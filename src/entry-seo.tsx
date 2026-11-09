import { renderToString } from 'react-dom/server';
import { MarketplaceTab } from './components/MarketplaceTab';
import { Header } from './components/Header';
import { Brand } from './components/Brand';
import { SiteFooter } from './components/SiteFooter';
import type { FarmerAccount, ProduceItem } from './types/agriculture';
import { isTestProduce, SITE_URL } from './utils/seo';
const noop = () => {};
const guest: FarmerAccount = { id: '', name: '', avatar: '', location: '', shortLocation: '', commune: '', role: '', cropFocus: '', areaHa: 0, treeCount: 0, phone: '', pucCode: '', certification: '' };
export function renderPublicHome(products: ProduceItem[]) {
  return renderToString(<div className="site-app"><Header activeTab="market" setActiveTab={noop} onOpenSidebar={noop} cartCount={0} onOpenCart={noop} currentFarmer={guest} isLoggedIn={false} onLogout={noop} onOpenQuickLogin={noop} /><main id="main-content" className="site-main"><MarketplaceTab produceList={products.filter((item) => !isTestProduce(item))} onSelectProduct={noop} onAddToCart={noop} /></main><SiteFooter /></div>);
}
export function renderPublicProduct(product: ProduceItem) {
  return renderToString(<div className="site-app"><main className="max-w-4xl mx-auto p-6 sm:p-10 space-y-6 trace-page">
    <div className="trace-brand"><a href={SITE_URL}><Brand /></a><a href={SITE_URL}>← Về sạp trái cây</a></div>
    <article className="bg-white rounded-3xl border p-6 space-y-5">
      <p className="eyebrow">THÔNG TIN NGUỒN GỐC TRÁI CÂY</p><h1 className="font-semibold">{product.name}</h1>
      <img src={product.image} alt={product.name} width="1000" height="663" className="w-full max-h-96 object-cover rounded-2xl" />
      <p>{product.description}</p><p>Nhà vườn: {product.farmer} · Khu vực: {product.origin}</p>
      <dl><dt>Giá nhà vườn niêm yết</dt><dd>{product.price.toLocaleString('vi-VN')} đ / {product.unit}</dd>
        <dt>Tình trạng</dt><dd>{product.inStock > 0 ? 'Đang nhận đơn' : 'Tạm hết hàng'}</dd>
        <dt>Mùa thu hoạch</dt><dd>{product.harvestSeason || 'Liên hệ nhà vườn'}</dd></dl>
      <h2 className="ui-section-title">Hồ sơ nhà vườn và nhật ký canh tác</h2>
      <p>Thông tin chi tiết được đồng bộ từ nhà vườn khi mở trang. Giấy chứng nhận do nhà vườn khai báo; không thay thế kiểm định của cơ quan chuyên môn.</p>
      <noscript><p>Bật JavaScript để xem nhật ký và hồ sơ cập nhật mới nhất.</p></noscript>
    </article></main></div>);
}
