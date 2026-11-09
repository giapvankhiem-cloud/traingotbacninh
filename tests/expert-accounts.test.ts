import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createUserWithEmailAndPassword, getIdToken, reload, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import type { ConsultationExpert } from '../src/types/consultations';

Object.assign(process.env, { VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-traingot.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'demo-traingot', VITE_FIREBASE_APP_ID: 'demo-app', VITE_USE_FIREBASE_EMULATORS: 'true', DEV: 'true' });
const { auth, db } = await import('../src/lib/firebase');
const accounts = await import('../src/services/expertAccounts');
const consultations = await import('../src/services/consultations');
let env: RulesTestEnvironment;
const password = 'Expert-Emulator-only-2026!';
const input = () => ({ email: `expert-${crypto.randomUUID()}@example.test`, password, name: 'Chuyên gia kiểm thử tài khoản', title: 'Kỹ sư trồng trọt', organization: 'Đơn vị thử nghiệm', specialties: 'Vải, Cây có múi', bio: 'Hồ sơ dùng riêng trong Firebase Emulator.', phone: '', availability: '8:00 – 17:00 (Thứ 2 – Thứ 6)' });
const application = (uid: string, email = `${uid}@example.test`) => ({ id: uid, email, profile: { id: uid, name: 'Chuyên gia kiểm thử tài khoản', avatar: '/farmer-avatar.svg', location: '', shortLocation: '', commune: '', role: 'Chuyên gia nội bộ', cropFocus: '', areaHa: 0, treeCount: 0, phone: '', pucCode: '', certification: 'Chưa chứng nhận' }, status: 'draft', revision: 1, submittedAt: 0, reviewedAt: 0, reviewedBy: '', reviewNote: '' });
const expert = (uid: string, actor = 'admin') => ({ id: uid, name: 'Chuyên gia kiểm thử tài khoản', title: 'Kỹ sư trồng trọt', organization: 'Đơn vị thử nghiệm', specialties: 'Vải', bio: '', phone: '', availability: '', active: false, status: 'pending', internalAccount: true, updatedAt: 1, updatedBy: actor });
const context = (uid: string, admin = false) => env.authenticatedContext(uid, { email: `${uid}@example.test`, email_verified: true, admin, firebase: { sign_in_provider: 'password' } }).firestore();
async function account(admin = false) {
  const email = `account-${crypto.randomUUID()}@example.test`;
  const { user } = await createUserWithEmailAndPassword(auth!, email, password);
  const result = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: user.uid, emailVerified: true, customAttributes: JSON.stringify({ admin }) }) });
  assert.equal(result.ok, true); await reload(user); await getIdToken(user, true);
  await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), 'farmerApplications', user.uid), application(user.uid, email)));
  return { uid: user.uid, email };
}
async function login(value: { email: string }) { await signInWithEmailAndPassword(auth!, value.email, password); }
async function expected(uid: string) {
  const [profile, app, state] = await Promise.all([getDoc(doc(db!, 'consultationExperts', uid)), getDoc(doc(db!, 'farmerApplications', uid)), getDoc(doc(db!, 'farmerAccountStates', uid))]);
  return { expertUpdatedAt: profile.data()!.updatedAt as number, applicationRevision: app.data()!.revision as number, accountVersion: (state.data()?.version || 0) as number };
}
async function authEmailExists(email: string) {
  const result = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-traingot/accounts:lookup', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: [email] }) });
  assert.equal(result.ok, true); const body = await result.json(); return (body.users || []).some((user: { email: string }) => user.email === email);
}

before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-traingot', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => { await signOut(auth!); await env.clearFirestore(); });
after(async () => { await signOut(auth!); await env.cleanup(); const { deleteApp } = await import('firebase/app'); await deleteApp(auth!.app); });

