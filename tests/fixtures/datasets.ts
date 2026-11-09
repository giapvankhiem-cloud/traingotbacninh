import type { BuyerDetails, FarmerAccount, ProduceItem } from '../../src/types/agriculture';

export const DATASET_SEED = 20261028;
export const categories: ProduceItem['category'][] = ['lychee', 'orange', 'pomelo', 'guava', 'apple', 'other'];
const fruitNames = ['Vải thiều Chũ', 'Cam đường Canh', 'Bưởi Diễn', 'Ổi lê', 'Táo xuân', 'Giỏ trái cây'];
const names = ['Nguyễn Văn An', 'Trần Thị Ánh 🌱', "Lê O'An", 'Đặng Thị Hồng – Vườn số 04', 'Hợp tác xã thử nghiệm', 'N'.repeat(100), 'Vườn có dấu: Ắ Ề Ỗ Ự', 'Vườn <b>kiểm thử</b>', 'Chủ vườn miền núi', 'Vườn\nHai dòng', 'Chủ vườn “Bình An”', 'Nhà vườn số 12'];
const prices = [1, 999, 1000, 65000, 125000.5, 100000000];
const stocks = [0, 1, 2, 20, 250, 10000000];
const phones = ['0901234567', '+84 90 123 4567', '(090) 123-4567', '0900 123 456'];

export function farmerDataset(index: number, uid: string): FarmerAccount {
  const coords = [[21.3653, 106.5925], [0, 0], [-90, -180], [90, 180], [10.7, 106.6], [16.1, 108.2]][index % 6];
  const address = `Địa chỉ giả lập ${index + 1}, khu vườn kiểm thử Chũ`;
  return { id: uid, name: names[index % names.length], avatar: '/farmer-avatar.svg', location: address, shortLocation: 'Chũ', commune: 'Chũ', role: 'Chủ vườn', cropFocus: fruitNames[index % 6], areaHa: [0, 0.1, 1.5, 100000][index % 4], treeCount: [0, 1, 100, 1000000][index % 4], phone: phones[index % phones.length], pucCode: '', certification: 'Chưa chứng nhận', bio: `Hồ sơ Emulator ${index}`, gardenLocation: { lat: coords[0], lng: coords[1], address, commune: 'Chũ', altitudeM: index * 5, soilType: 'Đất kiểm thử', waterSource: 'Nguồn nước khai báo' } };
}
export function productDataset(owner: FarmerAccount, ownerIndex: number, categoryIndex: number, id = `dataset-${ownerIndex}-${categoryIndex}`): ProduceItem {
  return { id, ownerId: owner.id, name: `${fruitNames[categoryIndex]} – lô ${ownerIndex + 1}`, category: categories[categoryIndex], price: prices[(ownerIndex + categoryIndex) % prices.length], unit: ['kg', 'hộp', 'thùng 5 kg', 'quả', 'túi 0,5 kg', 'giỏ'][categoryIndex], inStock: stocks[(ownerIndex + categoryIndex) % stocks.length], image: '/farmer-avatar.svg', origin: owner.location, farmer: owner.name, farmerPhone: owner.phone, rating: 0, reviewCount: 0, certifications: [], harvestSeason: 'Tháng 10/2026', description: `Trái cây giả lập ${ownerIndex}/${categoryIndex}. Không bán thật.`, vietgapCode: '', location: owner.gardenLocation!, farmerProfile: { name: owner.name, avatar: owner.avatar, role: owner.role, phone: owner.phone, zalo: owner.phone, address: owner.location, experienceYears: 0, orchardAreaHa: owner.areaHa, treeCount: owner.treeCount, bio: owner.bio || '', achievements: [], commitment: '', certificates: [] }, cultivationLog: { watering: [], fertilizing: [], pestProtection: [], general: [] } };
}
export const buyers: BuyerDetails[] = Array.from({ length: 12 }, (_, index) => ({ name: ['Khách Nguyễn Ánh', "Khách O'An", 'Khách 🌳', 'K'.repeat(100)][index % 4], phone: phones[index % phones.length], address: index % 3 === 0 ? 'A'.repeat(500) : `Địa chỉ giao hàng giả lập số ${index + 1}, Chũ` }));

