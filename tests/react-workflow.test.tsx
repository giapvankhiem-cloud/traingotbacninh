import { approveFixture } from './fixtures/approval';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { applyActionCode, createUserWithEmailAndPassword, getIdToken, inMemoryPersistence, reload, sendEmailVerification, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, terminate, updateDoc, where, writeBatch } from 'firebase/firestore';
import type { FarmerAccount, ProduceItem } from '../src/types/agriculture';
import { certificateFixture } from './fixtures/certificates';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

Object.assign(process.env, { VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-traingot.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'demo-traingot', VITE_FIREBASE_APP_ID: 'demo-app', VITE_USE_FIREBASE_EMULATORS: 'true' });
let server: ViteDevServer; let env: RulesTestEnvironment; let dom: JSDOM;
let render: any, screen: any, fireEvent: any, waitFor: any, cleanup: any, act: any;
let firebase: any, store: any;
let App: any, AuthModal: any, AddProduceModal: any, EditProduceModal: any, OrchardDeclarationModal: any, CartModal: any, OrdersTab: any, MarketplaceTab: any, TraceabilityPage: any, ProductDetailModal: any, RealtimeCommunity: any;
const password = 'Emulator-React-only-123';
const location = { lat: 21.3653, lng: 106.5925, address: 'Vườn kiểm thử giao diện', commune: 'Chũ', altitudeM: 95, soilType: 'Đất đồi', waterSource: 'Giếng' };
async function verifyEmail(email: string) {
  const { oobCodes } = await (await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-traingot/oobCodes')).json();
  const code = oobCodes.findLast((item: any) => item.email === email && item.requestType === 'VERIFY_EMAIL');
  assert.ok(code);
  await applyActionCode(firebase.auth, code.oobCode);
  await reload(firebase.auth.currentUser); await getIdToken(firebase.auth.currentUser, true);
}
async function farmer(): Promise<FarmerAccount> {
  const email = `ui-${crypto.randomUUID()}@example.test`;
  const { user } = await createUserWithEmailAndPassword(firebase.auth, email, password);
  await sendEmailVerification(user); await verifyEmail(email);
  const account: FarmerAccount = { id: user.uid, name: 'Nhà vườn UI', avatar: '/farmer-avatar.svg', location: location.address, shortLocation: 'Chũ', commune: 'Chũ', role: 'Chủ vườn', cropFocus: 'Vải', areaHa: 2, treeCount: 100, phone: '0901234567', pucCode: '', certification: 'Chưa chứng nhận', gardenLocation: location };
  await store.saveFarmer(account); return account;
}
function product(owner: FarmerAccount): ProduceItem {
  return { id: crypto.randomUUID(), ownerId: owner.id, name: 'Vải giao diện', category: 'lychee', price: 65000, unit: 'kg', inStock: 10, image: '/fruit.jpg', origin: owner.location, farmer: owner.name, farmerPhone: owner.phone, rating: 0, reviewCount: 0, certifications: ['VietGAP'], harvestSeason: 'Tháng 6', description: 'Kiểm thử React với Firebase Emulator', vietgapCode: '', location,
    farmerProfile: { name: owner.name, avatar: owner.avatar, role: owner.role, phone: owner.phone, zalo: owner.phone, address: owner.location, experienceYears: 0, orchardAreaHa: 2, treeCount: 100, bio: 'Giới thiệu vườn UI', achievements: [], commitment: '', certificates: [] }, cultivationLog: { watering: [{ id: 'w1', date: '27/10/2026', method: 'Nhỏ giọt UI', amountLiters: '20 lít', waterSource: 'Giếng', note: 'Sáng' }], fertilizing: [], pestProtection: [], general: [{ id: 'g1', date: '27/10/2026', title: 'Tỉa cành UI', instructions: 'Cắt cành khô', materials: 'Kéo' }] } };
}
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:4173/' });
  for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','MutationObserver','Event','MouseEvent']) {
    Object.defineProperty(globalThis, key, { configurable: true, value: (dom.window as any)[key] });
  }
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, requestAnimationFrame: (work: any) => setTimeout(work, 0), cancelAnimationFrame: clearTimeout });
  ({ render, screen, fireEvent, waitFor, cleanup, act } = await import('@testing-library/react'));
  server = await createServer({ configFile: false, envDir: '.tools/no-env', plugins: [react()], optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, define: { 'import.meta.env.VITE_PUBLIC_SITE_URL': JSON.stringify('http://localhost:4173/') } });
  firebase = await server.ssrLoadModule('/src/lib/firebase.ts');
  await setPersistence(firebase.auth, inMemoryPersistence);
  const realStore = await server.ssrLoadModule('/src/services/farmStore.ts');
  // Existing commerce fixtures include a trusted review after each submission.
  store = { ...realStore, saveFarmer: async (value: FarmerAccount) => { await realStore.saveFarmer(value); await approveFixture(env, value.id); } };
  for (const name of ['AuthModal','AddProduceModal','EditProduceModal','OrchardDeclarationModal','CartModal','OrdersTab','MarketplaceTab','RealtimeCommunity']) {
    const module = await server.ssrLoadModule(`/src/components/${name}.tsx`);
    if (name === 'AuthModal') AuthModal = module[name];
    if (name === 'AddProduceModal') AddProduceModal = module[name];
    if (name === 'EditProduceModal') EditProduceModal = module[name];
    if (name === 'OrchardDeclarationModal') OrchardDeclarationModal = module[name];
    if (name === 'CartModal') CartModal = module[name];
    if (name === 'OrdersTab') OrdersTab = module[name];
    if (name === 'MarketplaceTab') MarketplaceTab = module[name];
    if (name === 'RealtimeCommunity') RealtimeCommunity = module[name];
  }
  ({ TraceabilityPage } = await server.ssrLoadModule('/src/components/Traceability.tsx'));
  ({ ProductDetailModal } = await server.ssrLoadModule('/src/components/ProductDetailModal.tsx'));
  App = (await server.ssrLoadModule('/src/App.tsx')).default;
  env = await initializeTestEnvironment({ projectId: 'demo-traingot', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
});
afterEach(async () => { cleanup(); await signOut(firebase.auth); await env.clearFirestore(); });
after(async () => {
  await env?.cleanup();
  if (firebase?.db) await terminate(firebase.db);
  if (firebase?.firebaseApp) { const { deleteApp } = await import('firebase/app'); await deleteApp(firebase.firebaseApp); }
  await server?.close();
  dom?.window.close();
});
const change = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

test('React registration form creates a farmer profile and completes email verification', async () => {
  let closed = false; const email = `register-ui-${crypto.randomUUID()}@example.test`;
  render(<AuthModal onClose={() => { closed = true; }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký nhà vườn mới' }));
  change('Họ và tên', 'Chủ vườn từ form'); change('Email', email); change('Mật khẩu', password);
  fireEvent.submit(screen.getByRole('button', { name: 'Tạo tài khoản' }).closest('form'));
  await screen.findByRole('button', { name: 'Tôi đã xác minh' }, { timeout: 8000 });
  const uid = firebase.auth.currentUser.uid;
  assert.equal((await getDoc(doc(firebase.db, 'farmerApplications', uid))).data()!.profile.name, 'Chủ vườn từ form');
  assert.equal((await getDoc(doc(firebase.db, 'farmers', uid))).exists(), false);
  assert.equal(closed, false);
  await act(async () => { await verifyEmail(email); });
  fireEvent.click(screen.getByRole('button', { name: 'Tôi đã xác minh' }));
  await waitFor(() => assert.equal(closed, true));
});

test('React publish form waits for Firestore and shows an actionable missing-garden error', async () => {
  const owner = await farmer(); let closed = false;
  const view = render(<AddProduceModal isOpen currentFarmer={{ ...owner, gardenLocation: undefined }} onClose={() => { closed = true; }} onAddProduce={(item: ProduceItem) => store.saveProduce(item, true)} />);
  change('Tên trái cây', 'Vải đăng từ form'); change('Mô tả sản phẩm', 'Sản phẩm thử nghiệm');
  fireEvent.submit(screen.getByRole('button', { name: /Đăng lên sạp/ }).closest('form'));
  assert.match((await screen.findByRole('alert')).textContent, /lưu vị trí/);
  assert.equal(closed, false);
  view.rerender(<AddProduceModal isOpen currentFarmer={owner} onClose={() => { closed = true; }} onAddProduce={(item: ProduceItem) => store.saveProduce(item, true)} />);
  fireEvent.submit(screen.getByRole('button', { name: /Đăng lên sạp/ }).closest('form'));
  await waitFor(() => assert.equal(closed, true));
  const docs = await getDocs(query(collection(firebase.db, 'products'), where('ownerId', '==', owner.id)));
  assert.equal(docs.size, 1); assert.equal(docs.docs[0].data().name, 'Vải đăng từ form');
});

test('React publish form saves grape, mandarin and longan through the approved-farmer service and Firestore rules', async () => {
  const owner = await farmer();
  for (const [category, label] of [['grape', 'Nho Hạ đen'], ['mandarin', 'Quýt'], ['longan', 'Nhãn']]) {
    let closed = false;
    const view = render(<AddProduceModal isOpen currentFarmer={owner} onClose={() => { closed = true; }} onAddProduce={(item: ProduceItem) => store.saveProduce(item, true)} />);
    change('Tên trái cây', label);
    change('Loại cây', category);
    change('Mô tả sản phẩm', 'Trái cây kiểm thử trong Emulator');
    fireEvent.submit(screen.getByRole('button', { name: /Đăng lên sạp/ }).closest('form'));
    await waitFor(() => assert.equal(closed, true), { timeout: 8000 });
    const products = await getDocs(query(collection(firebase.db, 'products'), where('ownerId', '==', owner.id), where('category', '==', category)));
    assert.equal(products.size, 1);
    assert.equal(products.docs[0].data().name, label);
    view.unmount();
  }
});

test('React product edit persists removal of all self-declared certifications', async () => {
  const owner = await farmer(); const item = product(owner); await store.saveProduce(item, true);
  const current = (await getDoc(doc(firebase.db, 'products', item.id))).data() as ProduceItem;
  let closed = false;
  render(<EditProduceModal isOpen product={current} currentFarmer={owner} onClose={() => { closed = true; }} onSave={(updated: ProduceItem) => store.saveProduce(updated)} />);
  fireEvent.click(screen.getByRole('button', { name: '✓ VietGAP', exact: true }));
  fireEvent.submit(document.getElementById('edit-produce-form')!);
  await waitFor(() => assert.equal(closed, true));
  assert.deepEqual((await getDoc(doc(firebase.db, 'products', item.id))).data()!.certifications, []);
});

test('React cart creates an anonymous buyer and a real emulator order, then opens tracking', async () => {
  const owner = await farmer(); const item = product(owner); await store.saveProduce(item, true); await signOut(firebase.auth);
  let cleared = false, tracking = false;
  render(<CartModal isOpen onClose={() => {}} cartItems={[{ item, quantity: 2 }]} onUpdateQuantity={() => {}} onRemoveItem={() => {}} onClearCart={() => { cleared = true; }} onViewOrders={() => { tracking = true; }} />);
  change('Họ tên người nhận', 'Khách từ form'); change('Số điện thoại', '0901111222'); change('Địa chỉ giao hàng', 'Địa chỉ kiểm thử React Chũ');
  fireEvent.submit(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }).closest('form'));
  await screen.findByText('Đã gửi đơn đến nhà vườn', {}, { timeout: 8000 });
  assert.equal(cleared, true); assert.equal(firebase.auth.currentUser.isAnonymous, true);
  assert.equal((await getDoc(doc(firebase.db, 'products', item.id))).data()!.inStock, 8);
  fireEvent.click(screen.getByRole('button', { name: 'Theo dõi đơn hàng' })); assert.equal(tracking, true);
});

