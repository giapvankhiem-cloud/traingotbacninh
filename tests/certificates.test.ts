import assert from 'node:assert/strict';
import test from 'node:test';
import { CERTIFICATE_TYPES, certificateHttpsUrl, certificateSummary, certificateTerm, normalizeCertificates } from '../src/utils/certificates';
import { certificateFixture } from './fixtures/certificates';

test('all six supported declaration types are optional, bounded and self-declared', () => {
  assert.deepEqual(normalizeCertificates(), []);
  const certificates = CERTIFICATE_TYPES.map((type, index) => certificateFixture({ id: `cert-${index}`, type, ...(type === 'OCOP' ? { ocopStars: 4 as const } : {}) }));
  const result = normalizeCertificates(certificates);
  assert.equal(result.length, 6); assert.ok(result.every((certificate) => certificate.verified === false));
  assert.ok(certificateSummary(result).includes('OCOP 4 sao'));
});
for (const [label, patch] of [
  ['self verification', { verified: true }], ['empty title', { title: ' ' }], ['missing number', { certificateNumber: '' }], ['missing issuer', { issuedBy: '' }], ['missing scope', { scope: '' }],
  ['non-leap date', { issuedDate: '2026-02-29' }], ['impossible month date', { issuedDate: '2026-04-31' }], ['wrong date format', { issuedDate: '28/10/2026' }], ['reversed term', { expiryDate: '2024-01-01' }],
  ['bad OCOP rating', { type: 'OCOP', ocopStars: 2 }], ['JavaScript link', { documentUrl: 'javascript:alert(1)' }], ['HTTP link', { documentUrl: 'http://example.test/file.pdf' }], ['credential link', { documentUrl: 'https://user:secret@example.test/file.pdf' }],
  ['SVG data', { documentImage: 'data:image/svg+xml;base64,PHN2Zy8+' }], ['oversized image', { documentImage: 'data:image/png;base64,' + 'A'.repeat(140000) }], ['unknown secret field', { password: 'must-not-be-public' }],
] as Array<[string, any]>) {
  test(`certificate validation rejects ${label}`, () => assert.throws(() => normalizeCertificates([certificateFixture(patch)])));
}
test('duplicate IDs and a seventh certificate are rejected', () => {
  assert.throws(() => normalizeCertificates([certificateFixture(), certificateFixture()]));
  assert.throws(() => normalizeCertificates(Array.from({ length: 7 }, (_, index) => certificateFixture({ id: String(index) }))));
});
test('expiry is a declared date condition and never a verification claim', () => {
  assert.equal(certificateTerm(certificateFixture(), new Date(2026, 9, 28)), 'Trong thời hạn khai báo');
  assert.equal(certificateTerm(certificateFixture({ expiryDate: '2025-12-31' }), new Date(2026, 9, 28)), 'Đã hết hạn khai báo');
  assert.equal(certificateTerm(certificateFixture({ issuedDate: '2027-01-01' }), new Date(2026, 9, 28)), 'Chưa đến ngày cấp khai báo');
  assert.equal(certificateTerm(certificateFixture({ expiryDate: '' }), new Date(2026, 9, 28)), 'Chưa khai ngày hết hạn');
});
test('public HTTPS URLs are normalized and a missing attachment is supported', () => {
  assert.equal(certificateHttpsUrl(' HTTPS://EXAMPLE.TEST/file.pdf '), 'https://example.test/file.pdf');
  assert.equal(normalizeCertificates([certificateFixture({ documentImage: '', documentUrl: '', expiryDate: '' })])[0].documentUrl, '');
  assert.equal(normalizeCertificates([certificateFixture({ issuedDate: '2024-02-29' })])[0].issuedDate, '2024-02-29');
});
