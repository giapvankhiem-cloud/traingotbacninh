import type { Certificate } from '../../src/types/agriculture';

// A single transparent PNG pixel used only as an upload-format test fixture.
export const proofImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXi0AAAAASUVORK5CYII=';
export function certificateFixture(patch: Partial<Certificate> = {}): Certificate {
  return { id: 'certificate-test-1', type: 'VietGAP', title: 'Chứng nhận dùng trong Emulator', certificateNumber: 'TEST-VG-2026-001', issuedBy: 'Đơn vị cấp giả lập trong kiểm thử', issuedDate: '2025-01-01', expiryDate: '2027-12-31', scope: 'Vải thiều trên khu vườn thử nghiệm', verified: false, standardDetails: 'Dữ liệu kiểm thử, không phải giấy chứng nhận thật.', documentUrl: 'https://example.test/certificate.pdf', documentImage: proofImage, ...patch };
}
