import type { ProduceItem } from '../types/agriculture';
export const SITE_URL = 'https://trai-ngot-bac-ninh.web.app/';
export const SITE_NAME = 'Trái ngọt Bắc Ninh';
export const HOME_TITLE = 'Trái ngọt Bắc Ninh | Trái cây theo mùa, minh bạch nguồn gốc';
export const HOME_DESCRIPTION = 'Khám phá trái cây theo mùa từ nhà vườn Bắc Ninh. Xem vị trí vườn, giấy chứng nhận tự khai và nhật ký canh tác; kết nối trực tiếp với người trồng.';
export interface SeoMetadata { title: string; description: string; canonical: string; image: string; robots: string; structuredData?: Record<string, unknown>; }
export function buildProductUrl(id: string, siteUrl = SITE_URL) {
  const base = new URL(siteUrl); base.hash = ''; base.search = '';
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(`nong-san/${encodeURIComponent(id)}`, base).href;
}
export function readProductId(pathname: string, hash = '') {
  try { const match = pathname.match(/\/nong-san\/([^/]+)\/?$/); return match ? decodeURIComponent(match[1]) : hash.startsWith('#trace/') ? decodeURIComponent(hash.slice(7)) : ''; }
  catch { return ''; }
}
export function isTestProduce(product: Pick<ProduceItem, 'id' | 'name' | 'description'>) {
  const text = `${product.name} ${product.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /^(qa-live-|test-|emulator-)/i.test(product.id) || /kiem thu|du lieu thu|khong giao hang/.test(text);
}
export function homeMetadata(siteUrl = SITE_URL): SeoMetadata {
  const canonical = new URL(siteUrl).href;
  return { title: HOME_TITLE, description: HOME_DESCRIPTION, canonical, image: new URL('images/lychee-season.jpg', canonical).href, robots: 'index, follow, max-image-preview:large',
    structuredData: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'Organization', '@id': `${canonical}#organization`, name: SITE_NAME, url: canonical, logo: new URL('brand-mark.svg', canonical).href },
      { '@type': 'WebSite', '@id': `${canonical}#website`, name: SITE_NAME, url: canonical, inLanguage: 'vi-VN', description: HOME_DESCRIPTION, publisher: { '@id': `${canonical}#organization` } },
    ] } };
}
export function productMetadata(product: ProduceItem, siteUrl = SITE_URL): SeoMetadata {
  const canonical = buildProductUrl(product.id, siteUrl); const test = isTestProduce(product);
  const description = (product.description || `${product.name} từ nhà vườn ${product.farmer}. Xem thông tin nguồn gốc và nhật ký canh tác.`).replace(/\s+/g, ' ').trim().slice(0, 160);
  let image = new URL('brand-mark.svg', siteUrl).href;
  try { const candidate = new URL(product.image, siteUrl); if (['http:', 'https:'].includes(candidate.protocol)) image = candidate.href; } catch { /* Keep the public fallback. */ }
  return { title: `${product.name} | ${SITE_NAME}`, description, canonical, image, robots: test ? 'noindex, follow' : 'index, follow, max-image-preview:large',
    ...(test ? {} : { structuredData: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'Product', '@id': `${canonical}#product`, name: product.name, description, image, url: canonical, sku: product.id, category: product.category,
        ...(Number.isFinite(product.price) && product.price >= 0 ? { offers: { '@type': 'Offer', url: canonical, priceCurrency: 'VND', price: product.price, availability: `https://schema.org/${product.inStock > 0 ? 'InStock' : 'OutOfStock'}`, seller: { '@type': 'Person', name: product.farmer } } } : {}),
      },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE_NAME, item: new URL(siteUrl).href }, { '@type': 'ListItem', position: 2, name: product.name, item: canonical }] },
    ] } }),
  };
}
export function serializeJsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'); }
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export function renderSeoHead(meta: SeoMetadata) {
  return `<title>${escape(meta.title)}</title>\n<meta name="description" content="${escape(meta.description)}">\n<meta name="robots" content="${escape(meta.robots)}">\n<link rel="canonical" href="${escape(meta.canonical)}">\n<meta property="og:title" content="${escape(meta.title)}">\n<meta property="og:description" content="${escape(meta.description)}">\n<meta property="og:type" content="website">\n<meta property="og:locale" content="vi_VN">\n<meta property="og:site_name" content="${SITE_NAME}">\n<meta property="og:url" content="${escape(meta.canonical)}">\n<meta property="og:image" content="${escape(meta.image)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${escape(meta.title)}">\n<meta name="twitter:description" content="${escape(meta.description)}">\n<meta name="twitter:image" content="${escape(meta.image)}">\n${meta.structuredData ? `<script id="site-jsonld" type="application/ld+json">${serializeJsonLd(meta.structuredData)}</script>` : ''}`;
}
export function applyMetadata(meta: SeoMetadata) {
  document.title = meta.title;
  function set(attribute: 'name' | 'property', key: string, content: string) { let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`); if (!element) { element = document.createElement('meta'); element.setAttribute(attribute, key); document.head.append(element); } element.content = content; }
  set('name', 'description', meta.description); set('name', 'robots', meta.robots);
  for (const [key, value] of Object.entries({ 'og:title': meta.title, 'og:description': meta.description, 'og:url': meta.canonical, 'og:image': meta.image })) set('property', key, value);
  for (const [key, value] of Object.entries({ 'twitter:title': meta.title, 'twitter:description': meta.description, 'twitter:image': meta.image })) set('name', key, value);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); } canonical.href = meta.canonical;
  document.getElementById('site-jsonld')?.remove();
  if (meta.structuredData) { const script = document.createElement('script'); script.id = 'site-jsonld'; script.type = 'application/ld+json'; script.textContent = serializeJsonLd(meta.structuredData); document.head.append(script); }
}
