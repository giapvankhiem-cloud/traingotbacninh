import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { FarmerAccount, ProduceItem } from '../types/agriculture';
import { compressImage } from '../utils/images';
import { storedAssetUrl } from '../utils/assetUrl';
import { PRODUCE_CATEGORIES } from '../data/produceCategories';
import { PRODUCE_PHOTO_SAMPLES } from '../data/producePhotos';

export function AddProduceModal({ isOpen, onClose, currentFarmer, onAddProduce }: { isOpen: boolean; onClose: () => void; currentFarmer: FarmerAccount; onAddProduce: (product: ProduceItem) => Promise<void> }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProduceItem['category']>('lychee');
  const [price, setPrice] = useState(65000);
  const [stock, setStock] = useState(100);
  const [unit, setUnit] = useState('kg');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(PRODUCE_PHOTO_SAMPLES[0].src);
  const [certs, setCerts] = useState<ProduceItem['certifications']>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [productId] = useState(() => crypto.randomUUID());
  if (!isOpen) return null;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      if (!currentFarmer.gardenLocation) throw new Error('Hãy lưu vị trí và thông tin vườn trước khi đăng bán.');
      await onAddProduce({
        id: productId, ownerId: currentFarmer.id, name: name.trim(), category, price, unit: unit.trim(), inStock: stock,
        origin: currentFarmer.location, farmer: currentFarmer.name, farmerPhone: currentFarmer.phone,
        rating: 0, reviewCount: 0, image, certifications: certs, harvestSeason: season.trim(), description: description.trim(),
        vietgapCode: currentFarmer.pucCode, location: currentFarmer.gardenLocation,
        farmerProfile: { name: currentFarmer.name, avatar: currentFarmer.avatar, role: currentFarmer.role,
          phone: currentFarmer.phone, zalo: currentFarmer.phone.replace(/\s/g, ''), address: currentFarmer.location,
          experienceYears: 0, orchardAreaHa: currentFarmer.areaHa, treeCount: currentFarmer.treeCount,
          bio: currentFarmer.bio || '', introductionMedia: currentFarmer.introductionMedia || [], introductionContent: currentFarmer.introductionContent, achievements: [], commitment: currentFarmer.commitment || '', certificates: [],
        }, cultivationLog: { watering: [], fertilizing: [], pestProtection: [], general: [] },
      });
      onClose();
    } catch (error) {
      setError((error as { code?: string }).code === 'permission-denied'
        ? 'Máy chủ chưa cho phép lưu bài đăng này. Vui lòng kiểm tra trạng thái duyệt hồ sơ hoặc liên hệ quản trị để kiểm tra quyền đăng bán. Thông tin đã nhập vẫn được giữ lại.'
        : (error as Error).message);
    }
    finally { setBusy(false); }
  }
  const input = 'w-full border rounded-xl p-3 mt-1';
  return <div className="ui-dialog fixed inset-0 z-50 p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="add-title"><form onSubmit={submit} className="bg-white rounded-3xl p-5 space-y-4 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
    <div className="ui-banner rounded-2xl px-4 py-2 flex justify-between items-center gap-2"><h2 id="add-title" className="ui-section-title">Đăng bán trái cây</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Đóng"><X /></button></div>
    {error && <p role="alert" className="bg-rose-50 p-3 rounded-xl text-rose-800">{error}</p>}
    <label className="block">Tên trái cây<input required maxLength={250} value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
    <div className="grid grid-cols-2 gap-3"><label>Loại cây<select className={input} value={category} onChange={event => {
      const value = event.target.value as ProduceItem['category'];
      setCategory(value);
      setImage(PRODUCE_PHOTO_SAMPLES.find(sample => sample.category === value)?.src ?? storedAssetUrl('/produce-placeholder.svg'));
    }}>{PRODUCE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}<option value="other">Khác</option></select></label><label>Đơn vị<input required maxLength={30} value={unit} onChange={(e) => setUnit(e.target.value)} className={input} /></label><label>Giá bán (VNĐ)<input type="number" required min={1} max={100000000} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={input} /></label><label>Số lượng sẵn bán<input type="number" required min={0} max={10000000} step={1} value={stock} onChange={(e) => setStock(Number(e.target.value))} className={input} /></label></div>
    <label className="block">Mùa thu hoạch<input maxLength={300} value={season} onChange={(e) => setSeason(e.target.value)} className={input} /></label>
    <label className="block">Mô tả sản phẩm<textarea required maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} className={input} rows={3} /></label>
    <div className="flex items-center gap-4"><img src={image} alt="Ảnh trái cây sẽ đăng" className="w-24 h-24 object-cover rounded-xl" /><label>Ảnh thực tế (JPG/PNG/WebP, tối đa 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async (e) => { const file = e.target.files?.[0]; if (file) try { setImage(await compressImage(file)); } catch (error) { setError((error as Error).message); } }} /></label></div>
    <fieldset className="border rounded-xl p-3 space-y-2"><legend>Tiêu chuẩn nhà vườn tự khai</legend><p className="text-sm text-body">Chỉ chọn tiêu chuẩn có hồ sơ thực tế. Website chưa xác minh chứng nhận.</p><div className="flex flex-wrap gap-3">{(['VietGAP','GlobalGAP','OCOP 4 sao','OCOP 5 sao','Hữu cơ'] as const).map((cert) => <label key={cert} className="inline-flex gap-2"><input type="checkbox" checked={certs.includes(cert)} onChange={(e) => setCerts(e.target.checked ? [...certs, cert] : certs.filter((value) => value !== cert))} />{cert}</label>)}</div></fieldset>
    <p className="text-sm text-body">Sau khi đăng thành công, mục “Tem QR đóng hộp” của bài đăng sẽ mở để bạn tải tem riêng cho trái cây này. Người mua quét tem trên hộp để xem thông tin trái cây và nhà vườn.</p>
    <button disabled={busy} className="ui-button-primary w-full p-3 disabled:opacity-50">{busy ? 'Đang đăng bán…' : 'Đăng lên sạp & tạo mã QR'}</button>
  </form></div>;
}
