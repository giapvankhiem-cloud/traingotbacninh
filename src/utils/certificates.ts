import type { Certificate } from '../types/agriculture';

export const CERTIFICATE_TYPES: Certificate['type'][] = ['VietGAP', 'GlobalGAP', 'OCOP', 'Hữu cơ', 'An toàn thực phẩm', 'Khác'];
export const MAX_CERTIFICATES = 6;
export const MAX_CERTIFICATE_IMAGE = 140_000;
const allowed = new Set(['id', 'type', 'title', 'certificateNumber', 'issuedBy', 'issuedDate', 'expiryDate', 'scope', 'verified', 'qrCodeUrl', 'standardDetails', 'ocopStars', 'documentUrl', 'documentImage']);

export function validCertificateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1000 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export function certificateHttpsUrl(value: string) {
  if (!value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' && !url.username && !url.password && url.href.length <= 1200) return url.href;
  } catch { /* Validation message below. */ }
  throw new Error('Liên kết chứng nhận phải là HTTPS công khai, không chứa tên đăng nhập hoặc mật khẩu.');
}
export function normalizeCertificates(certificates: Certificate[] = []): Certificate[] {
  if (!Array.isArray(certificates) || certificates.length > MAX_CERTIFICATES) throw new Error(`Mỗi vườn khai báo tối đa ${MAX_CERTIFICATES} giấy chứng nhận.`);
  const ids = new Set<string>();
  return certificates.map((certificate, index) => {
    const prefix = `Chứng nhận ${index + 1}: `;
    if (!certificate || typeof certificate !== 'object' || Object.keys(certificate).some((key) => !allowed.has(key))) throw new Error(prefix + 'có trường dữ liệu không được hỗ trợ.');
    const text = (key: keyof Certificate, max: number, required = false) => {
      const value = certificate[key];
      if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new Error(prefix + 'vui lòng điền đủ thông tin, đúng giới hạn độ dài.');
      return value.trim();
    };
    const id = text('id', 80, true);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(prefix + 'mã hồ sơ không hợp lệ.');
    if (ids.has(id)) throw new Error(prefix + 'mã hồ sơ bị trùng.'); ids.add(id);
    if (!CERTIFICATE_TYPES.includes(certificate.type)) throw new Error(prefix + 'loại chứng nhận không được hỗ trợ.');
    if (certificate.verified !== false) throw new Error(prefix + 'nhà vườn chỉ được tự khai, không được tự đánh dấu đã xác minh.');
    const issuedDate = text('issuedDate', 10, true); const expiryDate = text('expiryDate', 10);
    if (!validCertificateDate(issuedDate) || (expiryDate && (!validCertificateDate(expiryDate) || expiryDate < issuedDate))) throw new Error(prefix + 'ngày cấp/hết hạn không hợp lệ hoặc ngày hết hạn sớm hơn ngày cấp.');
    if (certificate.type === 'OCOP' && ![3, 4, 5].includes(certificate.ocopStars!)) throw new Error(prefix + 'vui lòng chọn OCOP 3, 4 hoặc 5 sao.');
    const documentImage = certificate.documentImage || '';
    if (typeof documentImage !== 'string' || documentImage.length > MAX_CERTIFICATE_IMAGE || (documentImage && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(documentImage))) throw new Error(prefix + 'ảnh đính kèm không hợp lệ hoặc quá lớn.');
    return { id, type: certificate.type, title: text('title', 200, true), certificateNumber: text('certificateNumber', 150, true), issuedBy: text('issuedBy', 200, true), issuedDate, expiryDate, scope: text('scope', 1000, true), standardDetails: text('standardDetails', 1000), verified: false,
      ...(certificate.type === 'OCOP' ? { ocopStars: certificate.ocopStars } : {}), documentUrl: certificateHttpsUrl(certificate.documentUrl || ''), documentImage,
      ...(certificate.qrCodeUrl ? { qrCodeUrl: certificateHttpsUrl(certificate.qrCodeUrl) } : {}),
    };
  });
}
export function certificateTerm(certificate: Certificate, today = new Date()) {
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (certificate.issuedDate > day) return 'Chưa đến ngày cấp khai báo';
  if (!certificate.expiryDate) return 'Chưa khai ngày hết hạn';
  return certificate.expiryDate < day ? 'Đã hết hạn khai báo' : 'Trong thời hạn khai báo';
}
export function certificateSummary(certificates: Certificate[]) {
  return [...new Set(certificates.map((certificate) => certificate.type === 'OCOP' && certificate.ocopStars ? `OCOP ${certificate.ocopStars} sao` : certificate.type))].join(' · ');
}
