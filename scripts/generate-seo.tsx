import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadEnv } from 'vite';
import { renderPublicHome, renderPublicProduct } from '../src/entry-seo';
import { homeMetadata, productMetadata, renderSeoHead, buildProductUrl, isTestProduce, SITE_URL } from '../src/utils/seo';
import type { ProduceItem } from '../src/types/agriculture';
const environment = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const siteUrl = environment.VITE_PUBLIC_SITE_URL || SITE_URL;
const project = environment.VITE_FIREBASE_PROJECT_ID;
if (!project || !/^https:\/\//.test(siteUrl)) throw new Error('Cần dự án Firebase và URL HTTPS công khai để tạo SEO.');
function decode(value: any): any {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  return null;
}
const hiddenOwners = new Set<string>(); let stateToken = '';
do {
  const stateUrl = new URL(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/farmerAccountStates`);
  stateUrl.searchParams.set('pageSize', '100'); if (stateToken) stateUrl.searchParams.set('pageToken', stateToken);
  const stateResponse = await fetch(stateUrl);
  if (!stateResponse.ok) throw new Error('Không tải được trạng thái tài khoản công khai. Cần phát hành Firestore Rules tương ứng trước khi dựng SEO.');
  const states = await stateResponse.json() as any;
  for (const item of states.documents || []) {
    const state = decode({ mapValue: { fields: item.fields } });
    if (state.status === 'suspended' || state.status === 'deleted') hiddenOwners.add(item.name.split('/').at(-1));
  }
  stateToken = states.nextPageToken || '';
} while (stateToken);
const products: ProduceItem[] = []; let token = '';
do {
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/products`);
  url.searchParams.set('pageSize', '100'); if (token) url.searchParams.set('pageToken', token);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Không đọc được danh mục công khai để dựng SEO (${response.status}).`);
  const data = await response.json() as any;
  for (const document of data.documents || []) {
    const product = { ...decode({ mapValue: { fields: document.fields } }), id: document.name.split('/').at(-1) };
    if (!hiddenOwners.has(product.ownerId)) products.push(product);
  }
  token = data.nextPageToken || '';
  if (products.length > 2000) throw new Error('Danh mục lớn hơn 2.000 bài; cần cập nhật chiến lược dựng SEO trước khi triển khai.');
} while (token);
const template = await readFile('dist/index.html', 'utf8');
const slot = /<meta name="seo-slot-start"[^>]*>[\s\S]*?<meta name="seo-slot-end"[^>]*>/;
if (!slot.test(template) || !template.includes('<div id="root"></div>')) throw new Error('Thiếu vị trí dựng metadata/nội dung SEO trong bản build.');
const page = (meta: ReturnType<typeof homeMetadata>, content: string) => template.replace(slot, () => renderSeoHead(meta)).replace('<div id="root"></div>', () => `<div id="root">${content}</div>`);
await writeFile('dist/index.html', page(homeMetadata(siteUrl), renderPublicHome(products)));
const sitemap = [new URL(siteUrl).href]; let testPages = 0; let productPages = 0;
for (const product of products) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(product.id)) continue;
  await mkdir(`dist/nong-san/${product.id}`, { recursive: true });
  await writeFile(`dist/nong-san/${product.id}/index.html`, page(productMetadata(product, siteUrl), renderPublicProduct(product)));
  productPages++;
  if (isTestProduce(product)) testPages++; else sitemap.push(buildProductUrl(product.id, siteUrl));
}
const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.map((url) => `<url><loc>${xmlEscape(url)}</loc></url>`).join('')}</urlset>`);
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${new URL('sitemap.xml', siteUrl).href}\n`);
await writeFile('dist/seo-manifest.json', JSON.stringify({ site: siteUrl, productPages, testPagesNoindex: testPages, sitemapEntries: sitemap.length, generatedAt: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ renderedHome: true, productPages, testPagesNoindex: testPages, sitemapEntries: sitemap.length, privateDocumentsRead: 0 }));
