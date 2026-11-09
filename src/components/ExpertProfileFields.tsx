import { useEffect, useState } from 'react';
import type { ConsultationExpert } from '../types/consultations';

const field = 'block w-full border rounded-xl p-3 mt-1 bg-white';
export function ExpertProfileFields({ value, onChange, disabled = false }: {
  value: Partial<ConsultationExpert>; onChange: (details: Partial<ConsultationExpert>) => void; disabled?: boolean;
}) {
  // Preserve separators while typing; arrays sent to the parent contain clean entries.
  const [cropsText, setCropsText] = useState((value.coverCrops || []).join(', '));
  const [qualificationsText, setQualificationsText] = useState((value.qualifications || []).join('\n'));
  useEffect(() => {
    setCropsText((value.coverCrops || []).join(', '));
    setQualificationsText((value.qualifications || []).join('\n'));
  }, [value.id]);
  return <fieldset disabled={disabled} className="grid sm:grid-cols-2 gap-4 rounded-xl border p-4 sm:col-span-2">
    <legend className="px-2 font-semibold">Thông tin hồ sơ công khai</legend>
    <p className="text-sm text-muted sm:col-span-2">Bổ sung thông tin chuyên gia muốn hiển thị cho nhà vườn. Email liên hệ dưới đây là thông tin công khai của hồ sơ.</p>
    <label className="block sm:col-span-2">Ảnh đại diện (liên kết HTTPS)<input type="url" maxLength={1200} placeholder="https://…" value={value.avatar || ''} onChange={event => onChange({ avatar: event.target.value })} className={field} /></label>
    <label className="block">Nhóm chuyên gia<input maxLength={80} placeholder="Ví dụ: Cán bộ khuyến nông" value={value.badge || ''} onChange={event => onChange({ badge: event.target.value })} className={field} /></label>
    <label className="block">Số năm kinh nghiệm<input type="number" min={0} max={70} step={1} value={value.experienceYears ?? ''} onChange={event => onChange({ experienceYears: event.target.value === '' ? undefined : Number(event.target.value) })} className={field} /></label>
    <label className="block sm:col-span-2">Cây trồng phụ trách<input maxLength={1300} placeholder="Vải thiều, Cam đường Canh, Bưởi Diễn…" value={cropsText} onChange={event => { setCropsText(event.target.value); onChange({ coverCrops: event.target.value.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean) }); }} className={field} /><span className="text-xs text-muted">Tối đa 12 loại cây, ngăn cách bằng dấu phẩy.</span></label>
    <label className="block sm:col-span-2">Bằng cấp & chứng chỉ<textarea rows={3} maxLength={2500} placeholder="Mỗi bằng cấp hoặc chứng chỉ trên một dòng" value={qualificationsText} onChange={event => { setQualificationsText(event.target.value); onChange({ qualifications: event.target.value.split(/\n+/).map(item => item.trim()).filter(Boolean) }); }} className={field} /><span className="text-xs text-muted">Tối đa 12 mục, mỗi mục tối đa 200 ký tự.</span></label>
    <label className="block">Email liên hệ công khai<input type="email" maxLength={254} value={value.contactEmail || ''} onChange={event => onChange({ contactEmail: event.target.value })} className={field} /></label>
    <label className="block">Số Zalo công khai<input type="tel" maxLength={30} value={value.zalo || ''} onChange={event => onChange({ zalo: event.target.value })} className={field} /></label>
  </fieldset>;
}