test('React seller orders update confirmed orders through packing, shipping and completion', async () => {
  const owner = await farmer(); const item = product(owner); await store.saveProduce(item, true);
  const [id] = await store.placeOrders([{ item, quantity: 1 }], { name: 'Khách UI', phone: '0901111222', address: 'Địa chỉ giao thử nghiệm' }, crypto.randomUUID());
  render(<OrdersTab user={firebase.auth.currentUser} onLogin={() => {}} />);
  for (const label of ['Đã xác nhận', 'Đang đóng gói', 'Đang giao hàng', 'Hoàn tất']) {
    const button = await screen.findByRole('button', { name: label }, { timeout: 8000 }); fireEvent.click(button);
  }
  await waitFor(async () => assert.equal((await getDoc(doc(firebase.db, 'orders', id))).data()!.status, 'completed'));
  await waitFor(() => assert.equal(screen.queryByRole('button', { name: 'Hoàn tất' }), null));
});

test('React market search and category filters only show matching produce', async () => {
  const owner = await farmer(); const a = product(owner); const b = { ...product(owner), name: 'Cam đường Canh UI', category: 'orange' as const };
  render(<MarketplaceTab produceList={[a,b]} currentFarmer={owner} isLoggedIn onSelectProduct={() => {}} onAddToCart={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/Tìm/), { target: { value: 'Cam đường' } });
  assert.ok(screen.getByText(b.name)); assert.equal(screen.queryByText(a.name), null);
  fireEvent.change(screen.getByPlaceholderText(/Tìm/), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Vải', exact: true }));
  assert.ok(screen.getByText(a.name)); assert.equal(screen.queryByText(b.name), null);
});

test('React cultivation calendar filters all eight categories by category even when the fruit name omits it', async () => {
  const { CalendarTab } = await server.ssrLoadModule('/src/components/CalendarTab.tsx');
  const owner = await farmer();
  const item = { ...product(owner), name: 'Hạ đen UI', category: 'grape' as const };
  render(<CalendarTab currentFarmer={owner} produceList={[item]} onAddCultivationLog={async () => {}} />);
  const filter = screen.getByRole('combobox', { name: 'Lọc nhật ký theo loại cây' });
  for (const label of ['Vải', 'Cam', 'Quýt', 'Bưởi', 'Táo', 'Nhãn', 'Ổi', 'Nho']) assert.ok(screen.getByRole('option', { name: label, exact: true }));
  fireEvent.change(filter, { target: { value: 'grape' } });
  assert.ok(screen.getByRole('heading', { name: 'Tưới nước: Nhỏ giọt UI' }));
  fireEvent.change(filter, { target: { value: 'mandarin' } });
  assert.equal(screen.queryByRole('heading', { name: 'Tưới nước: Nhỏ giọt UI' }), null);
  fireEvent.change(filter, { target: { value: 'all' } });
  assert.ok(screen.getByRole('heading', { name: 'Tưới nước: Nhỏ giọt UI' }));
  assert.equal(screen.queryByTitle('Đã hoàn thành theo chuẩn VietGAP'), null);
});

test('React buyer trace page displays farmer, coordinates and all logs without another QR', async () => {
  const owner = await farmer(); const item = product(owner);
  render(<TraceabilityPage product={item} loading={false} error="" onBack={() => {}} />);
  assert.ok(screen.getByText('Giới thiệu vườn UI'));
  assert.ok(screen.getByText(/Nhỏ giọt UI/)); assert.ok(screen.getByText(/Tỉa cành UI/));
  assert.equal(screen.queryByRole('link', { name: 'Tải QR in dán hộp' }), null);
  assert.equal(screen.queryByRole('img', { name: /^QR truy xuất/ }), null);
  fireEvent.click(screen.getByRole('button', { name: 'Bón phân (0)' }));
  assert.equal(screen.queryByText(/Nhỏ giọt UI/), null);
});

test('React failed product details keep the market visible and can be closed', async () => {
  const { ProductDetailBoundary } = await server.ssrLoadModule('/src/components/ProductDetailBoundary.tsx');
  const BrokenDetail = () => { throw new Error('Failed to fetch dynamically imported module'); };
  let opened = true;
  function Market() {
    const [visible, setVisible] = React.useState(true);
    return <><h1>Sạp vẫn hoạt động</h1>{visible && <ProductDetailBoundary onClose={() => { opened = false; setVisible(false); }}><BrokenDetail /></ProductDetailBoundary>}</>;
  }
  // React reports the deliberately thrown fixture to console even when caught.
  const originalError = console.error;
  console.error = (...args: unknown[]) => { if (!args.some((arg) => String(arg).includes('Failed to fetch dynamically imported module'))) originalError(...args); };
  try {
    render(<Market />);
    assert.ok(screen.getByRole('heading', { name: 'Sạp vẫn hoạt động' }));
    assert.ok(screen.getByRole('dialog', { name: 'Chưa thể mở chi tiết trái cây' }));
    assert.ok(screen.getByRole('button', { name: 'Tải lại trang' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đóng và về sạp' }));
    assert.equal(opened, false);
    assert.equal(screen.queryByRole('dialog'), null);
    assert.ok(screen.getByRole('heading', { name: 'Sạp vẫn hoạt động' }));
  } finally { console.error = originalError; }
});

test('React packing QR has one seller-only location and decodes to the selected fruit', async () => {
  const owner = await farmer(); const item = product(owner);
  const props = { product: item, currentFarmer: owner, isLoggedIn: true, onClose: () => {}, onAddToCart: () => {} };
  const view = render(<ProductDetailModal {...props} />);
  assert.equal(screen.queryByRole('link', { name: 'Tải QR in dán hộp' }), null);
  fireEvent.click(screen.getByRole('button', { name: 'Tem QR đóng hộp' }));
  const link = await screen.findByRole('link', { name: 'Tải QR in dán hộp' });
  assert.equal(screen.getAllByRole('img', { name: /^QR truy xuất/ }).length, 1);
  assert.equal(link.getAttribute('download'), `QR-${item.id}.png`);
  function decodedLabel() {
    const png = PNG.sync.read(Buffer.from(screen.getByRole('link', { name: 'Tải QR in dán hộp' }).getAttribute('href').split(',')[1], 'base64'));
    return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
  }
  assert.equal(decodedLabel(), `http://localhost:4173/#trace/${item.id}`);
  const second = { ...product(owner), name: 'Cam của cùng nhà vườn', category: 'orange' as const };
  view.rerender(<ProductDetailModal {...props} product={second} />);
  await waitFor(() => assert.equal(decodedLabel(), `http://localhost:4173/#trace/${second.id}`));
  fireEvent.click(screen.getByRole('button', { name: 'Nhà vườn & chứng nhận' }));
  assert.equal(screen.queryByRole('link', { name: 'Tải QR in dán hộp' }), null);
  fireEvent.click(screen.getByRole('button', { name: 'Tem QR đóng hộp' }));
  await screen.findByRole('link', { name: 'Tải QR in dán hộp' });
  for (const account of [{ ...props, isLoggedIn: false }, { ...props, currentFarmer: { ...owner, id: 'another-uid' } }]) {
    view.rerender(<ProductDetailModal {...account} />);
    assert.equal(screen.queryByRole('button', { name: 'Tem QR đóng hộp' }), null);
    assert.equal(screen.queryByRole('img', { name: /^QR truy xuất/ }), null);
    for (const tab of ['Thông tin & đặt mua', 'Nhà vườn & chứng nhận', 'Vị trí vườn Google Maps', 'Nhật ký canh tác']) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      assert.equal(screen.queryByRole('link', { name: 'Tải QR in dán hộp' }), null);
    }
  }
});

test('React App opens the packing QR only after publishing and keeps it out of Overview', async () => {
  const owner = await farmer();
  render(<App />);
  await screen.findByRole('link',{name:'Vườn của tôi'}, { timeout: 8000 });
  fireEvent.click(await screen.findByRole('button', { name: 'Đăng bán trái cây mới' }, { timeout: 8000 }));
  await screen.findByRole('heading', { name: 'Đăng bán trái cây' });
  change('Tên trái cây', 'Vải sau khi đăng có tem riêng'); change('Mô tả sản phẩm', 'Chỉ thuộc Emulator, không giao hàng');
  assert.equal(screen.queryByRole('link', { name: 'Tải QR in dán hộp' }), null);
  fireEvent.submit(screen.getByRole('button', { name: /Đăng lên sạp/ }).closest('form'));
  const label = await screen.findByRole('link', { name: 'Tải QR in dán hộp' }, { timeout: 8000 });
  const published = await getDocs(query(collection(firebase.db, 'products'), where('ownerId', '==', owner.id)));
  assert.equal(published.size, 1);
  assert.equal(label.getAttribute('download'), `QR-${published.docs[0].id}.png`);
  assert.equal(screen.getByRole('button', { name: 'Tem QR đóng hộp' }).getAttribute('aria-pressed'), 'true');
  assert.equal(screen.getAllByRole('img', { name: /^QR truy xuất/ }).length, 1);
  fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết trái cây' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tổng quan' }));
  const reopen = await screen.findByRole('button', { name: 'Xem vườn & nhật ký' });
  assert.equal(screen.queryByRole('button', { name: 'Tải tem QR' }), null);
  assert.equal(screen.queryByRole('link', { name: 'Tải QR in dán hộp' }), null);
  fireEvent.click(reopen);
  fireEvent.click(await screen.findByRole('button', { name: 'Tem QR đóng hộp' }));
  assert.equal((await screen.findByRole('link', { name: 'Tải QR in dán hộp' })).getAttribute('download'), `QR-${published.docs[0].id}.png`);
});

