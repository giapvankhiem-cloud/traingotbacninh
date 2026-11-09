import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { getGlobalDefaultAccount } = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const project = 'trai-ngot-bac-ninh';
const account = getGlobalDefaultAccount();
if (!account) throw new Error('Cần đăng nhập Firebase CLI.');
await requireAuth({ project, ...account });
const firestore = new Client({ urlPrefix: 'https://firestore.googleapis.com', auth: true });
const identity = new Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', auth: true });
const root = `projects/${project}/databases/(default)/documents`;
const headers = { 'x-goog-user-project': project };
async function list(path) {
  const documents = []; let pageToken;
  do {
    const response = await firestore.get(`/v1/${root}/${path}`, { queryParams: { pageSize: 100, ...(pageToken ? { pageToken } : {}) }, headers });
    documents.push(...response.body.documents || []); pageToken = response.body.nextPageToken;
  } while (pageToken);
  return documents;
}
function decode(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  return null;
}
function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
}
const existing = new Set((await list('farmerApplications')).map((document) => document.name.split('/').at(-1)));
const profiles = await list('farmers');
const plan = [];
for (const document of profiles) {
  const uid = document.name.split('/').at(-1);
  if (existing.has(uid)) continue;
  const lookup = await identity.post(`/v1/projects/${project}/accounts:lookup`, { localId: [uid] }, { headers });
  const user = lookup.body.users?.[0];
  if (!user?.email || user.disabled) continue;
  const profile = decode({ mapValue: { fields: document.fields } });
  const certificates = (await list(`farmers/${uid}/certificates`)).filter((item) => (profile.certificateIds || []).includes(item.name.split('/').at(-1)));
  const complete = Boolean(user.emailVerified && profile.gardenLocation && profile.phone && profile.cropFocus && profile.location);
  plan.push({ uid, source: document, certificates, application: { id: uid, email: user.email, profile, status: complete ? 'pending' : 'draft', revision: 1, submittedAt: complete ? Date.now() : 0, reviewedAt: 0, reviewedBy: '', reviewNote: '' } });
}
if (process.argv.includes('--apply')) {
  mkdirSync('.tools', { recursive: true });
  writeFileSync(`.tools/pre-review-backup-${Date.now()}.private.json`, JSON.stringify(plan, null, 2));
  for (const item of plan) {
    const writes = [{ update: { name: `${root}/farmerApplications/${item.uid}`, fields: encode(item.application).mapValue.fields }, currentDocument: { exists: false } },
      ...item.certificates.map((certificate) => ({ update: { name: `${root}/farmerApplications/${item.uid}/certificates/${certificate.name.split('/').at(-1)}`, fields: certificate.fields }, currentDocument: { exists: false } }))];
    await firestore.post(`/v1/${root}:commit`, { writes }, { headers });
  }
}
console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'applied' : 'dry-run', existingApplications: existing.size,
  applicationsPrepared: plan.length, pending: plan.filter((item) => item.application.status === 'pending').length,
  draft: plan.filter((item) => item.application.status === 'draft').length, publicDocumentsChanged: 0, automaticallyApproved: 0 }));