test('expert account creation keeps primary admin signed in, stores neutral pending profiles and no password', async () => {
  const admin = await account(true), value = input();
  const uid = await accounts.createExpertAccount(value);
  assert.notEqual(uid, admin.uid); assert.equal(auth!.currentUser!.uid, admin.uid);
  assert.equal((await auth!.currentUser!.getIdTokenResult()).claims.admin, true);
  const app = (await getDoc(doc(db!, 'farmerApplications', uid))).data()!;
  const profile = (await getDoc(doc(db!, 'consultationExperts', uid))).data()!;
  assert.equal(app.email, value.email); assert.equal(app.status, 'draft'); assert.equal(app.revision, 1);
  assert.equal(profile.name, value.name); assert.equal(profile.status, 'pending'); assert.equal(profile.active, false); assert.equal(profile.internalAccount, true); assert.equal(profile.updatedBy, admin.uid);
  assert.equal(JSON.stringify({ app, profile }).includes(value.password), false);
  assert.equal('email' in profile, false); assert.equal('password' in app || 'password' in profile, false);
  assert.equal((await getDoc(doc(db!, 'farmers', uid))).exists(), false);
  await signOut(auth!); await signInWithEmailAndPassword(auth!, value.email, value.password);
  assert.equal(auth!.currentUser!.uid, uid); assert.equal(auth!.currentUser!.emailVerified, false);
  assert.notEqual((await auth!.currentUser!.getIdTokenResult()).claims.admin, true);
  await assertFails(getDocs(query(collection(db!, 'consultations'), where('expertId', '==', uid))));
});

test('expert public metadata survives real account creation and profile edits; clearing it keeps login email private', async () => {
  const administrator = await account(true), value = input();
  const details = { avatar: 'https://example.test/expert.jpg', badge: 'Cán bộ khuyến nông', experienceYears: 22,
    coverCrops: ['Vải thiều', 'Cam đường Canh'], qualifications: ['Kỹ sư nông nghiệp', 'Chứng chỉ VietGAP'],
    contactEmail: 'public-contact@example.test', zalo: '0912 345 678' };
  const uid = await accounts.createExpertAccount({ ...value, ...details });
  const profileRef = doc(db!, 'consultationExperts', uid);
  let profile = (await getDoc(profileRef)).data()!;
  for (const [key, expectedValue] of Object.entries(details)) assert.deepEqual(profile[key], expectedValue);
  assert.notEqual(profile.contactEmail, value.email);
  assert.equal('email' in profile, false); assert.equal('password' in profile, false);
  assert.equal((await getDoc(doc(db!, 'farmerApplications', uid))).data()!.email, value.email);
  assert.equal(auth!.currentUser!.uid, administrator.uid);

  const edited = { ...details, avatar: 'https://example.test/updated.jpg', experienceYears: 23,
    coverCrops: ['Bưởi Diễn'], qualifications: ['Kỹ sư nông nghiệp', 'Chứng chỉ GlobalGAP'],
    contactEmail: 'new-public-contact@example.test', zalo: '+84 912 345 678' };
  await consultations.saveConsultationExpert({ ...profile, ...edited } as any);
  profile = (await getDoc(profileRef)).data()!;
  for (const [key, expectedValue] of Object.entries(edited)) assert.deepEqual(profile[key], expectedValue);

  await consultations.saveConsultationExpert({ ...profile, avatar: '', badge: '', experienceYears: undefined,
    coverCrops: [], qualifications: [], contactEmail: '', zalo: '' } as any);
  const cleared = (await getDoc(profileRef)).data()!;
  for (const key of Object.keys(details)) assert.equal(key in cleared, false, `${key} should be removed by saving an empty optional value`);
  assert.equal(cleared.name, value.name); assert.equal(cleared.status, 'pending');
  assert.equal((await getDoc(doc(db!, 'farmerApplications', uid))).data()!.email, value.email);
  assert.equal(JSON.stringify(cleared).includes(value.email), false);
});

