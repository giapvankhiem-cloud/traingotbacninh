import { useState } from 'react';
import { Award, ExternalLink, Eye, X } from 'lucide-react';
import type { Certificate } from '../types/agriculture';
import { certificateHttpsUrl, certificateTerm } from '../utils/certificates';

function link(value?: string) { try { return certificateHttpsUrl(value || ''); } catch { return ''; } }
function date(value: string) { return value ? value.split('-').reverse().join('/') : 'Không khai báo'; }
export function FarmerCertificates({ certificates }: { certificates: Certificate[] }) {
  const [selectedId, setSelectedId] = useState('');
  const selected = certificates.find((certificate) => certificate.id === selectedId);
  return <section className="space-y-3" aria-label="Giấy chứng nhận của nhà vườn">
    <header className="flex items-center gap-2"><Award className="w-5 h-5 text-accent" /><h4 className="ui-label-title text-ink">Giấy chứng nhận nhà vườn khai báo ({certificates.length})</h4></header>
    <p className="text-xs text-body">Hồ sơ do chủ vườn cung cấp, chưa được website xác minh. Đối chiếu phạm vi, thời hạn và bản đính kèm để biết sản phẩm có thuộc hồ sơ này.</p>
    {certificates.length === 0 && <p className="text-sm p-4 rounded-2xl border bg-slate-50 text-body">Nhà vườn chưa khai báo giấy chứng nhận.</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{certificates.map((certificate) => <article key={certificate.id} className={`certificate-card rounded-2xl border p-4 space-y-3 text-xs ${certificate.type === 'GlobalGAP' ? 'bg-blue-50/60 border-blue-200' : certificate.type === 'OCOP' ? 'bg-amber-50/60 border-amber-200' : 'bg-emerald-50/60 border-emerald-200'}`}>
      <div className="flex flex-wrap justify-between gap-2"><span className="rounded-full bg-white px-2.5 py-1 font-semibold text-accent border">{certificate.type}{certificate.type === 'OCOP' && certificate.ocopStars ? ` ${certificate.ocopStars} sao` : ''}</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900 font-semibold">Tự khai · Chưa xác minh</span></div>
      <h5 className="ui-caption-title text-ink break-words">{certificate.title}</h5>
      <p className="break-words"><strong>Số chứng nhận:</strong> {certificate.certificateNumber}</p><p className="break-words"><strong>Đơn vị cấp:</strong> {certificate.issuedBy}</p><p className="whitespace-pre-wrap break-words"><strong>Phạm vi:</strong> {certificate.scope}</p>
      <p><strong>Ngày cấp:</strong> {date(certificate.issuedDate)}<br /><strong>Ngày hết hạn:</strong> {date(certificate.expiryDate)}</p><p className={certificateTerm(certificate) === 'Đã hết hạn khai báo' ? 'font-semibold text-rose-800' : 'text-body'}>{certificateTerm(certificate)}</p>
      {certificate.standardDetails && <p className="whitespace-pre-wrap break-words"><strong>Tiêu chuẩn / ghi chú:</strong> {certificate.standardDetails}</p>}
      {certificate.documentImage && <img src={certificate.documentImage} alt={`Bản chụp ${certificate.title}`} className="w-full h-36 object-contain bg-white border rounded-xl" />}
      <button type="button" onClick={() => setSelectedId(certificate.id)} className="w-full inline-flex justify-center items-center gap-2 rounded-xl border bg-white p-2.5 font-semibold text-accent"><Eye size={15} />Xem hồ sơ chứng nhận</button>
    </article>)}</div>
    {selected && <div className="ui-dialog fixed inset-0 z-[70] p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="certificate-view-title"><div className="bg-white rounded-3xl p-5 w-full max-w-3xl max-h-[92vh] overflow-y-auto space-y-4">
      <header className="ui-banner rounded-2xl px-4 py-2 flex justify-between items-center gap-3"><h3 id="certificate-view-title" className="ui-card-title">{selected.title}</h3><button type="button" aria-label="Đóng hồ sơ chứng nhận" onClick={() => setSelectedId('')}><X /></button></header>
      <p className="p-3 rounded-xl bg-amber-50 text-amber-900 text-sm">Nhà vườn tự khai – Chưa được website xác minh.</p>
      <dl className="text-sm space-y-2"><div><dt className="font-semibold">Số chứng nhận / quyết định</dt><dd>{selected.certificateNumber}</dd></div><div><dt className="font-semibold">Đơn vị cấp</dt><dd>{selected.issuedBy}</dd></div><div><dt className="font-semibold">Phạm vi</dt><dd className="whitespace-pre-wrap break-words">{selected.scope}</dd></div><div><dt className="font-semibold">Thời hạn khai báo</dt><dd>{date(selected.issuedDate)} – {date(selected.expiryDate)} · {certificateTerm(selected)}</dd></div></dl>
      {selected.documentImage && <img src={selected.documentImage} alt={`Bản chụp đầy đủ ${selected.title}`} className="max-w-full h-auto mx-auto border rounded-xl" />}
      {link(selected.documentUrl) && <a href={link(selected.documentUrl)} target="_blank" rel="noopener noreferrer" className="ui-button-primary inline-flex gap-2 items-center p-3"><ExternalLink size={16} />Mở bản chứng nhận / PDF</a>}
      {!selected.documentImage && !link(selected.documentUrl) && <p className="rounded-xl bg-slate-50 p-4 text-sm text-body">Nhà vườn chưa đính kèm ảnh hoặc liên kết bản chứng nhận.</p>}
    </div></div>}
  </section>;
}
