import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import type { FarmOrder, OrderStatus } from '../types/agriculture';
import { ORDER_LABELS, ORDER_NEXT } from '../utils/orders';
import { changeOrderStatus } from '../services/farmStore';

export function OrdersTab({ user, onLogin }: { user: User | null; onLogin: () => void }) {
  const [orders, setOrders] = useState<FarmOrder[]>([]);
  const [view, setView] = useState<'seller' | 'buyer'>(user?.isAnonymous ? 'buyer' : 'seller');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    setOrders([]); setLoading(true);
    if (!db || !user) { setLoading(false); return; }
    return onSnapshot(query(collection(db, 'orders'), where(view === 'seller' ? 'sellerId' : 'buyerId', '==', user.uid)), (snap) => {
      setOrders(snap.docs.map((value) => value.data() as FarmOrder).sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false); setError('');
    }, (error) => { setError(error.message); setLoading(false); });
  }, [user?.uid, view]);
  async function update(order: FarmOrder, status: OrderStatus) {
    setBusy(order.id); setError('');
    try { await changeOrderStatus(order.id, status, notes[order.id] ?? order.sellerNote); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(''); }
  }
  if (!user) return <div className="bg-white rounded-3xl p-6 space-y-4"><h2 className="ui-section-title">Đơn hàng</h2><p>Nhà vườn đăng nhập để nhận và xử lý đơn. Khách mua xem đơn sau khi đặt hàng trên thiết bị này.</p><button onClick={onLogin} className="ui-button-primary p-3">Đăng nhập nhà vườn</button></div>;
  return <div className="space-y-4">
    <div className="bg-white rounded-3xl p-5 space-y-3"><h2 className="ui-section-title">Quản lý đơn hàng</h2>
      <div className="flex gap-3 flex-wrap">{!user.isAnonymous && <button onClick={() => setView('seller')} className={view === 'seller' ? 'font-semibold text-accent' : ''}>Đơn bán của nhà vườn</button>}<button onClick={() => setView('buyer')} className={view === 'buyer' ? 'font-semibold text-accent' : ''}>Đơn tôi đã mua</button>
      <select aria-label="Lọc trạng thái đơn" value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded-xl p-2"><option value="all">Tất cả trạng thái</option>{Object.entries(ORDER_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></div>
    </div>
    {error && <p role="alert" className="bg-rose-50 text-rose-800 p-3 rounded-xl">{error}</p>}
    {loading && <p>Đang tải đơn hàng…</p>}
    {!loading && orders.length === 0 && <p className="bg-white p-6 rounded-2xl">Chưa có đơn hàng.</p>}
    {orders.filter((order) => filter === 'all' || order.status === filter).map((order) => <article key={order.id} className="rounded-3xl border bg-white p-5 space-y-3">
      <div className="flex justify-between gap-3 flex-wrap"><h3 className="ui-card-title">{order.productName}</h3><span className="text-accent font-semibold">{ORDER_LABELS[order.status]}</span></div>
      <p className="text-xs break-all text-muted">Đơn #{order.id} · {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
      <p>{order.quantity} {order.unit} × {order.unitPrice.toLocaleString('vi-VN')} đ = <strong>{order.total.toLocaleString('vi-VN')} đ</strong></p>
      <p>Người nhận: {order.buyer.name} · <a href={`tel:${order.buyer.phone}`}>{order.buyer.phone}</a><br />Giao đến: {order.buyer.address}</p>
      <p className="text-sm">Thanh toán khi nhận hàng (COD).</p>
      {order.sellerNote && <p className="text-sm">Ghi chú nhà vườn: {order.sellerNote}</p>}
      {view === 'seller' && ORDER_NEXT[order.status].length > 0 && <><textarea maxLength={500} aria-label="Ghi chú xử lý đơn" placeholder="Ghi chú xử lý, mã vận đơn hoặc lý do hủy" value={notes[order.id] ?? order.sellerNote} onChange={(e) => setNotes({ ...notes, [order.id]: e.target.value })} className="w-full rounded-xl border p-3" /><div className="flex flex-wrap gap-2">{ORDER_NEXT[order.status].map((next) => <button key={next} disabled={busy === order.id} onClick={() => update(order, next)} className={`rounded-xl px-4 py-2 disabled:opacity-50 ${next === 'cancelled' ? 'bg-rose-50 text-rose-800' : 'bg-action text-white'}`}>{busy === order.id ? 'Đang lưu…' : ORDER_LABELS[next]}</button>)}</div></>}
    </article>)}
  </div>;
}
