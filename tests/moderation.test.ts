import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, type RulesTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { createUserWithEmailAndPassword, getIdToken, reload, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import type { FarmerAccount, ProduceItem } from '../src/types/agriculture';
import { certificateFixture } from './fixtures/certificates';

Object.assign(process.env, { VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-traingot.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'demo-traingot', VITE_FIREBASE_APP_ID: 'demo-app', VITE_USE_FIREBASE_EMULATORS: 'true', DEV: 'true' });
const { auth, db } = await import('../src/lib/firebase');
const { saveFarmer, saveProduce, addProductLog, placeOrders, changeOrderStatus } = await import('../src/services/farmStore');
const { reviewFarmerApplication } = await import('../src/services/moderation');
const { changeFarmerAccountStatus } = await import('../src/services/accountModeration');
const password = 'Moderation-Emulator-only-2026';
let env: RulesTestEnvironment;
const location = { lat: 21.3, lng: 106.6, address: 'Vườn thử nghiệm', commune: 'Chũ', altitudeM: 90, soilType: 'Đất đồi', waterSource: 'Giếng' };
async function account(admin = false) {
  const email = `${crypto.randomUUID()}@example.test`;
  const { user } = await createUserWithEmailAndPassword(auth!, email, password);
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: user.uid, emailVerified: true, ...(admin ? { customAttributes: JSON.stringify({ admin: true }) } : {}) }) });
  assert.equal(response.ok, true); await reload(user); await getIdToken(user, true);
  const profile: FarmerAccount = { id: user.uid, name: 'Nhà vườn chờ duyệt', avatar: '', location: location.address, shortLocation: 'Chũ', commune: 'Chũ', role: 'Chủ vườn', cropFocus: 'Vải', areaHa: 1, treeCount: 50, phone: '0901234567', pucCode: '', certification: 'Chưa chứng nhận', gardenLocation: location };
  return { uid: user.uid, email, profile };
}
type Account = Awaited<ReturnType<typeof account>>;
async function login(user: Account) { await signInWithEmailAndPassword(auth!, user.email, password); }
async function application(uid: string) { return (await getDoc(doc(db!, 'farmerApplications', uid))).data()!; }
function product(owner: Account): ProduceItem {
  return { id: crypto.randomUUID(), ownerId: owner.uid, name: 'Vải cần quyền đăng', category: 'lychee', price: 50000, unit: 'kg', inStock: 10, image: '', origin: location.address, farmer: owner.profile.name, farmerPhone: owner.profile.phone, rating: 0, reviewCount: 0, certifications: [], harvestSeason: '', description: 'Chỉ dùng trong Emulator', vietgapCode: '', location,
    farmerProfile: { name: owner.profile.name, avatar: '', role: 'Chủ vườn', phone: owner.profile.phone, zalo: '', address: location.address, experienceYears: 0, orchardAreaHa: 1, treeCount: 50, bio: '', achievements: [], commitment: '', certificates: [] }, cultivationLog: { watering: [], fertilizing: [], pestProtection: [], general: [] } };
}
async function approve(owner: Account) {
  const reviewer = await account(true);
  const revision = (await application(owner.uid)).revision;
  await reviewFarmerApplication(owner.uid, revision, 'approved', 'Đã kiểm tra hồ sơ thử');
  await login(owner); return reviewer;
}
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-traingot', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => { await signOut(auth!); await env.clearFirestore(); });
after(async () => { await signOut(auth!); await env.cleanup(); const { deleteApp } = await import('firebase/app'); await deleteApp(auth!.app); });

