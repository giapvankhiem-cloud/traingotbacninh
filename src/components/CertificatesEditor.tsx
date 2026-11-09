import { useState } from 'react';
import { Plus, Trash2, FileCheck } from 'lucide-react';
import type { Certificate } from '../types/agriculture';
import { CERTIFICATE_TYPES, MAX_CERTIFICATES, MAX_CERTIFICATE_IMAGE } from '../utils/certificates';
import { compressImage } from '../utils/images';

export function CertificatesEditor({ value, onChange, disabled, onUploading }: { value: Certificate[]; onChange: (value: Certificate[]) => void; disabled: boolean; onUploading: (uploading: boolean) => void }) {
  const [uploadingId, setUploadingId] = useState('');
  const [error, setError] = useState('');
  function update(id: string, patch: Partial<Certificate>) { onChange(value.map((certificate) => certificate.id === id ? { ...certificate, ...patch, verified: false } : certificate)); }
  const busy = disabled || Boolean(uploadingId);
  const input = 'mt-1 w-full rounded-xl border border-slate-300 p-2.5 bg-white';
  return <section className="space-y-4 border-t border-slate-200 pt-5" aria-labelledby="certificates-editor-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><h4 id="certificates-editor-title" className="ui-label-title text-ink flex items-center gap-2"><FileCheck size={18} className="text-accent" />3. Giấy chứng nhận trái cây (nếu có)</h4><span className="text-muted">{value.length}/{MAX_CERTIFICATES} hồ sơ</span></div>
    <p className="text-body">Khai báo đúng loại, phạm vi và thời hạn của từng giấy. Thông tin cùng ảnh/liên kết chỉ được công khai trong hồ sơ và trang QR sau khi quản trị duyệt bản hồ sơ này. Các hồ sơ được ghi là “Nhà vườn tự khai – Chưa xác minh”.</p>
    {error && <p role="alert" className="rounded-xl bg-rose-50 text-rose-800 p-3">{error}</p>}
    {value.map((certificate, index) => <fieldset key={certificate.id} disabled={busy} className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
      <legend className="px-2 font-semibold text-accent">Chứng nhận {index + 1}</legend>
      <div className="flex justify-end"><button type="button" aria-label={`Xóa chứng nhận ${index + 1}`} onClick={() => onChange(value.filter((item) => item.id !== certificate.id))} className="inline-flex items-center gap-1 text-rose-700"><Trash2 size={14} />Bỏ hồ sơ này</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label>Loại chứng nhận *<select required className={input} value={certificate.type} onChange={(event) => { const type = event.target.value as Certificate['type']; update(certificate.id, { type, ...(type === 'OCOP' ? { ocopStars: 3 } : { ocopStars: undefined }), ...(certificate.title === `Giấy chứng nhận ${certificate.type}` ? { title: `Giấy chứng nhận ${type}` } : {}) }); }}>{CERTIFICATE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        {certificate.type === 'OCOP' && <label>Xếp hạng OCOP *<select required className={input} value={certificate.ocopStars || 3} onChange={(event) => update(certificate.id, { ocopStars: Number(event.target.value) as 3 | 4 | 5 })}>{[3, 4, 5].map((stars) => <option key={stars} value={stars}>{stars} sao</option>)}</select></label>}
        <label>Tên giấy chứng nhận *<input required maxLength={200} className={input} value={certificate.title} onChange={(event) => update(certificate.id, { title: event.target.value })} /></label>
        <label>Số chứng nhận / quyết định *<input required maxLength={150} className={input} value={certificate.certificateNumber} onChange={(event) => update(certificate.id, { certificateNumber: event.target.value })} /></label>
        <label>Đơn vị cấp *<input required maxLength={200} className={input} value={certificate.issuedBy} onChange={(event) => update(certificate.id, { issuedBy: event.target.value })} /></label>
        <label>Ngày cấp *<input required type="date" min="1000-01-01" max="9999-12-31" className={input} value={certificate.issuedDate} onChange={(event) => update(certificate.id, { issuedDate: event.target.value })} /></label>
        <label>Ngày hết hạn (nếu có)<input type="date" min={certificate.issuedDate || '1000-01-01'} max="9999-12-31" className={input} value={certificate.expiryDate} onChange={(event) => update(certificate.id, { expiryDate: event.target.value })} /></label>
      </div>
      <label className="block">Sản phẩm / vùng trồng thuộc phạm vi chứng nhận *<textarea required maxLength={1000} rows={2} className={input} placeholder="Ví dụ: Vải thiều tại khu A, diện tích 1,5 ha…" value={certificate.scope} onChange={(event) => update(certificate.id, { scope: event.target.value })} /></label>
      <label className="block">Tiêu chuẩn / ghi chú bổ sung<textarea maxLength={1000} rows={2} className={input} value={certificate.standardDetails} onChange={(event) => update(certificate.id, { standardDetails: event.target.value })} /></label>
      <label className="block">Liên kết hồ sơ hoặc PDF (HTTPS)<input type="url" maxLength={1200} placeholder="https://…" className={input} value={certificate.documentUrl || ''} onChange={(event) => update(certificate.id, { documentUrl: event.target.value })} /></label>
      <label className="block">Ảnh giấy chứng nhận (JPG/PNG/WebP, tối đa 10 MB)<input className="block mt-2 max-w-full" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
        const file = event.target.files?.[0]; if (!file) return;
        setError(''); setUploadingId(certificate.id); onUploading(true);
        try { update(certificate.id, { documentImage: await compressImage(file, 1400, MAX_CERTIFICATE_IMAGE) }); }
        catch (error) { setError((error as Error).message); }
        finally { setUploadingId(''); onUploading(false); }
      }} /></label>
      {uploadingId === certificate.id && <p role="status">Đang xử lý ảnh chứng nhận…</p>}
      {certificate.documentImage && <div className="space-y-2"><img src={certificate.documentImage} alt={`Ảnh đính kèm chứng nhận ${index + 1}`} className="max-h-60 max-w-full border rounded-xl bg-white object-contain" /><button type="button" onClick={() => update(certificate.id, { documentImage: '' })} className="text-rose-700">Bỏ ảnh đính kèm</button></div>}
      <p className="text-muted">Ảnh được nén trước khi lưu. Với hồ sơ PDF hoặc nhiều trang, dùng liên kết HTTPS tới bản đầy đủ. Không có bản đính kèm vẫn có thể khai báo thông tin.</p>
    </fieldset>)}
    <button type="button" disabled={busy || value.length >= MAX_CERTIFICATES} onClick={() => onChange([...value, { id: crypto.randomUUID(), type: 'VietGAP', title: 'Giấy chứng nhận VietGAP', certificateNumber: '', issuedBy: '', issuedDate: '', expiryDate: '', scope: '', verified: false, standardDetails: '', documentUrl: '', documentImage: '' }])} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-accent font-semibold disabled:opacity-50"><Plus size={16} />Thêm giấy chứng nhận</button>
    {value.length === 0 && <p className="text-muted">Chưa khai báo giấy chứng nhận. Bạn có thể bỏ qua mục này và bổ sung sau.</p>}
  </section>;
}
