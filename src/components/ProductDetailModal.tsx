import React, { useState } from 'react';
import {
  X,
  Star,
  Flame,
  CheckCircle,
  Phone,
  QrCode,
  MapPin,
  ShieldCheck,
  Plus,
  Minus,
  ShoppingBag,
  Navigation,
  CalendarCheck,
  Award,
  UserCheck,
  Edit3,
} from 'lucide-react';
import { ProduceItem, FarmerAccount } from '../types/agriculture';
import { GardenLocationMap } from './GardenLocationMap';
import { CultivationLogViewer } from './CultivationLogViewer';
import { FarmerProfileViewer } from './FarmerProfileViewer';
import { ProductQr } from './Traceability';
import { ownsProduct } from '../utils/farmerProduct';

interface ProductDetailModalProps {
  product: ProduceItem | null;
  onClose: () => void;
  onAddToCart: (product: ProduceItem, qty: number) => void;
  isLoggedIn?: boolean;
  currentFarmer?: FarmerAccount;
  onOpenEdit?: (product: ProduceItem) => void;
  initialTab?: 'info' | 'qr';
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
  isLoggedIn = false,
  currentFarmer,
  onOpenEdit,
  initialTab = 'info',
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedTab, setModalTab] = useState<'info' | 'farmer' | 'map' | 'logs' | 'qr'>(initialTab);

  if (!product) return null;

  const isMyProduct = Boolean(
    isLoggedIn &&
      currentFarmer &&
      ownsProduct(currentFarmer, product)
  );
  const modalTab = selectedTab === 'qr' && !isMyProduct ? 'info' : selectedTab;

  const handleAdd = () => {
    onAddToCart(product, quantity);
    onClose();
  };

  return (
    <div className="ui-dialog fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="ui-banner p-4 border-b flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-accent">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-semibold tracking-normal block">
                Thông tin nguồn gốc trái cây
              </span>
              <span className="text-xs text-inverse-muted">
                Mã vùng trồng: {product.vietgapCode} · Chủ hộ: {product.farmerProfile?.name || product.farmer}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMyProduct && onOpenEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEdit(product);
                }}
                className="button-light px-3 py-1.5 rounded-xl hover:bg-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Sửa bài đăng & Đổi giá</span>
              </button>
            )}

            <button
              onClick={onClose}
              aria-label="Đóng chi tiết trái cây"
              className="p-2 rounded-xl text-white hover:bg-white/15 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Product information is public; packing labels belong to the seller. */}
        <div className="dialog-tabs px-5 pt-3 border-b border-slate-100 flex flex-wrap items-center gap-2 bg-white">
          {isMyProduct && <button
            onClick={() => setModalTab('qr')}
            aria-pressed={modalTab === 'qr'}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${modalTab === 'qr' ? 'border-emerald-600 text-accent' : 'border-transparent text-muted hover:text-ink'}`}
          ><QrCode className="w-4 h-4" /><span>Tem QR đóng hộp</span></button>}
          <button
            onClick={() => setModalTab('info')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              modalTab === 'info'
                ? 'border-emerald-600 text-accent'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Thông tin & đặt mua</span>
          </button>

          <button
            onClick={() => setModalTab('farmer')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              modalTab === 'farmer'
                ? 'border-emerald-600 text-accent'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <UserCheck className="w-4 h-4 text-accent" />
            <span>Nhà vườn & chứng nhận</span>
          </button>

          <button
            onClick={() => setModalTab('map')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              modalTab === 'map'
                ? 'border-emerald-600 text-accent'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <MapPin className="w-4 h-4 text-accent" />
            <span>Vị trí vườn Google Maps</span>
          </button>

          <button
            onClick={() => setModalTab('logs')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              modalTab === 'logs'
                ? 'border-emerald-600 text-accent'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <CalendarCheck className="w-4 h-4 text-accent" />
            <span>Nhật ký canh tác</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1">
          {/* TAB 1: PRODUCT INFO */}
          {modalTab === 'info' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Product Hero Image */}
              <div className="relative h-64 sm:h-72 rounded-3xl overflow-hidden bg-slate-100 shadow-xs">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {product.certifications.map((c) => (
                    <span
                      key={c}
                      className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-600 text-white shadow"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                {product.sweetnessBrix && (
                  <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-xs text-white text-xs font-semibold flex items-center gap-1.5 shadow">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>Độ ngọt tự nhiên: {product.sweetnessBrix}° Brix</span>
                  </div>
                )}
              </div>

              {/* Title & Price */}
              <div>
                <h2 className="ui-section-title text-ink">
                  {product.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted mt-1.5">
                  <span className="flex items-center text-amber-500 font-semibold">
                    <Star className="w-4 h-4 fill-amber-500 mr-1" />
                    {product.rating} ({product.reviewCount} đánh giá)
                  </span>
                  <span>·</span>
                  <span className="text-accent font-semibold">
                    Còn {product.inStock} {product.unit} sẵn sàng thu hái
                  </span>
                </div>
              </div>

              {/* Price Banner */}
              <div className="product-price-panel bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/60 flex items-center justify-between">
                <div>
                  <span className="text-xs text-accent font-semibold">
                    Giá nhà vườn niêm yết
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-semibold text-accent">
                      {product.price.toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-sm font-semibold text-muted">/{product.unit}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-muted">Thời vụ thu hoạch:</span>
                  <p className="text-xs font-semibold text-ink">{product.harvestSeason}</p>
                </div>
              </div>

              {/* Quick Jump Action Cards (3 cards: Farmer profile, Google Map, Cultivation Logs) */}
              <div className="product-shortcuts grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setModalTab('farmer')}
                  className="p-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 transition-all text-left flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-accent">
                        Thông tin chủ vườn
                      </p>
                      <p className="text-xs text-accent font-medium truncate max-w-[120px]">
                        Giấy chứng nhận do nhà vườn khai báo
                      </p>
                    </div>
                  </div>
                  <Award className="w-4 h-4 text-accent" />
                </button>

                <button
                  onClick={() => setModalTab('map')}
                  className="p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all text-left flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-accent flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-ink group-hover:text-accent">
                        Vị trí Google Map
                      </p>
                      <p className="text-xs text-muted truncate max-w-[120px]">
                        {product.location.commune}
                      </p>
                    </div>
                  </div>
                  <Navigation className="w-4 h-4 text-accent" />
                </button>

                <button
                  onClick={() => setModalTab('logs')}
                  className="p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-line hover:border-emerald-300 transition-all text-left flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-accent flex items-center justify-center shrink-0">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-ink group-hover:text-accent">
                        Lịch canh tác
                      </p>
                      <p className="text-xs text-muted">
                        Tưới, bón & cách ly PHI
                      </p>
                    </div>
                  </div>
                  <CalendarCheck className="w-4 h-4 text-accent" />
                </button>
              </div>

              {/* Description */}
              <div>
                <h4 className="ui-label-title text-muted mb-1.5">
                  Giới thiệu trái cây
                </h4>
                <p className="text-xs sm:text-sm text-body leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {product.description}
                </p>
              </div>

              {/* Farmer Profile Card in info */}
              {product.farmerProfile && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="ui-label-title text-muted">
                      Nhà vườn cung cấp
                    </h4>
                    <button
                      onClick={() => setModalTab('farmer')}
                      className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                    >
                      <span>Xem hồ sơ nhà vườn</span>
                      <Award className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.farmerProfile.avatar}
                        alt={product.farmerProfile.name}
                        className="w-12 h-12 rounded-xl object-cover ring-2 ring-emerald-500"
                      />
                      <div className="space-y-0.5">
                        <p className="font-semibold text-ink text-sm">
                          {product.farmerProfile.name}
                        </p>
                        <p className="text-body text-xs">{product.farmerProfile.role}</p>
                        <p className="text-accent font-semibold text-xs flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{product.farmerProfile.certificates.length} hồ sơ chứng nhận tự khai</span>
                        </p>
                      </div>
                    </div>

                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <a
                      href={`tel:${product.farmerProfile.phone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-ink text-xs font-semibold hover:bg-slate-200 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-accent" />
                      <span>Hotline: {product.farmerProfile.phone}</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FARMER PROFILE & CERTIFICATES */}
          {modalTab === 'farmer' && product.farmerProfile && (
            <div className="animate-in fade-in duration-150">
              <FarmerProfileViewer
                farmer={product.farmerProfile}
                produceName={product.name}
              />
            </div>
          )}

          {/* TAB 3: GOOGLE MAPS LOCATION */}
          {modalTab === 'map' && (
            <div className="animate-in fade-in duration-150">
              <GardenLocationMap
                location={product.location}
                farmerName={product.farmerProfile?.name || product.farmer}
                produceName={product.name}
              />
            </div>
          )}

          {/* TAB 4: CULTIVATION LOGS (WATERING, FERTILIZING, PEST SPRAYING) */}
          {modalTab === 'logs' && (
            <div className="animate-in fade-in duration-150">
              <CultivationLogViewer
                logs={product.cultivationLog}
                vietgapCode={product.vietgapCode}
              />
            </div>
          )}
          {modalTab === 'qr' && isMyProduct && <ProductQr product={product} />}
        </div>

        {/* Modal Bottom Sticky Checkout Bar */}
        <div className="product-checkout p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-1 rounded-lg text-muted hover:text-accent hover:bg-slate-100"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-sm font-semibold text-ink">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-1 rounded-lg text-muted hover:text-accent hover:bg-slate-100"
            >
              <Plus className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-muted">{product.unit}</span>
          </div>

          <button
            onClick={handleAdd}
            className="ui-button-primary flex-1 py-3 px-5 sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>
              Thêm vào đơn hàng ({(product.price * quantity).toLocaleString('vi-VN')}đ)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
