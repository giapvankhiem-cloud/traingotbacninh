import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, MessageCircle } from 'lucide-react';
import type { Consultation, ConsultationExpert } from '../types/consultations';
import { consultationStatusLabels } from '../types/consultations';
import { watchConsultation, watchConsultations } from '../services/consultations';
import { ConsultationThread } from './ConsultationWorkspace';
import { ExpertDirectory } from './ExpertDirectory';
import { ExpertProfile } from './ExpertProfile';

export function FarmerConsultationHub({ uid, experts, loading, onStartChat, newConversationId }: {
  uid: string; experts: ConsultationExpert[]; loading: boolean;
  onStartChat: (expert: ConsultationExpert) => void; newConversationId?: string;
}) {
  const [items, setItems] = useState<Consultation[]>([]);
  const [count, setCount] = useState(50);
  const [selectedId, setSelectedId] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState<{ id: string; item: Consultation | null; loaded: boolean; error: string }>();
  useEffect(() => watchConsultations('farmer', uid, count, rows => { setItems(rows); setHistoryLoading(false); setError(''); }, error => { setError(error.message); setHistoryLoading(false); }), [uid, count]);
  useEffect(() => {
    if (newConversationId) {
      setSelectedId(newConversationId);
      setShowProfile(false);
    }
  }, [newConversationId]);
  useEffect(() => {
    if (!selectedId) { setOpened(undefined); return; }
    setOpened({ id: selectedId, item: null, loaded: false, error: '' });
    return watchConsultation(selectedId, item => setOpened({ id: selectedId, item, loaded: true, error: '' }), error => setOpened({ id: selectedId, item: null, loaded: true, error: error.message }));
  }, [selectedId]);
  const selected = opened?.id === selectedId ? opened.item : undefined;
  const expert = experts.find(person => person.id === selected?.expertId);
  const profileVisible = showProfile && Boolean(expert);
  function backToDirectory() {
    setSelectedId('');
    setShowProfile(false);
  }
  if (selectedId) return <div className="consultation-active-view">
    {error && <p role="alert" className="consultation-error">Chưa tải được danh sách lịch sử: {error}</p>}
    {selected ? <>
      <div hidden={profileVisible}>
        <ConsultationThread key={`${uid}:${selected.id}`} consultation={selected} mode="farmer" expert={expert} onBack={backToDirectory} onViewExpert={expert ? () => setShowProfile(true) : undefined} />
      </div>
      {profileVisible && expert && <ExpertProfile expert={expert} backLabel="Quay lại cuộc tư vấn" onBack={() => setShowProfile(false)} onChat={() => setShowProfile(false)} />}
    </> : <section className="consultation-history-panel">
      <button type="button" onClick={backToDirectory}><ArrowLeft size={18} />Quay lại danh sách chuyên gia</button>
      <p role={opened?.error ? 'alert' : 'status'}>{opened?.id === selectedId && opened.error || (opened?.id === selectedId && opened.loaded ? 'Không tìm thấy cuộc tư vấn. Vui lòng quay lại hộp thư.' : 'Đang mở cuộc tư vấn…')}</p>
    </section>}
  </div>;
  return <div className="space-y-5">
    <ExpertDirectory experts={experts} loading={loading} onChat={onStartChat} currentUserId={uid} />
    <section className="consultation-history-panel" aria-label="Hộp thư tư vấn">
      <h2 className="ui-section-title">Yêu cầu tư vấn của tôi</h2><p className="text-sm text-muted">Mở lại cuộc trao đổi để xem phản hồi và tiếp tục trò chuyện.</p>
      {error && <p role="alert" className="consultation-error">{error}</p>}
      {historyLoading && <p role="status">Đang tải yêu cầu…</p>}
      {!historyLoading && !items.length && !error && <p>Chưa có yêu cầu tư vấn. Chọn “Chat ngay” trên hồ sơ chuyên gia để bắt đầu.</p>}
      <div className="consultation-history-list">{items.map(item => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)}><MessageCircle size={21} aria-hidden="true" /><span><strong>{item.subject}</strong><span>{item.expertName} · {item.crop} · {consultationStatusLabels[item.status]}</span><span className="consultation-history-preview">{item.lastMessage}</span></span><ChevronRight size={18} aria-hidden="true" /></button>)}</div>
      {items.length >= count && <button type="button" onClick={() => setCount(value => value + 50)} className="rounded-xl border p-3">Tải thêm yêu cầu</button>}
    </section>
  </div>;
}
