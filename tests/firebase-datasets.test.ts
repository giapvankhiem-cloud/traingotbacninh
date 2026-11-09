import { approveFixture } from './fixtures/approval';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, getIdToken, reload, signInAnonymously, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, runTransaction, updateDoc, where, type Firestore } from 'firebase/firestore';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { FarmOrder, FarmerAccount, ProduceItem } from '../src/types/agriculture';
import { DATASET_SEED, buyers, categories, farmerDataset, invalidBuyers, invalidFarmers, invalidProducts, productDataset } from './fixtures/datasets';

Object.assign(process.env, { VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-traingot.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'demo-traingot', VITE_FIREBASE_APP_ID: 'demo-app', VITE_USE_FIREBASE_EMULATORS: 'true', DEV: 'true' });
const { auth, db } = await import('../src/lib/firebase');
assert.equal(auth!.app.options.projectId, 'demo-traingot', 'Never run dataset tests against production');
const { saveFarmer: submitFarmer, saveProduce, addProductLog, placeOrders, reserveOrders, changeOrderStatus } = await import('../src/services/farmStore');
const password = 'Dataset-Emulator-only-2026';
const runId = crypto.randomUUID();
let env: RulesTestEnvironment;
async function saveFarmer(value: FarmerAccount) { await submitFarmer(value); await approveFixture(env, value.id); }
const farmers: FarmerAccount[] = [];
const emails: string[] = [];
const catalog: ProduceItem[] = [];
const buyerIds = new Set<string>();
const productIds = new Set<string>();
const orderIds = new Set<string>();
const clientApps: FirebaseApp[] = [];
const clients: Array<{ db: Firestore; uid: string }> = [];
const checkouts: Array<{ buyerId: string; ids: string[] }> = [];
let concurrentAttempts = 0;
async function login(index = 0) {
  if (auth!.currentUser?.uid !== farmers[index].id) await signInWithEmailAndPassword(auth!, emails[index], password);
}
async function publish(item: ProduceItem) { await saveProduce(item, true); productIds.add(item.id); return (await getDoc(doc(db!, 'products', item.id))).data() as ProduceItem; }
async function read(id: string) { return (await getDoc(doc(db!, 'products', id))).data() as ProduceItem; }
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-traingot', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
});
after(async () => {
  mkdirSync('.tools', { recursive: true });
  writeFileSync('.tools/qa-datasets-summary.json', JSON.stringify({ seed: DATASET_SEED, project: 'demo-traingot', farmers: farmers.length, anonymousBuyers: buyerIds.size, baselineProducts: catalog.length, totalProductsCreated: productIds.size, ordersCreated: orderIds.size, multiSellerCheckouts: checkouts.length, concurrentAttempts, categories, productionWrites: 0 }, null, 2));
  await signOut(auth!); await Promise.all(clientApps.map((app) => deleteApp(app))); await env.cleanup(); await deleteApp(auth!.app);
});

// Each dataset uses real Auth Emulator accounts and the application's own services.
for (let index = 0; index < 24; index++) {
  test(`dataset farmer ${index + 1}: Unicode/profile boundaries and all six product categories`, async () => {
    const email = `dataset-${runId}-${index}@example.test`;
    const { user } = await createUserWithEmailAndPassword(auth!, email, password);
    // Fixture setup only. Email-link verification itself is covered by the workflow suite.
    const verified = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: user.uid, emailVerified: true }) });
    assert.equal(verified.ok, true); await reload(user); await getIdToken(user, true);
    const owner = farmerDataset(index, user.uid); await saveFarmer(owner); farmers.push(owner); emails.push(email);
    for (let category = 0; category < 6; category++) {
      const item = productDataset(owner, index, category);
      const stored = await publish(item); catalog.push(stored);
      assert.equal(stored.ownerId, owner.id); assert.equal(stored.category, categories[category]);
      assert.equal(stored.inStock, item.inStock); assert.equal(stored.price, item.price);
      assert.equal(stored.farmerProfile.name, owner.name);
    }
  });
}

