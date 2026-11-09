import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { createExpertAccount, type NewExpertAccount } from '../services/expertAccounts';
import { ExpertProfileFields } from './ExpertProfileFields';

const empty: NewExpertAccount = { email: '', password: '', name: '', title: '', organization: '', specialties: '', bio: '', phone: '', availability: '' };
const field = 'block w-full border rounded-xl p-3 mt-1 bg-white';
export function ExpertAccountCreateForm({ onCreated, onCancel, onBusyChange }: { onCreated: (uid: string, name: string) => void; onCancel: () => void; onBusyChange: (busy: boolean) => void }) {
  const [form, setForm] = useState({ ...empty });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); onBusyChange(true); setShowPassword(false); setError('');
    try { const uid = await createExpertAccount(form); setForm({ ...empty }); onCreated(uid, form.name.trim()); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <form onSubmit={submit} aria-label="Tạo tài khoản chuyên gia" autoComplete="off" className="rounded-2xl border bg-white p-4 sm:p-5 space-y-4">
    <h3 className="ui-card-title">Tạo tài khoản chuyên gia</h3>
    <p className="text-sm">Tài khoản mới ở trạng thái chờ xác nhận. Sau khi bàn giao đúng người, quản trị kiểm tra hồ sơ và mở quyền tư vấn.</p>
    {error && <p role="alert" className="rounded-xl bg-rose-50 text-rose-800 p-3">{error}</p>}
    <fieldset disabled={busy} className="grid sm:grid-cols-2 gap-4 disabled:opacity-60">
      <label className="block">Email đăng nhập<input type="email" required maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className={field} /></label>
      <div><label htmlFor="new-expert-password">Mật khẩu ban đầu</label><div className="relative mt-1"><input id="new-expert-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={10} maxLength={128} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="w-full border rounded-xl p-3 pr-14 bg-white" /><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute right-1 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center text-muted">{showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button></div><p className="text-xs text-muted mt-1">Từ 10 ký tự. Bàn giao email và mật khẩu riêng cho chuyên gia.</p></div>
      {([['name','Họ tên chuyên gia',100],['title','Chức danh',150],['organization','Đơn vị công tác',200],['specialties','Lĩnh vực chuyên môn',500],['phone','Điện thoại công khai (tùy chọn)',30],['availability','Lịch tiếp nhận',200]] as const).map(([key,label,max]) => <label className="block" key={key}>{label}<input required={['name','title','organization','specialties'].includes(key)} maxLength={max} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className={field} /></label>)}
      <label className="block sm:col-span-2">Giới thiệu<textarea rows={3} maxLength={3000} value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value })} className={field} /></label>
      <ExpertProfileFields value={form} onChange={details => setForm({ ...form, ...details })} disabled={busy} />
    </fieldset>
    <div className="flex flex-wrap gap-3"><button disabled={busy} className="ui-button-primary disabled:opacity-50">{busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản mới'}</button><button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border p-3">Hủy tạo tài khoản</button></div>
  </form>;
}
