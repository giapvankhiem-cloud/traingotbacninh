import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, Check, ChevronRight, Leaf, MessageCircle, Search, ShieldCheck, Sprout, Users } from 'lucide-react';
import type { ConsultationExpert } from '../types/consultations';
import { ExpertAvatar, ExpertProfile } from './ExpertProfile';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const topics = [
  { label: 'Khuyến nông', pattern: /khuyen nong/ },
  { label: 'Cây có múi', pattern: /cay co mui|cam|buoi|quyt/ },
  { label: 'Vải & nhãn', pattern: /vai|nhan/ },
  { label: 'Bảo vệ thực vật', pattern: /bao ve thuc vat|bvtv|sau|benh|dich hai/ },
  { label: 'Tiêu chuẩn canh tác', pattern: /vietgap|globalgap|huu co|tieu chuan|quy trinh/ },
];
const searchable = (expert: ConsultationExpert) => normalize([expert.name, expert.title, expert.organization, expert.specialties].join(' '));
const specialties = (value: string) => value.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean);

export function ExpertDirectory({ experts, loading, onChat, currentUserId, chatUnavailableReason }: {
  experts: ConsultationExpert[]; loading: boolean; onChat: (expert: ConsultationExpert) => void; currentUserId?: string; chatUnavailableReason?: string;
}) {
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('Tất cả');
  const [profileId, setProfileId] = useState('');
  const view = useRef<HTMLDivElement>(null);
  const activeExperts = experts.filter(expert => expert.active && expert.status === 'active');
  const selectedProfile = activeExperts.find(expert => expert.id === profileId);
  useEffect(() => { if (profileId && !loading && !experts.some(expert => expert.id === profileId && expert.active && expert.status === 'active')) setProfileId(''); }, [experts, loading, profileId]);
  useEffect(() => { if (profileId) view.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }, [profileId]);
  const query = normalize(search.trim());
  const selectedTopic = topics.find(item => item.label === topic);
  const visibleExperts = activeExperts.filter(expert => {
    const text = searchable(expert);
    const searchText = `${text} ${normalize(expert.coverCrops?.join(' ') || '')}`;
    return (!query || query.split(/\s+/).every(word => searchText.includes(word))) && (!selectedTopic || selectedTopic.pattern.test(text));
  });
  const topicCount = topics.filter(item => activeExperts.some(expert => item.pattern.test(searchable(expert)))).length;
  function chat(expert: ConsultationExpert) { setProfileId(''); onChat(expert); }
  if (selectedProfile) return <div ref={view} className="scroll-mt-28"><ExpertProfile expert={selectedProfile} onBack={() => setProfileId('')} onChat={() => chat(selectedProfile)} isSelf={selectedProfile.id === currentUserId} chatUnavailableReason={chatUnavailableReason} /></div>;
  return <div className="expert-directory">
    <section className="expert-hero" aria-labelledby="expert-directory-title">
      <span className="expert-hero-status"><span aria-hidden="true" />{loading ? 'Đang tải danh sách chuyên gia…' : `${activeExperts.length} chuyên gia đang tiếp nhận câu hỏi`}</span>
      <h2 id="expert-directory-title">Kết nối chuyên gia<span>Nông nghiệp Bắc Ninh</span></h2>
      <p>Trao đổi trực tiếp về cây trồng, sâu bệnh và kỹ thuật chăm sóc. Chọn chuyên gia phù hợp và theo dõi phản hồi ngay trong tài khoản của bạn.</p>
      <div className="expert-hero-features"><span><MessageCircle size={15} />Kết nối trực tiếp</span><span><ShieldCheck size={15} />Hội thoại theo tài khoản</span><span><Sprout size={15} />Đồng hành cùng nhà vườn</span></div>
    </section>
    <div className="expert-stats" aria-label="Thông tin kết nối chuyên gia">
      <div><Users size={22} aria-hidden="true" /><strong>{loading ? '—' : activeExperts.length}</strong><span>Chuyên gia tiếp nhận</span></div>
      <div><Leaf size={22} aria-hidden="true" /><strong>{loading ? '—' : topicCount}</strong><span>Nhóm chuyên môn</span></div>
      <div><MessageCircle size={22} aria-hidden="true" /><strong>1:1</strong><span>Trao đổi trực tiếp</span></div>
    </div>
    <section className="expert-search-panel" aria-label="Tìm và lọc chuyên gia">
      <label className="expert-search"><Search size={19} aria-hidden="true" /><span className="sr-only">Tìm chuyên gia</span><input type="search" placeholder="Tìm theo tên, chuyên môn, cây trồng…" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="expert-filters" aria-label="Lọc theo chuyên môn">
        <button type="button" aria-pressed={topic === 'Tất cả'} onClick={() => setTopic('Tất cả')}>Tất cả</button>
        {topics.map(item => <button type="button" key={item.label} aria-pressed={topic === item.label} onClick={() => setTopic(item.label)}>{item.label}</button>)}
      </div>
    </section>
    <section className="expert-results" aria-labelledby="expert-results-title" aria-busy={loading}>
      <div className="expert-results-heading"><h3 id="expert-results-title">Chuyên gia đang tiếp nhận</h3><span role="status">{loading ? 'Đang tải…' : `${visibleExperts.length} chuyên gia${query || selectedTopic ? ' phù hợp' : ''}`}</span></div>
      {!loading && !visibleExperts.length && <div className="expert-empty"><Search size={28} aria-hidden="true" /><h4>{activeExperts.length ? 'Chưa tìm thấy chuyên gia phù hợp' : 'Chưa có chuyên gia đang tiếp nhận'}</h4><p>{activeExperts.length ? 'Thử tên, cây trồng hoặc nhóm chuyên môn khác.' : 'Danh sách sẽ được cập nhật khi có chuyên gia mở tiếp nhận câu hỏi.'}</p>{(search || selectedTopic) && <button type="button" onClick={() => { setSearch(''); setTopic('Tất cả'); }}>Xóa bộ lọc</button>}</div>}
      {loading && <p className="expert-empty">Đang tải hồ sơ chuyên gia…</p>}
      {visibleExperts.map(expert => <article key={expert.id} className="expert-card" aria-label={expert.name}>
        <div className="expert-card-heading"><ExpertAvatar expert={expert} /><div className="expert-identity"><h4>{expert.name}</h4><p>{expert.title}</p>{expert.organization && <p className="expert-organization">{expert.organization}</p>}</div><span className="expert-card-badge"><Check size={13} aria-hidden="true" />{expert.badge || 'Đang tiếp nhận'}</span></div>
        <div className="expert-specialties">{specialties(expert.specialties).map((item, index) => <span key={`${item}:${index}`}>{item}</span>)}</div>
        <div className="expert-availability"><CalendarDays size={16} aria-hidden="true" /><span>{expert.availability || 'Phản hồi theo lịch làm việc của chuyên gia'}</span></div>
        <div className="expert-card-actions"><button type="button" className="expert-profile-button" onClick={() => setProfileId(expert.id)}><BookOpen size={17} aria-hidden="true" />Xem hồ sơ<ChevronRight size={16} aria-hidden="true" /></button><button type="button" className="expert-chat-button" disabled={expert.id === currentUserId || Boolean(chatUnavailableReason)} title={chatUnavailableReason} onClick={() => chat(expert)}><MessageCircle size={17} aria-hidden="true" />{expert.id === currentUserId ? 'Hồ sơ của bạn' : chatUnavailableReason ? 'Dành cho nhà vườn' : 'Chat ngay'}<ArrowUpRight size={16} aria-hidden="true" /></button></div>
      </article>)}
    </section>
  </div>;
}
