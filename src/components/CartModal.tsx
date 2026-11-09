import React, { useRef, useState } from 'react';
import { X, Plus, Minus, Trash2 } from 'lucide-react';
import type { CartItem } from '../types/agriculture';
import { placeOrders } from '../services/farmStore';
interface CartModalProps {
  isOpen: boolean; onClose: () => void; cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void; onRemoveItem: (id: string) => void;
  onClearCart: () => void; onViewOrders: () => void;
}
export function CartModal({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, onClearCart, onViewOrders }: CartModalProps) {
  const [buyer, setBuyer] = useState({ name: '', phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const checkoutId = useRef(crypto.randomUUID());
  const checkoutFingerprint = useRef('');
  if (!isOpen) return null;
  async function checkout(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const fingerprint = JSON.stringify([cartItems.map((line) => [line.item.id, line.quantity, line.item.price]), buyer]);
      if (checkoutFingerprint.current && checkoutFingerprint.current !== fingerprint) checkoutId.current = crypto.randomUUID();
      checkoutFingerprint.current = fingerprint;
      const result = await placeOrders(cartItems, buyer, checkoutId.current); setIds(result); onClearCart();
    }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="ui-dialog fixed inset-0 z-50 p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="cart-title">
    <form onSubmit={checkout} className="bg-white rounded-3xl p-5 w-full max-w-xl max-h-[92vh] overflow-y-auto space-y-4">
      <div className="ui-banner rounded-2xl px-4 py-2 flex items-center justify-between gap-2"><h2 id="cart-title" className="ui-section-title">Giỏ hàng trái cây</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Đóng giỏ"><X /></button></div>
      {ids.length ? <div className="space-y-3"><h3 className="ui-card-title text-accent">Đã gửi đơn đến nhà vườn</h3><p>Nhà vườn sẽ xác nhận đơn và liên hệ giao hàng. Thanh toán khi nhận hàng (COD).</p>{ids.map((id) => <p key={id} className="text-xs break-all">Mã đơn: {id}</p>)}<button type="button" onClick={onViewOrders} className="ui-button-primary p-3">Theo dõi đơn hàng</button></div> : <>
        {!cartItems.length && <p>Giỏ hàng đang trống.</p>}
        {cartItems.map(({ item, quantity }) => <div key={item.id} className="cart-line border rounded-2xl p-3"><img src={item.image} alt="" className="w-14 h-14 rounded-xl object-cover" /><div className="min-w-0"><h3 className="ui-card-title">{item.name}</h3><p className="text-sm">{item.price.toLocaleString('vi-VN')} đ/{item.unit}</p><p className="text-xs">Còn {item.inStock} {item.unit}</p></div><div className="cart-line-controls"><button type="button" disabled={busy} aria-label="Giảm số lượng" onClick={() => onUpdateQuantity(item.id, -1)}><Minus size={16} /></button><span>{quantity}</span><button type="button" disabled={busy || quantity >= item.inStock} aria-label="Tăng số lượng" onClick={() => onUpdateQuantity(item.id, 1)}><Plus size={16} /></button><button type="button" disabled={busy} aria-label="Xóa khỏi giỏ" onClick={() => onRemoveItem(item.id)}><Trash2 size={18} /></button></div></div>)}
        {cartItems.length > 0 && <>
          <label className="block">Họ tên người nhận<input required maxLength={100} autoComplete="name" value={buyer.name} disabled={busy} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} className="w-full border p-3 rounded-xl mt-1" /></label>
          <label className="block">Số điện thoại<input type="tel" required minLength={8} maxLength={20} autoComplete="tel" value={buyer.phone} disabled={busy} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} className="w-full border p-3 rounded-xl mt-1" /></label>
          <label className="block">Địa chỉ giao hàng<textarea required minLength={8} maxLength={500} autoComplete="street-address" value={buyer.address} disabled={busy} onChange={(e) => setBuyer({ ...buyer, address: e.target.value })} className="w-full border p-3 rounded-xl mt-1" /></label>
          <p className="font-semibold">Tiền trái cây: {cartItems.reduce((sum, line) => sum + line.item.price * line.quantity, 0).toLocaleString('vi-VN')} đ</p>
          <p className="text-sm text-body">Thanh toán khi nhận hàng. Phí vận chuyển được nhà vườn xác nhận với khách trước khi giao. Thông tin giao nhận chỉ hiển thị cho bạn và nhà vườn bán sản phẩm.</p>
          {error && <p role="alert" className="bg-rose-50 text-rose-800 p-3 rounded-xl">{error}</p>}
          <button disabled={busy} className="ui-button-primary w-full p-3 disabled:opacity-50">{busy ? 'Đang gửi đơn…' : 'Xác nhận đặt hàng'}</button>
        </>}
      </>}
    </form>
  </div>;
}
