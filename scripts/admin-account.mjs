import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getGlobalDefaultAccount } = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const project = 'trai-ngot-bac-ninh';
const email = process.argv.find((value) => value.startsWith('--email='))?.slice(8).trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Cần --email=<email tài khoản đã đăng ký>.');
const account = getGlobalDefaultAccount();
if (!account) throw new Error('Chưa đăng nhập Firebase CLI.');
await requireAuth({ project, ...account });
const client = new Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', auth: true });
const options = { headers: { 'x-goog-user-project': project } };
const lookup = () => client.post(`/v1/projects/${project}/accounts:lookup`, { email: [email] }, options);
const users = (await lookup()).body.users || [];
if (!users.length) console.log(JSON.stringify({ found: false, email }));
else {
if (users.length !== 1 || users[0].email?.toLowerCase() !== email || users[0].disabled) throw new Error('Tài khoản không khớp hoặc đã bị khóa.');
let user = users[0];
if (process.argv.includes('--grant')) {
  const claims = { ...JSON.parse(user.customAttributes || '{}'), admin: true };
  await client.post(`/v1/projects/${project}/accounts:update`, { localId: user.localId, customAttributes: JSON.stringify(claims) }, options);
  user = (await lookup()).body.users[0];
  if (JSON.parse(user.customAttributes || '{}').admin !== true) throw new Error('Chưa xác nhận được quyền quản trị.');
}
// Never print credentials, password hashes, reset links, or other token claims.
console.log(JSON.stringify({ found: true, email, uid: user.localId, emailVerified: Boolean(user.emailVerified), admin: JSON.parse(user.customAttributes || '{}').admin === true }));
}