test('catalog larger than 100 loads the next page without losing six older owned listings', async () => {
  await signOut(auth!);
  assert.equal((await getDocs(collection(db!, 'farmers'))).size, 24);
  const first = await getDocs(query(collection(db!, 'products'), orderBy('createdAt', 'desc'), limit(100)));
  const expanded = await getDocs(query(collection(db!, 'products'), orderBy('createdAt', 'desc'), limit(200)));
  assert.equal(first.size, 100); assert.equal(expanded.size, 144);
  assert.equal(new Set(expanded.docs.map((snap) => snap.id)).size, 144);
  const owned = await getDocs(query(collection(db!, 'products'), where('ownerId', '==', farmers[0].id)));
  assert.equal(owned.size, 6);
  assert.ok(owned.docs.some((snap) => !first.docs.some((current) => current.id === snap.id)));
});

for (const [label, mutate] of invalidFarmers) {
  test(`invalid farmer dataset: ${label} is rejected without changing the stored profile`, async () => {
    await login(); const ref = doc(db!, 'farmers', farmers[0].id); const original = (await getDoc(ref)).data();
    await assert.rejects(saveFarmer(mutate(farmers[0])));
    assert.deepEqual((await getDoc(ref)).data(), original);
  });
}
for (const [label, mutate] of invalidProducts) {
  test(`invalid product dataset: ${label} leaves no listing behind`, async () => {
    await login(); const item = mutate(productDataset(farmers[0], 0, 0, `bad-${crypto.randomUUID()}`));
    await assert.rejects(saveProduce(item, true));
    assert.equal((await getDoc(doc(db!, 'products', item.id))).exists(), false);
  });
}
for (const [label, buyer] of invalidBuyers) {
  test(`invalid buyer dataset: ${label} cannot create an order or reserve stock`, async () => {
    await login(); const item = catalog.find((item) => item.inStock === 250)!;
    const before = await read(item.id); const checkout = `invalid-${crypto.randomUUID()}`;
    await assert.rejects(placeOrders([{ item: before, quantity: 1 }], buyer, checkout));
    assert.equal((await read(item.id)).inStock, before.inStock);
    assert.equal((await getDoc(doc(db!, 'orders', `${checkout}_${item.id}`))).exists(), false);
  });
}

for (let index = 0; index < buyers.length; index++) {
  test(`buyer dataset ${index + 1}: ${index % 5 + 1} sellers, idempotent checkout, private orders and stock conservation`, async () => {
    const cart: Array<{ item: ProduceItem; quantity: number }> = [];
    for (let line = 0; line < index % 5 + 1; line++) {
      const ownerIndex = (index + line) % farmers.length; await login(ownerIndex);
      const item = await publish({ ...productDataset(farmers[ownerIndex], ownerIndex, (index + line) % 6, `checkout-${index}-${line}`), inStock: index === 11 ? 10000000 : 20 });
      cart.push({ item, quantity: index === 11 ? 10000000 : line + 1 });
    }
    await signOut(auth!); const checkoutId = `basket-${runId}-${index}`;
    const ids = await placeOrders(cart, buyers[index], checkoutId); const uid = auth!.currentUser!.uid; buyerIds.add(uid);
    assert.equal(auth!.currentUser!.isAnonymous, true); assert.equal(ids.length, cart.length);
    assert.deepEqual(await placeOrders(cart, buyers[index], checkoutId), ids);
    const buyerDb = env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    checkouts.push({ buyerId: uid, ids });
    for (let line = 0; line < ids.length; line++) {
      const id = ids[line]; orderIds.add(id); const order = (await getDoc(doc(buyerDb, 'orders', id))).data() as FarmOrder;
      assert.equal(order.sellerId, cart[line].item.ownerId); assert.equal(order.total, cart[line].item.price * cart[line].quantity);
      assert.deepEqual(order.buyer, Object.fromEntries(Object.entries(buyers[index]).map(([key, value]) => [key, value.trim()])));
      const ownerIndex = (index + line) % farmers.length; await login(ownerIndex);
      const cancel = index % 4;
      const statuses = cancel === 0 ? ['cancelled'] : cancel === 1 ? ['confirmed', 'cancelled'] : cancel === 2 ? ['confirmed', 'packing', 'cancelled'] : ['confirmed', 'packing', 'shipping', 'completed'];
      for (const status of statuses) await changeOrderStatus(id, status as FarmOrder['status'], `Ghi chú chủ vườn ${index}/${line}`);
      const expectedStock = cancel === 3 ? cart[line].item.inStock - cart[line].quantity : cart[line].item.inStock;
      assert.equal((await read(cart[line].item.id)).inStock, expectedStock);
      assert.equal((await getDoc(doc(buyerDb, 'orders', id))).data()!.status, statuses.at(-1));
      await assert.rejects(changeOrderStatus(id, 'confirmed', 'Không mở lại đơn'));
    }
  });
}

