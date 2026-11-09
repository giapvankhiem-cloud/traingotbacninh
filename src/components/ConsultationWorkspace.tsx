import React, { useEffect, useRef, useState } from 'react';
import { auth } from '../lib/firebase';
import { createConsultation, sendConsultationMessage, updateConsultation, watchConsultationExperts, watchConsultationMessages, watchConsultations } from '../services/consultations';
import { consultationStatusLabels, type Consultation, type ConsultationExpert, type ConsultationMessage } from '../types/consultations';
import { ArrowLeft, ChevronRight, Clock3, Send } from 'lucide-react';
import { ExpertAvatar } from './ExpertProfile';
import { CONSULTATION_TOPICS } from '../utils/consultationTopics';

const field = 'block w-full mt-1 rounded-xl border p-3 bg-white';
function date(timestamp: number) {
  const time = new Date(timestamp);
  return Number.isFinite(time.getTime()) ? time : undefined;
}
export function ConsultationWorkspace({ mode, uid, experts: suppliedExperts, requestedExpert }: { mode: 'farmer' | 'expert' | 'admin'; uid: string; experts?: ConsultationExpert[]; requestedExpert?: { expertId: string; sequence: number } }) {
  const [items, setItems] = useState<Consultation[]>([]);
  const [experts, setExperts] = useState<ConsultationExpert[]>([]);
  const [count, setCount] = useState(50);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: '', question: '', crop: '', expertId: '' });
  const [busy, setBusy] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const formElement = useRef<HTMLFormElement>(null);
  useEffect(() => {
    setItems([]);
    setSelected('');
  }, [mode, uid]);
  useEffect(() => {
    setLoading(true);
    setError('');
    return watchConsultations(mode, uid, count, (rows) => { setItems(rows); setLoading(false); }, (e) => { setLoading(false); setError(e.message); });
  }, [mode, uid, count]);
  useEffect(() => suppliedExperts ? setExperts(suppliedExperts) : undefined, [suppliedExperts]);
  useEffect(() => suppliedExperts ? undefined : watchConsultationExperts(false, setExperts, (e) => setError(e.message)), [suppliedExperts]);
  useEffect(() => {
    if (mode !== 'farmer' || !requestedExpert) return;
    setForm(current => ({ ...current, expertId: requestedExpert.expertId })); setCreating(true);
  }, [mode, requestedExpert]);
  useEffect(() => {
    if (!creating || !requestedExpert) return;
    formElement.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    formElement.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }, [creating, requestedExpert]);
  const target = items.find((item) => item.id === selected);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { const id = await createConsultation(form, requestId.current); requestId.current = crypto.randomUUID(); setForm({ subject: '', question: '', crop: '', expertId: '' }); setCreating(false); setSelected(id); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="space-y-4" aria-label="Hộp thư tư vấn">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="ui-section-title">{mode === 'admin' ? 'Theo dõi yêu cầu tư vấn' : mode === 'expert' ? 'Câu hỏi gửi trực tiếp cho tôi' : 'Yêu cầu tư vấn của tôi'}</h2>{mode === 'farmer' && <button className="ui-button-primary p-3" onClick={() => setCreating(!creating)}>{creating ? 'Đóng biểu mẫu' : 'Gửi yêu cầu tư vấn'}</button>}</div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 text-rose-800 p-3">Chưa thực hiện được: {error}</p>}
    {creating && <form ref={formElement} onSubmit={submit} className="rounded-2xl border bg-white p-4 space-y-3 scroll-mt-28" aria-label="Gửi yêu cầu tư vấn">
      <label className="block">Chuyên gia tiếp nhận<select required value={form.expertId} onChange={(e) => setForm({ ...form, expertId: e.target.value })} className={field}><option value="" disabled>Chọn chuyên gia để gửi trực tiếp</option>{experts.filter((p) => p.active && p.status === 'active' && p.id !== uid).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.specialties}</option>)}</select></label>
      <label className="block">Cây trồng<input required maxLength={100} value={form.crop} onChange={(e) => setForm({ ...form, crop: e.target.value })} className={field} /></label>
      <label className="block">Chủ đề<input required minLength={3} maxLength={200} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={field} /></label>
      <label className="block">Nội dung cần tư vấn<textarea required minLength={10} maxLength={5000} rows={4} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className={field} /></label>
      <p className="text-sm text-body">Mô tả triệu chứng, thời điểm xuất hiện và cách chăm sóc đã thực hiện. Câu hỏi được gửi thẳng đến chuyên gia bạn chọn, không cần quản trị điều phối.</p>
      <button disabled={busy || !experts.some((p) => p.id === form.expertId && p.active && p.status === 'active' && p.id !== uid)} className="ui-button-primary p-3 disabled:opacity-50">{busy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
    </form>}
    <div className="grid lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)] gap-4">
      <div className="space-y-2 min-w-0">{loading && <p role="status">Đang tải yêu cầu…</p>}{!loading && !items.length && !error && <p>Chưa có yêu cầu tư vấn.</p>}
        {items.map((item) => <button key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className={`w-full text-left rounded-xl border p-4 space-y-1 break-words ${selected === item.id ? 'bg-emerald-50 border-emerald-600' : 'bg-white'}`}><strong className="block">{item.subject}</strong><span className="block text-sm">{consultationStatusLabels[item.status]} · {item.crop}</span><span className="block text-sm text-body">{mode === 'farmer' ? item.expertName : item.farmerName}</span><span className="block text-xs text-body">{date(item.updatedAt)?.toLocaleString('vi-VN') || 'Chưa rõ thời gian'}</span></button>)}
        {items.length >= count && <button className="border rounded-xl p-3" onClick={() => setCount(count + 50)}>Tải thêm yêu cầu</button>}
      </div>
      {target ? <ConsultationThread key={`${uid}:${target.id}`} consultation={target} mode={mode} expert={experts.find(expert => expert.id === target.expertId)} /> : <div className="rounded-2xl border bg-white p-5"><p>Chọn yêu cầu để xem nội dung và trao đổi.</p></div>}
    </div>
  </section>;
}
export function ConsultationThread({ consultation: item, mode, expert, onBack, onViewExpert }: { consultation: Consultation; mode: 'farmer' | 'expert' | 'admin'; expert?: ConsultationExpert; onBack?: () => void; onViewExpert?: () => void }) {
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [count, setCount] = useState(100);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const retry = useRef<{ body: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const lastMessage = useRef('');
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { if (onBack) panel.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }, []);
  useEffect(() => { setLoading(true); return watchConsultationMessages(item.id, count, (rows) => { setMessages(rows); setLoading(false); setError(''); }, (e) => { setMessages([]); setLoading(false); setError(e.message); }); }, [item.id, count]);
  useEffect(() => { const id = messages[messages.length - 1]?.id; if (id && id !== lastMessage.current) { if (log.current) log.current.scrollTop = log.current.scrollHeight; lastMessage.current = id; } }, [messages]);
  async function run(action: () => Promise<unknown>) { if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(''); try { await action(); } catch (e) { setError((e as Error).message); } finally { inFlight.current = false; setBusy(false); } }
  const heading = mode === 'farmer' ? item.expertName : item.farmerName;
  return <article ref={panel} className="consultation-chat scroll-mt-28" aria-label="Chi tiết tư vấn">
    <header className="consultation-identity-header consultation-chat-header">
      {onBack && <button type="button" onClick={onBack} aria-label="Quay lại danh sách chuyên gia"><ArrowLeft size={23} /></button>}
      <ExpertAvatar expert={mode === 'farmer' ? expert || { name: item.expertName } : { name: item.farmerName }} />
      <div>{onViewExpert ? <button type="button" className="consultation-header-profile" onClick={onViewExpert}><h3>{heading}</h3><ChevronRight size={18} aria-hidden="true" /></button> : <h3>{heading}</h3>}<p>{mode === 'farmer' ? expert?.title || 'Chuyên gia tư vấn cây trồng' : `Nhà vườn · ${item.crop}`}</p></div>
      <span className="consultation-chat-status"><Clock3 size={15} aria-hidden="true" />{consultationStatusLabels[item.status]}</span>
    </header>
    <div className="consultation-chat-context"><strong>{item.subject}</strong><span>{item.crop} · {date(item.createdAt)?.toLocaleString('vi-VN') || 'Chưa rõ thời gian'}</span></div>
    {error && <p role="alert" className="consultation-error">{error}</p>}
    <div ref={log} className="consultation-messages" role="log" aria-label="Nội dung trao đổi" aria-live="polite">
      <p className="consultation-session-note">Phiên tư vấn với {item.expertName}</p>
      {loading && <p role="status">Đang tải tin nhắn…</p>}{item.messageCount > count && <button type="button" onClick={() => setCount(count + 100)} className="underline p-2">Xem tin nhắn cũ hơn</button>}
      {messages.map(message => {
        const time = date(message.createdAt);
        return <div key={message.id} className={`consultation-message ${message.senderId === auth?.currentUser?.uid ? 'consultation-message-own' : ''}`}>
          <div className="consultation-message-bubble"><p className="consultation-message-sender">{message.senderName} · {message.senderRole === 'expert' ? 'Chuyên gia' : message.senderRole === 'admin' ? 'Quản trị' : 'Nhà vườn'}</p><p className="consultation-message-text">{message.body}</p></div>
          <time dateTime={time?.toISOString()}>{time?.toLocaleString('vi-VN') || 'Chưa rõ thời gian'}</time>
        </div>;
      })}
      {!loading && !error && item.status === 'waiting' && mode === 'farmer' && <p className="consultation-awaiting-note">Câu hỏi đã được gửi trực tiếp. Chuyên gia sẽ phản hồi theo lịch tiếp nhận; bác có thể quay lại xem trong hộp thư tư vấn.</p>}
    </div>
    {item.status !== 'closed' ? <div className="consultation-composer">
      {mode === 'farmer' && <div className="consultation-topic-chips consultation-chat-topics" aria-label="Gợi ý chủ đề tư vấn">{CONSULTATION_TOPICS.map(topic => <button type="button" key={topic.label} aria-label={topic.label} disabled={busy || loading} onClick={() => setBody(topic.question)}><span aria-hidden="true">{topic.icon}</span>{topic.label}</button>)}</div>}
      <form onSubmit={event => { event.preventDefault(); const text = body.trim(); if (!text) return; if (retry.current?.body !== text) retry.current = { body: text, id: crypto.randomUUID().replaceAll('-', '').slice(0,20) }; const attempt = retry.current; void run(async () => { await sendConsultationMessage(item.id, text, attempt!.id); setBody(''); retry.current = null; }); }} className="consultation-message-form"><label className="sr-only" htmlFor={`consultation-message-${item.id}`}>Tin nhắn</label><textarea id={`consultation-message-${item.id}`} required maxLength={5000} rows={2} value={body} disabled={busy} onChange={event => setBody(event.target.value)} placeholder="Nhập tin nhắn cho cuộc tư vấn…" /><button type="submit" aria-label="Gửi tin nhắn" title="Gửi tin nhắn" disabled={busy || !body.trim() || loading}><Send size={22} aria-hidden="true" /><span className="sr-only">Gửi tin nhắn</span></button></form>
    </div> : <p className="consultation-closed-note">Cuộc tư vấn đã kết thúc. Quản trị có thể mở lại nếu cần trao đổi tiếp.</p>}
    <footer className="consultation-chat-footer"><p>Nhà vườn: {item.farmerName} · Tiếp nhận: {item.expertName}</p>{item.status !== 'closed' ? <button type="button" disabled={busy} onClick={() => void run(() => updateConsultation(item.id, item.revision, { status: 'closed' }))}>Kết thúc tư vấn</button> : mode === 'admin' && <button type="button" disabled={busy} onClick={() => void run(() => updateConsultation(item.id, item.revision, { status: 'waiting' }))}>Mở lại tư vấn</button>}</footer>
  </article>;
}