test('React admin navigation reviews a private submission and requires a review checklist before approval', async () => {
  const owner = await farmer();
  const realStore = await server.ssrLoadModule('/src/services/farmStore.ts');
  await realStore.saveFarmer({ ...owner, bio: 'Bản mới cần quản trị kiểm tra' });
  const { user: reviewer } = await createUserWithEmailAndPassword(firebase.auth, `admin-ui-${crypto.randomUUID()}@example.test`, password);
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: reviewer.uid, emailVerified: true, customAttributes: JSON.stringify({ admin: true }) }) });
  assert.equal(response.ok, true); await reload(reviewer); await getIdToken(reviewer, true);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Quản trị & Duyệt hồ sơ' }, { timeout: 8000 }));
  fireEvent.click(await screen.findByRole('button', { name: `Xem hồ sơ ${owner.name}` }));
  const approve = screen.getByRole('button', { name: 'Duyệt tài khoản & hồ sơ' });
  assert.equal(approve.disabled, true);
  fireEvent.click(screen.getByRole('checkbox', { name: /Đã kiểm tra tài khoản/ }));
  await waitFor(() => assert.equal(approve.disabled, false));
  fireEvent.click(approve);
  await screen.findByText(/Đã xử lý hồ sơ/);
  assert.equal((await getDoc(doc(firebase.db, 'farmerApplications', owner.id))).data()!.status, 'approved');
  assert.equal((await getDoc(doc(firebase.db, 'farmers', owner.id))).data()!.bio, 'Bản mới cần quản trị kiểm tra');
});

test('React community form publishes and receives a post through the live subscription', async () => {
  const owner = await farmer();
  render(<RealtimeCommunity farmer={owner} onLogin={() => {}} />);
  change('Bài viết mới', 'Bài cộng đồng kiểm thử từ React');
  fireEvent.submit(screen.getByRole('button', { name: 'Đăng bài' }).closest('form'));
  await screen.findByText('Bài cộng đồng kiểm thử từ React', {}, { timeout: 8000 });
  await waitFor(() => assert.equal((screen.getByLabelText('Bài viết mới') as HTMLTextAreaElement).value, ''));
  assert.equal((await getDocs(collection(firebase.db, 'posts'))).size, 1);
});

test('React admin suspends, restores and deletes website access with reason and email confirmation; deleted farmer sees the blocked screen', async () => {
  const owner = await farmer(); const ownerEmail = firebase.auth.currentUser.email;
  await store.saveProduce(product(owner), true);
  const { user: reviewer } = await createUserWithEmailAndPassword(firebase.auth, `policy-ui-${crypto.randomUUID()}@example.test`, password);
  const verified = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: reviewer.uid, emailVerified: true, customAttributes: JSON.stringify({ admin: true }) }) });
  assert.equal(verified.ok, true); await reload(reviewer); await getIdToken(reviewer, true);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Quản trị & Duyệt hồ sơ' }, { timeout: 8000 }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Lọc hồ sơ' }), { target: { value: 'all' } });
  fireEvent.click(await screen.findByRole('button', { name: `Xem hồ sơ ${owner.name}` }));
  fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng tài khoản' }));
  assert.equal(screen.getByRole('button', { name: 'Xác nhận xử lý tài khoản' }).disabled, true);
  change('Lý do xử lý tài khoản', 'Vi phạm chính sách cần xem xét');
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý tài khoản' }));
  await screen.findByText(/Đã xử lý tài khoản.*Tạm dừng/);
  assert.equal((await getDoc(doc(firebase.db, 'farmerAccountStates', owner.id))).data()!.status, 'suspended');
  fireEvent.click(screen.getByRole('button', { name: `Xem hồ sơ ${owner.name}` }));
  fireEvent.click(screen.getByRole('button', { name: 'Khôi phục tài khoản' }));
  change('Lý do xử lý tài khoản', 'Đã khắc phục');
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý tài khoản' }));
  await screen.findByText(/Đã xử lý tài khoản.*Đang hoạt động/);
  fireEvent.click(screen.getByRole('button', { name: `Xem hồ sơ ${owner.name}` }));
  fireEvent.click(screen.getByRole('button', { name: 'Xóa khỏi website', exact: true }));
  change('Lý do xử lý tài khoản', 'Vi phạm nhiều lần'); change('Nhập email nhà vườn để xác nhận xóa', 'wrong@example.test');
  assert.equal(screen.getByRole('button', { name: 'Xác nhận xử lý tài khoản' }).disabled, true);
  change('Nhập email nhà vườn để xác nhận xóa', ownerEmail);
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý tài khoản' }));
  await screen.findByText(/Đã xử lý tài khoản.*Đã xóa khỏi website/);
  cleanup(); await signOut(firebase.auth);
  render(<App />);
  await screen.findByRole('heading', { name: 'Không tìm thấy trái cây phù hợp' });
  assert.equal(screen.queryByRole('button', { name: 'Xem vườn & nhật ký' }), null);
  cleanup(); await signInWithEmailAndPassword(firebase.auth, ownerEmail, password);
  render(<App />);
  await screen.findByRole('heading', { name: 'Tài khoản đã bị xóa khỏi website' });
  assert.equal(screen.queryByRole('button', { name: 'Xem vườn & nhật ký' }), null);
  assert.ok(screen.getByRole('button', { name: 'Đăng xuất' }));
});