test('24 sellers and 12 buyers cannot read each other’s private order details', async () => {
  for (let index = 0; index < farmers.length; index++) {
    await login(index);
    const own = await getDocs(query(collection(db!, 'orders'), where('sellerId', '==', farmers[index].id)));
    own.docs.forEach((snap) => assert.equal(snap.data().sellerId, farmers[index].id));
    const foreign = [...orderIds].find((id) => !own.docs.some((snap) => snap.id === id))!;
    await assert.rejects(getDoc(doc(db!, 'orders', foreign)));
  }
  for (let index = 0; index < checkouts.length; index++) {
    const current = checkouts[index];
    const buyerDb = env.authenticatedContext(current.buyerId, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    assert.equal((await getDocs(query(collection(buyerDb, 'orders'), where('buyerId', '==', current.buyerId)))).size, current.ids.length);
    await assert.rejects(getDoc(doc(buyerDb, 'orders', checkouts[(index + 1) % checkouts.length].ids[0])));
  }
});

async function independentBuyers() {
  if (clients.length) return clients;
  for (let index = 0; index < 12; index++) {
    const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-traingot', appId: 'demo-app' }, `load-${runId}-${index}`); clientApps.push(app);
    const clientAuth = getAuth(app); connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const clientDb = getFirestore(app); connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);
    const { user } = await signInAnonymously(clientAuth); buyerIds.add(user.uid); clients.push({ db: clientDb, uid: user.uid });
  }
  return clients;
}
async function concurrentCheckout(client: { db: Firestore; uid: string }, item: ProduceItem, quantity: number, checkout: string) {
  const [id] = await reserveOrders(client.db, client.uid, [{ item, quantity }], buyers[0], checkout);
  return id;
}
for (const [stock, quantity] of [[7, 1], [20, 3], [25, 5]]) {
  test(`12 concurrent real anonymous accounts: stock ${stock}, quantity ${quantity}, no overselling or orphan orders`, { timeout: 60000 }, async () => {
    await login(); const item = await publish({ ...productDataset(farmers[0], 0, 0, `race-${stock}`), inStock: stock, price: 65000 });
    const independent = await independentBuyers(); concurrentAttempts += independent.length;
    const results = await Promise.allSettled(independent.map((client, index) => concurrentCheckout(client, item, quantity, `race-${stock}-${index}`)));
    const successes = results.filter((result) => result.status === 'fulfilled');
    const failures = results.filter((result) => result.status === 'rejected').map((result) => ({ code: result.reason.code, message: result.reason.message }));
    assert.equal(successes.length, Math.floor(stock / quantity), JSON.stringify({ stock, quantity, remaining: (await read(item.id)).inStock, failures }));
    for (const result of results) {
      if (result.status === 'fulfilled') orderIds.add(result.value);
      else assert.match(result.reason.message, /số lượng tồn kho không đủ/);
    }
    const orders = await getDocs(query(collection(db!, 'orders'), where('sellerId', '==', farmers[0].id)));
    const matching = orders.docs.map((snap) => snap.data()).filter((order) => order.productId === item.id);
    assert.equal(matching.length, successes.length);
    assert.equal((await read(item.id)).inStock + matching.reduce((sum, order) => sum + order.quantity, 0), stock);
    const winner = results.findIndex((result) => result.status === 'fulfilled');
    const id = await concurrentCheckout(independent[winner], item, quantity, `race-${stock}-${winner}`);
    assert.ok(orderIds.has(id)); assert.equal((await read(item.id)).inStock, stock % quantity);
    // Simultaneous cancellations must restore every reserved unit exactly once.
    const cancellations = await Promise.allSettled(successes.map((result) => changeOrderStatus(result.value, 'cancelled', 'Hủy đồng thời trong Emulator')));
    assert.equal(cancellations.filter((result) => result.status === 'fulfilled').length, successes.length,
      JSON.stringify(cancellations.filter((result) => result.status === 'rejected').map((result) => result.reason.message)));
    assert.equal((await read(item.id)).inStock, stock);
    for (const result of successes) assert.equal((await getDoc(doc(db!, 'orders', result.value))).data()!.status, 'cancelled');
  });
}

