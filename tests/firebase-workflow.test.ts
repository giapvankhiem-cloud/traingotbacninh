import { approveFixture } from './fixtures/approval';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createUserWithEmailAndPassword, getIdToken, reload, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import type { FarmerAccount, ProduceItem } from '../src/types/agriculture';

process.env.VITE_FIREBASE_API_KEY = 'demo-key';
process.env.VITE_FIREBASE_AUTH_DOMAIN = 'demo-traingot.firebaseapp.com';
process.env.VITE_FIREBASE_PROJECT_ID = 'demo-traingot';
process.env.VITE_FIREBASE_APP_ID = 'demo-app';
process.env.VITE_USE_FIREBASE_EMULATORS = 'true';
process.env.DEV = 'true';
const { auth, db } = await import('../src/lib/firebase');
const { saveFarmer: submitFarmer, saveProduce, addProductLog, placeOrders, changeOrderStatus } = await import('../src/services/farmStore');
let env: RulesTestEnvironment;
async function saveFarmer(value: FarmerAccount) { await submitFarmer(value); await approveFixture(env, value.id); }
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-traingot', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
});
after(async () => { await signOut(auth!); await env.cleanup(); const { deleteApp } = await import('firebase/app'); await deleteApp(auth!.app); });

test('real app services: verified farmer saves garden, publishes fruit, accepts COD order and logs', async () => {
  const credential = await createUserWithEmailAndPassword(auth!, `farm-${crypto.randomUUID()}@example.test`, 'Emulator-only-password-123');
  const uid = credential.user.uid;
  const gardenLocation = { lat: 21.3653, lng: 106.5925, address: 'Khu vườn thử nghiệm Chũ', commune: 'Chũ', altitudeM: 95, soilType: 'Đất đồi', waterSource: 'Giếng' };
  const farmer: FarmerAccount = { id: uid, name: 'Nhà vườn kiểm thử', avatar: '', location: gardenLocation.address, shortLocation: 'Chũ', commune: 'Chũ', role: 'Chủ vườn', cropFocus: 'Vải', areaHa: 2, treeCount: 100, phone: '0901234567', pucCode: '', certification: 'Chưa chứng nhận', gardenLocation };
  await assert.rejects(saveFarmer(farmer), /xác minh/);
  const verified = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: uid, emailVerified: true }) });
  assert.equal(verified.ok, true);
  await reload(credential.user); await getIdToken(credential.user, true);
  await saveFarmer(farmer);
  const product: ProduceItem = { id: crypto.randomUUID(), ownerId: uid, name: 'Vải thử nghiệm', category: 'lychee', price: 65000, unit: 'kg', inStock: 10, image: '', origin: farmer.location, farmer: farmer.name, farmerPhone: farmer.phone, rating: 0, reviewCount: 0, certifications: [], harvestSeason: 'Tháng 6', description: 'Trái cây thử nghiệm trên emulator', vietgapCode: '', location: gardenLocation,
    farmerProfile: { name: farmer.name, avatar: '', role: farmer.role, phone: farmer.phone, zalo: farmer.phone, address: farmer.location, experienceYears: 0, orchardAreaHa: 2, treeCount: 100, bio: '', achievements: [], commitment: '', certificates: [] }, cultivationLog: { watering: [], fertilizing: [], pestProtection: [], general: [] } };
  await saveProduce(product, true);
  const stored = (await getDoc(doc(db!, 'products', product.id))).data() as ProduceItem;
  await addProductLog(product.id, 'watering', { date: '27/10/2026', method: 'Nhỏ giọt', amountLiters: '20 lít', waterSource: 'Giếng', note: 'Thử nghiệm' });
  const logged = (await getDoc(doc(db!, 'products', product.id))).data() as ProduceItem;
  assert.equal(logged.cultivationLog.watering.length, 1);
  assert.ok(logged.cultivationLog.watering[0].id);
  await assert.rejects(saveProduce({ ...stored, price: 1 }), /vừa thay đổi/);
  await signOut(auth!);
  const checkoutId = crypto.randomUUID();
  const ids = await placeOrders([{ item: logged, quantity: 2 }], { name: 'Khách thử nghiệm', phone: '0901111222', address: 'Địa chỉ thử nghiệm Chũ' }, checkoutId);
  assert.equal(auth!.currentUser!.isAnonymous, true);
  await placeOrders([{ item: logged, quantity: 2 }], { name: 'Khách thử nghiệm', phone: '0901111222', address: 'Địa chỉ thử nghiệm Chũ' }, checkoutId);
  assert.equal((await getDoc(doc(db!, 'products', product.id))).data()!.inStock, 8);
  const seller = env.authenticatedContext(uid, { email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  const orders = await getDocs(query(collection(seller, 'orders'), where('sellerId', '==', uid)));
  assert.equal(orders.size, 1);
  await assert.rejects(changeOrderStatus(ids[0], 'confirmed', ''), /đăng nhập/);
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  await signInWithEmailAndPassword(auth!, credential.user.email!, 'Emulator-only-password-123');
  await changeOrderStatus(ids[0], 'confirmed', 'Đã gọi khách');
  await changeOrderStatus(ids[0], 'packing', 'Đang đóng hộp');
  await changeOrderStatus(ids[0], 'cancelled', 'Khách yêu cầu hủy trước khi giao');
  assert.equal((await getDoc(doc(db!, 'products', product.id))).data()!.inStock, 10);
  await assert.rejects(changeOrderStatus(ids[0], 'confirmed', ''), /Không thể chuyển/);
  assert.equal((await getDoc(doc(db!, 'orders', ids[0]))).data()!.status, 'cancelled');
});
