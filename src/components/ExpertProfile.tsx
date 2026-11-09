import { useState } from 'react';
import { ArrowLeft, Award, BookOpen, CalendarDays, CheckCircle2, Clock3, ExternalLink, Leaf, Mail, MessageCircle, Phone, Sprout, TrendingUp, Users } from 'lucide-react';
import { expertStatusLabels, type ConsultationExpert } from '../types/consultations';

const splitSpecialties = (value: string) => value.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean);
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(word => word[0]).join('');
function imageUrl(value?: string) {
  if (!value) return '';
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
function phoneNumber(value?: string) {
  const phone = value?.trim() || '';
  if (!/^\+?[\d\s().-]+$/.test(phone)) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? `${phone.startsWith('+') ? '+' : ''}${digits}` : '';
}
function publicEmail(value?: string) {
  const email = value?.trim() || '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function experienceFromBio(bio?: string): number | undefined {
  const matches = (bio || '').normalize('NFC').matchAll(/^[ \t]*(\d{1,2})[ \t]+năm[ \t]+kinh[ \t]+nghiệm(?=$|[^\p{L}\p{N}])/gimu);
  const years = new Set(Array.from(matches, match => Number(match[1])));
  const [value] = years;
  return years.size === 1 && value <= 70 ? value : undefined;
}

export function ExpertAvatar({ expert, className = '' }: { expert: Pick<ConsultationExpert, 'name' | 'avatar'>; className?: string }) {
  const source = imageUrl(expert.avatar);
  const [failedSource, setFailedSource] = useState('');
  return <span className={`expert-portrait ${className}`}>
    {source && failedSource !== source
      ? <img src={source} alt={expert.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSource(source)} />
      : <span role="img" aria-label={`Ảnh đại diện ${expert.name}`}>{initials(expert.name)}</span>}
  </span>;
}

export function ExpertProfile({ expert, onBack, onChat, isSelf = false, chatUnavailableReason, backLabel = 'Danh sách chuyên gia' }: {
  expert: ConsultationExpert; onBack: () => void; onChat: () => void; isSelf?: boolean; chatUnavailableReason?: string;
  backLabel?: string;
}) {
  const receiving = expert.active && expert.status === 'active';
  const specialtyItems = splitSpecialties(expert.specialties);
  const crops = expert.coverCrops?.filter(Boolean) || [];
  const qualifications = expert.qualifications?.filter(Boolean) || [];
  const phone = phoneNumber(expert.phone);
  const zaloPhone = phoneNumber(expert.zalo).replace(/^\+/, '');
  const zalo = zaloPhone.startsWith('0') ? `84${zaloPhone.slice(1)}` : zaloPhone;
  const email = publicEmail(expert.contactEmail);
  const disabled = isSelf || Boolean(chatUnavailableReason) || !receiving;
  const chatLabel = isSelf ? 'Hồ sơ của bạn' : chatUnavailableReason ? 'Dành cho nhà vườn' : receiving ? 'Chat ngay' : 'Chưa mở tiếp nhận';
  const years = expert.experienceYears;
  const hasStructuredExperience = typeof years === 'number' && Number.isInteger(years) && years >= 0 && years <= 70;
  const introductionExperience = hasStructuredExperience ? undefined : experienceFromBio(expert.bio);
  const experience = hasStructuredExperience ? years : introductionExperience;
  return <section className="expert-profile-page" aria-label={`Hồ sơ chuyên gia ${expert.name}`}>
    <button type="button" className="expert-profile-back" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" />{backLabel}</button>
    <header className="expert-profile-hero">
      <ExpertAvatar expert={expert} className="expert-profile-portrait" />
      <div className="expert-profile-heading">
        <span className="expert-profile-group"><Users size={13} aria-hidden="true" />{expert.badge || 'Chuyên gia tư vấn'}</span>
        <h2>{expert.name}</h2>
        <p>{expert.title}</p>
        <p className="expert-profile-organization">{expert.organization || 'Chưa cập nhật đơn vị công tác'}</p>
      </div>
    </header>
    <div className="expert-profile-metrics" aria-label="Thông tin chuyên gia">
      <div><TrendingUp size={20} aria-hidden="true" /><strong className={experience === undefined ? 'expert-profile-metric-text' : undefined}>{experience ?? 'Chưa cập nhật'}</strong><span>{introductionExperience === undefined ? 'Năm kinh nghiệm' : 'Năm kinh nghiệm theo giới thiệu'}</span></div>
      <div><Sprout size={20} aria-hidden="true" /><strong className={!crops.length ? 'expert-profile-metric-text' : undefined}>{crops.length || 'Chưa cập nhật'}</strong><span>Cây trồng phụ trách</span></div>
      <div className={receiving ? undefined : 'expert-profile-unavailable'}><CheckCircle2 size={20} aria-hidden="true" /><strong className="expert-profile-metric-text">{receiving ? 'Đang tiếp nhận' : expertStatusLabels[expert.status]}</strong><span>Trạng thái tư vấn</span></div>
    </div>
    <section className="expert-profile-section" aria-labelledby="expert-profile-about">
      <h3 id="expert-profile-about"><BookOpen size={17} aria-hidden="true" />Giới thiệu</h3>
      <p className="expert-profile-prose">{expert.bio || 'Chuyên gia chưa cập nhật phần giới thiệu.'}</p>
    </section>
    <section className="expert-profile-section" aria-labelledby="expert-profile-specialties">
      <h3 id="expert-profile-specialties"><Leaf size={17} aria-hidden="true" />Chuyên môn & cây trồng phụ trách</h3>
      <div className="expert-profile-chips">{specialtyItems.length ? specialtyItems.map((item, index) => <span key={`${item}:${index}`}>{item}</span>) : <p className="expert-profile-missing">Chưa cập nhật chuyên môn.</p>}</div>
      <div className="expert-profile-chips expert-profile-crops">{crops.length ? crops.map((crop, index) => <span key={`${crop}:${index}`}><Sprout size={13} aria-hidden="true" />{crop}</span>) : <p className="expert-profile-missing">Chưa cập nhật cây trồng phụ trách.</p>}</div>
    </section>
    <section className="expert-profile-section" aria-labelledby="expert-profile-qualifications">
      <h3 id="expert-profile-qualifications"><Award size={17} aria-hidden="true" />Bằng cấp & chứng chỉ</h3>
      {qualifications.length ? <ul className="expert-profile-qualifications">{qualifications.map((qualification, index) => <li key={`${qualification}:${index}`}><CheckCircle2 size={16} aria-hidden="true" /><span>{qualification}</span></li>)}</ul> : <p className="expert-profile-missing">Chuyên gia chưa cập nhật bằng cấp và chứng chỉ.</p>}
    </section>
    <section className="expert-profile-section" aria-labelledby="expert-profile-contact">
      <h3 id="expert-profile-contact"><Phone size={17} aria-hidden="true" />Liên hệ & lịch làm việc</h3>
      <div className="expert-profile-contacts">
        <div><span className="expert-profile-contact-icon"><Phone size={17} aria-hidden="true" /></span><span><span className="expert-profile-contact-label">Điện thoại</span>{phone ? <a href={`tel:${phone}`}>{expert.phone}</a> : <span className="expert-profile-missing">Chưa cập nhật</span>}</span></div>
        <div><span className="expert-profile-contact-icon"><MessageCircle size={17} aria-hidden="true" /></span><span><span className="expert-profile-contact-label">Zalo</span>{zalo ? <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer">{expert.zalo}<ExternalLink size={13} aria-hidden="true" /></a> : <span className="expert-profile-missing">Chưa cập nhật</span>}</span></div>
        <div><span className="expert-profile-contact-icon"><Mail size={17} aria-hidden="true" /></span><span><span className="expert-profile-contact-label">Email liên hệ công khai</span>{email ? <a href={`mailto:${encodeURIComponent(email).replace(/%40/g, '@')}`}>{email}</a> : <span className="expert-profile-missing">Chưa cập nhật</span>}</span></div>
      </div>
      <div className="expert-profile-working-hours"><CalendarDays size={18} aria-hidden="true" /><div><span>Lịch tiếp nhận</span><p>{expert.availability || 'Chưa cập nhật lịch làm việc.'}</p></div></div>
      <p className="expert-profile-response-note"><Clock3 size={14} aria-hidden="true" />Thời gian phản hồi phụ thuộc lịch làm việc của chuyên gia.</p>
    </section>
    <div className="expert-profile-actions">
      {phone ? <a className="expert-profile-call" href={`tel:${phone}`}><Phone size={18} aria-hidden="true" />Gọi điện</a> : <button type="button" className="expert-profile-call" disabled><Phone size={18} aria-hidden="true" />Chưa có số điện thoại</button>}
      <button type="button" className="expert-profile-start-chat" onClick={onChat} disabled={disabled} title={chatUnavailableReason}><MessageCircle size={18} aria-hidden="true" />{chatLabel}</button>
    </div>
  </section>;
}
