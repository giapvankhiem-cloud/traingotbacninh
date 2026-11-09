import { StoryEditor } from './StoryEditor';
import { readStory, encodeStory, storyFromLegacy, storyText } from '../utils/story';
import React, { useState } from 'react';
import {
  X,
  MapPin,
  Camera,
  Save,
  CheckCircle2,
  Layers,
  Upload,
} from 'lucide-react';
import { FarmerAccount } from '../types/agriculture';
import { publicAssetUrl } from '../utils/assetUrl';
import { compressImage } from '../utils/images';
import { GardenLocationMap } from './GardenLocationMap';
import { CertificatesEditor } from './CertificatesEditor';
import { certificateSummary } from '../utils/certificates';

interface OrchardDeclarationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFarmer: FarmerAccount;
  onSaveFarmer: (updatedFarmer: FarmerAccount) => Promise<void>;
}

export const OrchardDeclarationModal: React.FC<OrchardDeclarationModalProps> = ({
  isOpen,
  onClose,
  currentFarmer,
  onSaveFarmer,
}) => {
  const [formData, setFormData] = useState({
    name: currentFarmer.name,
    role: currentFarmer.role,
    phone: currentFarmer.phone,
    location: currentFarmer.location,
    shortLocation: currentFarmer.shortLocation,
    commune: currentFarmer.commune,
    areaHa: currentFarmer.areaHa,
    treeCount: currentFarmer.treeCount,
    cropFocus: currentFarmer.cropFocus,
    pucCode: currentFarmer.pucCode,
    certification: currentFarmer.certification,
    avatar: currentFarmer.avatar,
    // Orchard details
    altitudeM: currentFarmer.gardenLocation?.altitudeM || 0,
    soilType: currentFarmer.gardenLocation?.soilType || '',
    waterSource: currentFarmer.gardenLocation?.waterSource || '',
    lat: currentFarmer.gardenLocation?.lat ?? 21.3653,
    lng: currentFarmer.gardenLocation?.lng ?? 106.5925,
    bio: currentFarmer.bio || '',
    commitment: currentFarmer.commitment || '',
  });

  const [previewAvatar, setPreviewAvatar] = useState<string>(currentFarmer.avatar);
  const [orchardPhoto, setOrchardPhoto] = useState<string>(
    currentFarmer.orchardPhoto || publicAssetUrl('farmer-avatar.svg')
  );
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [certificates, setCertificates] = useState(currentFarmer.certificates || []);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [story, setStory] = useState(readStory(currentFarmer.introductionContent, storyFromLegacy(currentFarmer.bio, currentFarmer.introductionMedia)));
  const [processingMedia, setProcessingMedia] = useState(false);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try { setPreviewAvatar(await compressImage(file, 400, 65_000)); } catch (error) { setError((error as Error).message); }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try { setOrchardPhoto(await compressImage(file)); } catch (error) { setError((error as Error).message); }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || uploadingCertificate || processingMedia) return;
    setIsSaving(true); setError('');
    const updated: FarmerAccount = {
      ...currentFarmer,
      name: formData.name,
      role: formData.role,
      phone: formData.phone,
      location: formData.location,
      shortLocation: formData.shortLocation,
      commune: formData.commune,
      areaHa: Number(formData.areaHa),
      treeCount: Number(formData.treeCount),
      cropFocus: formData.cropFocus,
      pucCode: formData.pucCode,
      certification: certificates.length ? certificateSummary(certificates) : formData.certification,
      avatar: previewAvatar,
      orchardPhoto,
      bio: storyText(story),
      introductionMedia: [],
      introductionContent: encodeStory(story),
      commitment: formData.commitment,
      certificates,
      gardenLocation: {
        lat: Number(formData.lat), lng: Number(formData.lng), address: formData.location,
        commune: formData.commune, altitudeM: Number(formData.altitudeM), soilType: formData.soilType, waterSource: formData.waterSource,
      },
    };

    try { await onSaveFarmer(updated); setIsSaved(true); onClose(); }
    catch (error) { setError((error as Error).message); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="ui-dialog fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in font-sans">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between ui-banner">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="ui-section-title text-white">
                Thông tin & vị trí vườn
              </h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                Cập nhật hồ sơ, vùng trồng và giấy chứng nhận.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Đóng thông tin vườn"
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1 text-xs">
          {error && <p role="alert" className="bg-rose-50 text-rose-800 rounded-xl p-3">{error}</p>}
          {isSaving && <p role="status">Đang lưu lên máy chủ…</p>}
          {isSaved && (
            <div className="p-3.5 rounded-2xl bg-emerald-100 border border-emerald-300 text-accent font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
              <span>Đã lưu thành công thông tin khu vườn của chủ hộ {formData.name}!</span>
            </div>
          )}

          {/* 1. Photos Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            {/* Avatar upload */}
            <div>
              <label className="block text-body font-semibold mb-2">Ảnh chân dung chủ vườn:</label>
              <div className="flex items-center gap-3">
                <img
                  src={previewAvatar}
                  alt="Chân dung chủ vườn"
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-500 shadow-xs"
                />
                <label className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-body font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-accent" />
                  <span>Đổi ảnh</span>
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Orchard photo upload */}
            <div>
              <label className="block text-body font-semibold mb-2">Ảnh chụp khu vườn thực tế:</label>
              <div className="flex items-center gap-3">
                <img
                  src={orchardPhoto}
                  alt="Ảnh vườn thực tế"
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-500 shadow-xs"
                />
                <label className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-body font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-accent" />
                  <span>Tải ảnh vườn</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          {/* 2. Personal & Location Information */}
          <div className="space-y-3">
            <h4 className="ui-label-title text-ink pb-1 border-b border-slate-100 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-accent" />
              <span>1. Định danh & vị trí vườn</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-body font-semibold mb-1">Họ và tên chủ hộ *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-emerald-600"
                />
              </div>

              <div>
                <label className="block text-body font-semibold mb-1">Số điện thoại liên hệ *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-body font-semibold mb-1">
                Vị trí khu vườn chi tiết (Thôn - TDP - Phường tại TP. Bắc Ninh) *
              </label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ví dụ: Thôn Kép 1 - Phường Chũ, TP. Bắc Ninh"
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-emerald-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-body font-semibold mb-1">Tọa độ Vĩ độ (Latitude)</label>
                <input
                  type="number"
                  min={-90}
                  max={90}
                  required
                  step="0.0001"
                  value={formData.lat}
                  onChange={(e) => setFormData({ ...formData, lat: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-emerald-600"
                />
              </div>

              <div>
                <label className="block text-body font-semibold mb-1">Tọa độ Kinh độ (Longitude)</label>
                <input
                  type="number"
                  min={-180}
                  max={180}
                  required
                  step="0.0001"
                  value={formData.lng}
                  onChange={(e) => setFormData({ ...formData, lng: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-emerald-600"
                />
              </div>
            </div>
            <button type="button" disabled={isSaving} onClick={() => {
              if (!navigator.geolocation) { setError('Thiết bị không hỗ trợ lấy vị trí.'); return; }
              navigator.geolocation.getCurrentPosition((position) => {
                setFormData((previous) => ({ ...previous, lat: Number(position.coords.latitude.toFixed(6)), lng: Number(position.coords.longitude.toFixed(6)) }));
              }, () => setError('Chưa lấy được vị trí. Bạn có thể nhập tọa độ trực tiếp.'), { enableHighAccuracy: true, timeout: 15000 });
            }} className="border rounded-xl p-3 text-accent font-semibold">Lấy GPS tại khu vườn</button>
            <p className="text-muted">Chỉ dùng GPS khi đang đứng tại vườn. Kiểm tra dấu vị trí trên bản đồ trước khi lưu.</p>
            {Number.isFinite(formData.lat) && Number.isFinite(formData.lng) && <GardenLocationMap location={{ lat: formData.lat, lng: formData.lng, address: formData.location, commune: formData.commune, altitudeM: formData.altitudeM, soilType: formData.soilType, waterSource: formData.waterSource }} farmerName={formData.name} produceName={formData.cropFocus} />}
          </div>

          {/* 3. Orchard Scale & Crops */}
          <div className="space-y-3">
            <h4 className="ui-label-title text-ink pb-1 border-b border-slate-100 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-accent" />
              <span>2. Quy mô & cây trồng</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-body font-semibold mb-1">Diện tích vườn (Hecta) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.areaHa}
                  min={0}
                  onChange={(e) => setFormData({ ...formData, areaHa: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-emerald-600"
                />
              </div>

              <div>
                <label className="block text-body font-semibold mb-1">Số lượng gốc cây</label>
                <input
                  type="number"
                  value={formData.treeCount}
                  min={0}
                  step={1}
                  onChange={(e) => setFormData({ ...formData, treeCount: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-emerald-600"
                />
              </div>

              <div>
                <label className="block text-body font-semibold mb-1">Mã vùng trồng (PUC)</label>
                <input
                  type="text"
                  value={formData.pucCode}
                  onChange={(e) => setFormData({ ...formData, pucCode: e.target.value })}
                  placeholder="VN-BG-CHU-..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-mono font-semibold focus:outline-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-body font-semibold mb-1">Cây trồng chủ lực *</label>
              <input
                type="text"
                required
                value={formData.cropFocus}
                onChange={(e) => setFormData({ ...formData, cropFocus: e.target.value })}
                placeholder="Ví dụ: Vải thiều Chũ, Cam đường Canh, Bưởi Diễn..."
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-emerald-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-body font-semibold mb-1">Tiêu chuẩn nhà vườn tự khai (tóm tắt)</label>
                <input maxLength={200} disabled={certificates.length > 0} value={certificates.length ? certificateSummary(certificates) : formData.certification} onChange={(event) => setFormData({ ...formData, certification: event.target.value })} className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium disabled:bg-slate-100" />
                <p className="text-muted mt-1">Tự tổng hợp từ các giấy chứng nhận khi có hồ sơ ở bên dưới.</p>
              </div>

              <div>
                <label className="block text-body font-semibold mb-1">Độ cao địa hình (mét)</label>
                <input
                  type="number"
                  value={formData.altitudeM}
                  onChange={(e) => setFormData({ ...formData, altitudeM: parseInt(e.target.value) || 90 })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-body font-semibold mb-1">Nguồn nước tưới</label>
              <input
                type="text"
                value={formData.waterSource}
                onChange={(e) => setFormData({ ...formData, waterSource: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-emerald-600"
              />
            </div>
            <label className="block">Loại đất<input maxLength={500} value={formData.soilType} onChange={(event) => setFormData({ ...formData, soilType: event.target.value })} className="mt-1 w-full border rounded-xl p-3" /></label>
            <StoryEditor value={story} onChange={setStory} onBusy={setProcessingMedia} disabled={isSaving} />
            <label className="block">Cam kết của nhà vườn<textarea maxLength={5000} value={formData.commitment} onChange={(event) => setFormData({ ...formData, commitment: event.target.value })} className="mt-1 w-full border rounded-xl p-3" /></label>
          </div>

          <CertificatesEditor value={certificates} onChange={(value) => { if (!value.length && certificates.length) setFormData((previous) => ({ ...previous, certification: 'Chưa khai báo chứng nhận' })); setCertificates(value); }} disabled={isSaving} onUploading={setUploadingCertificate} />

          {/* Footer Submit */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-2xl flex items-center justify-between gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-body font-semibold hover:bg-slate-100"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={isSaving || uploadingCertificate || processingMedia}
              className="ui-button-primary inline-flex items-center gap-2 px-6 py-2.5 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Gửi hồ sơ cho quản trị duyệt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