test('expert metadata rules accept legacy and bounded complete profiles and deny ordinary-user updates', async () => {
  const d = context('metadata-admin', true), uid = 'metadata-legacy';
  await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), 'farmerApplications', uid), application(uid)));
  const profileRef = doc(d, 'consultationExperts', uid);
  await setDoc(profileRef, expert(uid, 'metadata-admin'));
  assert.equal('avatar' in (await getDoc(profileRef)).data()!, false);
  const details = { avatar: 'https://example.test/photo.jpg?size=200', badge: 'Nhà nghiên cứu', experienceYears: 70,
    coverCrops: Array.from({ length: 12 }, (_, index) => `Cây ${index}`),
    qualifications: Array.from({ length: 12 }, (_, index) => `Chứng chỉ ${index}`),
    contactEmail: 'public@example.test', zalo: '0912345678' };
  await updateDoc(profileRef, { ...details, updatedAt: 2, updatedBy: 'metadata-admin' });
  const stored = (await getDoc(profileRef)).data()!;
  for (const [key, expectedValue] of Object.entries(details)) assert.deepEqual(stored[key], expectedValue);
  const unicodeDetails = { coverCrops: ['Vải 🌿', 'Cam\nBưởi', ...Array.from({ length: 10 }, (_, index) => `${index}` + 'ấ'.repeat(99))],
    qualifications: ['Kỹ sư\tNông nghiệp', 'Chứng chỉ\nVietGAP', ...Array.from({ length: 10 }, (_, index) => `${index}` + 'ệ'.repeat(199))] };
  await updateDoc(profileRef, { ...unicodeDetails, updatedAt: 3, updatedBy: 'metadata-admin' });
  const unicodeStored = (await getDoc(profileRef)).data()!;
  assert.deepEqual(unicodeStored.coverCrops, unicodeDetails.coverCrops);
  assert.deepEqual(unicodeStored.qualifications, unicodeDetails.qualifications);
  await assertFails(updateDoc(doc(context('ordinary'), 'consultationExperts', uid), {
    bio: 'Tự thay đổi thông tin hồ sơ', contactEmail: 'intruder@example.test', updatedAt: 3, updatedBy: 'ordinary',
  }));
  assert.equal((await getDoc(profileRef)).data()!.contactEmail, 'public@example.test');
});

test('expert metadata rules reject unsafe avatar URLs and malformed or oversized optional fields at every list index', async () => {
  const d = context('metadata-admin', true), uid = 'metadata-validation';
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'farmerApplications', uid), application(uid)); await setDoc(doc(ctx.firestore(), 'consultationExperts', uid), expert(uid, 'metadata-admin')); });
  const profileRef = doc(d, 'consultationExperts', uid);
  const invalid: Record<string, unknown>[] = [
    { avatar: 'http://example.test/photo.jpg' }, { avatar: 'https://user:password@example.test/photo.jpg' },
    { avatar: 'https://example.test/photo with space.jpg' }, { avatar: 'https://example.test/\nphoto.jpg' },
    { avatar: 'javascript:alert(1)' }, { avatar: 'https://example.test/' + 'a'.repeat(1200) },
    { badge: 'a'.repeat(81) }, { experienceYears: 1.5 }, { experienceYears: -1 }, { experienceYears: 71 }, { experienceYears: '22' },
    { coverCrops: Array(13).fill('Vải') }, { qualifications: Array(13).fill('Chứng chỉ') },
    { coverCrops: ['a'.repeat(101)] }, { qualifications: ['a'.repeat(201)] },
    { coverCrops: [...Array(11).fill('Vải'), 'a'.repeat(101)] }, { qualifications: [...Array(11).fill('Chứng chỉ'), 'a'.repeat(201)] },
    { coverCrops: ['Vải', 5] }, { qualifications: ['Kỹ sư', { label: 'Invalid' }] },
    { coverCrops: [...Array(11).fill('Vải'), 5] }, { qualifications: [...Array(11).fill('Kỹ sư'), { label: 'Invalid' }] },
    { coverCrops: ['Vải\u001fCam'] }, { qualifications: ['Kỹ sư\u001fTiến sĩ'] },
    { coverCrops: [...Array(11).fill('Vải'), 'Cam\u001fBưởi'] }, { qualifications: [...Array(11).fill('Kỹ sư'), 'A\u001fB'] },
    { coverCrops: [...Array(11).fill('Vải'), 'ấ'.repeat(101)] }, { qualifications: [...Array(11).fill('Kỹ sư'), 'ệ'.repeat(201)] },
    { coverCrops: [''] }, { qualifications: [''] },
    { contactEmail: 'not-an-email' }, { contactEmail: 'space @example.test' }, { contactEmail: 'a@example' },
    { contactEmail: 'a'.repeat(250) + '@example.test' }, { zalo: 'not-a-phone' }, { zalo: '1234' }, { zalo: '1'.repeat(31) },
    { email: 'must-not-become-public@example.test' }, { unknownMetadata: 'not in schema' },
  ];
  for (const patch of invalid) await assertFails(updateDoc(profileRef, { ...patch, updatedAt: 2, updatedBy: 'metadata-admin' }));
  const unchanged = (await getDoc(profileRef)).data()!;
  assert.equal(unchanged.updatedAt, 1); assert.equal('avatar' in unchanged, false); assert.equal('email' in unchanged, false);
});

