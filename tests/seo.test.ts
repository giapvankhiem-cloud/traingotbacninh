import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { buildProductUrl, readProductId, isTestProduce, homeMetadata, productMetadata, renderSeoHead, serializeJsonLd, applyMetadata, SITE_URL } from '../src/utils/seo';
import { renderPublicHome, renderPublicProduct } from '../src/entry-seo';
import type { ProduceItem } from '../src/types/agriculture';
const product = { id: 'harvest-2026', ownerId: 'farmer', name: 'Vải thiều Chũ theo mùa', description: 'Vải thiều từ khu vườn, xem thông tin nguồn gốc trước khi mua.', image: '/images/lychee-season.jpg', farmer: 'Nhà vườn An', origin: 'Bắc Ninh', category: 'lychee', certifications: [], price: 60000, unit: 'kg', inStock: 12, harvestSeason: 'Tháng 6', rating: 0, reviewCount: 0 } as unknown as ProduceItem;
for (const id of ['harvest-2026', 'vải-thiều', 'ổi 🌱', 'batch#1?x=2', '100%pure+fruit']) {
  test(`clean product URLs round-trip ${id}`, () => { const url = new URL(buildProductUrl(id)); assert.equal(url.hash, ''); assert.equal(url.search, ''); assert.equal(readProductId(url.pathname), id); });
}
test('printed legacy QR links and malformed URLs remain safe', () => {
  assert.equal(readProductId('/', '#trace/v%E1%BA%A3i'), 'vải'); assert.equal(readProductId('/nong-san/%ZZ'), ''); assert.equal(readProductId('/', '#trace/%ZZ'), '');
  assert.equal(buildProductUrl('fruit', 'https://example.test/store/'), 'https://example.test/store/nong-san/fruit');
});
test('home metadata is canonical, descriptive and contains no blanket certificate claim', () => {
  const meta = homeMetadata(); assert.equal(meta.canonical, SITE_URL); assert.match(meta.robots, /^index/); assert.doesNotMatch(meta.description, /đạt chuẩn|chính ngạch/);
  const document = new JSDOM(`<head>${renderSeoHead(meta)}</head>`).window.document;
  assert.equal(document.querySelectorAll('title').length, 1); assert.equal(document.querySelector('link[rel=canonical]')?.getAttribute('href'), SITE_URL);
  assert.ok(document.querySelector('meta[property="og:image"]')); assert.ok(document.querySelector('meta[name="twitter:card"]'));
});
test('real product metadata has its own URL, actual price and no invented reviews', () => {
  const meta = productMetadata(product); assert.equal(meta.canonical, buildProductUrl(product.id)); assert.match(meta.title, /Vải thiều Chũ/);
  const json = JSON.stringify(meta.structuredData); assert.match(json, /Product/); assert.match(json, /BreadcrumbList/); assert.doesNotMatch(json, /aggregateRating|reviewCount|priceValidUntil/);
  const graph = meta.structuredData!['@graph'] as any[];
  assert.equal(graph[0].offers.price, product.price); assert.equal(graph[0].offers.priceCurrency, 'VND'); assert.equal(graph[0].offers.availability, 'https://schema.org/InStock');
  assert.equal((productMetadata({ ...product, inStock: 0 }).structuredData!['@graph'] as any[])[0].offers.availability, 'https://schema.org/OutOfStock');
});
test('QA data is noindex and never emitted as a real structured product', () => {
  for (const item of [{ ...product, id: 'qa-live-20261028-test' }, { ...product, name: 'DỮ LIỆU THỬ – KHÔNG GIAO HÀNG' }, { ...product, description: 'Bài kiểm thử từ Emulator' }]) {
    assert.equal(isTestProduce(item), true); const meta = productMetadata(item); assert.match(meta.robots, /noindex/); assert.equal(meta.structuredData, undefined);
  }
  assert.equal(isTestProduce(product), false);
});
test('HTML metadata and JSON-LD cannot be broken out of by a posted description', () => {
  const attack = '</script><script>alert("x")</script>';
  const meta = productMetadata({ ...product, name: attack, description: attack });
  const html = renderSeoHead(meta); const document = new JSDOM(`<head>${html}</head>`).window.document;
  assert.equal(document.querySelectorAll('script').length, 1); assert.equal(document.querySelector('script')?.type, 'application/ld+json');
  assert.equal(JSON.parse(serializeJsonLd({ value: attack })).value, attack); assert.doesNotMatch(serializeJsonLd({ value: attack }), /<script>/);
});
test('crawler HTML contains a single main heading, real links and meaningful content before JS', () => {
  const html = renderPublicHome([product, { ...product, id: 'qa-live-ignored', name: 'Bài thử không được đưa vào HTML SEO' }]);
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelectorAll('h1').length, 1); assert.match(document.querySelector('h1')!.textContent!, /Vị ngọt từ trái/);
  assert.ok(document.querySelector(`a[href="${buildProductUrl(product.id)}"]`)); assert.doesNotMatch(html, /qa-live-ignored/);
  assert.ok(document.getElementById('hanh-trinh')); assert.ok(document.getElementById('faq-title'));
  assert.doesNotMatch(html, /file:\/\//, 'SEO HTML must not expose local asset paths');
  assert.ok(document.querySelector('.hero-slide.is-active[src]'), 'A public hero image must render before JavaScript');
});
test('static product article avoids copying certificate documents or private account data', () => {
  const html = renderPublicProduct(product); const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector('h1')?.textContent, product.name); assert.ok(document.querySelector('noscript'));
  assert.doesNotMatch(html, /accessToken|refreshToken|password|documentImage|@example/);
});
test('client navigation replaces metadata without duplicated canonical or old structured data', () => {
  const dom = new JSDOM('<html><head></head><body></body></html>'); const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  try {
    applyMetadata(homeMetadata()); applyMetadata(productMetadata(product));
    assert.equal(dom.window.document.querySelectorAll('link[rel=canonical]').length, 1); assert.equal(dom.window.document.querySelectorAll('#site-jsonld').length, 1);
    applyMetadata(productMetadata({ ...product, id: 'qa-live-noindex' })); assert.equal(dom.window.document.querySelector('#site-jsonld'), null);
    assert.equal(dom.window.document.querySelector('meta[name=robots]')?.getAttribute('content'), 'noindex, follow');
  } finally { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete (globalThis as any).document; dom.window.close(); }
});
