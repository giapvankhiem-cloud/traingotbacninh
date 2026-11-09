import assert from 'node:assert/strict';
import test from 'node:test';
import type { FarmerAccount, ProduceItem } from '../src/types/agriculture';
import { getFarmerProduce } from '../src/utils/farmerProduct';
import { parseImageBase64, validateDiagnosisResult } from '../src/utils/aiValidation';

const farmer: FarmerAccount = {
  id: 'farmer-1', name: 'Nguyễn Văn An', avatar: '', location: 'Chũ', shortLocation: 'Chũ', commune: 'Chũ',
  role: 'Chủ vườn', cropFocus: 'Vải', areaHa: 1, treeCount: 100, phone: '0900000000', pucCode: 'VN-BN-001', certification: 'VietGAP',
};
const products: ProduceItem[] = [{
  id: 'product-1', name: 'Vải thiều', category: 'lychee', price: 50_000, unit: 'kg', origin: 'Chũ', farmer: 'Nguyễn Văn An',
  farmerPhone: '0900000000', rating: 5, reviewCount: 1, inStock: 10, image: '', certifications: ['VietGAP'], harvestSeason: 'Tháng 6',
  description: '', vietgapCode: 'OTHER-CODE', farmerProfile: {
    name: farmer.name, avatar: '', role: 'Chủ vườn', phone: '', zalo: '', address: '', experienceYears: 1, orchardAreaHa: 1,
    treeCount: 100, bio: '', achievements: [], commitment: '', certificates: [],
  },
  location: { lat: 0, lng: 0, address: '', commune: '', altitudeM: 0, soilType: '', waterSource: '' },
  cultivationLog: { watering: [], fertilizing: [], pestProtection: [] },
}];

test('does not fall back to another farmer product', () => {
  const unknownFarmer = { ...farmer, id: 'unknown', name: 'Không tồn tại', pucCode: 'UNKNOWN' };
  assert.equal(getFarmerProduce(unknownFarmer, products), undefined);
});

test('finds a product owned by the selected farmer', () => {
  const product = getFarmerProduce(farmer, products);
  assert.equal(product?.farmerProfile.name, farmer.name);
});

test('rejects diagnosis results for a different crop', () => {
  const result = validateDiagnosisResult({
    name: 'Bệnh trên vải',
    plant: 'Vải thiều',
    confidence: 92,
    severity: 'Trung bình',
    causes: 'Nấm',
    symptoms: ['Đốm lá'],
    treatment: { biological: ['Cắt tỉa'], chemicalIfSevere: [], prevention: ['Vệ sinh vườn'] },
    expertAdvice: 'Theo dõi thêm',
    isolationDays: 0,
  }, 'Cam đường Canh');
  assert.equal(result, null);
});

test('accepts a bounded matching diagnosis result and a valid image payload', () => {
  const result = validateDiagnosisResult({
    name: 'Nhện đỏ',
    plant: 'Cam đường Canh',
    confidence: 92.4,
    severity: 'Trung bình',
    causes: 'Thời tiết khô',
    symptoms: ['Lá bạc'],
    treatment: { biological: ['Dầu khoáng'], chemicalIfSevere: [], prevention: ['Theo dõi'] },
    expertAdvice: 'Ưu tiên biện pháp sinh học',
    isolationDays: 7,
  }, 'Cam đường Canh');
  assert.equal(result?.confidence, 92);
  assert.equal(parseImageBase64('data:image/jpeg;base64,/9j/4AAQ', 'image/jpeg'), '/9j/4AAQ');
  assert.equal(parseImageBase64('data:image/png;base64,not-an-image!', 'image/png'), null);
});
