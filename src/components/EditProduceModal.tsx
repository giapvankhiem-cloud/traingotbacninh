import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  DollarSign,
  TrendingUp,
  Tag,
  Award,
  Image as ImageIcon,
  Package,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ProduceItem, FarmerAccount } from '../types/agriculture';
import { FruitLogo } from './FruitLogo';
import { compressImage } from '../utils/images';
import { PRODUCE_CATEGORIES } from '../data/produceCategories';
import { PRODUCE_PHOTO_SAMPLES } from '../data/producePhotos';

interface EditProduceModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProduceItem | null;
  onSave: (updatedProduct: ProduceItem) => Promise<void>;
  currentFarmer?: FarmerAccount;
}

export const EditProduceModal: React.FC<EditProduceModalProps> = ({
  isOpen,
  onClose,
  product,
  onSave,
  currentFarmer,
}) => {
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<ProduceItem['category']>('lychee');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [unit, setUnit] = useState<string>('kg');
  const [inStock, setInStock] = useState<number>(0);
  const [sweetnessBrix, setSweetnessBrix] = useState<number>(20);
  const [harvestSeason, setHarvestSeason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [image, setImage] = useState<string>('');
  const [certifications, setCertifications] = useState<
    ('VietGAP' | 'GlobalGAP' | 'OCOP 4 sao' | 'OCOP 5 sao' | 'Hữu cơ')[]
  >([]);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setCategory(product.category);
      setPrice(product.price);
      setUnit(product.unit || 'kg');
      setInStock(product.inStock || 0);
      setSweetnessBrix(product.sweetnessBrix || 20);
      setHarvestSeason(product.harvestSeason || '');
      setDescription(product.description || '');
      setImage(product.image || '');
      setCertifications(product.certifications || ['VietGAP']);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handlePriceDelta = (delta: number) => {
    setPrice((prev) => Math.max(1000, prev + delta));
  };

  const toggleCertification = (
    cert: 'VietGAP' | 'GlobalGAP' | 'OCOP 4 sao' | 'OCOP 5 sao' | 'Hữu cơ'
  ) => {
    if (certifications.includes(cert)) {
      setCertifications(certifications.filter((c) => c !== cert));
    } else {
      setCertifications([...certifications, cert]);
    }
  };

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try { setImage(await compressImage(file)); } catch (error) { setError((error as Error).message); }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true); setError('');

    const updated: ProduceItem = {
      ...product,
      name: name.trim() || product.name,
      category,
      price: Number(price) > 0 ? Number(price) : product.price,
      unit: unit.trim() || 'kg',
      inStock: Number(inStock) >= 0 ? Number(inStock) : product.inStock,
      sweetnessBrix: Number(sweetnessBrix),
      harvestSeason: harvestSeason.trim() || product.harvestSeason,
      description: description.trim() || product.description,
      image: image || product.image,
      certifications,
    };

    try { await onSave(updated); }
    catch (error) { setError((error as Error).message); setIsSaving(false); return; }

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {
      // ignore
    }

    onClose();
  };

  return (
    <div className="ui-dialog fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in font-sans">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="ui-banner p-4 sm:p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-emerald-300 flex items-center justify-center border border-white/20 shadow-xs">
              <DollarSign className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="ui-section-title text-white">
                Sửa bài đăng & giá bán
              </h3>
              <p className="text-xs text-inverse-muted mt-0.5">
                Chủ vườn: {currentFarmer ? currentFarmer.name : product.farmer}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Đóng sửa bài đăng"
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form id="edit-produce-form" onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
          {error && <p role="alert" className="bg-rose-50 text-rose-800 p-3 rounded-xl">{error}</p>}
          {isSaving && <p role="status">Đang lưu bài đăng…</p>}
          {/* Highlighted Price Adjustment Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/80 border-2 border-emerald-500/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-accent flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span>Giá bán mới (VNĐ)</span>
              </label>
              <span className="text-xs font-semibold text-accent bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Giá hiện tại trên sạp
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full text-xl sm:text-2xl font-semibold text-accent px-4 py-2.5 rounded-2xl border-2 border-emerald-400 bg-white focus:outline-emerald-600 focus:ring-2 focus:ring-emerald-300 transition-all font-mono"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                  VNĐ
                </span>
              </div>

              {/* Quick Adjustment Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handlePriceDelta(-5000)}
                  className="px-2.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-emerald-300 text-xs font-semibold text-body shadow-2xs cursor-pointer active:scale-95"
                >
                  -5.000đ
                </button>
                <button
                  type="button"
                  onClick={() => handlePriceDelta(5000)}
                  className="ui-button-primary px-2.5 py-2 shadow-2xs cursor-pointer active:scale-95"
                >
                  +5.000đ
                </button>
                <button
                  type="button"
                  onClick={() => handlePriceDelta(10000)}
                  className="ui-button-primary px-2.5 py-2 shadow-2xs cursor-pointer active:scale-95"
                >
                  +10.000đ
                </button>
              </div>
            </div>

            {/* Price Preview formatted */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200/60">
              <span className="text-accent font-medium">Hiển thị trên Sạp:</span>
              <span className="text-base font-semibold text-accent">
                {price.toLocaleString('vi-VN')} đ / {unit}
              </span>
            </div>
          </div>

          {/* Unit & InStock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-body block mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-muted" />
                <span>Đơn vị tính</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-emerald-600"
                  placeholder="kg, thùng 5kg, v.v."
                />
                <button
                  type="button"
                  onClick={() => setUnit('kg')}
                  className={`px-2.5 py-2 rounded-xl text-xs font-semibold border ${
                    unit === 'kg' ? 'bg-emerald-100 text-accent border-emerald-400' : 'bg-slate-100 text-body'
                  }`}
                >
                  kg
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('thùng 5kg')}
                  className={`px-2.5 py-2 rounded-xl text-xs font-semibold border ${
                    unit === 'thùng 5kg'
                      ? 'bg-emerald-100 text-accent border-emerald-400'
                      : 'bg-slate-100 text-body'
                  }`}
                >
                  thùng
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-body block mb-1.5 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-muted" />
                <span>Sản lượng còn lại ({unit})</span>
              </label>
              <input
                type="number"
                min="0"
                value={inStock}
                onChange={(e) => setInStock(Number(e.target.value))}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-emerald-600"
                placeholder="1000"
              />
            </div>
          </div>

          {/* Title / Produce Name */}
          <label className="block text-sm text-body">Loại cây
            <select value={category} onChange={event => setCategory(event.target.value as ProduceItem['category'])} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3">
              {PRODUCE_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              <option value="other">Khác</option>
            </select>
          </label>
          <div>
            <label className="text-xs font-semibold text-body block mb-1.5">
              Tiêu đề bài đăng trái cây
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-emerald-600"
              placeholder="VD: Vải thiều Chũ chính gốc vườn bác Nguyễn Văn An"
            />
          </div>

          {/* Sweetness Brix & Harvest Season */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-body block mb-1.5 flex items-center gap-1.5">
                <FruitLogo fruit="apple" className="text-sm" />
                <span>Độ ngọt trung bình (°Brix)</span>
              </label>
              <input
                type="number"
                step="0.5"
                value={sweetnessBrix}
                onChange={(e) => setSweetnessBrix(Number(e.target.value))}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-emerald-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-body block mb-1.5">
                Mùa vụ / Thời gian thu hái
              </label>
              <input
                type="text"
                value={harvestSeason}
                onChange={(e) => setHarvestSeason(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-emerald-600"
                placeholder="VD: Tháng 5 - Tháng 7 hàng năm"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-body block mb-1.5">
              Mô tả chi tiết & Cam kết chất lượng
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-emerald-600 leading-relaxed font-sans"
              placeholder="Nhập ghi chú về quy trình hái, vận chuyển, độ tươi..."
            />
          </div>

          {/* Certifications */}
          <div>
            <label className="text-xs font-semibold text-body block mb-1.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-accent" />
              <span>Chứng nhận chất lượng gắn trên bài đăng</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {(['VietGAP', 'GlobalGAP', 'OCOP 4 sao', 'OCOP 5 sao', 'Hữu cơ'] as const).map(
                (cert) => {
                  const isChecked = certifications.includes(cert);
                  return (
                    <button
                      type="button"
                      key={cert}
                      onClick={() => toggleCertification(cert)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        isChecked
                          ? 'bg-action text-white border-emerald-600 shadow-2xs'
                          : 'bg-slate-100 text-body border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {isChecked && '✓ '}
                      {cert}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Image Selection */}
          <div>
            <label className="text-xs font-semibold text-body block mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-muted" />
              <span>Ảnh đại diện bài đăng trái cây</span>
            </label>
            <div className="flex items-center gap-3">
              <img
                src={image || product.image}
                alt="Xem trước"
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-500 shadow-xs shrink-0"
              />
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {PRODUCE_PHOTO_SAMPLES.map(sample => (
                    <button
                      type="button"
                      key={sample.category}
                      onClick={() => setImage(sample.src)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        image === sample.src
                          ? 'bg-emerald-100 text-accent border-emerald-400'
                          : 'bg-slate-50 text-body border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <label className="text-xs font-semibold text-accent hover:underline cursor-pointer">
                    <span>+ Tải ảnh thực tế từ vườn</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-body font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="submit"
            form="edit-produce-form"
            disabled={isSaving}
            className="ui-button-primary flex items-center gap-2 px-5 py-2.5 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Lưu bài đăng & giá bán</span>
          </button>
        </div>
      </div>
    </div>
  );
};
