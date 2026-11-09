import { approveFixture } from './fixtures/approval';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { applyActionCode, confirmPasswordReset, createUserWithEmailAndPassword, getIdToken, reload, sendEmailVerification, sendPasswordResetEmail, signInAnonymously, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { collection, doc, documentId, getDoc, getDocs, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import type { FarmerAccount, ProduceItem } from '../src/types/agriculture';
import { certificateFixture } from './fixtures/certificates';

Object.assign(process.env, { VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-traingot.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'demo-traingot', VITE_FIREBASE_APP_ID: 'demo-app', VITE_USE_FIREBASE_EMULATORS: 'true', DEV: 'true' });
const { auth, db } = await import('../src/lib/firebase');
const { saveFarmer: submitFarmer, saveProduce, addProductLog, placeOrders, changeOrderStatus, saveTaskStatus } = await import('../src/services/farmStore');
const { getSynchronizedTasksForFarmer } = await import('../src/utils/cultivationSync');
let env: RulesTestEnvironment;
async function saveFarmer(value: FarmerAccount) { await submitFarmer(value); await approveFixture(env, value.id); }
const password = 'Emulator-only-password-123';
const buyer = { name: 'Khách kiểm thử', phone: '0901111222', address: 'Địa chỉ nhận hàng kiểm thử Chũ' };
const location = { lat: 21.3653, lng: 106.5925, address: 'Vườn kiểm thử Chũ', commune: 'Chũ', altitudeM: 95, soilType: 'Đất đồi', waterSource: 'Giếng' };
type Account = { uid: string; email: string; farmer: FarmerAccount };

async function actionCode(email: string, requestType: string) {
  const response = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-traingot/oobCodes');
  assert.equal(response.ok, true);
  const result = await response.json() as { oobCodes: Array<{ email: string; requestType: string; oobCode: string }> };
  const code = result.oobCodes.findLast((item) => item.email === email && item.requestType === requestType)?.oobCode;
  assert.ok(code, `Missing ${requestType} email in Auth Emulator`);
  return code;
}

async function register(verified = true): Promise<Account> {
  const email = `qa-${crypto.randomUUID()}@example.test`;
  const { user } = await createUserWithEmailAndPassword(auth!, email, password);
  await updateProfile(user, { displayName: 'Nhà vườn kiểm thử' });
  const farmer: FarmerAccount = { id: user.uid, name: 'Nhà vườn kiểm thử', avatar: '', location: location.address, shortLocation: 'Chũ', commune: 'Chũ', role: 'Chủ vườn', cropFocus: 'Vải', areaHa: 2, treeCount: 100, phone: '0901234567', pucCode: '', certification: 'Chưa chứng nhận', gardenLocation: location };
  // Same registration payload as AuthModal, including the unverified account stage.
  const { gardenLocation: _location, ...initialProfile } = farmer;
  await setDoc(doc(db!, 'farmerApplications', user.uid), { id: user.uid, email, profile: { ...initialProfile, location: '' }, status: 'draft', revision: 1, submittedAt: 0, reviewedAt: 0, reviewedBy: '', reviewNote: '' });
  if (verified) {
    await sendEmailVerification(user);
    await applyActionCode(auth!, await actionCode(email, 'VERIFY_EMAIL'));
    await reload(user); await getIdToken(user, true);
    await saveFarmer(farmer);
  }
  return { uid: user.uid, email, farmer };
}

function product(account: Account): ProduceItem {
  return { id: crypto.randomUUID(), ownerId: account.uid, name: 'Vải kiểm thử', category: 'lychee', price: 65000, unit: 'kg', inStock: 10, image: '', origin: location.address, farmer: account.farmer.name, farmerPhone: account.farmer.phone, rating: 0, reviewCount: 0, certifications: [], harvestSeason: 'Tháng 6', description: 'Chỉ sử dụng trong Firebase Emulator', vietgapCode: '', location,
    farmerProfile: { name: account.farmer.name, avatar: '', role: 'Chủ vườn', phone: account.farmer.phone, zalo: account.farmer.phone, address: location.address, experienceYears: 0, orchardAreaHa: 2, treeCount: 100, bio: '', achievements: [], commitment: '', certificates: [] }, cultivationLog: { watering: [], fertilizing: [], pestProtection: [], general: [] } };
}
async function stored(id: string) { return (await getDoc(doc(db!, 'products', id))).data() as ProduceItem; }
async function login(account: Account) { await signInWithEmailAndPassword(auth!, account.email, password); }
function observe(database: any, path: string, predicate: (data: any) => boolean) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error(`Realtime timeout: ${path}`)); }, 8000);
    const stop = onSnapshot(doc(database, path), (snap) => { if (predicate(snap.data())) { clearTimeout(timer); stop(); resolve(); } }, (error) => { clearTimeout(timer); reject(error); });
  });
}