test('verified pending farmer is private and cannot bypass approval, publish, or grant an admin role', async () => {
  const owner = await account(); await saveFarmer({ ...owner.profile, certificates: [certificateFixture()] });
  assert.equal((await application(owner.uid)).status, 'pending');
  assert.equal((await getDoc(doc(db!, 'farmers', owner.uid))).exists(), false);
  const publicDb = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(publicDb, 'farmerApplications', owner.uid)));
  await assertFails(getDocs(collection(publicDb, 'farmerApplications')));
  await assertFails(getDoc(doc(publicDb, 'farmerApplications', owner.uid, 'certificates', 'certificate-test-1')));
  const other = env.authenticatedContext('other', { email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  await assertFails(getDoc(doc(other, 'farmerApplications', owner.uid)));
  await assert.rejects(saveProduce(product(owner), true), /quản trị duyệt/);
  await assertFails(updateDoc(doc(db!, 'farmerApplications', owner.uid), { status: 'approved', reviewedBy: owner.uid }));
  await assertFails(updateDoc(doc(db!, 'farmerApplications', owner.uid), { admin: true }));
  await assertFails(setDoc(doc(db!, 'farmers', owner.uid), owner.profile));
  await assertFails(setDoc(doc(db!, 'products', 'bypass'), { ...product(owner), id: 'bypass', createdAt: 1, updatedAt: 1 }));
  await assertFails(setDoc(doc(db!, 'posts', 'bypass'), { id: 'bypass', ownerId: owner.uid, author: owner.profile.name, content: 'Không được công khai', image: '', createdAt: 1 }));
  await assert.rejects(reviewFarmerApplication(owner.uid, 1, 'approved', ''), /không có quyền/);
});

test('real admin claim approves six proofs atomically, records immutable audit, and unlocks publishing', async () => {
  const owner = await account();
  const certificates = ['VietGAP','GlobalGAP','OCOP','Hữu cơ','An toàn thực phẩm','Khác'].map((type, i) => certificateFixture({ id: `proof-${i}`, type: type as any, ...(type === 'OCOP' ? { ocopStars: 4 as const } : {}) }));
  await saveFarmer({ ...owner.profile, certificates });
  const reviewer = await approve(owner);
  assert.equal((await application(owner.uid)).status, 'approved');
  assert.equal((await getDoc(doc(db!, 'farmers', owner.uid))).data()!.certificateIds.length, 6);
  const history = await getDocs(collection(db!, 'farmerApplications', owner.uid, 'reviews'));
  assert.equal(history.size, 1); assert.equal(history.docs[0].data().reviewerId, reviewer.uid);
  await assertFails(updateDoc(history.docs[0].ref, { note: 'rewrite' }));
  const item = product(owner); await saveProduce(item, true);
  await addProductLog(item.id, 'general', { date: '28/10/2026', title: 'Tỉa cành đã được mở quyền' });
  await setDoc(doc(db!, 'posts', 'allowed'), { id: 'allowed', ownerId: owner.uid, author: owner.profile.name, content: 'Được phép chia sẻ', image: '', createdAt: 1 });
});

test('editing an approved profile stages private changes and blocks new posts until a second review', async () => {
  const owner = await account(); await saveFarmer(owner.profile); const reviewer = await approve(owner);
  const item = product(owner); await saveProduce(item, true);
  await saveFarmer({ ...owner.profile, name: 'Tên mới chờ duyệt', certificates: [certificateFixture()] });
  assert.equal((await application(owner.uid)).status, 'pending');
  assert.equal((await getDoc(doc(db!, 'farmers', owner.uid))).data()!.name, owner.profile.name);
  await assert.rejects(addProductLog(item.id, 'general', { date: '28/10/2026', title: 'Chặn trước duyệt lại' }), /quản trị duyệt/);
  await assert.rejects(saveProduce(product(owner), true), /quản trị duyệt/);
  await login(reviewer); await reviewFarmerApplication(owner.uid, 2, 'approved', 'Đã kiểm tra bản sửa');
  await login(owner);
  assert.equal((await getDoc(doc(db!, 'farmers', owner.uid))).data()!.name, 'Tên mới chờ duyệt');
  await saveProduce(product(owner), true);
});

