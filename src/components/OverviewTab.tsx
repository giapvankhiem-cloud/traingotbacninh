import { SeasonalNotices } from './SeasonalNotices';
import { useMemo } from 'react';
import { MapPin, ShoppingBag, CalendarDays, Pencil } from 'lucide-react';
import type { ActiveTab, FarmerAccount, ProduceItem } from '../types/agriculture';
import { ownsProduct } from '../utils/farmerProduct';
interface Props {
  setActiveTab: (tab: ActiveTab) => void;
  onSelectProduct: (product: ProduceItem) => void;
  currentFarmer?: FarmerAccount;
  isLoggedIn?: boolean;
  onOpenQuickLogin?: () => void;
  onOpenDeclareOrchard?: () => void;
  onOpenAddProduce?: () => void;
  onOpenEditProduce?: (product: ProduceItem) => void;
  onOpenDiagnosis?: () => void;
  onSelectFarmer?: (farmer: FarmerAccount) => void;
  produceList?: ProduceItem[];
}
export function OverviewTab({ currentFarmer, produceList = [], setActiveTab, onSelectProduct, onOpenAddProduce, onOpenEditProduce, onOpenDiagnosis }: Props) {
  const mine = useMemo(() => currentFarmer ? produceList.filter((product) => ownsProduct(currentFarmer, product)) : [], [produceList, currentFarmer]);
  const logCount = mine.reduce((sum, item) => sum + item.cultivationLog.watering.length + item.cultivationLog.fertilizing.length + item.cultivationLog.pestProtection.length + (item.cultivationLog.general?.length || 0), 0);
  if (!currentFarmer) return null;
  return <div className="space-y-5">
    <SeasonalNotices cropFocus={currentFarmer.cropFocus} categories={mine.map(p=>p.category)}/>
    <section className="ui-banner rounded-3xl p-6 space-y-4">
      <div className="flex items-center gap-4"><img src={currentFarmer.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" /><div><h2 className="ui-section-title">{currentFarmer.farmName || 'Khu vườn của ' + currentFarmer.name}</h2><p>{currentFarmer.cropFocus || 'Chưa khai báo cây trồng'}</p></div></div>
      <p className="flex gap-2 items-center"><MapPin size={18} />{currentFarmer.location || 'Chưa khai báo vị trí khu vườn'}</p>
      <p>{currentFarmer.areaHa} ha · {currentFarmer.treeCount} gốc cây · {currentFarmer.phone || 'Chưa khai báo điện thoại'}</p>
      <p className="text-sm">Tiêu chuẩn tự khai: {currentFarmer.certification || 'Chưa chứng nhận'} · Mã vùng trồng: {currentFarmer.pucCode || 'Chưa có'}</p>
    </section>
    <div className="grid sm:grid-cols-3 gap-4">{[[mine.length, 'Bài đăng của tôi'], [logCount, 'Nhật ký đã lưu'], [currentFarmer.areaHa, 'Diện tích (ha)']].map(([value, label]) => <div key={label} className="bg-white border rounded-2xl p-5"><p className="text-2xl font-semibold text-accent">{value}</p><p>{label}</p></div>)}</div>
    <div className="flex flex-wrap gap-3">
      <button onClick={() => setActiveTab('orders')} className="ui-button-primary p-3 inline-flex items-center gap-2"><ShoppingBag size={18} />Xem & xử lý đơn hàng</button>
      <button onClick={() => setActiveTab('calendar')} className="bg-white border rounded-xl p-3 inline-flex items-center gap-2"><CalendarDays size={18} />Ghi nhật ký canh tác</button>
      <button onClick={onOpenAddProduce} className="ui-button-primary">Đăng bán trái cây mới</button>
      <button onClick={onOpenDiagnosis} className="bg-white border rounded-xl p-3">Chẩn đoán bệnh</button>
    </div>
    <section className="space-y-3"><h2 className="ui-section-title">Trái cây của tôi</h2>{!mine.length && <p className="bg-white p-5 rounded-2xl">Bạn chưa có bài đăng. Hãy khai báo vị trí vườn, sau đó đăng bán trái cây để nhận mã QR truy xuất.</p>}
      {mine.map((product) => <article key={product.id} className="bg-white rounded-3xl border p-4 space-y-3"><div className="flex gap-4"><img src={product.image} alt="" className="w-24 h-24 rounded-2xl object-cover" /><div className="space-y-2"><h3 className="ui-card-title">{product.name}</h3><p>{product.price.toLocaleString('vi-VN')} đ/{product.unit} · Còn {product.inStock} {product.unit}</p><div className="flex gap-3 flex-wrap text-sm"><button onClick={() => onSelectProduct(product)} className="text-accent underline">Xem vườn & nhật ký</button><button onClick={() => onOpenEditProduce?.(product)} className="inline-flex items-center gap-1"><Pencil size={16} />Sửa bài đăng</button></div></div></div></article>)}
    </section>
  </div>;
}