export const invalidFarmers: Array<[string, (base: FarmerAccount) => FarmerAccount]> = [
  ['empty name', (p) => ({ ...p, name: '' })], ['blank name', (p) => ({ ...p, name: '   ' })], ['long name', (p) => ({ ...p, name: 'x'.repeat(101) })],
  ['empty phone', (p) => ({ ...p, phone: '' })], ['short phone', (p) => ({ ...p, phone: '1234567' })], ['letter phone', (p) => ({ ...p, phone: 'abcdefghij' })], ['punctuation phone', (p) => ({ ...p, phone: '--------' })],
  ['empty address', (p) => ({ ...p, location: ' ' })], ['long address', (p) => ({ ...p, location: 'x'.repeat(501) })],
  ['negative area', (p) => ({ ...p, areaHa: -1 })], ['NaN area', (p) => ({ ...p, areaHa: NaN })], ['infinite area', (p) => ({ ...p, areaHa: Infinity })], ['oversized area', (p) => ({ ...p, areaHa: 100000.1 })],
  ['negative trees', (p) => ({ ...p, treeCount: -1 })], ['fractional trees', (p) => ({ ...p, treeCount: 1.5 })],
  ['latitude above 90', (p) => ({ ...p, gardenLocation: { ...p.gardenLocation!, lat: 90.0001 } })], ['latitude below -90', (p) => ({ ...p, gardenLocation: { ...p.gardenLocation!, lat: -90.0001 } })],
  ['longitude above 180', (p) => ({ ...p, gardenLocation: { ...p.gardenLocation!, lng: 180.0001 } })], ['NaN longitude', (p) => ({ ...p, gardenLocation: { ...p.gardenLocation!, lng: NaN } })],
  ['foreign UID', (p) => ({ ...p, id: 'foreign-farmer' })], ['oversized bio', (p) => ({ ...p, bio: 'x'.repeat(5001) })],
];
export const invalidProducts: Array<[string, (base: ProduceItem) => ProduceItem]> = [
  ['blank name', (p) => ({ ...p, name: ' ' })], ['long name', (p) => ({ ...p, name: 'x'.repeat(251) })],
  ['zero price', (p) => ({ ...p, price: 0 })], ['negative price', (p) => ({ ...p, price: -1 })], ['NaN price', (p) => ({ ...p, price: NaN })], ['infinite price', (p) => ({ ...p, price: Infinity })], ['oversized price', (p) => ({ ...p, price: 100000001 })],
  ['negative stock', (p) => ({ ...p, inStock: -1 })], ['fractional stock', (p) => ({ ...p, inStock: 1.5 })], ['infinite stock', (p) => ({ ...p, inStock: Infinity })], ['oversized stock', (p) => ({ ...p, inStock: 10000001 })],
  ['long unit', (p) => ({ ...p, unit: 'x'.repeat(31) })], ['long description', (p) => ({ ...p, description: 'x'.repeat(10001) })], ['oversized image', (p) => ({ ...p, image: 'x'.repeat(150001) })],
  ['invalid category', (p) => ({ ...p, category: 'invalid' as any })], ['invalid latitude', (p) => ({ ...p, location: { ...p.location, lat: 91 } })], ['forged verified certificate', (p) => ({ ...p, farmerProfile: { ...p.farmerProfile, certificates: [{ verified: true } as any] } })],
];
export const invalidBuyers: Array<[string, BuyerDetails]> = [
  ['blank name', { ...buyers[0], name: ' ' }], ['long name', { ...buyers[0], name: 'x'.repeat(101) }],
  ['empty phone', { ...buyers[0], phone: '' }], ['short phone', { ...buyers[0], phone: '1234567' }], ['letter phone', { ...buyers[0], phone: 'abcdefghij' }],
  ['hyphens only phone', { ...buyers[0], phone: '--------' }], ['parentheses only phone', { ...buyers[0], phone: '(  )----' }], ['plus signs only phone', { ...buyers[0], phone: '+ + + + +' }],
  ['long phone', { ...buyers[0], phone: '0'.repeat(21) }], ['empty address', { ...buyers[0], address: '' }], ['short address', { ...buyers[0], address: 'Chũ' }], ['blank address', { ...buyers[0], address: ' '.repeat(20) }], ['long address', { ...buyers[0], address: 'x'.repeat(501) }],
];