test('admin cannot approve an unseen revision; rejection needs a reason and farmer resubmits a new revision', async () => {
  const owner = await account(); await saveFarmer(owner.profile); const reviewer = await account(true);
  await login(owner); await saveFarmer({ ...owner.profile, bio: 'Nội dung mới' });
  await login(reviewer);
  await assert.rejects(reviewFarmerApplication(owner.uid, 1, 'approved', ''), /vừa thay đổi/);
  await assert.rejects(reviewFarmerApplication(owner.uid, 2, 'rejected', ' '), /lý do/);
  await reviewFarmerApplication(owner.uid, 2, 'rejected', 'Bổ sung ảnh vườn và số điện thoại');
  await login(owner);
  assert.match((await application(owner.uid)).reviewNote, /Bổ sung/);
  await saveFarmer({ ...owner.profile, bio: 'Đã bổ sung' });
  assert.equal((await application(owner.uid)).revision, 3);
  await login(reviewer); await reviewFarmerApplication(owner.uid, 3, 'approved', '');
});

test('suspension blocks publication but preserves cancellation and stock restoration for an existing order', async () => {
  const owner = await account(); await saveFarmer(owner.profile); const reviewer = await approve(owner);
  const item = product(owner); await saveProduce(item, true);
  const [id] = await placeOrders([{ item, quantity: 2 }], { name: 'Khách thử', phone: '0901111222', address: 'Địa chỉ giao thử nghiệm' }, crypto.randomUUID());
  await login(reviewer); await reviewFarmerApplication(owner.uid, 1, 'suspended', 'Cần kiểm tra lại hồ sơ');
  await login(owner);
  await assert.rejects(saveFarmer(owner.profile), /bị khóa/);
  await assert.rejects(saveProduce(product(owner), true), /quản trị duyệt/);
  await changeOrderStatus(id, 'cancelled', 'Xử lý đơn đã có');
  assert.equal((await getDoc(doc(db!, 'products', item.id))).data()!.inStock, 10);
  await login(reviewer); await reviewFarmerApplication(owner.uid, 1, 'rejected', 'Cho phép bổ sung lại');
  await login(owner); await saveFarmer(owner.profile);
  assert.equal((await application(owner.uid)).status, 'pending');
});

test('submitted proofs cannot be silently changed without a new parent revision', async () => {
  const owner = await account(); const certificate = certificateFixture(); await saveFarmer({ ...owner.profile, certificates: [certificate] });
  const proof = doc(db!, 'farmerApplications', owner.uid, 'certificates', certificate.id);
  await assertFails(updateDoc(proof, { certificateNumber: 'SILENT' }));
  const current = await application(owner.uid);
  const batch = writeBatch(db!); batch.set(doc(db!, 'farmerApplications', owner.uid), { ...current, revision: 2 }); batch.set(proof, { ...certificate, verified: true });
  await assertFails(batch.commit());
  assert.equal((await application(owner.uid)).revision, 1);
});

test('legacy public profiles require review before any further publishing; new submissions do not overwrite public data', async () => {
  const owner = await account();
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore(), 'farmers', owner.uid), owner.profile); });
  await assert.rejects(saveProduce(product(owner), true), /quản trị duyệt/);
  await saveFarmer({ ...owner.profile, name: 'Bản đăng ký xét duyệt' });
  assert.equal((await getDoc(doc(db!, 'farmers', owner.uid))).data()!.name, owner.profile.name);
  assert.equal((await application(owner.uid)).status, 'pending');
});

test('unverified admin tokens and ordinary accounts cannot list applications or forge reviewer history', async () => {
  const owner = await account(); await saveFarmer(owner.profile);
  await assertFails(getDocs(collection(db!, 'farmerApplications')));
  const unverifiedAdmin = env.authenticatedContext('fake-admin', { admin: true, email_verified: false, firebase: { sign_in_provider: 'password' } }).firestore();
  await assertFails(getDocs(collection(unverifiedAdmin, 'farmerApplications')));
  await assertFails(setDoc(doc(db!, 'farmerApplications', owner.uid, 'reviews', '1-approved'), { revision: 1, decision: 'approved', reviewerId: owner.uid, reviewedAt: 1, note: '' }));
});

