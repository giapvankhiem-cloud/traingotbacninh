import { AdminConsultations } from './AdminConsultations';
import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { Certificate, FarmerApplication } from '../types/agriculture';
import { applicationLabels, getApplicationCertificates, reviewFarmerApplication } from '../services/moderation';
import { FarmerProfileViewer } from './FarmerProfileViewer';
import { GardenLocationMap } from './GardenLocationMap';
import { accountStatusLabels, changeFarmerAccountStatus, isAccountRestricted, type FarmerAccountAction, type FarmerAccountState, type FarmerAccountStatus } from '../services/accountModeration';

export function AdminTab({ allowed }: { allowed: boolean }) {
  const [page, setPage] = useState<'farmers' | 'requests' | 'experts'>('farmers');
  const [applications, setApplications] = useState<FarmerApplication[]>([]);
  const [count, setCount] = useState(100);
  const [filter, setFilter] = useState('pending');
  const [target, setTarget] = useState<FarmerApplication | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [accountStates, setAccountStates] = useState<Record<string, FarmerAccountState>>({});
  const [statesLoaded, setStatesLoaded] = useState(false);
  const [accountFilter, setAccountFilter] = useState('all');
  const [targetVersion, setTargetVersion] = useState(0);
  const [accountDecision, setAccountDecision] = useState<FarmerAccountStatus | null>(null);
  const [accountNote, setAccountNote] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [actions, setActions] = useState<FarmerAccountAction[]>([]);
  useEffect(() => {
    if (!allowed || !db) return;
    return onSnapshot(collection(db, 'farmerAccountStates'), (snapshot) => {
      setAccountStates(Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data() as FarmerAccountState]))); setStatesLoaded(true);
    }, (error) => setError(error.message));
  }, [allowed]);
  useEffect(() => {
    setActions([]); setAccountDecision(null); setAccountNote(''); setConfirmation('');
    if (!allowed || !db || !target) return;
    return onSnapshot(query(collection(db, 'farmerAccountActions'), where('farmerId', '==', target.id)), (snapshot) => {
      setActions(snapshot.docs.map((item) => item.data() as FarmerAccountAction).sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => setError(error.message));
  }, [allowed, target?.id]);
  useEffect(() => {
    setApplications([]); setTarget(null);
    if (!allowed || !db) return;
    return onSnapshot(query(collection(db, 'farmerApplications'), orderBy('submittedAt', 'desc'), limit(count)),
      (snapshot) => setApplications(snapshot.docs.map((document) => document.data() as FarmerApplication)), (error) => setError(error.message));
  }, [allowed, count]);
  useEffect(() => {
    let active = true; setCertificates([]); setChecked(false); setNote(''); setError('');
    if (!target) return;
    setLoadingProofs(true);
    getApplicationCertificates(target.id, target.profile).then((items) => {
      if (active) { setCertificates(items); if (items.length !== (target.profile.certificateIds || []).length) setError('Thiếu hồ sơ đính kèm. Yêu cầu nhà vườn bổ sung trước khi duyệt.'); }
    }).catch(() => { if (active) setError('Không tải được tài liệu. Vui lòng mở lại hồ sơ.'); }).finally(() => { if (active) setLoadingProofs(false); });
    return () => { active = false; };
  }, [target]);
  if (!allowed) return <p role="alert">Chỉ tài khoản quản trị được truy cập mục này.</p>;
  const latest = applications.find((item) => item.id === target?.id);
  const state = target ? accountStates[target.id] : undefined;
  const stale = Boolean(target && (!latest || latest.revision !== target.revision || latest.status !== target.status || (state?.version || 0) !== targetVersion));
  const matches = (item: FarmerApplication) => (filter === 'all' || item.status === filter) && (accountFilter === 'all' || (accountStates[item.id]?.status || 'active') === accountFilter);
  async function applyAccountDecision() {
    if (!target || !accountDecision || !statesLoaded || stale || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await changeFarmerAccountStatus(target.id, target.revision, targetVersion, accountDecision, accountNote, confirmation);
      setMessage(`Đã xử lý tài khoản ${target.profile.name}: ${accountStatusLabels[accountDecision]}.`); setTarget(null);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function decide(decision: 'approved' | 'rejected' | 'suspended') {
    if (!target || busy || stale || isAccountRestricted(state) || (decision === 'approved' && (!checked || loadingProofs || certificates.length !== (target.profile.certificateIds || []).length))) return;
    setBusy(true); setError(''); setMessage('');
    try { await reviewFarmerApplication(target.id, target.revision, decision, note); setMessage(`Đã xử lý hồ sơ ${target.profile.name}: ${applicationLabels[decision]}.`); setTarget(null); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  const navigation = <nav className="flex flex-wrap gap-2" aria-label="Phân hệ quản trị">{([['farmers','Tài khoản nhà vườn'],['requests','Yêu cầu tư vấn'],['experts','Tài khoản chuyên gia']] as const).map(([key,label]) => <button key={key} onClick={() => setPage(key)} aria-pressed={page === key} className={`rounded-xl border p-3 ${page === key ? 'border-action bg-action text-white' : 'bg-white'}`}>{label}</button>)}</nav>;
  if (page !== 'farmers') return <div className="space-y-5">{navigation}<AdminConsultations page={page} /></div>;
  return <div className="space-y-5">{navigation}
    <section className="ui-banner rounded-3xl p-6 space-y-2"><h2 className="ui-section-title">Duyệt tài khoản & hồ sơ nhà vườn</h2><p>Kiểm tra tài khoản, thông tin liên hệ, vị trí vườn và tài liệu trước khi mở quyền đăng. Email và hồ sơ chờ duyệt chỉ quản trị viên và chủ hồ sơ được xem.</p></section>
    {error && <p role="alert" className="bg-rose-50 text-rose-800 rounded-xl p-4">{error}</p>}
    {message && <p role="status" className="bg-emerald-50 rounded-xl p-4">{message}</p>}
    <label className="block">Trạng thái hồ sơ<select aria-label="Lọc hồ sơ" value={filter} onChange={(event) => setFilter(event.target.value)} className="ml-3 border rounded-xl p-3"><option value="all">Tất cả tài khoản đã đăng ký</option>{Object.entries(applicationLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="block">Hoạt động tài khoản<select aria-label="Lọc hoạt động tài khoản" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="ml-3 border rounded-xl p-3"><option value="all">Tất cả trạng thái hoạt động</option>{Object.entries(accountStatusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <div className="grid md:grid-cols-2 gap-3">{applications.filter(matches).map((item) => <article key={item.id} className="bg-white border rounded-2xl p-4 space-y-2"><h3 className="ui-card-title">{item.profile.name}</h3><p className="break-all">{item.email}</p><p>{item.profile.phone || 'Chưa khai điện thoại'} · {applicationLabels[item.status]}</p><p className={isAccountRestricted(accountStates[item.id]) ? 'font-semibold text-rose-800' : 'text-accent'}>{accountStatusLabels[accountStates[item.id]?.status || 'active']}</p><p className="text-sm text-body">Bản {item.revision} · {item.submittedAt ? `Gửi ${new Date(item.submittedAt).toLocaleString('vi-VN')}` : 'Chưa gửi hồ sơ đầy đủ'}</p><button disabled={busy || !statesLoaded} onClick={() => { setTargetVersion(accountStates[item.id]?.version || 0); setTarget(item); setMessage(''); }} className="text-accent underline font-semibold">Xem hồ sơ {item.profile.name}</button></article>)}</div>
    {!applications.some(matches) && <p>Chưa có hồ sơ trong danh sách này.</p>}
    {applications.length >= count && <button onClick={() => setCount((value) => value + 100)} className="border rounded-xl bg-white p-3">Tải thêm hồ sơ</button>}
    {target && <section className="bg-white border-2 border-emerald-300 rounded-3xl p-4 sm:p-6 space-y-5" aria-label="Hồ sơ đang kiểm tra">
      <div className="flex justify-between gap-3"><div><h2 className="ui-section-title">Kiểm tra {target.profile.name}</h2><p>{target.email} · {target.status === 'draft' ? 'Tài khoản đã đăng ký, chưa gửi hồ sơ' : 'Email đã xác minh khi gửi hồ sơ'} · Bản {target.revision}</p></div><button disabled={busy} onClick={() => setTarget(null)}>Đóng hồ sơ</button></div>
      {stale && <p role="alert" className="bg-amber-50 p-3 rounded-xl">Hồ sơ vừa thay đổi. Mở lại từ danh sách trước khi xử lý.</p>}
      <FarmerProfileViewer farmer={{ name: target.profile.name, avatar: target.profile.avatar, role: target.profile.role, phone: target.profile.phone, zalo: target.profile.phone, address: target.profile.location,
        experienceYears: 0, orchardAreaHa: target.profile.areaHa, treeCount: target.profile.treeCount, bio: target.profile.bio || '', introductionMedia: target.profile.introductionMedia || [], introductionContent: target.profile.introductionContent, commitment: target.profile.commitment || '', achievements: [], certificates }} produceName={target.profile.cropFocus} />
      <dl className="grid sm:grid-cols-2 gap-3"><div><dt>Cây trồng chính</dt><dd>{target.profile.cropFocus || 'Chưa khai báo'}</dd></div><div><dt>Mã vùng trồng</dt><dd>{target.profile.pucCode || 'Chưa khai báo'}</dd></div><div><dt>Tiêu chuẩn tự khai</dt><dd>{target.profile.certification}</dd></div><div><dt>Khu vực</dt><dd>{target.profile.commune || 'Chưa khai báo'}</dd></div></dl>
      {target.profile.orchardPhoto && <img src={target.profile.orchardPhoto} alt="Ảnh vườn trong hồ sơ chờ duyệt" className="max-h-80 w-full object-contain rounded-2xl" />}
      {target.profile.gardenLocation && <GardenLocationMap location={target.profile.gardenLocation} farmerName={target.profile.name} produceName={target.profile.cropFocus} />}
      {target.reviewNote && <p className="bg-slate-50 p-3 rounded-xl">Lần xử lý trước: {target.reviewNote}</p>}
      {loadingProofs && <p role="status">Đang tải giấy tờ đính kèm…</p>}
      {!isAccountRestricted(state) && target.status !== 'draft' && <div className="space-y-3 border-t pt-4"><label className="block">Ghi chú / lý do yêu cầu bổ sung hoặc khóa quyền<textarea maxLength={1000} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} className="w-full rounded-xl border p-3 mt-1" /></label>
        {target.status === 'pending' && <label className="flex gap-2"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />Đã kiểm tra tài khoản, thông tin liên hệ, vị trí vườn và tài liệu đính kèm</label>}
        <div className="flex flex-wrap gap-3">{target.status === 'pending' && <><button disabled={busy || stale || loadingProofs || !checked || certificates.length !== (target.profile.certificateIds || []).length} onClick={() => decide('approved')} className="ui-button-primary p-3 disabled:opacity-50">Duyệt tài khoản & hồ sơ</button><button disabled={busy || stale || !note.trim()} onClick={() => decide('rejected')} className="bg-amber-100 rounded-xl p-3 disabled:opacity-50">Yêu cầu bổ sung</button></>}
          {target.status === 'suspended' && <button disabled={busy || stale || !note.trim()} onClick={() => decide('rejected')} className="bg-amber-100 rounded-xl p-3 disabled:opacity-50">Mở lại để bổ sung hồ sơ</button>}
        </div><p className="text-sm text-muted">Duyệt hồ sơ mở quyền đăng cho tài khoản. Thao tác này không thay thế kiểm định chất lượng hay xác nhận pháp lý của cơ quan cấp giấy.</p></div>}
      <section className="border-t pt-4 space-y-3" aria-label="Xử lý vi phạm tài khoản">
        <h3 className="ui-card-title">Quản lý hoạt động tài khoản</h3><p>{accountStatusLabels[state?.status || 'active']}</p>
        <p className="text-sm text-body">Tạm dừng hoặc xóa khỏi website sẽ ẩn trái cây khỏi sạp và chặn hoạt động, kể cả nhận đơn mới. Đơn cũ và lịch sử xử lý được giữ để đối chiếu. Tài khoản đăng nhập Firebase được giữ để có thể khôi phục.</p>
        {target.id === auth?.currentUser?.uid ? <p>Không thể xử lý tài khoản quản trị đang sử dụng.</p> : <>
          <div className="flex flex-wrap gap-3">
            {!isAccountRestricted(state) && <button disabled={busy || stale || !statesLoaded} onClick={() => setAccountDecision('suspended')} className="rounded-xl bg-amber-100 p-3">Tạm dừng tài khoản</button>}
            {state?.status !== 'deleted' && <button disabled={busy || stale || !statesLoaded} onClick={() => setAccountDecision('deleted')} className="rounded-xl bg-rose-100 text-rose-800 p-3">Xóa khỏi website</button>}
            {isAccountRestricted(state) && <button disabled={busy || stale || !statesLoaded} onClick={() => setAccountDecision('active')} className="ui-button-primary p-3">Khôi phục tài khoản</button>}
          </div>
          {accountDecision && <form onSubmit={(event) => { event.preventDefault(); void applyAccountDecision(); }} className="rounded-xl border p-4 space-y-3" aria-label="Xác nhận xử lý tài khoản"><h4 className="font-semibold">Xác nhận: {accountStatusLabels[accountDecision]}</h4><label className="block">Lý do xử lý tài khoản<textarea required maxLength={1000} disabled={busy} value={accountNote} onChange={(event) => setAccountNote(event.target.value)} className="block w-full border rounded-xl p-3 mt-1" /></label>
            {accountDecision === 'deleted' && <label className="block">Nhập email nhà vườn để xác nhận xóa<input type="email" aria-label="Nhập email nhà vườn để xác nhận xóa" required disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="block w-full border rounded-xl p-3 mt-1" /><span className="text-sm text-muted">{target.email}</span></label>}
            <div className="flex gap-3"><button type="submit" disabled={busy || stale || !accountNote.trim() || (accountDecision === 'deleted' && confirmation.trim().toLowerCase() !== target.email.toLowerCase())} className="ui-button-primary p-3 disabled:opacity-50">{busy ? 'Đang xử lý…' : 'Xác nhận xử lý tài khoản'}</button><button type="button" disabled={busy} onClick={() => setAccountDecision(null)} className="border rounded-xl p-3">Hủy thao tác</button></div></form>}
        </>}
        <h4 className="font-semibold">Lịch sử xử lý tài khoản</h4>{actions.length ? <ol className="space-y-2">{actions.map((action) => <li key={action.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">{accountStatusLabels[action.status]} · {new Date(action.createdAt).toLocaleString('vi-VN')}</p><p className="whitespace-pre-wrap">{action.note}</p><p className="text-muted">Mã quản trị: {action.reviewerId}</p></li>)}</ol> : <p className="text-sm text-muted">Chưa có thao tác tạm dừng, xóa hoặc khôi phục.</p>}
      </section>
    </section>}
  </div>;
}
