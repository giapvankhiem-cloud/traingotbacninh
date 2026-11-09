import { StoryViewer } from './StoryEditor';
import { storyFromLegacy } from '../utils/story';
import React from 'react';
import { Phone, MessageSquare, MapPin, Heart, Award } from 'lucide-react';
import type { FarmerProfile } from '../types/agriculture';
import { FarmerCertificates } from './FarmerCertificates';

export const FarmerProfileViewer: React.FC<{ farmer: FarmerProfile; produceName: string }> = ({ farmer }) => <div className="space-y-5">
  <section className="farmer-summary rounded-3xl ui-banner p-5 sm:p-6 text-white border border-emerald-800/50 shadow-md">
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <img src={farmer.avatar || undefined} alt={farmer.name} className="w-20 h-20 rounded-2xl object-cover ring-4 ring-emerald-400/80 shadow-lg" />
      <div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2 mb-1"><h3 className="ui-card-title text-white break-words">{farmer.name}</h3><span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/20">Hồ sơ nhà vườn</span></div><p className="text-xs text-emerald-200 mb-1">{farmer.role}</p><p className="text-xs text-emerald-100 flex items-start gap-1"><MapPin size={14} className="shrink-0" /><span className="break-words">{farmer.address}</span></p></div>
      <div className="farmer-contact flex sm:flex-col gap-2 w-full sm:w-auto pt-2 sm:pt-0">
        <a href={`tel:${farmer.phone.replace(/\s+/g, '')}`} className="farmer-phone flex-1 inline-flex justify-center items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-ink font-semibold text-xs"><Phone size={14} />Gọi: {farmer.phone}</a>
        <a href={`https://zalo.me/${farmer.zalo}`} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex justify-center items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 text-white font-semibold text-xs border border-white/20"><MessageSquare size={14} />Nhắn Zalo</a>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-emerald-800/60 text-center">{[['Kinh nghiệm', `${farmer.experienceYears} năm`], ['Quy mô vườn', `${farmer.orchardAreaHa} ha`], ['Số lượng gốc', `${farmer.treeCount} cây`]].map(([label, value]) => <div key={label} className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-700/30"><span className="text-xs text-emerald-200 block">{label}</span><p className="text-base sm:text-lg font-semibold text-white">{value}</p></div>)}</div>
  </section>
  <section className="farmer-story bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs leading-relaxed">
    <div><h4 className="ui-label-title text-ink mb-1">Giới thiệu nhà vườn</h4><StoryViewer blocks={farmer.introductionContent || storyFromLegacy(farmer.bio || 'Nhà vườn chưa bổ sung phần giới thiệu.', farmer.introductionMedia)} /></div>
    <div className="pt-2 border-t border-slate-200"><h4 className="ui-label-title text-accent mb-1 flex items-center gap-1.5"><Heart size={14} />Cam kết canh tác</h4><p className="text-body italic bg-white p-2.5 rounded-xl border border-slate-200 whitespace-pre-wrap">{farmer.commitment || 'Nhà vườn chưa bổ sung cam kết.'}</p></div>
    {farmer.achievements?.length > 0 && <div><h4 className="ui-label-title flex gap-1.5 items-center"><Award size={14} />Thành tích và danh hiệu</h4><ul className="list-disc pl-4 space-y-1">{farmer.achievements.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
  </section>
  <FarmerCertificates certificates={farmer.certificates || []} />
</div>;
