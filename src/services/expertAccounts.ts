import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, deleteUser, initializeAuth, inMemoryPersistence, signOut, updateProfile, type User } from 'firebase/auth';
import { collection, doc, getDocFromServer, runTransaction } from 'firebase/firestore';
import { auth, firebaseApp, requireDatabase } from '../lib/firebase';
import { requireActiveFarmer, type FarmerAccountAction, type FarmerAccountState, type FarmerAccountStatus } from './accountModeration';
import type { ConsultationExpert } from '../types/consultations';
import { isValidPhone } from '../utils/orders';
import { normalizeExpertProfileDetails, type ExpertProfileDetails } from '../utils/expertProfile';

export interface NewExpertAccount extends ExpertProfileDetails {
  email: string; password: string; name: string; title: string; organization: string;
  specialties: string; bio: string; phone: string; availability: string;
}
export interface ExpertAccountVersion { expertUpdatedAt: number; applicationRevision: number; accountVersion: number }
async function requireExpertAdministrator() {
  const user = await requireActiveFarmer();
  if ((await user.getIdTokenResult(true)).claims.admin !== true) throw new Error('Chỉ quản trị được quản lý tài khoản chuyên gia.');
  return user;
}
function text(value: string, min: number, max: number, field: string) {
  value = value.trim();
  if (value.length < min || value.length > max) throw new Error(`${field}: nhập từ ${min} đến ${max} ký tự.`);
  return value;
}
function authError(error: unknown) {
  const code = (error as { code?: string }).code;
  return ({ 'auth/email-already-in-use': 'Email đã có tài khoản. Hãy chọn “Thêm tài khoản đã đăng ký” để cấp quyền chuyên gia.',
    'auth/invalid-email': 'Email đăng nhập chưa hợp lệ.', 'auth/weak-password': 'Mật khẩu ban đầu chưa đủ mạnh.',
    'auth/operation-not-allowed': 'Phương thức đăng nhập email chưa được bật.',
    'auth/too-many-requests': 'Có quá nhiều yêu cầu. Vui lòng thử lại sau.' } as Record<string,string>)[code || '']
    || (code?.startsWith('auth/') ? 'Chưa tạo được tài khoản đăng nhập. Vui lòng kiểm tra kết nối và thử lại.' : (error as Error).message);
}

/** The temporary Auth instance never replaces or persists the administrator's session. */
export async function createExpertAccount(input: NewExpertAccount): Promise<string> {
  const administrator = await requireExpertAdministrator();
  const email = text(input.email, 3, 254, 'Email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email đăng nhập chưa hợp lệ.');
  if (input.password.length < 10 || input.password.length > 128) throw new Error('Mật khẩu ban đầu cần từ 10 đến 128 ký tự.');
  const profile = {
    ...normalizeExpertProfileDetails(input),
    name: text(input.name, 1, 100, 'Họ tên'), title: text(input.title, 1, 150, 'Chức danh'),
    organization: text(input.organization, 0, 200, 'Đơn vị'), specialties: text(input.specialties, 1, 500, 'Chuyên môn'),
    bio: text(input.bio, 0, 3000, 'Giới thiệu'), phone: input.phone.trim(), availability: text(input.availability, 0, 200, 'Lịch tiếp nhận'),
  };
  if (profile.phone && !isValidPhone(profile.phone, 30)) throw new Error('Số điện thoại liên hệ chưa hợp lệ.');
  if (!firebaseApp || !auth) throw new Error('Website chưa kết nối Firebase.');
  const secondaryApp = initializeApp(firebaseApp.options, `expert-provision-${crypto.randomUUID()}`);
  const secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence });
  if (auth.emulatorConfig) {
    const emulator = auth.emulatorConfig;
    connectAuthEmulator(secondaryAuth, `${emulator.protocol}://${emulator.host}:${emulator.port}`, { disableWarnings: true });
  }
  const db = requireDatabase();
  let created: User | undefined;
  try {
    created = (await createUserWithEmailAndPassword(secondaryAuth, email, input.password)).user;
    await updateProfile(created, { displayName: profile.name });
    const currentAdmin = await requireExpertAdministrator();
    if (currentAdmin.uid !== administrator.uid) throw new Error('Phiên quản trị đã thay đổi. Vui lòng đăng nhập lại.');
    const uid = created.uid;
    const expert: ConsultationExpert = { ...profile, id: uid, status: 'pending', active: false, internalAccount: true, updatedAt: Date.now(), updatedBy: administrator.uid };
    await runTransaction(db, async transaction => {
      const applicationRef = doc(db, 'farmerApplications', uid), expertRef = doc(db, 'consultationExperts', uid);
      const [application, existingExpert] = await Promise.all([transaction.get(applicationRef), transaction.get(expertRef)]);
      if (application.exists() || existingExpert.exists()) throw new Error('Hồ sơ tài khoản đã tồn tại. Vui lòng tải lại danh sách.');
      transaction.set(applicationRef, { id: uid, email, profile: { id: uid, name: profile.name, avatar: '/farmer-avatar.svg',
        location: '', shortLocation: '', commune: '', role: 'Chuyên gia nội bộ', cropFocus: '', areaHa: 0, treeCount: 0,
        phone: '', pucCode: '', certification: 'Chưa chứng nhận' }, status: 'draft', revision: 1, submittedAt: 0, reviewedAt: 0, reviewedBy: '', reviewNote: '' });
      transaction.set(expertRef, expert);
    });
    return uid;
  } catch (error) {
    if (created) {
      // Auth and Firestore cannot commit together. Resolve an uncertain write before rollback.
      let outcome: 'saved' | 'absent' | 'uncertain' = 'uncertain';
      try {
        const [application, expert] = await Promise.all([
          getDocFromServer(doc(db, 'farmerApplications', created.uid)), getDocFromServer(doc(db, 'consultationExperts', created.uid)),
        ]);
        if (application.data()?.email === email && expert.data()?.updatedBy === administrator.uid && expert.data()?.id === created.uid) outcome = 'saved';
        else if (!application.exists() && !expert.exists()) outcome = 'absent';
      } catch { /* Keep the account recoverable if the server state cannot be confirmed. */ }
      if (outcome === 'saved') return created.uid;
      if (outcome === 'absent') {
        try { await deleteUser(created); }
        catch { throw new Error(`Đã tạo đăng nhập ${email} nhưng chưa hoàn tất hồ sơ. Mã tài khoản: ${created.uid}. Giữ thông tin bàn giao và liên hệ hỗ trợ để hoàn tất; không tạo lại tài khoản.`); }
      } else throw new Error(`Chưa xác nhận được hồ sơ của ${email}. Mã tài khoản: ${created.uid}. Giữ thông tin bàn giao và kiểm tra danh sách trước khi tạo lại.`);
    }
    throw new Error(authError(error));
  } finally {
    // Cleanup must not replace a confirmed provisioning result or the actionable error.
    await signOut(secondaryAuth).catch(() => undefined);
    await deleteApp(secondaryApp).catch(() => undefined);
  }
}