test('expert account email collision never overwrites the existing Auth account or profiles', async () => {
  const existing = await account(), admin = await account(true);
  await assert.rejects(accounts.createExpertAccount({ ...input(), email: existing.email }));
  assert.equal(auth!.currentUser!.uid, admin.uid);
  assert.equal((await getDoc(doc(db!, 'farmerApplications', existing.uid))).data()!.email, existing.email);
  assert.equal((await getDoc(doc(db!, 'consultationExperts', existing.uid))).exists(), false);
  await login(existing); assert.equal(auth!.currentUser!.uid, existing.uid);
});

test('failed atomic expert provisioning rolls back only the newly created Auth account and preserves admin session', async () => {
  const admin = await account(true), value = input();
  const originalRules = readFileSync('firestore.rules', 'utf8');
  const rejectingRules = originalRules.replace('adminExpertApplication(uid) || selfSubmission(uid)', 'false || selfSubmission(uid)');
  assert.notEqual(rejectingRules, originalRules, 'The test must disable only the new admin provisioning branch.');
  let rejectingEnvironment: RulesTestEnvironment | undefined;
  try {
    // The public initializer loads a ruleset without clearing existing emulator data.
    rejectingEnvironment = await initializeTestEnvironment({ projectId: 'demo-traingot', firestore: { host: '127.0.0.1', port: 8080, rules: rejectingRules } });
    await assert.rejects(accounts.createExpertAccount(value));
    assert.equal(auth!.currentUser!.uid, admin.uid);
    assert.equal((await auth!.currentUser!.getIdTokenResult()).claims.admin, true);
    assert.equal(await authEmailExists(value.email), false);
    assert.equal((await getDocs(query(collection(db!, 'farmerApplications'), where('email', '==', value.email)))).size, 0);
    assert.equal((await getDocs(collection(db!, 'consultationExperts'))).size, 0);
    assert.equal((await getDoc(doc(db!, 'farmerApplications', admin.uid))).exists(), true);
  } finally {
    const restoredEnvironment = await initializeTestEnvironment({ projectId: 'demo-traingot', firestore: { host: '127.0.0.1', port: 8080, rules: originalRules } });
    await restoredEnvironment.cleanup();
    await rejectingEnvironment?.cleanup();
  }
});

test('ordinary, unverified and signed-out users cannot create expert Auth accounts or grant roles', async () => {
  const ordinary = await account(), value = input();
  await assert.rejects(accounts.createExpertAccount(value)); assert.equal(auth!.currentUser!.uid, ordinary.uid);
  assert.equal(await authEmailExists(value.email), false);
  const unverifiedEmail = `unverified-${crypto.randomUUID()}@example.test`;
  await createUserWithEmailAndPassword(auth!, unverifiedEmail, password);
  await assert.rejects(accounts.createExpertAccount(value)); assert.equal(await authEmailExists(value.email), false);
  await signOut(auth!); await assert.rejects(accounts.createExpertAccount(value)); assert.equal(await authEmailExists(value.email), false);
  const d = context('ordinary');
  const batch = writeBatch(d); batch.set(doc(d, 'farmerApplications', 'forged'), application('forged')); batch.set(doc(d, 'consultationExperts', 'forged'), expert('forged', 'ordinary'));
  await assertFails(batch.commit()); await assertFails(setDoc(doc(d, 'consultationExperts', ordinary.uid), expert(ordinary.uid, 'ordinary')));
});