for (const type of ['watering', 'fertilizing', 'pest', 'general'] as const) {
  test(`log boundary dataset: ${type} accepts 500 records and rejects record 501`, async () => {
    await login();
    const log: any = type === 'watering' ? { date: '28/10/2026', method: 'Nhỏ giọt', amountLiters: '20', waterSource: 'Giếng', note: '' } : type === 'fertilizing' ? { date: '28/10/2026', fertilizerName: 'Phân thử', dosage: '1kg', stage: 'Sau thu hoạch', organicCertified: false, note: '' } : type === 'pest' ? { date: '28/10/2026', productUsed: 'Chế phẩm thử', targetPest: 'Sâu', isolationDaysBeforeHarvest: 7, isBiological: false, status: 'Đang cách ly', safetyVerified: false } : { date: '28/10/2026', title: 'Tỉa cành', instructions: 'Ghi chú', materials: 'Kéo' };
    const item = productDataset(farmers[0], 0, 0, `logs-${type}`); const key = type === 'pest' ? 'pestProtection' : type;
    item.cultivationLog[key] = Array.from({ length: 500 }, (_, index) => ({ ...log, id: `${type}-${index}` })) as any;
    await publish(item);
    await assert.rejects(addProductLog(item.id, type, log));
    // Direct writes must also be blocked, independently of service validation.
    await assert.rejects(updateDoc(doc(db!, 'products', item.id), { cultivationLog: { ...item.cultivationLog, [key]: [...item.cultivationLog[key]!, { ...log, id: 'direct-501' }] } }));
    assert.equal((await read(item.id)).cultivationLog[key]!.length, 500);
  });
}

test('large catalog: multiple public subscribers receive the changed product without changing another garden', async () => {
  await login(); const item = catalog[0]; const other = await read(catalog[6].id);
  const stops: Array<() => void> = [];
  try {
    const observed = Array.from({ length: 4 }, () => new Promise<void>((resolve, reject) => {
      const publicDb = env.unauthenticatedContext().firestore();
      const timer = setTimeout(() => reject(new Error('Dataset realtime timed out')), 8000);
      const stop = onSnapshot(doc(publicDb, 'products', item.id), (snap) => { if (snap.data()?.description === 'Cập nhật realtime trên 144 sản phẩm') { clearTimeout(timer); resolve(); } }, (error) => { clearTimeout(timer); reject(error); });
      stops.push(() => { clearTimeout(timer); stop(); });
    }));
    await saveProduce({ ...await read(item.id), description: 'Cập nhật realtime trên 144 sản phẩm' }); await Promise.all(observed);
    assert.deepEqual(await read(other.id), other);
  } finally { stops.forEach((stop) => stop()); }
});

for (const phone of ['--------', '(  )----', '+ + + + +']) {
  test(`rules dataset rejects a forged phone ${JSON.stringify(phone)} even in an atomic checkout`, async () => {
    await login(); const item = await publish({ ...productDataset(farmers[0], 0, 0, `phone-${crypto.randomUUID()}`), inStock: 2 });
    await assert.rejects(updateDoc(doc(db!, 'farmers', farmers[0].id), { phone }));
    const [client] = await independentBuyers(); const checkout = `phone-${crypto.randomUUID()}`; const id = `${checkout}_${item.id}`;
    await assert.rejects(runTransaction(client.db, async (tx) => {
      const productRef = doc(client.db, 'products', item.id); await tx.get(productRef);
      const now = Date.now();
      tx.set(doc(client.db, 'orders', id), { id, checkoutId: checkout, buyerId: client.uid, sellerId: item.ownerId, productId: item.id, productName: item.name, unit: item.unit, unitPrice: item.price, quantity: 1, total: item.price, buyer: { ...buyers[0], phone }, status: 'pending', sellerNote: '', createdAt: now, updatedAt: now });
      tx.update(productRef, { inStock: 1, lastOrderId: id, updatedAt: now });
    }));
    assert.equal((await read(item.id)).inStock, 2);
    assert.equal((await getDoc(doc(client.db, 'orders', id))).exists(), false);
    await assert.rejects(reserveOrders(client.db, 'forged-buyer-id', [{ item, quantity: 1 }], buyers[0], `forged-${crypto.randomUUID()}`));
    assert.equal((await read(item.id)).inStock, 2);
  });
}