/** Reversible website lifecycle; historical conversations and Auth credentials are retained. */
export async function changeExpertAccountStatus(uid: string, expected: ExpertAccountVersion, status: FarmerAccountStatus, note: string, confirmation = '') {
  const administrator = await requireExpertAdministrator();
  if (uid === administrator.uid) throw new Error('Không thể xử lý tài khoản quản trị đang sử dụng.');
  if (!['active','suspended','deleted'].includes(status)) throw new Error('Trạng thái tài khoản không hợp lệ.');
  note = text(note, 1, 1000, 'Lý do xử lý');
  const db = requireDatabase(), actionRef = doc(collection(db, 'farmerAccountActions'));
  await runTransaction(db, async transaction => {
    const applicationRef = doc(db, 'farmerApplications', uid), expertRef = doc(db, 'consultationExperts', uid), stateRef = doc(db, 'farmerAccountStates', uid);
    const [application, expert, state] = await Promise.all([transaction.get(applicationRef), transaction.get(expertRef), transaction.get(stateRef)]);
    const previous = state.data() as FarmerAccountState | undefined;
    const previousStatus = previous?.status || 'active';
    if (!expert.exists() || !application.exists() || expert.data().updatedAt !== expected.expertUpdatedAt || application.data().revision !== expected.applicationRevision || (previous?.version || 0) !== expected.accountVersion) throw new Error('Tài khoản vừa thay đổi. Hãy mở lại trước khi xử lý.');
    if (status === previousStatus || previousStatus === 'deleted' && status !== 'active') throw new Error('Trạng thái tài khoản không phù hợp với thao tác này.');
    if (status === 'deleted' && confirmation.trim().toLowerCase() !== application.data().email.toLowerCase()) throw new Error('Nhập đúng email chuyên gia để xác nhận xóa khỏi website.');
    const now = Date.now(), version = expected.accountVersion + 1;
    transaction.set(stateRef, { id: uid, status, version, updatedAt: now, lastActionId: actionRef.id } satisfies FarmerAccountState);
    transaction.set(actionRef, { id: actionRef.id, farmerId: uid, previousStatus, status, version, reviewerId: administrator.uid, note, createdAt: now } satisfies FarmerAccountAction);
    transaction.update(expertRef, { status: status === 'deleted' ? 'revoked' : status === 'active' ? 'pending' : 'suspended', active: false, updatedAt: now, updatedBy: administrator.uid });
  });
}