before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-traingot', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => { await signOut(auth!); await env.clearFirestore(); });
after(async () => { await signOut(auth!); await env.cleanup(); const { deleteApp } = await import('firebase/app'); await deleteApp(auth!.app); });

test('email account registration, duplicate email, verification link, logout and login', async () => {
  const account = await register(false);
  assert.equal(auth!.currentUser!.emailVerified, false);
  await assert.rejects(saveFarmer(account.farmer), /xác minh/);
  await assert.rejects(createUserWithEmailAndPassword(auth!, account.email, password), { code: 'auth/email-already-in-use' });
  await sendEmailVerification(auth!.currentUser!);
  await applyActionCode(auth!, await actionCode(account.email, 'VERIFY_EMAIL'));
  await reload(auth!.currentUser!); await getIdToken(auth!.currentUser!, true);
  await saveFarmer(account.farmer);
  const profile = (await getDoc(doc(env.unauthenticatedContext().firestore(), 'farmers', account.uid))).data()!;
  assert.equal(profile.name, account.farmer.name);
  assert.equal('email' in profile || 'password' in profile, false);
  await signOut(auth!);
  assert.equal(auth!.currentUser, null);
  await assert.rejects(signInWithEmailAndPassword(auth!, account.email, 'wrong-password'));
  await login(account);
  assert.equal(auth!.currentUser!.uid, account.uid);
  assert.equal(auth!.currentUser!.emailVerified, true);
});

test('password reset email and action code change the Auth password without writing Firestore', async () => {
  const account = await register();
  await signOut(auth!);
  await sendPasswordResetEmail(auth!, account.email);
  const code = await actionCode(account.email, 'PASSWORD_RESET');
  const nextPassword = 'Emulator-reset-only-456';
  await confirmPasswordReset(auth!, code, nextPassword);
  await assert.rejects(login(account));
  await signInWithEmailAndPassword(auth!, account.email, nextPassword);
  assert.equal(auth!.currentUser!.uid, account.uid);
  await assert.rejects(confirmPasswordReset(auth!, code, nextPassword));
  assert.equal(JSON.stringify((await getDoc(doc(db!, 'farmers', account.uid))).data()).includes(nextPassword), false);
});

test('garden edits reach another session and invalid coordinates never overwrite the saved location', async () => {
  const account = await register();
  const publicDb = env.unauthenticatedContext().firestore();
  const observed = observe(publicDb, `farmers/${account.uid}`, (value) => value?.gardenLocation.lat === 21.6 && value?.phone === '0907777888');
  await saveFarmer({ ...account.farmer, phone: '0907777888', bio: 'Hồ sơ mới', gardenLocation: { ...location, lat: 21.6, lng: 106.7 } });
  await observed;
  await assert.rejects(saveFarmer({ ...account.farmer, gardenLocation: { ...location, lat: 91 } }), /tọa độ/);
  await assert.rejects(saveFarmer({ ...account.farmer, treeCount: -1 }), /gốc cây/);
  assert.equal((await getDoc(doc(publicDb, 'farmers', account.uid))).data()!.gardenLocation.lat, 21.6);
});

test('publish, edit and public product stream; another farmer cannot edit the listing', async () => {
  const owner = await register(); const item = product(owner);
  const observed = observe(env.unauthenticatedContext().firestore(), `products/${item.id}`, (value) => value?.price === 70000);
  await saveProduce(item, true);
  await assert.rejects(saveProduce(item, true), /đã tồn tại/);
  await saveProduce({ ...await stored(item.id), name: 'Vải loại 1', price: 70000, description: 'Mô tả cập nhật' });
  await observed;
  const current = await stored(item.id);
  assert.equal(current.name, 'Vải loại 1');
  assert.equal(current.description, 'Mô tả cập nhật');
  await register();
  await assert.rejects(saveProduce({ ...current, price: 1 }), /quyền sửa/);
  await assert.rejects(addProductLog(item.id, 'general', { date: '27/10/2026', title: 'Giả mạo', instructions: '', materials: '' }), /Không tìm thấy/);
});

