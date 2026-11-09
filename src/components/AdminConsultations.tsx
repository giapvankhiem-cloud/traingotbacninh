import React, { useEffect, useState } from 'react';
import { collection, doc, getDocFromServer, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { FarmerApplication } from '../types/agriculture';
import { expertStatusLabels, type ConsultationExpert } from '../types/consultations';
import { saveConsultationExpert, watchConsultationExperts } from '../services/consultations';
import { ConsultationWorkspace } from './ConsultationWorkspace';
import { ExpertAccountCreateForm } from './ExpertAccountCreateForm';
import { ExpertProfileFields } from './ExpertProfileFields';
import { changeExpertAccountStatus, type ExpertAccountVersion } from '../services/expertAccounts';
import { accountStatusLabels, isAccountRestricted, type FarmerAccountState, type FarmerAccountStatus } from '../services/accountModeration';
const blank = { id: '', name: '', title: 'Chờ bổ sung', organization: '', specialties: 'Chờ bổ sung', bio: '', phone: '', availability: '', active: false, status: 'pending' as const, internalAccount: false, updatedAt: 0, updatedBy: '' };
const field = 'block w-full border rounded-xl p-3 mt-1 bg-white';
export function AdminConsultations({ page }: { page: 'requests' | 'experts' }) {
  const [experts, setExperts] = useState<ConsultationExpert[]>([]);
  const [accounts, setAccounts] = useState<FarmerApplication[]>([]);
  const [count, setCount] = useState(100);
  const [draft, setDraft] = useState<ConsultationExpert | null>(null);
  const [expectedProfileUpdatedAt, setExpectedProfileUpdatedAt] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [states, setStates] = useState<Record<string, FarmerAccountState>>({});
  const [statesLoaded, setStatesLoaded] = useState(false);
  const [filter, setFilter] = useState('current');
  const [decision, setDecision] = useState<{ expert: ConsultationExpert; email: string; status: FarmerAccountStatus; expected: ExpertAccountVersion } | null>(null);
  const [note, setNote] = useState('');
  const [confirmation, setConfirmation] = useState('');
  useEffect(() => watchConsultationExperts(true, setExperts, (e) => setError(e.message)), []);
  useEffect(() => db ? onSnapshot(query(collection(db, 'farmerApplications'), orderBy('submittedAt', 'desc'), limit(count)), (s) => setAccounts(s.docs.map((d) => d.data() as FarmerApplication)), (e) => setError(e.message)) : undefined, [count]);
  useEffect(() => db ? onSnapshot(collection(db, 'farmerAccountStates'), snapshot => { setStates(Object.fromEntries(snapshot.docs.map(item => [item.id, item.data() as FarmerAccountState]))); setStatesLoaded(true); }, error => setError(error.message)) : undefined, []);
  function edit(profile: ConsultationExpert, expectedUpdatedAt: number | null = profile.updatedAt) {
    setCreating(false);
    setDecision(null);
    setDraft({ ...profile });
    setExpectedProfileUpdatedAt(expectedUpdatedAt);
    setChecked(false);
    setError('');
    setMessage('');
  }
  async function chooseDecision(expert: ConsultationExpert, status: FarmerAccountStatus) {
    if (!db || busy) return;
    setBusy(true); setError(''); setMessage(''); setDraft(null); setCreating(false);
    try {
      const [application, state] = await Promise.all([getDocFromServer(doc(db, 'farmerApplications', expert.id)), getDocFromServer(doc(db, 'farmerAccountStates', expert.id))]);
      if (!application.exists()) throw new Error('Không tải được hồ sơ tài khoản chuyên gia. Vui lòng thử lại.');
      setNote(''); setConfirmation('');
      setDecision({ expert, email: application.data().email, status, expected: { expertUpdatedAt: expert.updatedAt, applicationRevision: application.data().revision, accountVersion: state.data()?.version || 0 } });
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  async function applyDecision(event: React.FormEvent) {
    event.preventDefault(); if (!decision || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await changeExpertAccountStatus(decision.expert.id, decision.expected, decision.status, note, confirmation);
      setMessage(`${decision.expert.name}: ${accountStatusLabels[decision.status]}.${decision.status === 'active' ? ' Hồ sơ trở về chờ xác nhận; hãy kiểm tra trước khi mở lại quyền tư vấn.' : ' Lịch sử tư vấn được giữ để đối chiếu.'}`);
      setDecision(null);
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!draft || busy || (draft.status === 'active' && !checked)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await saveConsultationExpert(draft, expectedProfileUpdatedAt);
      setMessage(`Đã lưu ${draft.name}: ${expertStatusLabels[draft.status]}.`);
      setDraft(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="space-y-4">
    {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-800">{error}</p>}{message && <p role="status" className="p-3 rounded-xl bg-emerald-50">{message}</p>}
    {page === 'requests' ? <ConsultationWorkspace mode="admin" uid={auth!.currentUser!.uid} experts={experts} /> : <>
      <section className="ui-banner rounded-2xl p-5 space-y-2"><h2 className="ui-section-title">Quản lý chuyên gia</h2><p>Chỉ tài khoản được xác nhận mới xuất hiện và có quyền tư vấn. Tạm dừng hoặc hủy quyền sẽ chặn truy cập hội thoại chuyên gia; lịch sử tư vấn được giữ. Nhà vườn chọn và trao đổi trực tiếp với chuyên gia, không qua bước điều phối của quản trị.</p></section>
      <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => { setCreating(true); setDraft(null); setDecision(null); setMessage(''); setError(''); }} className="ui-button-primary p-3">Tạo tài khoản chuyên gia</button><button disabled={busy} onClick={() => edit(blank, null)} className="border bg-white rounded-xl p-3">Thêm tài khoản đã đăng ký</button></div>
      {creating && <ExpertAccountCreateForm onBusyChange={setBusy} onCancel={() => setCreating(false)} onCreated={(_uid, name) => { setCreating(false); setFilter('current'); setMessage(`Đã tạo tài khoản ${name}. Kiểm tra đúng người nhận rồi mở “Sửa hồ sơ & quyền tư vấn” để xác nhận.`); }} />}
      <label className="block">Lọc tài khoản chuyên gia<select value={filter} onChange={event => setFilter(event.target.value)} className="ml-3 border bg-white rounded-xl p-3"><option value="current">Tài khoản hiện có</option><option value="all">Tất cả, kể cả đã xóa</option><option value="active">Đang tiếp nhận</option><option value="pending">Chờ xác nhận</option><option value="suspended">Tạm dừng</option><option value="deleted">Đã xóa khỏi website</option></select></label>
      <div className="grid md:grid-cols-2 gap-3">{experts.filter(p => filter === 'all' || (filter === 'current' ? states[p.id]?.status !== 'deleted' : filter === 'deleted' ? states[p.id]?.status === 'deleted' : filter === 'suspended' ? states[p.id]?.status === 'suspended' || p.status === 'suspended' : !isAccountRestricted(states[p.id]) && p.status === filter)).map((p) => <article key={p.id} aria-label={p.name} className="bg-white border rounded-2xl p-4 space-y-2"><h3 className="ui-card-title">{p.name}</h3><p>{expertStatusLabels[p.status]} · {p.internalAccount ? 'Tài khoản nội bộ' : 'Tài khoản đăng ký'}</p><p className={isAccountRestricted(states[p.id]) ? 'text-rose-800' : 'text-accent'}>{accountStatusLabels[states[p.id]?.status || 'active']}</p><p>{p.specialties}</p>{accounts.find(account => account.id === p.id)?.email && <p className="text-sm break-all">{accounts.find(account => account.id === p.id)!.email}</p>}<p className="text-xs break-all">Mã tài khoản: {p.id}</p><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => edit(p)} className="border rounded-xl p-3">Sửa hồ sơ & quyền tư vấn</button>{!isAccountRestricted(states[p.id]) ? <button disabled={busy || !statesLoaded || p.id === auth?.currentUser?.uid} onClick={() => void chooseDecision(p, 'suspended')} className="rounded-xl bg-amber-100 p-3">Tạm dừng tài khoản</button> : <button disabled={busy || !statesLoaded || p.id === auth?.currentUser?.uid} onClick={() => void chooseDecision(p, 'active')} className="rounded-xl bg-emerald-50 p-3">Khôi phục tài khoản</button>}{states[p.id]?.status !== 'deleted' && <button disabled={busy || !statesLoaded || p.id === auth?.currentUser?.uid} onClick={() => void chooseDecision(p, 'deleted')} className="rounded-xl bg-rose-50 text-rose-800 p-3">Xóa khỏi website</button>}</div></article>)}</div>
      {!experts.length && <p>Chưa có tài khoản chuyên gia.</p>}
      {decision && <form onSubmit={applyDecision} aria-label="Xử lý tài khoản chuyên gia" className="rounded-2xl border-2 border-amber-200 bg-white p-4 space-y-3">
        <h3 className="ui-card-title">{accountStatusLabels[decision.status]}: {decision.expert.name}</h3>
        <p className="text-sm">{decision.status === 'active' ? 'Khôi phục quyền truy cập website. Hồ sơ chuyên gia trở về chờ xác nhận trước khi nhận câu hỏi mới.' : 'Chặn quyền truy cập chức năng tư vấn và ẩn chuyên gia khỏi danh sách tiếp nhận. Hồ sơ và hội thoại cũ được giữ để khôi phục, đối chiếu.'}</p>
        <label className="block">Lý do xử lý<textarea required maxLength={1000} rows={3} disabled={busy} value={note} onChange={event => setNote(event.target.value)} className={field} /></label>
        {decision.status === 'deleted' && <label className="block">Nhập email chuyên gia để xác nhận xóa<input type="email" aria-label="Nhập email chuyên gia để xác nhận xóa" required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} className={field} /><span className="text-sm text-muted">{decision.email}</span></label>}
        <div className="flex flex-wrap gap-3"><button disabled={busy || !note.trim() || decision.status === 'deleted' && confirmation.trim().toLowerCase() !== decision.email.toLowerCase()} className="ui-button-primary p-3">{busy ? 'Đang xử lý…' : 'Xác nhận xử lý tài khoản'}</button><button type="button" disabled={busy} onClick={() => setDecision(null)} className="rounded-xl border p-3">Hủy thao tác</button></div>
      </form>}
      {draft && <form onSubmit={save} className="border rounded-2xl bg-white p-4 space-y-3" aria-label="Cấu hình chuyên gia">
        <h3 className="ui-card-title">Hồ sơ và quyền tư vấn</h3>
        <label className="block">Tài khoản đã đăng ký<select required disabled={expectedProfileUpdatedAt !== null} value={draft.id} onChange={(e) => { const a = accounts.find((a) => a.id === e.target.value); setDraft({ ...blank, id: e.target.value, name: a?.profile.name || '' }); }} className={field}><option value="">Chọn tài khoản</option>{draft.id && !accounts.some((a) => a.id === draft.id) && <option value={draft.id}>{draft.id}</option>}{accounts.map((a) => <option key={a.id} value={a.id}>{a.profile.name} · {a.email}</option>)}</select></label>
        {accounts.length >= count && <button type="button" onClick={() => setCount(count + 100)} className="underline p-2">Tải thêm tài khoản đã đăng ký</button>}
        {([['name','Họ tên thật',100],['title','Chức danh',150],['organization','Đơn vị công tác',200],['specialties','Lĩnh vực chuyên môn',500],['availability','Lịch tiếp nhận',200],['phone','Điện thoại công khai (tùy chọn)',30]] as const).map(([key,label,max]) => <label key={key} className="block">{label}<input required={['name','title','specialties'].includes(key)} value={draft[key]} maxLength={max} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className={field} /></label>)}
        <label className="block">Giới thiệu<textarea rows={3} maxLength={3000} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} className={field} /></label>
        <ExpertProfileFields key={draft.id || 'new'} value={draft} onChange={details => setDraft({ ...draft, ...details })} disabled={busy} />
        {isAccountRestricted(states[draft.id]) && <p className="rounded-xl bg-amber-50 p-3">Khôi phục hoạt động tài khoản trước khi xác nhận quyền tư vấn.</p>}
        <label className="block">Quyền tư vấn<select value={draft.status} onChange={(e) => { setDraft({ ...draft, status: e.target.value as ConsultationExpert['status'] }); setChecked(false); }} className={field}>{Object.entries(expertStatusLabels).map(([key,label]) => <option key={key} value={key} disabled={key === 'active' && isAccountRestricted(states[draft.id])}>{label}</option>)}</select></label>
        {draft.status === 'active' && <label className="flex gap-3"><input type="checkbox" required checked={checked} onChange={(e) => setChecked(e.target.checked)} /><span>Tôi đã kiểm tra đúng người nhận tài khoản, thông tin chuyên môn và đồng ý xác nhận quyền tư vấn.</span></label>}
        <div className="flex gap-3"><button disabled={busy || (draft.status === 'active' && !checked)} className="ui-button-primary p-3 disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu quyền chuyên gia'}</button><button type="button" disabled={busy} onClick={() => setDraft(null)} className="border rounded-xl p-3">Đóng</button></div>
      </form>}
    </>}
  </div>;
}