test('React registration rejects a whitespace-only name before creating an Auth account', { timeout: 10000 }, async () => {
  render(<AuthModal onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký nhà vườn mới' }));
  change('Họ và tên', '   '); change('Email', `blank-${crypto.randomUUID()}@example.test`); change('Mật khẩu', password);
  fireEvent.submit(screen.getByRole('button', { name: 'Tạo tài khoản' }).closest('form'));
  await screen.findByText('Vui lòng nhập họ và tên chủ vườn.');
  assert.equal(Boolean(firebase.auth.currentUser), false);
});

test('React garden form saves new coordinates and preserves an explicit zero tree count', async () => {
  const owner = await farmer(); let closed = false;
  render(<OrchardDeclarationModal isOpen currentFarmer={owner} onClose={() => { closed = true; }} onSaveFarmer={(value: FarmerAccount) => store.saveFarmer(value)} />);
  const numeric = screen.getAllByRole('spinbutton');
  fireEvent.change(numeric[0], { target: { value: '21.6' } });
  fireEvent.change(numeric[1], { target: { value: '106.7' } });
  fireEvent.change(numeric[3], { target: { value: '0' } });
  assert.equal(screen.getByRole('link', { name: /Mở Google Maps/ }).getAttribute('href'), 'https://www.google.com/maps/search/?api=1&query=21.6,106.7');
  fireEvent.submit(screen.getByRole('button', { name: /Gửi hồ sơ cho quản trị duyệt/ }).closest('form'));
  await waitFor(() => assert.equal(closed, true));
  const saved = (await getDoc(doc(firebase.db, 'farmers', owner.id))).data()!;
  assert.equal(saved.gardenLocation.lat, 21.6); assert.equal(saved.gardenLocation.lng, 106.7);
  assert.equal(saved.treeCount, 0);
});

test('React certificate form saves OCOP to Firebase, shows the PDF as self-declared, and removes the stored proof', async () => {
  const owner = await farmer(); let closed = false;
  render(<OrchardDeclarationModal isOpen currentFarmer={owner} onClose={() => { closed = true; }} onSaveFarmer={(value: FarmerAccount) => store.saveFarmer(value)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Thêm giấy chứng nhận' }));
  change('Loại chứng nhận *', 'OCOP'); change('Xếp hạng OCOP *', '4');
  change('Tên giấy chứng nhận *', 'Hồ sơ OCOP thử nghiệm'); change('Số chứng nhận / quyết định *', 'TEST-OCOP-04');
  change('Đơn vị cấp *', 'Đơn vị cấp trong Emulator'); change('Ngày cấp *', '2025-01-01'); change('Ngày hết hạn (nếu có)', '2027-12-31');
  change('Sản phẩm / vùng trồng thuộc phạm vi chứng nhận *', 'Vải trên vườn thử nghiệm');
  change('Liên kết hồ sơ hoặc PDF (HTTPS)', 'https://example.test/ocop.pdf');
  fireEvent.submit(screen.getByRole('button', { name: /Gửi hồ sơ cho quản trị duyệt/ }).closest('form'));
  await waitFor(() => assert.equal(closed, true));
  const profile = (await getDoc(doc(firebase.db, 'farmers', owner.id))).data()!;
  assert.equal(profile.certificateIds.length, 1); assert.equal(profile.certification, 'OCOP 4 sao');
  const id = profile.certificateIds[0];
  const certificate = (await getDoc(doc(firebase.db, 'farmers', owner.id, 'certificates', id))).data()!;
  assert.equal(certificate.ocopStars, 4); assert.equal(certificate.verified, false);
  assert.equal('certificates' in profile, false);
  cleanup();
  const { withFarmer } = await server.ssrLoadModule('/src/hooks/useFarmData.ts');
  const hydrated = { ...owner, ...profile, certificates: [certificate] };
  render(<TraceabilityPage product={withFarmer(product(owner), hydrated)} loading={false} error="" onBack={() => {}} />);
  assert.ok(screen.getByText('OCOP 4 sao')); assert.ok(screen.getByText('Tự khai · Chưa xác minh'));
  assert.equal(Boolean(screen.queryByText(/Đã thẩm định|ĐÃ KIỂM ĐỊNH|^Hợp lệ$/)), false);
  fireEvent.click(screen.getByRole('button', { name: 'Xem hồ sơ chứng nhận' }));
  assert.equal(screen.getByRole('link', { name: 'Mở bản chứng nhận / PDF' }).getAttribute('href'), 'https://example.test/ocop.pdf');
  cleanup(); closed = false;
  render(<OrchardDeclarationModal isOpen currentFarmer={hydrated} onClose={() => { closed = true; }} onSaveFarmer={(value: FarmerAccount) => store.saveFarmer(value)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xóa chứng nhận 1' }));
  fireEvent.submit(screen.getByRole('button', { name: /Gửi hồ sơ cho quản trị duyệt/ }).closest('form'));
  await waitFor(() => assert.equal(closed, true));
  assert.deepEqual((await getDoc(doc(firebase.db, 'farmers', owner.id))).data()!.certificateIds, []);
  assert.equal((await getDoc(doc(firebase.db, 'farmers', owner.id, 'certificates', id))).exists(), false);
});

test('public React trace listeners receive certificate edits, removals and new IDs without stale permission errors', async () => {
  const owner = await farmer(); const item = product(owner); await store.saveProduce(item, true);
  const certificate = certificateFixture(); await store.saveFarmer({ ...owner, certificates: [certificate] });
  await signOut(firebase.auth);
  const { useFarmData } = await server.ssrLoadModule('/src/hooks/useFarmData.ts');
  function Probe() {
    const data = useFarmData(item.id);
    return <><output aria-label="Chứng nhận realtime">{data.products[0]?.farmerProfile.certificates.map((value: any) => value.certificateNumber).join(',') || 'Không có'}</output><output aria-label="Lỗi chứng nhận">{data.error}</output></>;
  }
  render(<Probe />);
  await waitFor(() => assert.equal(screen.getByLabelText('Chứng nhận realtime').textContent, certificate.certificateNumber), { timeout: 8000 });
  const seller = env.authenticatedContext('review-fixture', { admin: true, email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  await act(async () => { await env.withSecurityRulesDisabled(async (context) => { await updateDoc(doc(context.firestore(), 'farmers', owner.id, 'certificates', certificate.id), { certificateNumber: 'LIVE-UPDATED' }); }); });
  await waitFor(() => assert.equal(screen.getByLabelText('Chứng nhận realtime').textContent, 'LIVE-UPDATED'));
  const remove = writeBatch(seller); remove.update(doc(seller, 'farmers', owner.id), { certificateIds: [] }); remove.delete(doc(seller, 'farmers', owner.id, 'certificates', certificate.id));
  await act(async () => { await env.withSecurityRulesDisabled(async (context) => { const b=writeBatch(context.firestore()); b.update(doc(context.firestore(),'farmers',owner.id),{certificateIds:[]}); b.delete(doc(context.firestore(),'farmers',owner.id,'certificates',certificate.id)); await b.commit(); }); });
  await waitFor(() => assert.equal(screen.getByLabelText('Chứng nhận realtime').textContent, 'Không có'));
  const next = certificateFixture({ id: 'next-certificate', certificateNumber: 'LIVE-NEW' });
  const add = writeBatch(seller); add.update(doc(seller, 'farmers', owner.id), { certificateIds: [next.id] }); add.set(doc(seller, 'farmers', owner.id, 'certificates', next.id), next);
  await act(async () => { await env.withSecurityRulesDisabled(async (context) => { const b=writeBatch(context.firestore()); b.update(doc(context.firestore(),'farmers',owner.id),{certificateIds:[next.id]}); b.set(doc(context.firestore(),'farmers',owner.id,'certificates',next.id),next); await b.commit(); }); });
  await waitFor(() => assert.equal(screen.getByLabelText('Chứng nhận realtime').textContent, 'LIVE-NEW'));
  assert.equal(screen.getByLabelText('Lỗi chứng nhận').textContent, '');
  assert.equal(Boolean(firebase.auth.currentUser), false);
});

test('expert connection guest CTA opens login without fake responses', async () => {
  await signOut(firebase.auth);
  const { ExpertChatTab } = await server.ssrLoadModule('/src/components/ExpertChatTab.tsx');
  let opened=false;render(<ExpertChatTab onLogin={()=>{opened=true;}} />);
  fireEvent.click(await screen.findByRole('button',{name:'Đăng nhập để được tư vấn'}));assert.equal(opened,true);
  assert.equal(screen.queryByText(/đang trực tuyến|4\.9\/5|đã tiếp nhận 500/i),null);
});

test('expert chat guest drafts before login and resumes the same question without sending it automatically', async () => {
  const owner = await farmer();
  const email = firebase.auth.currentUser.email;
  const expertId = 'guest-draft-expert';
  const expertName = 'Chuyên gia nhận câu hỏi nháp';
  await env.withSecurityRulesDisabled(async context => {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(context.firestore(), 'consultationExperts', expertId), {
      id: expertId, name: expertName, title: 'Kỹ sư', organization: 'Đơn vị kiểm thử',
      specialties: 'Vải', bio: '', phone: '', availability: '', active: true, status: 'active',
      internalAccount: false, updatedAt: 1, updatedBy: 'fixture',
    });
  });
  await signOut(firebase.auth);
  const { within } = await import('@testing-library/react');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mở menu điều hướng', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: /Trợ lý & Chuyên gia/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Kết nối chuyên gia', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Chat ngay', exact: true }));

  const starterName = `Tư vấn với ${expertName}`;
  const getStarter = () => screen.findByRole('dialog', { name: starterName }, { timeout: 8000 });
  const getLogin = () => screen.findByRole('dialog', { name: 'Đăng nhập nhà vườn' });
  const start = (dialog: HTMLElement) => fireEvent.submit(within(dialog).getByRole('button', { name: 'Bắt đầu', exact: true }).closest('form')!);
  let starter = await getStarter();
  fireEvent.click(within(starter).getByRole('button', { name: 'Hãm lộc đông vải', exact: true }));
  const question = 'Bác cho tôi hỏi cách chuẩn bị cho cây vải trước khi hãm lộc đông?';
  change('Câu hỏi cần tư vấn', question);
  assert.equal(Boolean(screen.queryByRole('dialog', { name: 'Đăng nhập nhà vườn' })), false);

  start(starter);
  fireEvent.click(within(await getLogin()).getByRole('button', { name: 'Đóng', exact: true }));
  starter = await getStarter();
  assert.equal(within(starter).getByLabelText('Câu hỏi cần tư vấn').value, question);
  assert.match(within(starter).getByLabelText('Cây trồng').value, /vải/i);

  start(starter);
  const login = await getLogin();
  change('Email', email);
  change('Mật khẩu', password);
  fireEvent.submit(login.querySelector('form')!);
  starter = await getStarter();
  assert.equal(firebase.auth.currentUser.uid, owner.id);
  assert.equal(within(starter).getByLabelText('Câu hỏi cần tư vấn').value, question);
  const requests = query(collection(firebase.db, 'consultations'), where('farmerId', '==', owner.id));
  assert.equal((await getDocs(requests)).size, 0);

  start(starter);
  const chat = await screen.findByLabelText('Chi tiết tư vấn', {}, { timeout: 8000 });
  await within(chat).findByRole('log', { name: 'Nội dung trao đổi' });
  const saved = await getDocs(requests);
  assert.equal(saved.size, 1);
  assert.equal(saved.docs[0].data().expertId, expertId);
  assert.equal(saved.docs[0].data().question, question);
});

test('farmer React starts a consultation from a suggested topic, chats directly and reloads persisted history', async () => {
  const owner=await farmer();
  await env.withSecurityRulesDisabled(async(ctx)=>{const {setDoc}=await import('firebase/firestore');await setDoc(doc(ctx.firestore(),'consultationExperts','direct-ui-expert'),{id:'direct-ui-expert',name:'Chuyên gia tư vấn trực tiếp',title:'Kỹ sư',organization:'Đơn vị kiểm thử',specialties:'Vải',bio:'',phone:'',availability:'',active:true,status:'active',internalAccount:false,updatedAt:1,updatedBy:'fixture'});});
  const { ExpertChatTab } = await server.ssrLoadModule('/src/components/ExpertChatTab.tsx');
  render(<ExpertChatTab />);
  const { within } = await import('@testing-library/react');
  const expertCard = (await screen.findByRole('heading',{name:'Chuyên gia tư vấn trực tiếp',exact:true})).closest('article');
  assert.ok(expertCard);
  fireEvent.click(within(expertCard).getByRole('button',{name:'Chat ngay',exact:true}));
  const starter = await screen.findByRole('dialog',{name:'Tư vấn với Chuyên gia tư vấn trực tiếp',exact:true});
  assert.equal(within(starter).getByRole('button',{name:'Bắt đầu',exact:true}).disabled,true);
  fireEvent.click(within(starter).getByRole('button',{name:'Hãm lộc đông vải',exact:true}));
  assert.match(within(starter).getByLabelText('Câu hỏi cần tư vấn').value,/vải|lộc/i);
  assert.equal((await getDocs(query(collection(firebase.db,'consultations'),where('farmerId','==',owner.id)))).size,0);
  const question='Cây vải vàng lá sau mưa, xin tư vấn cách chăm sóc UI.';
  change('Cây trồng','Vải');change('Câu hỏi cần tư vấn',question);
  assert.equal(within(starter).getByRole('button',{name:'Bắt đầu',exact:true}).disabled,false);
  const startForm=within(starter).getByRole('button',{name:'Bắt đầu',exact:true}).closest('form');
  fireEvent.submit(startForm);fireEvent.submit(startForm);
  await screen.findByLabelText('Chi tiết tư vấn',{}, {timeout:8000});
  assert.equal(Boolean(screen.queryByRole('dialog')),false);
  assert.equal(Boolean(screen.queryByLabelText('Tìm và lọc chuyên gia')),false);
  const snapshot=await getDocs(query(collection(firebase.db,'consultations'),where('farmerId','==',owner.id)));assert.equal(snapshot.size,1);
  const request=snapshot.docs[0];assert.equal(request.data().messageCount,1);assert.equal(request.data().expertId,'direct-ui-expert');assert.equal(request.data().question,question);
  const initialMessages=await getDocs(collection(firebase.db,'consultations',request.id,'messages'));
  assert.equal(initialMessages.size,1);assert.equal(initialMessages.docs[0].data().senderRole,'farmer');assert.equal(initialMessages.docs[0].data().body,question);
  fireEvent.click(screen.getByRole('button',{name:'Kỹ thuật bón phân',exact:true}));
  const draft = screen.getByLabelText('Tin nhắn').value;
  assert.match(draft,/bón phân/i);
  const chat = screen.getByLabelText('Chi tiết tư vấn');
  fireEvent.click(within(chat).getByRole('button',{name:'Chuyên gia tư vấn trực tiếp',exact:true}));
  const profile = screen.getByRole('region',{name:'Hồ sơ chuyên gia Chuyên gia tư vấn trực tiếp',exact:true});
  fireEvent.click(within(profile).getByRole('button',{name:'Quay lại cuộc tư vấn',exact:true}));
  assert.equal(screen.getByLabelText('Tin nhắn').value,draft);
  assert.equal((await getDocs(collection(firebase.db,'consultations',request.id,'messages'))).size,1);
  change('Tin nhắn','Lá vàng xuất hiện trong tuần này.');fireEvent.submit(screen.getByRole('button',{name:'Gửi tin nhắn',exact:true}).closest('form'));
  await waitFor(()=>assert.equal(screen.getByLabelText('Tin nhắn').value,''),{timeout:8000});
  fireEvent.click(screen.getByRole('button',{name:'Quay lại danh sách chuyên gia',exact:true}));
  await screen.findByRole('heading',{name:'Chuyên gia tư vấn trực tiếp',exact:true});
  cleanup();render(<ExpertChatTab />);
  fireEvent.click(await screen.findByRole('button',{name:/Cây vải vàng lá sau mưa/}));
  await screen.findByText('Lá vàng xuất hiện trong tuần này.');
  assert.equal((await getDocs(collection(firebase.db,'consultations',request.id,'messages'))).size,2);
  assert.equal(screen.queryByRole('alert'),null);
});

test('expert chat starter does not send blank questions or send to an expert who stops receiving', async () => {
  const owner=await farmer();
  const expertId='starter-withdrawn-expert';
  await env.withSecurityRulesDisabled(async ctx=>{const {setDoc}=await import('firebase/firestore');await setDoc(doc(ctx.firestore(),'consultationExperts',expertId),{id:expertId,name:'Chuyên gia tạm dừng UI',title:'Kỹ sư',organization:'Đơn vị kiểm thử',specialties:'Vải',bio:'',phone:'',availability:'',active:true,status:'active',internalAccount:false,updatedAt:1,updatedBy:'fixture'});});
  const { ExpertChatTab }=await server.ssrLoadModule('/src/components/ExpertChatTab.tsx');
  const { within }=await import('@testing-library/react');
  render(<ExpertChatTab />);
  const card=(await screen.findByRole('heading',{name:'Chuyên gia tạm dừng UI',exact:true})).closest('article');
  fireEvent.click(within(card).getByRole('button',{name:'Chat ngay',exact:true}));
  const starter=await screen.findByRole('dialog',{name:'Tư vấn với Chuyên gia tạm dừng UI',exact:true});
  const start=within(starter).getByRole('button',{name:'Bắt đầu',exact:true});
  change('Cây trồng','Vải');change('Câu hỏi cần tư vấn','   ');
  assert.equal(start.disabled,true);
  fireEvent.click(start);
  assert.equal((await getDocs(query(collection(firebase.db,'consultations'),where('farmerId','==',owner.id)))).size,0);
  change('Câu hỏi cần tư vấn','Xin tư vấn cách chăm sóc vải sau thu hoạch.');
  await act(async()=>{await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'consultationExperts',expertId),{active:false,status:'suspended',updatedAt:2}));});
  await waitFor(()=>assert.equal(Boolean(screen.queryByRole('dialog',{name:'Tư vấn với Chuyên gia tạm dừng UI',exact:true})) && !screen.queryByRole('button',{name:'Bắt đầu',exact:true})?.disabled,false),{timeout:8000});
  assert.equal((await getDocs(query(collection(firebase.db,'consultations'),where('farmerId','==',owner.id)))).size,0);
});

test('expert chat keeps an open conversation when it leaves the limited history window and receives status updates', async () => {
  const owner=await farmer();
  const expertId='history-window-expert', selectedId='history-old-000-00000000';
  const question='Tin nhắn gốc của cuộc tư vấn cũ vẫn cần được hiển thị.';
  function conversation(id: string, subject: string, updatedAt: number) {
    return {id,farmerId:owner.id,farmerName:owner.name,subject,question,crop:'Vải',expertId,expertName:'Chuyên gia lịch sử UI',status:'waiting',revision:1,messageCount:1,lastMessage:question,lastMessageId:'initial',lastSenderRole:'farmer',createdAt:1,updatedAt};
  }
  await env.withSecurityRulesDisabled(async ctx=>{
    const database=ctx.firestore(),batch=writeBatch(database);
    batch.set(doc(database,'consultationExperts',expertId),{id:expertId,name:'Chuyên gia lịch sử UI',title:'Kỹ sư',organization:'Đơn vị kiểm thử',specialties:'Vải',bio:'',phone:'',availability:'',active:true,status:'active',internalAccount:false,updatedAt:1,updatedBy:'fixture'});
    for(let index=0;index<50;index++){
      const id=`history-old-${String(index).padStart(3,'0')}-00000000`;
      batch.set(doc(database,'consultations',id),conversation(id,index===0?'Cuộc tư vấn cũ nhất UI':`Cuộc tư vấn lịch sử ${index}`,index+1));
    }
    batch.set(doc(database,'consultations',selectedId,'messages','initial'),{id:'initial',senderId:owner.id,senderRole:'farmer',senderName:owner.name,body:question,createdAt:Number.MAX_SAFE_INTEGER});
    await batch.commit();
  });
  const {ExpertChatTab}=await server.ssrLoadModule('/src/components/ExpertChatTab.tsx');
  const service=await server.ssrLoadModule('/src/services/consultations.ts');
  render(<ExpertChatTab />);
  fireEvent.click(await screen.findByRole('button',{name:/Cuộc tư vấn cũ nhất UI/}));
  await screen.findByText(question);
  assert.ok(screen.getByText('Chưa rõ thời gian'));
  assert.equal(Boolean(screen.queryByLabelText('Chi tiết tư vấn')),true);
  let stopHistory=()=>{};
  try{
    // Observe the identical query after the Hub subscribed, so the barrier confirms
    // that its limited history listener has received the replacement window too.
    const windowChanged=new Promise<void>((resolve,reject)=>{
      stopHistory=service.watchConsultations('farmer',owner.id,50,(rows: {id:string}[])=>{if(rows.length===50&&rows.every(row=>row.id.startsWith('history-new-')))resolve();},reject);
    });
    await act(async()=>{
      await env.withSecurityRulesDisabled(async ctx=>{
        const database=ctx.firestore(),batch=writeBatch(database);
        for(let index=0;index<50;index++){
          const id=`history-new-${String(index).padStart(3,'0')}-00000000`;
          batch.set(doc(database,'consultations',id),conversation(id,`Cuộc tư vấn mới ${index}`,1000+index));
        }
        await batch.commit();
      });
      await windowChanged;
    });
    assert.equal(Boolean(screen.queryByLabelText('Chi tiết tư vấn')),true);
    assert.ok(screen.getByText(question));
    assert.equal(Boolean(screen.queryByText('Đang mở cuộc tư vấn…')),false);
    await act(async()=>{await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'consultations',selectedId),{status:'closed',revision:2}));});
    await screen.findByText(/Cuộc tư vấn đã kết thúc/);
    assert.equal(Boolean(screen.queryByLabelText('Tin nhắn')),false);
    assert.equal(Boolean(screen.queryByLabelText('Chi tiết tư vấn')),true);
  }finally{stopHistory();}
});