test('all four log categories survive edits and task completion is private and persistent', async () => {
  const owner = await register(); const item = product(owner); await saveProduce(item, true);
  await addProductLog(item.id, 'watering', { date: '27/10/2026', method: 'Nhỏ giọt', amountLiters: '20 lít', waterSource: 'Giếng', note: 'Sáng' });
  await addProductLog(item.id, 'fertilizing', { date: '27/10/2026', fertilizerName: 'Phân hữu cơ', dosage: '1 kg', stage: 'Sau thu hoạch', organicCertified: false, note: 'Theo hướng dẫn' });
  await addProductLog(item.id, 'pest', { date: '27/10/2026', productUsed: 'Sản phẩm thử', targetPest: 'Sâu', isolationDaysBeforeHarvest: 7 });
  await addProductLog(item.id, 'general', { date: '27/10/2026', title: 'Tỉa cành', instructions: 'Cắt cành khô', materials: 'Kéo' });
  const current = await stored(item.id);
  const groups = Object.values(current.cultivationLog);
  assert.deepEqual(groups.map((group) => group.length), [1, 1, 1, 1]);
  assert.equal(new Set(groups.flat().map((log) => log.id)).size, 4);
  assert.equal(current.cultivationLog.pestProtection[0].safetyVerified, false);
  await saveProduce({ ...current, description: 'Chỉnh nội dung, giữ nhật ký' });
  assert.deepEqual((await stored(item.id)).cultivationLog, current.cultivationLog);
  const tasks = getSynchronizedTasksForFarmer(owner.farmer, [current]);
  assert.equal(tasks.length, 4);
  await saveTaskStatus(owner.uid, tasks[0].id, true);
  assert.equal((await getDoc(doc(db!, 'farmers', owner.uid, 'tasks', tasks[0].id))).data()!.completed, true);
  await assert.rejects(getDoc(doc(env.unauthenticatedContext().firestore(), 'farmers', owner.uid, 'tasks', tasks[0].id)));
  await signOut(auth!); await login(owner);
  assert.equal((await getDoc(doc(db!, 'farmers', owner.uid, 'tasks', tasks[0].id))).data()!.completed, true);
});

test('invalid cart, stale price, missing product and insufficient stock leave no partial orders', async () => {
  const owner = await register(); const item = product(owner); await saveProduce(item, true);
  await signOut(auth!);
  const attempt = (quantity: number) => placeOrders([{ item, quantity }], buyer, crypto.randomUUID());
  for (const quantity of [0, -1, 1.5, 11]) await assert.rejects(attempt(quantity), /số lượng/);
  await assert.rejects(placeOrders([{ item: { ...item, price: 1 }, quantity: 1 }], buyer, crypto.randomUUID()), /Giá/);
  await assert.rejects(placeOrders([{ item, quantity: 1 }, { item: { ...item, id: 'missing' }, quantity: 1 }], buyer, crypto.randomUUID()), /đã được gỡ/);
  await assert.rejects(placeOrders([{ item, quantity: 1 }, { item, quantity: 1 }], buyer, crypto.randomUUID()), /tối đa/);
  await assert.rejects(placeOrders(Array.from({ length: 6 }, (_, index) => ({ item: { ...item, id: `p${index}` }, quantity: 1 })), buyer, crypto.randomUUID()), /tối đa/);
  await assert.rejects(placeOrders([{ item, quantity: 1 }], { ...buyer, phone: 'bad' }, crypto.randomUUID()), /điện thoại/);
  assert.equal((await stored(item.id)).inStock, 10);
  const orders = await getDocs(query(collection(db!, 'orders'), where('buyerId', '==', auth!.currentUser!.uid)));
  assert.equal(orders.size, 0);
});

