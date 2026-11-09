import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import type { ConsultationDraft, ConsultationExpert } from '../types/consultations';
import { ExpertAvatar } from './ExpertProfile';
import { CONSULTATION_TOPICS } from '../utils/consultationTopics';

export type ConsultationStartInput = ConsultationDraft & { subject: string };
export function ConsultationStartDialog({ expert, available, defaultCrop = '', draft, signInRequired, onClose, onStart }: {
  expert: ConsultationExpert; available: boolean; defaultCrop?: string; onClose: () => void;
  draft?: ConsultationDraft; signInRequired?: boolean;
  onStart: (input: ConsultationStartInput, requestId: string) => Promise<void>;
}) {
  const [question, setQuestion] = useState(draft?.question ?? '');
  const [crop, setCrop] = useState(draft?.crop ?? defaultCrop);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const attempt = useRef<{ id: string; payload: string } | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; questionInput.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !available || question.trim().length < 10 || !crop.trim()) return;
    inFlight.current = true; setBusy(true); setError('');
    const input = { subject: question.trim().slice(0, 200), question: question.trim(), crop: crop.trim(), expertId: expert.id };
    const payload = JSON.stringify(input);
    if (attempt.current?.payload !== payload) attempt.current = { id: crypto.randomUUID(), payload };
    try { await onStart(input, attempt.current!.id); }
    catch (error) { setError((error as Error).message); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="ui-dialog consultation-start-overlay" onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={`Tư vấn với ${expert.name}`} className="consultation-start-dialog" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)');
        const first = elements?.[0], last = elements?.[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header className="consultation-identity-header"><ExpertAvatar expert={expert} /><div><h2>{expert.name}</h2><p>{expert.title}</p></div><button type="button" aria-label="Đóng tư vấn" disabled={busy} onClick={onClose}><X size={24} /></button></header>
      <form onSubmit={submit} aria-label="Bắt đầu tư vấn" className="consultation-start-form">
        <div className="consultation-start-fields">
          <h3>Bác cần tư vấn vấn đề gì?</h3>
          {!available && <p role="alert" className="consultation-error">Chuyên gia đã tạm ngừng nhận câu hỏi. Vui lòng chọn chuyên gia khác.</p>}
          {error && <p role="alert" className="consultation-error">{error}</p>}
          <label className="sr-only" htmlFor="consultation-start-question">Câu hỏi cần tư vấn</label>
          <textarea ref={questionInput} id="consultation-start-question" aria-describedby="consultation-question-hint" rows={2} required minLength={10} maxLength={5000} disabled={busy} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Mô tả vấn đề của vườn và điều bác muốn hỏi…" />
          <p id="consultation-question-hint" className="consultation-start-note">Nhập ít nhất 10 ký tự và chọn cây trồng để bắt đầu.</p>
          <div className="consultation-topic-chips" aria-label="Gợi ý chủ đề tư vấn">{CONSULTATION_TOPICS.map(topic => <button type="button" key={topic.label} aria-label={topic.label} disabled={busy || !available} onClick={() => { setQuestion(topic.question); if (!crop.trim() && topic.crop) setCrop(topic.crop); questionInput.current?.focus(); }}><span aria-hidden="true">{topic.icon}</span>{topic.label}</button>)}</div>
          <label className="consultation-crop-label">Cây trồng<input required maxLength={100} disabled={busy} value={crop} onChange={event => setCrop(event.target.value)} placeholder="Ví dụ: vải thiều, cam, bưởi…" /></label>
          {signInRequired && <p className="consultation-start-note">Bác sẽ đăng nhập hoặc xác minh email sau khi bấm “Bắt đầu”. Câu hỏi được giữ để bác kiểm tra lại trước khi gửi.</p>}
          <p className="consultation-start-note">Câu hỏi được gửi thẳng tới {expert.name}. Chuyên gia phản hồi theo lịch tiếp nhận.</p>
        </div>
        <div className="consultation-start-actions"><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" disabled={busy || !available || question.trim().length < 10 || !crop.trim()}><MessageCircle size={22} aria-hidden="true" />{busy ? 'Đang bắt đầu…' : 'Bắt đầu'}</button></div>
      </form>
    </div>
  </div>;
}