test('pending internal expert sees pending status and no send permission', async () => {
  const email=`expert-ui-${crypto.randomUUID()}@example.test`;const {user}=await createUserWithEmailAndPassword(firebase.auth,email,password);
  await env.withSecurityRulesDisabled(async(ctx)=>{ const {setDoc}=await import('firebase/firestore');await setDoc(doc(ctx.firestore(),'consultationExperts',user.uid),{id:user.uid,name:'Chuyên gia 01',title:'Chờ bổ sung',organization:'',specialties:'Chờ bổ sung',bio:'',phone:'',availability:'',active:false,status:'pending',internalAccount:true,updatedAt:1,updatedBy:'fixture'}); });
  const { ExpertChatTab } = await server.ssrLoadModule('/src/components/ExpertChatTab.tsx');render(<ExpertChatTab />);
  await screen.findByText(/Chuyên gia 01 · Chờ xác nhận/);assert.equal(screen.queryByRole('button',{name:'Gửi yêu cầu tư vấn'}),null);assert.equal(screen.queryByLabelText('Tin nhắn'),null);
});

test('active expert React replies to an assigned request, persists the reply and closes the conversation', async () => {
  const owner = await farmer();
  const ownerEmail = firebase.auth.currentUser.email;
  const expert = await farmer();
  const expertEmail = firebase.auth.currentUser.email;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(ctx.firestore(), 'consultationExperts', expert.id), {
      id: expert.id, name: 'Chuyên gia kiểm thử UI', title: 'Kỹ sư nông nghiệp',
      organization: 'Đơn vị kiểm thử', specialties: 'Cây ăn quả', bio: '', phone: '',
      availability: '', active: true, status: 'active', internalAccount: false,
      updatedAt: 1, updatedBy: 'fixture',
    });
  });
  await signInWithEmailAndPassword(firebase.auth, ownerEmail, password);
  const service = await server.ssrLoadModule('/src/services/consultations.ts');
  const requestId = await service.createConsultation({
    subject: 'Chuyên gia xử lý vàng lá UI', question: 'Cây vải vàng lá sau mưa, cần kiểm tra những gì?',
    crop: 'Vải', expertId: expert.id,
  });
  const original = (await getDoc(doc(firebase.db, 'consultations', requestId))).data()!;
  await env.withSecurityRulesDisabled(async context => {
    const database = context.firestore();
    const batch = writeBatch(database);
    for (let index = 1; index <= 50; index++) {
      const id = `expert-older-request-${String(index).padStart(3, '0')}`;
      batch.set(doc(database, 'consultations', id), { ...original, id, subject: `Yêu cầu cũ ${index}`, updatedAt: original.updatedAt - index });
    }
    await batch.commit();
  });
  await signInWithEmailAndPassword(firebase.auth, expertEmail, password);
  const { ExpertChatTab } = await server.ssrLoadModule('/src/components/ExpertChatTab.tsx');
  render(<ExpertChatTab />);
  fireEvent.click(await screen.findByRole('button', { name: /Chuyên gia xử lý vàng lá UI/ }));
  await screen.findByLabelText('Tin nhắn');
  change('Tin nhắn', 'Kiểm tra thoát nước và tình trạng rễ cây.');
  fireEvent.click(await screen.findByRole('button', { name: 'Tải thêm yêu cầu', exact: true }));
  await screen.findByRole('button', { name: /Yêu cầu cũ 50/ });
  assert.equal(screen.getByLabelText('Tin nhắn').value, 'Kiểm tra thoát nước và tình trạng rễ cây.');
  fireEvent.submit(screen.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).closest('form'));
  await waitFor(() => assert.equal(screen.getByLabelText('Tin nhắn').value, ''), { timeout: 8000 });
  const request = await getDoc(doc(firebase.db, 'consultations', requestId));
  assert.equal(request.data()!.status, 'in_progress');
  assert.equal(request.data()!.messageCount, 2);
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc tư vấn' }));
  await screen.findByText(/Cuộc tư vấn đã kết thúc/);
  assert.equal(screen.queryByLabelText('Tin nhắn'), null);
  assert.equal(screen.queryByRole('button', { name: 'Mở lại tư vấn' }), null);
  cleanup();
  await signInWithEmailAndPassword(firebase.auth, ownerEmail, password);
  const messages = await getDocs(collection(firebase.db, 'consultations', requestId, 'messages'));
  assert.equal(messages.size, 2);
  assert.ok(messages.docs.some((entry) => entry.data().senderId === expert.id && entry.data().senderRole === 'expert' && entry.data().body === 'Kiểm tra thoát nước và tình trạng rễ cây.'));
  assert.equal((await getDoc(doc(firebase.db, 'consultations', requestId))).data()!.farmerId, owner.id);
  assert.equal((await getDoc(doc(firebase.db, 'consultations', requestId))).data()!.status, 'closed');
});

