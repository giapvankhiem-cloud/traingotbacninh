import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

// Read-only smoke checks: never create accounts or write production documents.
const origin = 'https://trai-ngot-bac-ninh.web.app';
const response = await fetch(origin);
assert.equal(response.status, 200);
assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
assert.ok(response.headers.get('cache-control')?.includes('no-cache'), 'The home page must revalidate after deployment');
const html = await response.text();
assert.ok(html.includes('<div id="root">'));
assert.ok(html.includes('Vị ngọt từ trái'), 'The crawler receives meaningful HTML before JavaScript');
assert.ok(html.includes('rel="canonical"'), 'Canonical metadata is server readable');
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');
async function filesIn(path) {
  const entries = await readdir(`dist/${path}`, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const child = [path, entry.name].filter(Boolean).join('/');
    return entry.isDirectory() ? filesIn(child) : child;
  }))).flat();
}
const paths = await filesIn('');
const seo = JSON.parse(await readFile('dist/seo-manifest.json', 'utf8'));
const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
assert.equal((sitemap.match(/<loc>/g) || []).length, seo.sitemapEntries);
assert.ok(!/qa-live-|emulator-|\/test-/.test(sitemap), 'Test products must stay out of the sitemap');
const robotsResponse = await fetch(`${origin}/robots.txt`);
assert.equal(robotsResponse.status, 200);
assert.ok((await robotsResponse.text()).includes(`Sitemap: ${origin}/sitemap.xml`));
const productPath = paths.find((path) => /^nong-san\/[^/]+\/index\.html$/.test(path));
if (productPath) {
  const cleanUrl = `${origin}/${productPath.replace('/index.html', '')}`;
  const productResponse = await fetch(cleanUrl);
  assert.equal(productResponse.status, 200, 'Clean product URL must open directly');
  assert.ok(productResponse.headers.get('cache-control')?.includes('no-cache'));
  const productHtml = await productResponse.text();
  assert.equal((productHtml.match(/<h1\b/g) || []).length, 1);
  assert.ok(productHtml.includes(`rel="canonical" href="${cleanUrl}"`));
  if (productPath.includes('qa-live-')) assert.ok(productHtml.includes('content="noindex, follow"'));
}
const assets = [];
for (let index = 0; index < paths.length; index += 6) {
  assets.push(...await Promise.all(paths.slice(index, index + 6).map(async (path) => {
    const remote = await fetch(`${origin}/${path}`);
    assert.equal(remote.status, 200, path);
    const buffer = Buffer.from(await remote.arrayBuffer());
    const sameAsLocal = digest(buffer) === digest(await readFile(`dist/${path}`));
    assert.ok(sameAsLocal, `Production differs from this build: ${path}`);
    return { path, status: remote.status, matchesBuild: sameAsLocal };
  })));
}
const api = 'https://firestore.googleapis.com/v1/projects/trai-ngot-bac-ninh/databases/(default)/documents';
const products = await fetch(`${api}/products?pageSize=1`);
assert.equal(products.status, 200, 'Public traceability access');
const privateOrders = await fetch(`${api}/orders?pageSize=1`);
const privateApplications = await fetch(`${api}/farmerApplications?pageSize=1`);
const privateConsultations = await fetch(`${api}/consultations?pageSize=1`);
assert.equal(privateConsultations.status, 403, 'Consultations must be private');
const privateAccountActions = await fetch(`${api}/farmerAccountActions?pageSize=1`);
assert.equal(privateApplications.status, 403, 'Pending applications and account emails must stay private');
assert.equal(privateOrders.status, 403, 'Unauthenticated private orders must be denied');
assert.equal(privateAccountActions.status, 403, 'Policy reasons and reviewer history must stay private');
console.log(JSON.stringify({ site: response.status, assetsChecked: assets.length, allAssetsMatchLocalBuild: true, seo: { sitemapEntries: seo.sitemapEntries, productPages: seo.productPages, testPagesNoindex: seo.testPagesNoindex, cleanProductUrl: Boolean(productPath) }, publicProducts: products.status, unauthenticatedConsultations: privateConsultations.status, unauthenticatedOrders: privateOrders.status, unauthenticatedApplications: privateApplications.status, unauthenticatedAccountActions: privateAccountActions.status, mutations: 0 }, null, 2));
