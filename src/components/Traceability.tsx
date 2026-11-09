import { useEffect, useState } from 'react';
import type { ProduceItem } from '../types/agriculture';
import { GardenLocationMap } from './GardenLocationMap';
import { FarmerProfileViewer } from './FarmerProfileViewer';
import { CultivationLogViewer } from './CultivationLogViewer';
import { buildTraceUrl } from '../utils/traceUrl';
import { Brand } from './Brand';

export function traceUrl(productId: string) {
  const origin = import.meta.env.VITE_PUBLIC_SITE_URL || `${window.location.origin}${import.meta.env.BASE_URL}`;
  return buildTraceUrl(productId, origin);
}

export function ProductQr({ product }: { product: ProduceItem }) {
  const [png, setPng] = useState('');
  const [error, setError] = useState('');
  const url = traceUrl(product.id);
  useEffect(() => {
    let active = true;
    setPng(''); setError('');
    // Public garden/profile/log views do not need the QR encoder. A failed QR
    // download must stay inside the packing-label view, not break the market.
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(url, { width: 1000, margin: 4, errorCorrectionLevel: 'M' }))
      .then((image) => { if (active) setPng(image); })
      .catch(() => { if (active) setError('Chưa tạo được mã QR.'); });
    return () => { active = false; };
  }, [url]);
  return <section className="rounded-2xl border bg-white p-4 flex flex-wrap items-center gap-4">
    {png && <img width={144} height={144} src={png} alt={`QR truy xuất ${product.name}`} />}
    <div className="space-y-2 flex-1 min-w-48"><h3 className="ui-card-title">Tem QR của {product.name}</h3><p className="text-sm">Tải tem này để in dán lên hộp {product.name}. Người mua quét mã sẽ xem thông tin trái cây, nhà vườn, chứng nhận, vị trí và nhật ký canh tác cập nhật.</p>
      {!png && !error && <p role="status" className="text-sm text-body">Đang tạo tem QR…</p>}
      {png && <a href={png} download={`QR-${product.id}.png`} className="ui-button-primary inline-block px-4 py-2">Tải QR in dán hộp</a>}
      <a href={url} target="_blank" rel="noreferrer" className="block text-sm text-accent underline break-all">Mở trang truy xuất</a>{error && <p>{error}</p>}
    </div>
  </section>;
}

export function TraceabilityPage({ product, loading, error, onBack }: { product?: ProduceItem; loading: boolean; error: string; onBack: () => void }) {
  return <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-5 min-h-screen trace-page">
    <div className="trace-brand"><Brand /><button onClick={onBack} className="text-accent underline text-sm">← Về sạp trái cây</button></div>
    {loading ? <p>Đang tải hồ sơ truy xuất…</p> : error ? <p role="alert">Không thể tải hồ sơ. Vui lòng kiểm tra kết nối rồi tải lại trang.</p> : !product ? <p>Không tìm thấy trái cây hoặc bài đăng đã được gỡ.</p> : <>
      <header className="bg-white rounded-3xl p-5 space-y-2"><p className="text-accent font-semibold">Trái ngọt Bắc Ninh · Truy xuất nguồn gốc</p><h1 className="text-2xl font-semibold">{product.name}</h1><p>Mã bài đăng: {product.id} · Mã vùng trồng: {product.vietgapCode || 'Chưa khai báo'}</p><img src={product.image} alt={product.name} width="1000" height="663" className="w-full max-h-72 object-cover rounded-2xl" /><p>{product.description}</p>
        <dl className="flex flex-wrap gap-6 border-t border-stone-200 pt-4 text-sm"><div><dt>Giá niêm yết hiện tại</dt><dd className="font-semibold text-lg">{product.price.toLocaleString('vi-VN')} đ / {product.unit}</dd></div><div><dt>Tình trạng</dt><dd>{product.inStock > 0 ? 'Đang nhận đơn' : 'Tạm hết hàng'}</dd></div></dl>
      </header>
      <FarmerProfileViewer farmer={product.farmerProfile} produceName={product.name} />
      <GardenLocationMap location={product.location} farmerName={product.farmer} produceName={product.name} />
      <CultivationLogViewer logs={product.cultivationLog} vietgapCode={product.vietgapCode} />
      <p className="text-sm text-body">Thông tin do nhà vườn khai báo. Mã QR dẫn tới hồ sơ, không thay thế chứng nhận chất lượng của cơ quan có thẩm quyền.</p>
    </>}
  </main>;
}
