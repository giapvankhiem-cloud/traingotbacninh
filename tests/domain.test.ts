import assert from 'node:assert/strict';
import test from 'node:test';
import { appendCultivationLog } from '../src/utils/cultivationLogs';
import { ownsProduct } from '../src/utils/farmerProduct';
import { canChangeOrderStatus, validateBuyer } from '../src/utils/orders';
import type { FarmerAccount, ProduceItem } from '../src/types/agriculture';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { buildTraceUrl } from '../src/utils/traceUrl';

test('cloud product ownership uses UID even when two farmers share a name', () => {
  const farmer = { id: 'seller-a', name: 'Nguyễn Văn An' } as FarmerAccount;
  const product = { ownerId: 'seller-b', farmer: farmer.name } as ProduceItem;
  assert.equal(ownsProduct(farmer, product), false);
  assert.equal(ownsProduct(farmer, { ...product, ownerId: farmer.id }), true);
});
test('a new pest log never asserts a completed isolation or verified safety', () => {
  const product = { cultivationLog: { watering: [], fertilizing: [], pestProtection: [] } } as unknown as ProduceItem;
  const result = appendCultivationLog(product, 'pest', { date: '27/10/2026', productUsed: 'Chế phẩm', targetPest: 'Rệp', isolationDaysBeforeHarvest: 0 });
  assert.equal(result.cultivationLog.pestProtection[0].isolationDaysBeforeHarvest, 0);
  assert.equal(result.cultivationLog.pestProtection[0].status, 'Đang cách ly');
  assert.equal(result.cultivationLog.pestProtection[0].safetyVerified, false);
  assert.equal(product.cultivationLog.pestProtection.length, 0);
});
test('order transitions do not reopen fulfilled or cancelled orders', () => {
  assert.equal(canChangeOrderStatus('pending', 'confirmed'), true);
  assert.equal(canChangeOrderStatus('pending', 'completed'), false);
  assert.equal(canChangeOrderStatus('shipping', 'cancelled'), false);
  assert.equal(canChangeOrderStatus('cancelled', 'confirmed'), false);
  assert.equal(canChangeOrderStatus('completed', 'pending'), false);
});
test('checkout requires usable buyer contact information', () => {
  assert.throws(() => validateBuyer({ name: 'A', phone: '123', address: 'Chũ' }));
  assert.doesNotThrow(() => validateBuyer({ name: 'Khách mua', phone: '0901234567', address: 'Địa chỉ giao hàng Chũ' }));
});
test('a printed QR decodes to the permanent product trace URL', async () => {
  const url = buildTraceUrl('fruit-001', 'https://trai-ngot-bac-ninh.web.app/');
  const png = PNG.sync.read(await QRCode.toBuffer(url, { width: 600, margin: 4, errorCorrectionLevel: 'M' }));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(decoded?.data, url);
  assert.equal(new URL(decoded!.data).hash, '#trace/fruit-001');
});

for (const date of ['29/02/2024', '28/02/2026', '1/1/2026', '31/12/2026', ' 28/10/2026 ']) {
  test(`calendar date dataset accepts the real date ${JSON.stringify(date)}`, () => {
    const product = { cultivationLog: { watering: [], fertilizing: [], pestProtection: [] } } as unknown as ProduceItem;
    assert.doesNotThrow(() => appendCultivationLog(product, 'general', { date, title: 'Tỉa cành', instructions: '', materials: '' }));
  });
}
for (const date of ['', '   ', '29/02/2026', '31/04/2026', '0/10/2026', '28/13/2026', '2026-10-28', 'hôm qua']) {
  test(`calendar date dataset rejects ${JSON.stringify(date)} without changing history`, () => {
    const product = { cultivationLog: { watering: [], fertilizing: [], pestProtection: [] } } as unknown as ProduceItem;
    assert.throws(() => appendCultivationLog(product, 'general', { date, title: 'Tỉa cành', instructions: '', materials: '' }));
    assert.equal(product.cultivationLog.general, undefined);
  });
}
for (const id of ['vải-thiều-đợt-1', 'ổi 🌱 2026', 'batch#1?x=2', '100%pure+fruit', "vườn-O'An", 'a'.repeat(250)]) {
  test(`QR dataset round-trips an encoded product ID: ${id.slice(0, 40)}`, async () => {
    const url = buildTraceUrl(id, 'https://trai-ngot-bac-ninh.web.app/');
    const png = PNG.sync.read(await QRCode.toBuffer(url, { width: 800, margin: 4, errorCorrectionLevel: 'M' }));
    const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.equal(result?.data, url);
    assert.equal(decodeURIComponent(new URL(result!.data).hash.slice(7)), id);
  });
}