test('admin provisioning rules require an atomic new pending internal expert and matching neutral draft', async () => {
  const d = context('admin', true);
  await assertFails(setDoc(doc(d, 'farmerApplications', 'unpaired'), application('unpaired')));
  await assertFails(setDoc(doc(d, 'consultationExperts', 'unpaired'), expert('unpaired')));
  for (const patch of [{ status: 'active', active: true }, { internalAccount: false }, { updatedBy: 'other' }, { id: 'different' }]) {
    const uid = `bad-${crypto.randomUUID()}`, batch = writeBatch(d);
    batch.set(doc(d, 'farmerApplications', uid), application(uid)); batch.set(doc(d, 'consultationExperts', uid), { ...expert(uid), ...patch });
    await assertFails(batch.commit());
  }
  for (const patch of [{ status: 'approved' }, { reviewedBy: 'admin', reviewedAt: 1 }, { submittedAt: 1 }, { revision: 2 }]) {
    const uid = `bad-${crypto.randomUUID()}`, batch = writeBatch(d);
    batch.set(doc(d, 'farmerApplications', uid), { ...application(uid), ...patch }); batch.set(doc(d, 'consultationExperts', uid), expert(uid));
    await assertFails(batch.commit());
  }
  const batch = writeBatch(d); batch.set(doc(d, 'farmerApplications', 'paired'), application('paired')); batch.set(doc(d, 'consultationExperts', 'paired'), expert('paired'));
  await batch.commit(); assert.equal((await getDoc(doc(d, 'consultationExperts', 'paired'))).data()!.status, 'pending');
  await assertFails(deleteDoc(doc(d, 'consultationExperts', 'paired'))); await assertFails(deleteDoc(doc(d, 'farmerApplications', 'paired')));
});

for (const status of ['suspended', 'deleted'] as const) test(`expert account ${status} blocks existing session, new requests and messages while preserving history`, async () => {
  const owner = await account(), admin = await account(true), value = input();
  const uid = await accounts.createExpertAccount(value);
  const profile = (await getDoc(doc(db!, 'consultationExperts', uid))).data()!;
  await consultations.saveConsultationExpert({ ...profile, status: 'active', active: true } as any);
  await login(owner);
  const request = await consultations.createConsultation({ subject: 'Cây vải bị vàng lá', question: 'Lá vải vàng sau mưa, xin tư vấn chăm sóc.', crop: 'Vải', expertId: uid });
  const existingExpertSession = env.authenticatedContext(uid, { email_verified: false, firebase: { sign_in_provider: 'password' } }).firestore();
  assert.equal((await getDoc(doc(existingExpertSession, 'consultations', request))).exists(), true);
  await login(admin);
  const version = await expected(uid);
  const activeDraft = (await getDoc(doc(db!, 'consultationExperts', uid))).data() as ConsultationExpert;
  await accounts.changeExpertAccountStatus(uid, version, status, 'Lý do xử lý tài khoản thử nghiệm', status === 'deleted' ? value.email : '');
  assert.equal(auth!.currentUser!.uid, admin.uid);
  assert.equal((await getDoc(doc(db!, 'farmerAccountStates', uid))).data()!.status, status);
  const changed = (await getDoc(doc(db!, 'consultationExperts', uid))).data()!;
  assert.equal(changed.active, false); assert.equal(changed.status, status === 'deleted' ? 'revoked' : 'suspended');
  assert.equal((await getDocs(query(collection(db!, 'farmerAccountActions'), where('farmerId', '==', uid)))).size, 1);
  assert.equal((await getDoc(doc(db!, 'consultations', request))).exists(), true);
  assert.equal((await getDocs(collection(db!, 'consultations', request, 'messages'))).size, 1);
  await assertFails(getDoc(doc(existingExpertSession, 'consultations', request)));
  await assertFails(getDocs(collection(existingExpertSession, 'consultations', request, 'messages')));
  await assert.rejects(consultations.saveConsultationExpert({ ...changed, status: 'active', active: true } as any));
  await signInWithEmailAndPassword(auth!, value.email, value.password);
  await assertFails(getDoc(doc(db!, 'consultations', request)));
  await assert.rejects(consultations.sendConsultationMessage(request, 'Không được phép gửi sau khi bị xử lý.'));
  await login(owner); await assert.rejects(consultations.createConsultation({ subject: 'Cần tư vấn mới', question: 'Xin hỏi chuyên gia về chăm sóc vải thiều.', crop: 'Vải', expertId: uid }));
  assert.equal((await getDoc(doc(db!, 'consultations', request))).exists(), true);
  await login(admin); await accounts.changeExpertAccountStatus(uid, await expected(uid), 'active', 'Khôi phục tài khoản kiểm thử');
  assert.equal((await getDoc(doc(db!, 'farmerAccountStates', uid))).data()!.status, 'active');
  const restored = (await getDoc(doc(db!, 'consultationExperts', uid))).data() as ConsultationExpert;
  assert.equal(restored.status, 'pending'); assert.equal(restored.active, false);
  await assert.rejects(consultations.saveConsultationExpert(activeDraft, activeDraft.updatedAt), /Hồ sơ chuyên gia vừa thay đổi/);
  await assert.rejects(consultations.saveConsultationExpert(activeDraft, null), /Hồ sơ chuyên gia vừa thay đổi/);
  assert.equal((await getDoc(doc(db!, 'consultationExperts', uid))).data()!.status, 'pending');

  await consultations.saveConsultationExpert({ ...restored, status: 'active' }, restored.updatedAt);
  const reactivated = (await getDoc(doc(db!, 'consultationExperts', uid))).data() as ConsultationExpert;
  assert.equal(reactivated.status, 'active');
  assert.equal(reactivated.active, true);
});