test('multi-seller checkout separates private orders and delivers through all statuses in realtime', async () => {
  const first = await register(); const a = product(first); await saveProduce(a, true);
  const second = await register(); const b = product(second); await saveProduce(b, true);
  await signOut(auth!);
  const ids = await placeOrders([{ item: a, quantity: 2 }, { item: b, quantity: 3 }], buyer, crypto.randomUUID());
  const buyerId = auth!.currentUser!.uid;
  const buyerDb = env.authenticatedContext(buyerId, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  assert.equal((await getDocs(query(collection(buyerDb, 'orders'), where('buyerId', '==', buyerId)))).size, 2);
  await login(first);
  assert.equal((await getDocs(query(collection(db!, 'orders'), where('sellerId', '==', first.uid)))).size, 1);
  await assert.rejects(getDoc(doc(db!, 'orders', ids[1])));
  for (const status of ['confirmed', 'packing', 'shipping', 'completed'] as const) {
    const observed = observe(buyerDb, `orders/${ids[0]}`, (value) => value?.status === status);
    await changeOrderStatus(ids[0], status, 'Ghi chú kiểm thử'); await observed;
  }
  assert.equal((await stored(a.id)).inStock, 8);
  await assert.rejects(changeOrderStatus(ids[0], 'cancelled', ''), /Không thể chuyển/);
  await login(second);
  await changeOrderStatus(ids[1], 'cancelled', 'Hủy đơn thử');
  assert.equal((await stored(b.id)).inStock, 10);
  assert.equal((await getDoc(doc(buyerDb, 'orders', ids[0]))).data()!.sellerNote, 'Ghi chú kiểm thử');
});

test('a new anonymous identity cannot read orders from an earlier guest session', async () => {
  const owner = await register(); const item = product(owner); await saveProduce(item, true);
  await signOut(auth!);
  const [id] = await placeOrders([{ item, quantity: 1 }], buyer, crypto.randomUUID());
  const oldBuyerId = auth!.currentUser!.uid;
  await signOut(auth!); await signInAnonymously(auth!);
  assert.notEqual(auth!.currentUser!.uid, oldBuyerId);
  await assert.rejects(getDoc(doc(db!, 'orders', id)));
});

test('certificate declarations sync to product/QR profiles; edits never copy stale proofs into products', async () => {
  const account = await register(); const item = product(account); await saveProduce(item, true);
  const { withFarmer } = await import('../src/hooks/useFarmData');
  const certificates = [certificateFixture(), certificateFixture({ id: 'cert-2', type: 'GlobalGAP', expiryDate: '', documentImage: '' }), certificateFixture({ id: 'cert-3', type: 'OCOP', ocopStars: 4 })];
  const publicDb = env.unauthenticatedContext().firestore();
  async function ownerProfile() {
    const profile = (await getDoc(doc(publicDb, 'farmers', account.uid))).data() as FarmerAccount;
    const ids = profile.certificateIds || [];
    const documents = ids.length ? await getDocs(query(collection(publicDb, 'farmers', account.uid, 'certificates'), where(documentId(), 'in', ids))) : null;
    const byId = new Map(documents?.docs.map((snapshot) => [snapshot.id, snapshot.data()]) || []);
    return { ...profile, certificates: ids.map((id) => byId.get(id)) } as FarmerAccount;
  }
  const observed = observe(publicDb, `farmers/${account.uid}`, (value) => value?.certificateIds?.length === 3);
  await saveFarmer({ ...account.farmer, certificates }); await observed;
  const declared = await ownerProfile();
  const hydrated = withFarmer(await stored(item.id), declared);
  assert.equal(hydrated.farmerProfile.certificates.length, 3);
  await saveProduce({ ...hydrated, price: 70000 });
  assert.deepEqual((await stored(item.id)).farmerProfile.certificates, []);
  await saveFarmer({ ...declared, certificates: [{ ...certificates[0], certificateNumber: 'UPDATED-2026' }] });
  await assert.rejects(saveProduce(hydrated), /chứng nhận vừa thay đổi/);
  const latest = await ownerProfile();
  assert.equal(withFarmer(await stored(item.id), latest).farmerProfile.certificates[0].certificateNumber, 'UPDATED-2026');
  await saveFarmer({ ...latest, certificates: [] });
  const removed = await ownerProfile();
  assert.deepEqual(withFarmer(await stored(item.id), removed).farmerProfile.certificates, []);
});
