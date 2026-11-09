import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MarketplaceTab } from './components/MarketplaceTab';
import { useFarmData } from './hooks/useFarmData';
import { auth, firebaseConfigured, requireFarmer } from './lib/firebase';
import { addProductLog, saveFarmer, saveProduce } from './services/farmStore';
import { ownsProduct, getFarmerProduce } from './utils/farmerProduct';
import type { CultivationLogInput, CultivationLogType } from './utils/cultivationLogs';
import type { ActiveTab, CartItem, FarmerAccount, ProduceItem } from './types/agriculture';
import type { ConsultationDraft } from './types/consultations';
import { applicationLabels } from './services/moderation';
import { SiteFooter } from './components/SiteFooter';
import { ProductDetailBoundary } from './components/ProductDetailBoundary';
import { isAccountRestricted } from './services/accountModeration';
import { applyMetadata, homeMetadata, productMetadata, readProductId, SITE_URL } from './utils/seo';
import { readCommunityPostId } from './utils/communityLinks';
import { roleLandingTab } from './utils/roleLanding';

const OverviewTab = lazy(() => import('./components/OverviewTab').then((m) => ({ default: m.OverviewTab })));
const GardenLocationTab = lazy(() => import('./components/GardenLocationTab').then((m) => ({ default: m.GardenLocationTab })));
const WeatherTab = lazy(() => import('./components/WeatherTab').then((m) => ({ default: m.WeatherTab })));
const CalendarTab = lazy(() => import('./components/CalendarTab').then((m) => ({ default: m.CalendarTab })));
const CommunityTab = lazy(() => import('./components/RealtimeCommunity').then((m) => ({ default: m.RealtimeCommunity })));
const AssistantTab = lazy(() => import('./components/AssistantTab').then((m) => ({ default: m.AssistantTab })));
const ProductDetailModal = lazy(() => import('./components/ProductDetailModal').then((m) => ({ default: m.ProductDetailModal })));
const CartModal = lazy(() => import('./components/CartModal').then((m) => ({ default: m.CartModal })));
const AuthModal = lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
const OrchardDeclarationModal = lazy(() => import('./components/OrchardDeclarationModal').then((m) => ({ default: m.OrchardDeclarationModal })));
const AddProduceModal = lazy(() => import('./components/AddProduceModal').then((m) => ({ default: m.AddProduceModal })));
const EditProduceModal = lazy(() => import('./components/EditProduceModal').then((m) => ({ default: m.EditProduceModal })));
const OrdersTab = lazy(() => import('./components/OrdersTab').then((m) => ({ default: m.OrdersTab })));
const AdminTab = lazy(() => import('./components/AdminTab').then((m) => ({ default: m.AdminTab })));
const TraceabilityPage = lazy(() => import('./components/Traceability').then((m) => ({ default: m.TraceabilityPage })));