test('expert lifecycle rejects stale snapshots, wrong email, empty reasons, self actions and ordinary users', async () => {
  const admin = await account(true), value = input(), uid = await accounts.createExpertAccount(value), version = await expected(uid);
  for (const badVersion of [{ ...version, expertUpdatedAt: version.expertUpdatedAt - 1 }, { ...version, applicationRevision: 2 }, { ...version, accountVersion: 1 }]) await assert.rejects(accounts.changeExpertAccountStatus(uid, badVersion, 'suspended', 'Lý do hợp lệ'));
  await assert.rejects(accounts.changeExpertAccountStatus(uid, version, 'deleted', 'Lý do hợp lệ', 'wrong@example.test'));
  await assert.rejects(accounts.changeExpertAccountStatus(uid, version, 'suspended', '   '));
  await assert.rejects(accounts.changeExpertAccountStatus(admin.uid, version, 'suspended', 'Không được tự xử lý'));
  assert.equal((await getDoc(doc(db!, 'farmerAccountStates', uid))).exists(), false);
  await account(); await assert.rejects(accounts.changeExpertAccountStatus(uid, version, 'suspended', 'Không có quyền'));
  await login(admin); await accounts.changeExpertAccountStatus(uid, version, 'suspended', 'Quản trị xử lý hợp lệ');
  await assert.rejects(accounts.changeExpertAccountStatus(uid, version, 'deleted', 'Bản cũ không được sử dụng', value.email));
  assert.equal((await getDoc(doc(db!, 'farmerAccountStates', uid))).data()!.status, 'suspended');
});

test('rules reject activation of globally suspended/deleted experts even in malicious admin batches', async () => {
  const d = context('admin', true);
  for (const status of ['suspended', 'deleted']) {
    const uid = `${status}-expert`;
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'farmerApplications', uid), application(uid)); await setDoc(doc(ctx.firestore(), 'consultationExperts', uid), expert(uid)); await setDoc(doc(ctx.firestore(), 'farmerAccountStates', uid), { id: uid, status, version: 1, updatedAt: 1, lastActionId: '01234567890123456789' }); });
    await assertFails(updateDoc(doc(d, 'consultationExperts', uid), { status: 'active', active: true, updatedAt: 2, updatedBy: 'admin' }));
    const batch = writeBatch(d);
    // Updating a profile while leaving its blocked lifecycle state in place cannot open access.
    batch.update(doc(d, 'consultationExperts', uid), { status: 'active', active: true, updatedAt: 3, updatedBy: 'admin' });
    await assertFails(batch.commit());
    assert.equal((await getDoc(doc(d, 'farmerAccountStates', uid))).data()!.status, status);
    const atomicUid = `atomic-${status}`, actionId = `atomic${status}`.padEnd(20, '0').slice(0, 20);
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'farmerApplications', atomicUid), application(atomicUid)); await setDoc(doc(ctx.firestore(), 'consultationExperts', atomicUid), expert(atomicUid)); });
    const atomic = writeBatch(d);
    atomic.set(doc(d, 'farmerAccountStates', atomicUid), { id: atomicUid, status, version: 1, updatedAt: 2, lastActionId: actionId });
    atomic.set(doc(d, 'farmerAccountActions', actionId), { id: actionId, farmerId: atomicUid, previousStatus: 'active', status, version: 1, reviewerId: 'admin', note: 'Lý do kiểm thử', createdAt: 2 });
    atomic.update(doc(d, 'consultationExperts', atomicUid), { status: 'active', active: true, updatedAt: 2, updatedBy: 'admin' });
    await assertFails(atomic.commit());
    assert.equal((await getDoc(doc(d, 'farmerAccountStates', atomicUid))).exists(), false);
  }
});