test('account suspension blocks publication and checkout atomically; only admin can restore without overwriting old orders', async () => {
  const owner = await account(); await saveFarmer(owner.profile); const reviewer = await approve(owner);
  const item = product(owner); await saveProduce(item, true);
  const [oldOrder] = await placeOrders([{ item, quantity: 1 }], { name: 'Khách thử', phone: '0901111222', address: 'Địa chỉ đơn cũ cần giữ' }, crypto.randomUUID());
  const oldOrderData = (await getDoc(doc(db!, 'orders', oldOrder))).data()!;
  await login(reviewer);
  await changeFarmerAccountStatus(owner.uid, 1, 0, 'suspended', 'Vi phạm chính sách bán hàng');
  assert.equal((await getDoc(doc(db!, 'farmerAccountStates', owner.uid))).data()!.status, 'suspended');
  await login(owner);
  await assert.rejects(saveFarmer(owner.profile), /tạm dừng/);
  await assert.rejects(saveProduce(item), /tạm dừng/);
  await assert.rejects(addProductLog(item.id, 'general', { date: '30/10/2026', title: 'Không được ghi' }), /tạm dừng/);
  await assert.rejects(changeOrderStatus(oldOrder, 'cancelled', ''), /tạm dừng/);
  await assert.rejects(changeFarmerAccountStatus(owner.uid, 1, 1, 'active', 'Tự mở lại'), /tạm dừng/);
  await assertFails(updateDoc(doc(db!, 'farmerAccountStates', owner.uid), { status: 'active', version: 2 }));
  await assertFails(setDoc(doc(db!, 'posts', 'blocked-post'), { id: 'blocked-post', ownerId: owner.uid, author: owner.profile.name, content: 'Bị chặn', image: '', createdAt: 1 }));
  const buyer = await account();
  await assert.rejects(placeOrders([{ item, quantity: 1 }], { name: 'Khách mới', phone: '0901111222', address: 'Địa chỉ giao hàng mới' }, crypto.randomUUID()), /tạm dừng/);
  const checkoutId = crypto.randomUUID(); const newOrderId = `${checkoutId}_${item.id}`; const now = Date.now();
  const bypass = writeBatch(db!);
  bypass.set(doc(db!, 'orders', newOrderId), { ...oldOrderData, id: newOrderId, checkoutId, buyerId: buyer.uid, createdAt: now, updatedAt: now });
  bypass.update(doc(db!, 'products', item.id), { inStock: 8, lastOrderId: newOrderId, updatedAt: now });
  await assertFails(bypass.commit());
  assert.equal((await getDoc(doc(db!, 'products', item.id))).data()!.inStock, 9);
  const buyerOrders = await getDocs(query(collection(db!, 'orders'), where('buyerId', '==', buyer.uid)));
  assert.equal(buyerOrders.size, 0);
  await login(reviewer); await changeFarmerAccountStatus(owner.uid, 1, 1, 'active', 'Đã khắc phục vi phạm');
  await login(owner); await saveProduce((await getDoc(doc(db!, 'products', item.id))).data() as ProduceItem);
  assert.equal((await getDoc(doc(db!, 'orders', oldOrder))).data()!.status, 'pending');
  const audit = await getDocs(query(collection(db!, 'farmerAccountActions'), where('farmerId', '==', owner.uid)));
  assert.equal(audit.size, 2);
  await assertFails(updateDoc(audit.docs[0].ref, { note: 'Sửa lịch sử' }));
});

