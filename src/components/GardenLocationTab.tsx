import { lazy, Suspense, useState } from 'react';
import type { FarmerAccount, ProduceItem } from '../types/agriculture';
import { GardenLocationMap } from './GardenLocationMap';
const Map3D = lazy(() => import('./Map3DTab').then((m) => ({ default: m.Map3DTab })));
export function GardenLocationTab({ products, currentFarmer, onEdit }: { products: ProduceItem[]; currentFarmer?: FarmerAccount; onEdit: () => void }) {
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState('map');
  const product = products.find((value) => value.id === selected) || products.find((value) => value.ownerId === currentFarmer?.id) || products[0];
  const location = selected ? product?.location : currentFarmer?.gardenLocation || product?.location;
  return <div className="space-y-4"><div className="bg-white rounded-3xl p-5 space-y-3"><div className="flex justify-between flex-wrap gap-3"><h2 className="ui-section-title">Vị trí khu vườn</h2>{currentFarmer && <button onClick={onEdit} className="ui-button-primary px-4 py-2">Sửa vị trí vườn của tôi</button>}</div>
    <div className="flex gap-3 flex-wrap"><select aria-label="Chọn khu vườn" className="border rounded-xl p-3" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">{currentFarmer?.gardenLocation ? 'Vườn của tôi' : 'Chọn khu vườn'}</option>{products.map((item) => <option key={item.id} value={item.id}>{item.farmer} · {item.name}</option>)}</select><button onClick={() => setMode(mode === 'map' ? '3d' : 'map')}>{mode === 'map' ? 'Mô hình 3D minh họa' : 'Bản đồ thực tế'}</button></div>
  </div>{mode === '3d' ? <Suspense fallback={<p>Đang tải mô hình…</p>}><p className="text-sm">Mô hình minh họa, không phải dữ liệu cảm biến trực tiếp.</p><Map3D /></Suspense> : location ? <GardenLocationMap location={location} farmerName={!selected && currentFarmer?.gardenLocation ? currentFarmer.name : product?.farmer || ''} produceName={!selected && currentFarmer?.gardenLocation ? currentFarmer.cropFocus : product?.name || ''} /> : <p className="bg-white rounded-2xl p-6">Chưa có vị trí vườn. Chủ vườn hãy khai báo tọa độ và địa chỉ.</p>}</div>;
}
