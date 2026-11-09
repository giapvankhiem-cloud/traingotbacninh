import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeExpertProfileDetails } from '../src/utils/expertProfile';

test('expert profile details preserve supplied public contact and professional information only', () => {
  assert.deepEqual(normalizeExpertProfileDetails({ avatar: ' https://example.test/expert.jpg ', badge: ' Cán bộ khuyến nông ', experienceYears: 22,
    coverCrops: [' Vải thiều ', 'Cam', 'Cam'], qualifications: [' Kỹ sư nông nghiệp ', 'Chứng chỉ VietGAP'], contactEmail: ' public@example.test ', zalo: ' 0912 345 678 ',
    ...({ email: 'private-login@example.test', password: 'must-never-copy' } as any),
  }), { avatar: 'https://example.test/expert.jpg', badge: 'Cán bộ khuyến nông', experienceYears: 22,
    coverCrops: ['Vải thiều', 'Cam'], qualifications: ['Kỹ sư nông nghiệp', 'Chứng chỉ VietGAP'], contactEmail: 'public@example.test', zalo: '0912 345 678' });
});
test('expert profile details keep legacy records compatible and omit empty optional values', () => {
  assert.deepEqual(normalizeExpertProfileDetails({}), {});
  assert.deepEqual(normalizeExpertProfileDetails({ avatar: ' ', badge: '', coverCrops: [], qualifications: [], contactEmail: '', zalo: '' }), {});
  assert.deepEqual(normalizeExpertProfileDetails({ experienceYears: 0 }), { experienceYears: 0 });
});
test('expert profile avatar rejects unsafe schemes, embedded credentials, whitespace and overlong links', () => {
  for (const avatar of ['http://example.test/a.jpg', 'javascript:alert(1)', 'data:image/jpeg;base64,aaa', 'https://user:secret@example.test/a.jpg', 'https://example.test/a b.jpg', 'https://example.test/\na.jpg', 'https://example.test/'+'a'.repeat(1200)]) assert.throws(() => normalizeExpertProfileDetails({ avatar }));
});
test('expert profile validates experience, contact fields and every bounded list entry', () => {
  for (const experienceYears of [-1, 71, 0.5, NaN, '22', null]) assert.throws(() => normalizeExpertProfileDetails({ experienceYears } as any));
  for (const contactEmail of ['not-email', 'a@example', 'a b@example.test', 123]) assert.throws(() => normalizeExpertProfileDetails({ contactEmail } as any));
  for (const zalo of ['letters only', '1234', '1'.repeat(31), 123]) assert.throws(() => normalizeExpertProfileDetails({ zalo } as any));
  for (const coverCrops of [Array(13).fill('Vải'), ['a'.repeat(101)], ['Vải', ''], ['Vải', 4], 'Vải']) assert.throws(() => normalizeExpertProfileDetails({ coverCrops } as any));
  for (const qualifications of [Array(13).fill('Kỹ sư'), ['a'.repeat(201)], ['', 'Kỹ sư'], [{ label: 'fake' }]]) assert.throws(() => normalizeExpertProfileDetails({ qualifications } as any));
  assert.throws(() => normalizeExpertProfileDetails({ coverCrops: ['Vải\u001fCam'] }));
  assert.throws(() => normalizeExpertProfileDetails({ qualifications: ['Kỹ sư\u001fTiến sĩ'] }));
  assert.deepEqual(normalizeExpertProfileDetails({ coverCrops: ['Vải 🌿', 'Cam\nBưởi'], qualifications: ['Kỹ sư\tNông nghiệp', 'Chứng chỉ VietGAP\nBắc Ninh'] }),
    { coverCrops: ['Vải 🌿', 'Cam\nBưởi'], qualifications: ['Kỹ sư\tNông nghiệp', 'Chứng chỉ VietGAP\nBắc Ninh'] });
  assert.throws(() => normalizeExpertProfileDetails({ badge: 'a'.repeat(81) }));
});