test('admin React confirms, suspends, revokes and restores expert permission with confirmation checkbox', async () => {
  const owner=await farmer();const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update',{method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({localId:owner.id,customAttributes:JSON.stringify({admin:true})})});assert.equal(response.ok,true);await getIdToken(firebase.auth.currentUser,true);
  const p={id:'expert-ui-admin',name:'Người tư vấn UI',title:'Cán bộ kiểm thử',organization:'Đơn vị kiểm thử',specialties:'Cây ăn quả',bio:'',phone:'',availability:'',active:false,status:'pending',internalAccount:true,updatedAt:1,updatedBy:'fixture'};
  await env.withSecurityRulesDisabled(async(ctx)=>{const {setDoc}=await import('firebase/firestore');await setDoc(doc(ctx.firestore(),'consultationExperts',p.id),p);await setDoc(doc(ctx.firestore(),'farmerApplications',p.id),{id:p.id,email:'expert-ui-admin@example.test',profile:{name:p.name},submittedAt:0});});
  const {AdminConsultations}=await server.ssrLoadModule('/src/components/AdminConsultations.tsx');render(<AdminConsultations page="experts" />);
  await screen.findByText('Người tư vấn UI');
  const publicDetails={avatar:'https://example.test/expert-ui.jpg',badge:'Cán bộ khuyến nông',experienceYears:12,coverCrops:['Vải thiều','Cam đường Canh'],qualifications:['Kỹ sư trồng trọt','Chứng chỉ khuyến nông'],contactEmail:'public-expert-ui@example.test',zalo:'0901234567'};
  let detailsEntered=false;
  for(const status of ['active','suspended','revoked','active']){
    fireEvent.click(screen.getByRole('heading',{name:'Người tư vấn UI',exact:true}).closest('article').querySelector('button'));change('Quyền tư vấn',status);
    if(status==='active'&&!detailsEntered){
      change('Ảnh đại diện (liên kết HTTPS)',publicDetails.avatar);change('Nhóm chuyên gia',publicDetails.badge);change('Số năm kinh nghiệm',String(publicDetails.experienceYears));
      change(/^Cây trồng phụ trách/,publicDetails.coverCrops.join(', '));change(/^Bằng cấp & chứng chỉ/,publicDetails.qualifications.join('\n'));change('Email liên hệ công khai',publicDetails.contactEmail);change('Số Zalo công khai',publicDetails.zalo);
      detailsEntered=true;
    }
    if(status==='active'){const save=screen.getByRole('button',{name:'Lưu quyền chuyên gia'});assert.equal(save.disabled,true);fireEvent.click(screen.getByRole('checkbox',{name:/Tôi đã kiểm tra đúng người/}));assert.equal(save.disabled,false);}
    fireEvent.submit(screen.getByRole('button',{name:'Lưu quyền chuyên gia'}).closest('form'));
    await waitFor(()=>assert.ok(!screen.queryByLabelText('Cấu hình chuyên gia')),{timeout:8000});
    const savedProfile=(await getDoc(doc(firebase.db,'consultationExperts',p.id))).data()!;assert.equal(savedProfile.status,status);
    for(const [key,value] of Object.entries(publicDetails))assert.deepEqual(savedProfile[key],value);
    assert.equal('email' in savedProfile,false);
  }
});

test('expert accounts React: administrator creates, suspends, restores and deletes website access without losing the admin session', async () => {
  const administrator = await farmer();
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update', {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: administrator.id, customAttributes: JSON.stringify({ admin: true }) }),
  });
  assert.equal(response.ok, true); await getIdToken(firebase.auth.currentUser, true);
  const { AdminConsultations } = await server.ssrLoadModule('/src/components/AdminConsultations.tsx');
  const { within } = await import('@testing-library/react');
  const email = `expert-created-ui-${crypto.randomUUID()}@example.test`;
  const name = 'Chuyên gia được tạo từ quản trị UI';
  render(<AdminConsultations page="experts" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo tài khoản chuyên gia', exact: true }));
  const createForm = await screen.findByRole('form', { name: 'Tạo tài khoản chuyên gia', exact: true });
  for (const [label, value] of [
    ['Email đăng nhập', email], ['Mật khẩu ban đầu', password], ['Họ tên chuyên gia', name],
    ['Chức danh', 'Kỹ sư nông nghiệp'], ['Đơn vị công tác', 'Đơn vị kiểm thử giao diện'], ['Lĩnh vực chuyên môn', 'Vải thiều, Bảo vệ thực vật'],
  ]) fireEvent.change(within(createForm).getByLabelText(label, { exact: true }), { target: { value } });
  fireEvent.submit(createForm);
  await screen.findByRole('heading', { name, exact: true }, { timeout: 8000 });
  assert.equal(firebase.auth.currentUser.uid, administrator.id);
  const applications = await getDocs(query(collection(firebase.db, 'farmerApplications'), where('email', '==', email)));
  assert.equal(applications.size, 1);
  const uid = applications.docs[0].id;
  const expertRef = doc(firebase.db, 'consultationExperts', uid), stateRef = doc(firebase.db, 'farmerAccountStates', uid);
  assert.equal((await getDoc(expertRef)).data()!.status, 'pending');
  assert.equal((await getDoc(expertRef)).data()!.active, false);
  assert.equal(JSON.stringify(applications.docs[0].data()).includes(password), false);

  async function decide(action: string, reason: string, deleteEmail?: string) {
    const card = await screen.findByRole('article', { name, exact: true });
    fireEvent.click(within(card).getByRole('button', { name: action, exact: true }));
    const form = await screen.findByRole('form', { name: 'Xử lý tài khoản chuyên gia', exact: true });
    const confirmButton = within(form).getByRole('button', { name: 'Xác nhận xử lý tài khoản', exact: true });
    assert.equal((confirmButton as HTMLButtonElement).disabled, true);
    fireEvent.change(within(form).getByLabelText('Lý do xử lý', { exact: true }), { target: { value: reason } });
    if (deleteEmail) {
      const emailInput = within(form).getByLabelText('Nhập email chuyên gia để xác nhận xóa', { exact: true });
      fireEvent.change(emailInput, { target: { value: 'wrong@example.test' } });
      assert.equal((confirmButton as HTMLButtonElement).disabled, true);
      fireEvent.change(emailInput, { target: { value: deleteEmail } });
    }
    assert.equal((confirmButton as HTMLButtonElement).disabled, false);
    fireEvent.submit(form);
    await waitFor(() => assert.equal(Boolean(screen.queryByRole('form', { name: 'Xử lý tài khoản chuyên gia', exact: true })), false), { timeout: 8000 });
    assert.equal(firebase.auth.currentUser.uid, administrator.id);
  }

  await decide('Tạm dừng tài khoản', 'Tạm dừng để kiểm tra hồ sơ chuyên gia');
  assert.equal((await getDoc(stateRef)).data()!.status, 'suspended');
  assert.equal((await getDoc(expertRef)).data()!.status, 'suspended');
  await decide('Khôi phục tài khoản', 'Cho phép bổ sung và xác nhận lại hồ sơ');
  assert.equal((await getDoc(stateRef)).data()!.status, 'active');
  assert.equal((await getDoc(expertRef)).data()!.status, 'pending');
  assert.equal((await getDoc(expertRef)).data()!.active, false);
  await decide('Xóa khỏi website', 'Dừng hoạt động theo yêu cầu thử nghiệm', email);
  assert.equal((await getDoc(stateRef)).data()!.status, 'deleted');
  assert.equal((await getDoc(expertRef)).data()!.status, 'revoked');
  assert.equal((await getDoc(doc(firebase.db, 'farmerApplications', uid))).exists(), true);
  const actions = await getDocs(query(collection(firebase.db, 'farmerAccountActions'), where('farmerId', '==', uid)));
  assert.equal(actions.size, 3);
  assert.equal(actions.docs.every(action => action.data().reviewerId === administrator.id), true);
});