const emptyFarmer: FarmerAccount = {
  id: '', name: 'Nhà vườn', avatar: import.meta.env.BASE_URL + 'farmer-avatar.svg', location: '', shortLocation: '',
  commune: '', role: 'Chủ vườn', cropFocus: '', areaHa: 0, treeCount: 0, phone: '', pucCode: '', certification: 'Chưa chứng nhận',
};
const titles: Record<ActiveTab, string> = {
  market: 'Sạp trái cây', overview: 'Trang trại số', garden_map: 'Vị trí khu vườn', weather: 'Thời tiết',
  calendar: 'Lịch canh tác', community: 'Cộng đồng', assistant: 'Tư vấn canh tác', orders: 'Quản lý đơn hàng',
  admin: 'Quản trị & Duyệt hồ sơ',
};
function readTraceId() {
  return typeof window === 'undefined' ? '' : readProductId(window.location.pathname, window.location.hash);
}
function readLinkedPostId() {
  return typeof window === 'undefined' ? '' : readCommunityPostId(window.location.hash);
}
export default function App() {
  const [traceId, setTraceId] = useState(readTraceId);
  const [communityPostId, setCommunityPostId] = useState(readLinkedPostId);
  const { user, expertAccount, isAdmin, identityReady, identityError, application, applicationLoading, accountState, farmers, products: produceList, currentFarmer: cloudFarmer, loading, error, certificatesLoading, canLoadMore, loadMore } = useFarmData(traceId);
  const currentFarmer = cloudFarmer || { ...emptyFarmer, id: user?.uid || '', name: user?.displayName || 'Nhà vườn' };
  const isLoggedIn = Boolean(user && !user.isAnonymous);
  const [selectedTab, setSelectedTab] = useState<ActiveTab>('market');
  const activeTab = communityPostId ? 'community' : selectedTab;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductView, setSelectedProductView] = useState<'info' | 'qr'>('info');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [consultationDraft, setConsultationDraft] = useState<ConsultationDraft>();
  const [isDeclareOrchardOpen, setIsDeclareOrchardOpen] = useState(false);
  const [isAddProduceOpen, setIsAddProduceOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProduceItem | null>(null);
  const [toast, setToast] = useState('');
  const [assistantSubTab, setAssistantSubTab] = useState<'chat' | 'diagnosis' | 'experts'>('chat');
  const defaultTab = roleLandingTab({ signedIn: isLoggedIn, admin: isAdmin, internalExpert: Boolean(expertAccount?.internalAccount), farmer: Boolean(application || cloudFarmer) });
  const entryKey = `${isLoggedIn ? user!.uid : 'guest'}:${defaultTab}`;
  const [landedKey, setLandedKey] = useState('');
  useEffect(() => {
    if (!identityReady || traceId || landedKey === entryKey) return;
    setLandedKey(entryKey);
    const resumeConsultation = consultationDraft && isLoggedIn && !isAdmin && !expertAccount;
    setSelectedTab(resumeConsultation ? 'assistant' : defaultTab);
    setIsSidebarOpen(false);
    if (resumeConsultation || defaultTab === 'assistant') setAssistantSubTab('experts');
    if (isLoggedIn && (isAdmin || expertAccount)) setConsultationDraft(undefined);
  }, [identityReady, traceId, landedKey, entryKey, defaultTab, consultationDraft, isLoggedIn, isAdmin, expertAccount]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedProduct = produceList.find((product) => product.id === selectedProductId);
  const liveCart = cartItems.map((line) => ({ ...line, item: produceList.find((product) => product.id === line.item.id) || line.item }));
  useEffect(() => {
    const change = () => {
      setTraceId(readTraceId());
      const postId = readLinkedPostId();
      setCommunityPostId(postId);
      if (postId) setIsSidebarOpen(false);
    };
    window.addEventListener('hashchange', change);
    window.addEventListener('popstate', change);
    return () => { window.removeEventListener('hashchange', change); window.removeEventListener('popstate', change); };
  }, []);
  const traceProduct = produceList.find((product) => product.id === traceId);
  useEffect(() => {
    if (traceId && !traceProduct && loading) return;
    const site = import.meta.env.VITE_PUBLIC_SITE_URL || SITE_URL;
    const meta = traceProduct ? productMetadata(traceProduct, site) : homeMetadata(site);
    if (traceId && !traceProduct) { meta.title = loading ? 'Đang tải trái cây | Trái ngọt Bắc Ninh' : 'Không tìm thấy trái cây | Trái ngọt Bắc Ninh'; meta.robots = 'noindex, follow'; delete meta.structuredData; }
    else if (!traceId && activeTab !== 'market') { meta.title = `${titles[activeTab]} | Trái ngọt Bắc Ninh`; meta.robots = 'noindex, follow'; delete meta.structuredData; }
    applyMetadata(meta);
  }, [activeTab, traceId, traceProduct, loading]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  function setActiveTab(tab: ActiveTab) {
    if (communityPostId) {
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.pushState({}, '', url);
      setCommunityPostId('');
    }
    setSelectedTab(tab);
  }
  function notify(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message); toastTimer.current = setTimeout(() => setToast(''), 5000);
  }
  function farmerAction(action: () => void, needsApproval = true) {
    if (isAccountRestricted(accountState)) { notify('Tài khoản đã bị tạm dừng hoặc xóa khỏi website. Vui lòng liên hệ quản trị.'); return; }
    if (certificatesLoading) { notify('Đang tải giấy chứng nhận của vườn. Vui lòng chờ một chút rồi mở lại.'); return; }
    if (!isLoggedIn) { setIsAuthOpen(true); return; }
    if (applicationLoading) { notify('Đang tải trạng thái duyệt hồ sơ.'); return; }
    try {
      requireFarmer();
      if (needsApproval && application?.status !== 'approved') { notify('Tài khoản và hồ sơ cần được quản trị duyệt trước khi đăng thông tin.'); setActiveTab('overview'); return; }
      if (!needsApproval && application?.status === 'suspended') { notify('Quyền đăng đang bị khóa. Liên hệ quản trị theo ghi chú trong hồ sơ.'); return; }
      action();
    } catch (error) { notify((error as Error).message); setIsAuthOpen(true); }
  }
  function openEdit(product?: ProduceItem) {
    farmerAction(() => {
      const target = product || getFarmerProduce(currentFarmer, produceList);
      if (!target || !ownsProduct(currentFarmer, target)) { notify('Chưa có bài đăng thuộc tài khoản của bạn.'); return; }
      setEditingProduct(target);
    });
  }
  async function updateFarmer(value: FarmerAccount) { await saveFarmer(value); notify('Đã gửi hồ sơ cho quản trị duyệt. Bản mới chưa công khai cho khách.'); }
  async function addProduce(value: ProduceItem) {
    await saveProduce(value, true); setSelectedProductView('qr'); setSelectedProductId(value.id); setActiveTab('market');
    notify('Đã đăng bán. Tải tem tại mục “Tem QR đóng hộp” của bài đăng.');
  }
  function openProduct(product: ProduceItem) { setSelectedProductView('info'); setSelectedProductId(product.id); }
  async function updateProduce(value: ProduceItem) { await saveProduce(value); notify('Đã lưu bài đăng trái cây.'); }
  async function addLog(type: CultivationLogType, value: CultivationLogInput, productId?: string) {
    const product = produceList.find((item) => item.id === productId);
    if (!product || !ownsProduct(currentFarmer, product)) throw new Error('Hãy chọn đúng trái cây của nhà vườn để ghi nhật ký.');
    await addProductLog(product.id, type, value); notify('Đã đồng bộ nhật ký lên hồ sơ truy xuất.');
  }
  function addCart(product: ProduceItem, quantity = 1) {
    if (!Number.isInteger(quantity) || quantity < 1 || product.inStock < 1) { notify('Trái cây đã hết hàng.'); return; }
    const existing = cartItems.find((line) => line.item.id === product.id);
    if ((existing?.quantity || 0) + quantity > product.inStock) { notify('Số lượng vượt quá tồn kho hiện tại.'); return; }
    if (!existing && cartItems.length >= 5) { notify('Mỗi lần đặt tối đa 5 loại trái cây.'); return; }
    setCartItems((previous) => existing ? previous.map((line) => line.item.id === product.id ? { item: product, quantity: line.quantity + quantity } : line) : [...previous, { item: product, quantity }]);
    notify('Đã thêm vào giỏ hàng.');
  }
  function updateQuantity(id: string, delta: number) {
    const product = produceList.find((item) => item.id === id);
    setCartItems((previous) => previous.map((line) => line.item.id === id ? { ...line, quantity: Math.min(product?.inStock || 0, line.quantity + delta) } : line).filter((line) => line.quantity > 0));
  }
  if (isAccountRestricted(accountState)) return <main className="min-h-screen flex items-center justify-center bg-stone-50 p-6"><section className="bg-white border rounded-3xl p-6 max-w-lg space-y-4"><h1 className="ui-section-title">{accountState?.status === 'deleted' ? 'Tài khoản đã bị xóa khỏi website' : 'Tài khoản đang tạm dừng'}</h1><p role="alert">Quản trị đã dừng hoạt động của tài khoản này. Bạn không thể đăng bán, nhận đơn mới, gửi hoặc trả lời tư vấn. Vui lòng liên hệ quản trị để được xem xét khôi phục.</p><p className="text-sm text-muted">Đơn hàng, hội thoại cũ và lịch sử xử lý được giữ để đối chiếu.</p><button className="ui-button-primary px-4 py-2" onClick={() => auth && signOut(auth)}>Đăng xuất</button></section></main>;
  if (traceId) return <Suspense fallback={<p className="p-8">Đang tải hồ sơ…</p>}><TraceabilityPage product={traceProduct} loading={loading} error={error || (!firebaseConfigured ? 'Firebase chưa cấu hình' : '')} onBack={() => { window.history.pushState({}, '', import.meta.env.BASE_URL || '/'); setTraceId(''); setCommunityPostId(''); }} /></Suspense>;
  if (!isAuthOpen && landedKey !== entryKey) return <main className="min-h-screen flex items-center justify-center p-6"><div className="space-y-3"><p role={identityError ? 'alert' : 'status'}>{identityError || 'Đang xác định trang phù hợp với tài khoản…'}</p>{identityError && <button className="ui-button-primary px-4 py-2" onClick={() => window.location.reload()}>Tải lại trang</button>}</div></main>;
  const managementMode = isLoggedIn && activeTab !== 'market';
  return <div className="site-app">
    <a href="#main-content" className="sr-only focus:not-sr-only" onClick={communityPostId ? (event) => {
      event.preventDefault();
      document.getElementById('main-content')?.focus();
    } : undefined}>Chuyển đến nội dung chính</a>
    {toast && <div role="status" className="fixed top-3 right-3 max-w-md bg-emerald-900 text-white p-4 rounded-2xl shadow-xl z-[70]">{toast}</div>}
    <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} cartCount={cartItems.reduce((sum, line) => sum + line.quantity, 0)} isAdmin={isAdmin} permanent={managementMode} />
    <div className={managementMode ? 'site-frame workspace-frame lg:pl-72' : 'site-frame'}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onOpenSidebar={() => setIsSidebarOpen(true)} cartCount={cartItems.reduce((sum, line) => sum + line.quantity, 0)} onOpenCart={() => setIsCartOpen(true)} currentFarmer={currentFarmer} isLoggedIn={isLoggedIn} onLogout={async () => { try { if (auth) await signOut(auth); setActiveTab('market'); } catch { notify('Chưa đăng xuất được. Vui lòng thử lại.'); } }} onOpenQuickLogin={() => setIsAuthOpen(true)} onOpenDeclareOrchard={() => farmerAction(() => setIsDeclareOrchardOpen(true), false)} onOpenAddProduce={() => farmerAction(() => setIsAddProduceOpen(true))} onOpenEditProduce={() => openEdit()} />
      <main id="main-content" tabIndex={communityPostId ? -1 : undefined} className={activeTab === 'market' ? 'site-main' : 'workspace-main'}>
        {!firebaseConfigured && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4">Website đang chờ kết nối dịch vụ dữ liệu. Chức năng đăng ký, lưu vườn và đặt hàng sẽ hoạt động khi quản trị viên hoàn tất cấu hình Firebase.</p>}
        {error && <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4">Không thể đồng bộ dữ liệu: {error}</p>}
        {isLoggedIn && !expertAccount?.internalAccount && !user?.emailVerified && <button onClick={() => setIsAuthOpen(true)} className="w-full rounded-2xl bg-amber-50 p-4 text-left">Xác minh email để cập nhật vườn và đăng bán →</button>}
        {isLoggedIn && !isAdmin && !expertAccount && application?.status !== 'approved' && <section className="rounded-2xl p-4 space-y-2 bg-amber-50" aria-label="Trạng thái duyệt nhà vườn"><p className="font-bold">{applicationLoading ? 'Đang kiểm tra trạng thái hồ sơ…' : application ? applicationLabels[application.status] : 'Cần gửi hồ sơ để quản trị duyệt'}</p>{application?.reviewNote && <p>Quản trị ghi chú: {application.reviewNote}</p>}<p className="text-sm">Tài khoản và hồ sơ phải được duyệt trước khi đăng bán, ghi nhật ký công khai hoặc chia sẻ cộng đồng. Khi sửa hồ sơ, bản mới cần duyệt lại; khách tiếp tục thấy bản công khai đã có.</p>{application?.status !== 'suspended' && <button onClick={() => farmerAction(() => setIsDeclareOrchardOpen(true), false)} className="text-emerald-800 font-bold underline">Hoàn thiện hồ sơ & gửi duyệt</button>}</section>}
        <Suspense fallback={<p className="p-8">Đang tải chuyên mục…</p>}>
          {activeTab === 'market' && <MarketplaceTab loading={loading} produceList={produceList} currentFarmer={currentFarmer} isLoggedIn={isLoggedIn} onSelectProduct={openProduct} onAddToCart={addCart} onOpenAddProduce={() => farmerAction(() => setIsAddProduceOpen(true))} onOpenQuickLogin={() => setIsAuthOpen(true)} onOpenEditProduce={openEdit} />}
          {activeTab === 'overview' && (isLoggedIn ? <OverviewTab produceList={produceList} currentFarmer={currentFarmer} isLoggedIn setActiveTab={setActiveTab} onSelectProduct={openProduct} onOpenQuickLogin={() => setIsAuthOpen(true)} onOpenDeclareOrchard={() => farmerAction(() => setIsDeclareOrchardOpen(true), false)} onOpenAddProduce={() => farmerAction(() => setIsAddProduceOpen(true))} onOpenEditProduce={openEdit} onOpenDiagnosis={() => { setAssistantSubTab('diagnosis'); setActiveTab('assistant'); }} /> : <div className="bg-white rounded-3xl p-6 space-y-3"><h2 className="text-xl font-bold">Trang trại của bạn</h2><p>Đăng nhập để quản lý khu vườn, trái cây và đơn hàng.</p><button onClick={() => setIsAuthOpen(true)} className="ui-button-primary p-3">Đăng nhập / Đăng ký</button></div>)}
          {activeTab === 'garden_map' && <GardenLocationTab products={produceList} currentFarmer={isLoggedIn ? currentFarmer : undefined} onEdit={() => farmerAction(() => setIsDeclareOrchardOpen(true), false)} />}
          {activeTab === 'weather' && <WeatherTab />}
          {activeTab === 'calendar' && <CalendarTab key={user?.uid || 'guest'} currentFarmer={currentFarmer} produceList={produceList} onAddCultivationLog={addLog} isLoggedIn={isLoggedIn} onOpenQuickLogin={() => setIsAuthOpen(true)} />}
          {activeTab === 'orders' && <OrdersTab key={user?.uid || 'guest'} user={user} onLogin={() => setIsAuthOpen(true)} />}
          {activeTab === 'community' && <CommunityTab
            farmer={isLoggedIn && application?.status === 'approved' ? currentFarmer : undefined}
            farmers={farmers}
            postId={communityPostId || undefined}
            onLogin={() => setIsAuthOpen(true)}
            blockedMessage={isLoggedIn && application?.status !== 'approved' ? 'Hồ sơ cần được quản trị duyệt trước khi chia sẻ và bình luận. Bạn có thể đọc các bài công khai.' : undefined}
          />}
          {activeTab === 'admin' && <AdminTab allowed={isAdmin} />}
          {activeTab === 'assistant' && <AssistantTab
            currentFarmer={isLoggedIn ? currentFarmer : undefined} defaultSubTab={assistantSubTab}
            onLogin={() => setIsAuthOpen(true)}
            onConsultationLogin={draft => { setConsultationDraft(draft); setIsAuthOpen(true); }}
            resumeDraft={isAuthOpen ? undefined : consultationDraft}
            onResumeHandled={() => setConsultationDraft(undefined)}
          />}
        </Suspense>
        {activeTab === 'market' && canLoadMore && <button onClick={loadMore} className="w-full rounded-xl border bg-white p-3 font-bold text-emerald-800">Tải thêm trái cây</button>}
      </main>
      <SiteFooter onJoin={() => isLoggedIn ? farmerAction(() => setIsDeclareOrchardOpen(true), false) : setIsAuthOpen(true)} />
    </div>
    <Suspense fallback={<div className="fixed bottom-4 right-4 bg-white p-4 shadow-xl rounded-xl">Đang tải…</div>}>
      {selectedProduct && <ProductDetailBoundary key={`${selectedProduct.id}:${selectedProductView}`} onClose={() => setSelectedProductId('')}><ProductDetailModal initialTab={selectedProductView} product={selectedProduct} currentFarmer={currentFarmer} isLoggedIn={isLoggedIn} onClose={() => setSelectedProductId('')} onAddToCart={addCart} onOpenEdit={openEdit} /></ProductDetailBoundary>}
      {isCartOpen && <CartModal isOpen onClose={() => setIsCartOpen(false)} cartItems={liveCart} onUpdateQuantity={updateQuantity} onRemoveItem={(id) => setCartItems((previous) => previous.filter((line) => line.item.id !== id))} onClearCart={() => setCartItems([])} onViewOrders={() => { setIsCartOpen(false); setActiveTab('orders'); }} />}
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
      {isDeclareOrchardOpen && <OrchardDeclarationModal key={currentFarmer.id} isOpen currentFarmer={currentFarmer} onClose={() => setIsDeclareOrchardOpen(false)} onSaveFarmer={updateFarmer} />}
      {isAddProduceOpen && <AddProduceModal key={currentFarmer.id} isOpen currentFarmer={currentFarmer} onClose={() => setIsAddProduceOpen(false)} onAddProduce={addProduce} />}
      {editingProduct && <EditProduceModal isOpen product={editingProduct} currentFarmer={currentFarmer} onClose={() => setEditingProduct(null)} onSave={updateProduce} />}
    </Suspense>
  </div>;
}