test('website deletion requires email and reason, preserves records, rejects stale actions and supports audited restoration', async () => {
  const owner = await account(); await saveFarmer(owner.profile); const reviewer = await approve(owner);
  const item = product(owner); await saveProduce(item, true);
  await login(reviewer);
  await assert.rejects(changeFarmerAccountStatus(owner.uid, 1, 0, 'deleted', ' ', owner.email), /lý do/);
  await assert.rejects(changeFarmerAccountStatus(owner.uid, 1, 0, 'deleted', 'Vi phạm', 'wrong@example.test'), /đúng email/);
  await changeFarmerAccountStatus(owner.uid, 1, 0, 'deleted', 'Vi phạm nhiều lần', owner.email);
  await assert.rejects(changeFarmerAccountStatus(owner.uid, 1, 0, 'active', 'Mở lại'), /vừa thay đổi/);
  assert.equal((await getDoc(doc(db!, 'products', item.id))).exists(), true);
  assert.equal((await getDoc(doc(db!, 'farmerApplications', owner.uid))).data()!.status, 'approved');
  await login(owner); await assert.rejects(saveProduce(item), /xóa khỏi website/);
  await login(reviewer); await changeFarmerAccountStatus(owner.uid, 1, 1, 'active', 'Quản trị khôi phục');
  await login(owner); await saveProduce((await getDoc(doc(db!, 'products', item.id))).data() as ProduceItem);
});

test('ordinary and unverified accounts cannot moderate, forge logs, or read another farmer policy history', async () => {
  const owner = await account(); await saveFarmer(owner.profile); const reviewer = await approve(owner);
  await assert.rejects(changeFarmerAccountStatus(owner.uid, 1, 0, 'suspended', 'Tự xử lý'), /không có quyền/);
  await login(reviewer); await assert.rejects(changeFarmerAccountStatus(reviewer.uid, 1, 0, 'suspended', 'Tự khóa'), /quản trị đang sử dụng/);
  const state = { id: owner.uid, status: 'suspended', version: 1, updatedAt: 1, lastActionId: 'abcdefghijklmnopqrst' };
  await assertFails(setDoc(doc(db!, 'farmerAccountStates', owner.uid), state));
  await changeFarmerAccountStatus(owner.uid, 1, 0, 'suspended', 'Lý do riêng cho hồ sơ');
  const actions = await getDocs(collection(db!, 'farmerAccountActions'));
  const other = await account();
  await assertFails(getDocs(collection(db!, 'farmerAccountActions')));
  await assertFails(getDoc(doc(db!, 'farmerAccountActions', actions.docs[0].id)));
  await assertFails(setDoc(doc(db!, 'farmerAccountStates', owner.uid), { ...state, version: 2, status: 'active' }));
  const anonymous = env.unauthenticatedContext().firestore();
  const publicState = (await getDoc(doc(anonymous, 'farmerAccountStates', owner.uid))).data()!;
  assert.equal(publicState.status, 'suspended'); assert.equal('note' in publicState, false);
  const unverified = env.authenticatedContext(other.uid, { admin: true, email_verified: false, firebase: { sign_in_provider: 'password' } }).firestore();
  await assertFails(updateDoc(doc(unverified, 'farmerAccountStates', owner.uid), { status: 'active', version: 2 }));
});

test('verified buyers can still reserve five sellers in one atomic checkout with account moderation checks', async () => {
  const buyer = await account();
  const products = Array.from({ length: 5 }, (_, index) => ({ ...product(buyer), ownerId: `policy-seller-${index}`, createdAt: 1, updatedAt: 1 }));
  await env.withSecurityRulesDisabled(async (context) => {
    for (const item of products) await setDoc(doc(context.firestore(), 'products', item.id), item);
  });
  const orders = await placeOrders(products.map((item) => ({ item, quantity: 1 })), { name: 'Khách đã xác minh', phone: '0901111222', address: 'Địa chỉ đặt giỏ năm nhà vườn' }, crypto.randomUUID());
  assert.equal(orders.length, 5);
  for (const id of orders) assert.equal((await getDoc(doc(db!, 'orders', id))).data()!.buyerId, buyer.uid);
});