function mockGardenImages() {
 const bitmap=globalThis.createImageBitmap,context=dom.window.HTMLCanvasElement.prototype.getContext,data=dom.window.HTMLCanvasElement.prototype.toDataURL;
 (globalThis as any).createImageBitmap=async()=>({width:100,height:100,close(){}});
 (dom.window.HTMLCanvasElement.prototype as any).getContext=()=>({fillStyle:'',fillRect(){},drawImage(){}});
 dom.window.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/jpeg;base64,/9j/2Q==';
 return ()=>{(globalThis as any).createImageBitmap=bitmap;dom.window.HTMLCanvasElement.prototype.getContext=context;dom.window.HTMLCanvasElement.prototype.toDataURL=data;};
}
function gardenFiles(){return [new dom.window.File(['a'],'garden1.jpg',{type:'image/jpeg'}),new dom.window.File(['b'],'garden2.jpg',{type:'image/jpeg'})];}
test('garden media React: introduction inserts images and video inside text and persists the exact order', async()=>{
 const owner=await farmer();let closed=false;const restore=mockGardenImages();
 try {
 render(<OrchardDeclarationModal isOpen currentFarmer={owner} onClose={()=>{closed=true;}} onSaveFarmer={(value:FarmerAccount)=>store.saveFarmer(value)} />);
 change('Giới thiệu nhà vườn','TrướcSau');const input=screen.getByLabelText('Giới thiệu nhà vườn');input.focus();input.setSelectionRange(5,5);fireEvent.select(input);
 fireEvent.change(screen.getByLabelText('Chèn ảnh vào giới thiệu'),{target:{files:gardenFiles()}});
 await waitFor(()=>assert.equal(screen.getAllByRole('button',{name:'Bỏ ảnh',exact:true}).length,2));
 assert.equal(screen.getByLabelText('Giới thiệu nhà vườn').value,'Trước');assert.equal(screen.getByLabelText('Đoạn giới thiệu 3').value,'Sau');
 const last=screen.getByLabelText('Đoạn giới thiệu 3');last.focus();last.setSelectionRange(3,3);fireEvent.select(last);
 fireEvent.click(screen.getByRole('button',{name:'Chèn video'}));change('Liên kết video','https://youtu.be/abcDEF123_-');fireEvent.click(screen.getByRole('button',{name:'Chèn vào nội dung'}));
 change('Đoạn giới thiệu 4','Kết thúc');assert.equal(screen.queryByLabelText('Chú thích 1'),null);
 fireEvent.click(screen.getByRole('button',{name:/Gửi hồ sơ cho quản trị duyệt/}));await waitFor(()=>assert.equal(closed,true),{timeout:8000});
 const profile=(await getDoc(doc(firebase.db,'farmers',owner.id))).data()!;const intro=profile.introductionContent;
 assert.deepEqual(intro.media.map((b:string)=>b.startsWith('i:')?'image':'video'),['image','image','video']);
 assert.equal(intro.paragraphs[0],'Trước');assert.equal(intro.paragraphs[2],'Sau');assert.equal(intro.paragraphs[3],'Kết thúc');
 cleanup();const {withFarmer}=await server.ssrLoadModule('/src/hooks/useFarmData.ts');render(<TraceabilityPage product={withFarmer(product(owner),{...owner,...profile})} loading={false} error="" onBack={()=>{}} />);
 const blocks=screen.getByLabelText('Nội dung giới thiệu').children;assert.equal(blocks[0].textContent,'Trước');assert.ok(blocks[1].querySelector('img'));assert.equal(blocks[4].textContent,'Sau');assert.ok(blocks[5].querySelector('iframe'));assert.equal(blocks[6].textContent,'Kết thúc');
 cleanup();render(<OrchardDeclarationModal isOpen currentFarmer={{...owner,...profile}} onClose={()=>{}} onSaveFarmer={(value:FarmerAccount)=>store.saveFarmer(value)} />);
 assert.equal(screen.getByLabelText('Đoạn giới thiệu 4').value,'Kết thúc');fireEvent.click(screen.getByRole('button',{name:'Bỏ video',exact:true}));assert.equal(screen.getByLabelText('Đoạn giới thiệu 3').value,'SauKết thúc');
 }finally{restore();}
});
test('garden media React: community publishes two images and two videos and reloads all attachments',async()=>{
 const owner=await farmer(),restore=mockGardenImages();try{
 render(<RealtimeCommunity farmer={owner} onLogin={()=>{}}/>);change('Bài viết mới','Bài vườn nhiều ảnh và video');
 fireEvent.change(screen.getByLabelText('Ảnh bài đăng'),{target:{files:gardenFiles()}});await screen.findByRole('button',{name:'Bỏ mục 2'});
 for(const url of ['https://youtu.be/abcDEF123_-','https://example.test/garden.mp4']){fireEvent.click(screen.getByRole('button',{name:'Chèn video'}));change('Liên kết video',url);fireEvent.click(screen.getByRole('button',{name:'Thêm video vào bài'}));}
 assert.ok(screen.getByRole('button',{name:'Bỏ mục 4'}));assert.equal(screen.queryByLabelText('Chú thích 1'),null);
 fireEvent.submit(screen.getByRole('button',{name:'Đăng bài'}).closest('form'));await waitFor(()=>assert.equal(screen.getByLabelText('Bài viết mới').value,''),{timeout:8000});
 const rows=await getDocs(collection(firebase.db,'posts'));assert.equal(rows.size,1);assert.deepEqual(rows.docs[0].data().media.map((m:any)=>m.type),['image','image','video','video']);
 cleanup();render(<RealtimeCommunity onLogin={()=>{}}/>);await screen.findByText('Bài vườn nhiều ảnh và video');await waitFor(()=>assert.equal(document.querySelectorAll('article figure img').length,2));assert.equal(document.querySelectorAll('article video').length,1);assert.equal(document.querySelectorAll('article iframe').length,1);
 }finally{restore();}
});
test('seasonal notices React: expert publishes and farmer sees relevant notice; withdrawal and suspension remove it in realtime',async()=>{
 const owner=await farmer(),ownerEmail=firebase.auth.currentUser.email;const expert=await farmer(),expertEmail=firebase.auth.currentUser.email;
 await env.withSecurityRulesDisabled(async(ctx)=>{const {setDoc}=await import('firebase/firestore');await setDoc(doc(ctx.firestore(),'consultationExperts',expert.id),{id:expert.id,name:'Chuyên gia mùa vụ UI',title:'Kỹ sư',organization:'Đơn vị thử',specialties:'Vải',bio:'',phone:'',availability:'',active:true,status:'active',internalAccount:false,updatedAt:1,updatedBy:'fixture'});});
 const {SeasonalNoticeEditor}=await server.ssrLoadModule('/src/components/SeasonalNotices.tsx');const service=await server.ssrLoadModule('/src/services/seasonalNotices.ts');const {vietnamDate}=await server.ssrLoadModule('/src/utils/seasonalNotices.ts');
 render(<SeasonalNoticeEditor uid={expert.id}/>);change('Tiêu đề thông báo','Lưu ý mùa vụ vải từ chuyên gia');change('Cây trồng áp dụng','lychee');change('Từ ngày',vietnamDate());change('Đến ngày','2030-12-31');change('Nội dung lưu ý','Nội dung kiểm thử lịch canh tác theo mùa vụ.');
 fireEvent.submit(screen.getByRole('button',{name:'Đăng thông báo mùa vụ'}).closest('form'));await screen.findByText('Đã đăng thông báo mùa vụ cho nhà vườn.',{},{timeout:8000});
 const rows=await getDocs(query(collection(firebase.db,'seasonalNotices'),where('authorId','==',expert.id)));assert.equal(rows.size,1);const id=rows.docs[0].id;assert.equal(rows.docs[0].data().authorId,expert.id);
 await service.publishSeasonalNotice({title:'Lưu ý cây cam riêng',body:'Thông báo kiểm thử dành riêng cây cam.',crop:'orange',from:vietnamDate(),until:'2030-12-31'});
 cleanup();await signInWithEmailAndPassword(firebase.auth,ownerEmail,password);const {OverviewTab}=await server.ssrLoadModule('/src/components/OverviewTab.tsx');render(<OverviewTab currentFarmer={owner} produceList={[]} setActiveTab={()=>{}} onSelectProduct={()=>{}}/>);
 await screen.findByText('Lưu ý mùa vụ vải từ chuyên gia',{},{timeout:8000});assert.equal(screen.queryByText('Lưu ý cây cam riêng'),null);assert.equal(screen.queryByRole('button',{name:'Sửa hồ sơ & vị trí vườn'}),null);
 await signInWithEmailAndPassword(firebase.auth,expertEmail,password);await service.setSeasonalNoticePublished(id,false);await waitFor(()=>assert.equal(Boolean(screen.queryByText('Lưu ý mùa vụ vải từ chuyên gia')),false),{timeout:8000});
 await service.setSeasonalNoticePublished(id,true);await screen.findByText('Lưu ý mùa vụ vải từ chuyên gia');
 await env.withSecurityRulesDisabled(async(ctx)=>{const {setDoc}=await import('firebase/firestore');await setDoc(doc(ctx.firestore(),'farmerAccountStates',expert.id),{status:'suspended'});});await waitFor(()=>assert.equal(Boolean(screen.queryByText('Lưu ý mùa vụ vải từ chuyên gia')),false),{timeout:8000});
});
test('seasonal notices React: approved farm page removes crossed approval banner and duplicate edit action',async()=>{
 await farmer();render(<App/>);fireEvent.click(await screen.findByRole('link',{name:'Vườn của tôi'},{timeout:8000}));
 await screen.findByLabelText('Lưu ý mùa vụ từ chuyên gia',{},{timeout:8000});await waitFor(()=>assert.equal(Boolean(screen.queryByLabelText('Trạng thái duyệt nhà vườn')),false),{timeout:8000});
 assert.equal(screen.queryByText('Đã được duyệt đăng thông tin'),null);assert.equal(screen.queryByRole('button',{name:'Sửa hồ sơ & vị trí vườn'}),null);
});
test('role landing React: farmer enters overview after login/remount and manual navigation survives token refresh',async()=>{
 await farmer();render(<App/>);await screen.findByRole('heading',{name:'Trang trại của tôi',level:1},{timeout:8000});
 assert.equal(screen.getByRole('button',{name:'Tổng quan',exact:true}).getAttribute('aria-current'),'page');
 fireEvent.click(screen.getByRole('button',{name:'Sạp trái cây',exact:true}));await screen.findByRole('heading',{name:/Vị ngọt từ trái/,level:1});
 await act(async()=>{await getIdToken(firebase.auth.currentUser,true);});assert.ok(screen.getByRole('heading',{name:/Vị ngọt từ trái/,level:1}));
 cleanup();render(<App/>);await screen.findByRole('heading',{name:'Trang trại của tôi',level:1},{timeout:8000});
});
test('role landing React: guest and customer stay on market; late farmer registration switches to overview',async()=>{
 await signOut(firebase.auth);render(<App/>);await screen.findByRole('heading',{name:/Vị ngọt từ trái/,level:1},{timeout:8000});
 const {signInAnonymously}=await import('firebase/auth');await act(async()=>{await signInAnonymously(firebase.auth);});assert.ok(screen.getByRole('heading',{name:/Vị ngọt từ trái/,level:1}));
 const email='customer-'+crypto.randomUUID()+'@example.test';await act(async()=>{await createUserWithEmailAndPassword(firebase.auth,email,password);});
 await screen.findByRole('link',{name:'Vườn của tôi'},{timeout:8000});assert.ok(screen.getByRole('heading',{name:/Vị ngọt từ trái/,level:1}));
 const user=firebase.auth.currentUser;const profile={id:user.uid,name:'Nhà vườn mới',avatar:'',location:'',shortLocation:'',commune:'',role:'Chủ nhà vườn',cropFocus:'',areaHa:0,treeCount:0,phone:'',pucCode:'',certification:'Chưa chứng nhận'};
 const {setDoc}=await import('firebase/firestore');await setDoc(doc(firebase.db,'farmerApplications',user.uid),{id:user.uid,email,profile,status:'draft',revision:1,submittedAt:0,reviewedAt:0,reviewedBy:'',reviewNote:''});
 await screen.findByRole('heading',{name:'Trang trại của tôi',level:1},{timeout:8000});
});
test('role landing React: admin waits for claims, overrides farmer profile and resets after switching account/logout',async()=>{
 const owner=await farmer(),ownerEmail=firebase.auth.currentUser.email;await farmer();const admin=firebase.auth.currentUser;
 const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update',{method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({localId:admin.uid,customAttributes:JSON.stringify({admin:true})})});assert.equal(response.ok,true);await getIdToken(admin,true);
 const original=admin.getIdTokenResult.bind(admin);let release=()=>{};const gate=new Promise<void>(r=>{release=r;});admin.getIdTokenResult=async(...args:any[])=>{await gate;return original(...args);};
 try{render(<App/>);await screen.findByText('Đang xác định trang phù hợp với tài khoản…');assert.equal(Boolean(screen.queryByRole('heading',{name:'Trang trại của tôi',level:1})),false);await act(async()=>{release();});await screen.findByRole('heading',{name:'Quản trị & Duyệt hồ sơ',level:1},{timeout:8000});}finally{release();admin.getIdTokenResult=original;}
 cleanup();render(<App/>);await screen.findByRole('heading',{name:'Quản trị & Duyệt hồ sơ',level:1},{timeout:8000});
 await act(async()=>{await signInWithEmailAndPassword(firebase.auth,ownerEmail,password);});await screen.findByRole('heading',{name:'Trang trại của tôi',level:1},{timeout:8000});assert.equal(Boolean(screen.queryByRole('button',{name:'Quản trị & Duyệt hồ sơ'})),false);
 await act(async()=>{await signOut(firebase.auth);});await screen.findByRole('heading',{name:/Vị ngọt từ trái/,level:1},{timeout:8000});assert.equal(owner.id!==admin.uid,true);
});
test('role landing React: direct product/QR links remain open for authenticated farmers',async()=>{
 const owner=await farmer(),item=product(owner);await store.saveProduce(item,true);
 try{for(const path of ['/nong-san/'+item.id,'/#trace/'+item.id]){cleanup();window.history.replaceState({},'',path);render(<App/>);await screen.findByRole('heading',{name:item.name,level:1},{timeout:8000});assert.equal(Boolean(screen.queryByRole('heading',{name:'Trang trại của tôi',level:1})),false);}}finally{cleanup();window.history.replaceState({},'','/');}
});
test('role landing React: legacy public farmer without an application still enters overview',async()=>{
 const owner=await farmer();await env.withSecurityRulesDisabled(async(ctx)=>{const {deleteDoc}=await import('firebase/firestore');await deleteDoc(doc(ctx.firestore(),'farmerApplications',owner.id));});
 render(<App/>);await screen.findByRole('heading',{name:'Trang trại của tôi',level:1},{timeout:8000});assert.equal(screen.getByRole('button',{name:'Tổng quan',exact:true}).getAttribute('aria-current'),'page');
});
test('role landing React: internal expert keeps expert workspace without farmer publishing authority',async()=>{
 const {user}=await createUserWithEmailAndPassword(firebase.auth,'internal-'+crypto.randomUUID()+'@example.test',password);
 await env.withSecurityRulesDisabled(async(ctx)=>{const {setDoc}=await import('firebase/firestore');await setDoc(doc(ctx.firestore(),'consultationExperts',user.uid),{id:user.uid,name:'Chuyên gia đang chờ',title:'Chờ bổ sung',organization:'',specialties:'Chờ bổ sung',bio:'',phone:'',availability:'',active:false,status:'pending',internalAccount:true,updatedAt:1,updatedBy:'fixture'});});
 render(<App/>);await screen.findByRole('heading',{name:'Trợ lý canh tác',level:1},{timeout:8000});await screen.findByText(/Chuyên gia đang chờ · Chờ xác nhận/,{},{timeout:8000});assert.equal(Boolean(screen.queryByRole('button',{name:'Đăng thông báo mùa vụ'})),false);
});

test('React community share opens an older post and follows browser history', async () => {
  const owner = await farmer();
  const { communityPostUrl } = await server.ssrLoadModule('/src/utils/communityLinks.ts');
  const postId = 'bài-viết-được-chia-sẻ';
  const content = 'Bài chia sẻ cũ được mở qua liên kết.';
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const batch = writeBatch(db);
    const post = { ownerId: owner.id, author: owner.name, image: '' };
    batch.set(doc(db, 'posts', postId), { ...post, id: postId, content, createdAt: 1 });
    for (let index = 0; index < 50; index += 1) {
      const id = `recent-${index}`;
      batch.set(doc(db, 'posts', id), { ...post, id, content: `Bài mới ${index}`, createdAt: index + 2 });
    }
    await batch.commit();
  });

  try {
    const url = communityPostUrl(postId);
    window.history.replaceState({}, '', url);
    render(<App />);
    await screen.findByText(content, {}, { timeout: 8000 });
    fireEvent.click(screen.getByRole('link', { name: 'Chuyển đến nội dung chính' }));
    assert.equal(window.location.href, url);
    assert.equal(document.activeElement, screen.getByRole('main'));
    fireEvent.click(screen.getByRole('button', { name: 'Sạp trái cây', exact: true }));
    await screen.findByRole('heading', { name: /Vị ngọt từ trái/, level: 1 });
    assert.equal(window.location.hash, '');

    await act(async () => { window.history.back(); });
    await screen.findByText(content, {}, { timeout: 8000 });
    await act(async () => { window.history.forward(); });
    await screen.findByRole('heading', { name: /Vị ngọt từ trái/, level: 1 });
  } finally {
    cleanup();
    window.history.replaceState({}, '', '/');
  }
});
