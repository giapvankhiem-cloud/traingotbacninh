import { collection, doc, getDoc, getDocFromServer, limit, limitToLast, onSnapshot, orderBy, query, runTransaction, where } from 'firebase/firestore';
import { auth, requireDatabase } from '../lib/firebase';
import { isAccountRestricted, requireActiveFarmer, type FarmerAccountState } from './accountModeration';
import type { Consultation, ConsultationExpert, ConsultationMessage, ConsultationRole, ConsultationStatus } from '../types/consultations';
import { isValidPhone } from '../utils/orders';
import { normalizeExpertProfileDetails } from '../utils/expertProfile';

const clean = (value: string, min: number, max: number, field: string) => {
  value = value.trim();
  if (value.length < min || value.length > max) throw new Error(`${field}: nhập từ ${min} đến ${max} ký tự.`);
  return value;
};
async function requireConsultationActor() {
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) throw new Error('Vui lòng đăng nhập.');
  const db = requireDatabase();
  const [state, profile] = await Promise.all([getDocFromServer(doc(db, 'farmerAccountStates', user.uid)), getDocFromServer(doc(db, 'consultationExperts', user.uid))]);
  if (isAccountRestricted(state.data() as any)) throw new Error('Tài khoản đã tạm dừng hoặc bị xóa khỏi website.');
  if (!user.emailVerified && !(profile.data()?.internalAccount && profile.data()?.active && profile.data()?.status === 'active')) throw new Error('Tài khoản cần được xác minh hoặc xác nhận quyền chuyên gia.');
  return user;
}
export async function saveConsultationExpert(value: Omit<ConsultationExpert, 'updatedAt' | 'updatedBy'>, expectedUpdatedAt?: number | null) {
  const user = await requireActiveFarmer();
  if ((await user.getIdTokenResult()).claims.admin !== true) throw new Error('Chỉ quản trị được cấu hình chuyên gia.');
  const id = clean(value.id, 1, 128, 'Tài khoản');
  const db = requireDatabase();
  const expertRef = doc(db, 'consultationExperts', id);
  await runTransaction(db, async (transaction) => {
    const [application, state, current] = await Promise.all([
      transaction.get(doc(db, 'farmerApplications', id)),
      transaction.get(doc(db, 'farmerAccountStates', id)),
      transaction.get(expertRef),
    ]);
    if (!application.exists()) throw new Error('Chọn tài khoản đã đăng ký trên website.');
    const currentUpdatedAt = current.exists() ? (current.data() as ConsultationExpert).updatedAt : null;
    if (expectedUpdatedAt !== undefined && currentUpdatedAt !== expectedUpdatedAt) {
      throw new Error('Hồ sơ chuyên gia vừa thay đổi. Vui lòng mở lại hồ sơ và kiểm tra trước khi lưu.');
    }
    if (value.status === 'active' && isAccountRestricted(state.data() as FarmerAccountState | undefined)) {
      throw new Error('Khôi phục hoạt động tài khoản trước khi xác nhận quyền tư vấn.');
    }
    const expert: ConsultationExpert = {
      ...normalizeExpertProfileDetails(value),
      id, name: clean(value.name, 1, 100, 'Họ tên'), title: clean(value.title, 1, 150, 'Chức danh'),
      organization: clean(value.organization, 0, 200, 'Đơn vị'), specialties: clean(value.specialties, 1, 500, 'Chuyên môn'),
      bio: clean(value.bio, 0, 3000, 'Giới thiệu'), phone: value.phone.trim(), availability: clean(value.availability, 0, 200, 'Lịch tiếp nhận'),
      active: value.status === 'active', status: value.status, internalAccount: value.internalAccount,
      updatedAt: Math.max(Date.now(), (currentUpdatedAt ?? 0) + 1), updatedBy: user.uid,
    };
    if (expert.phone && !isValidPhone(expert.phone, 30)) throw new Error('Số điện thoại liên hệ chưa hợp lệ.');
    if (expert.active && (/^Chuyên gia \d+$/.test(expert.name) || /Chờ/.test(expert.title + expert.specialties) || !expert.organization)) throw new Error('Bổ sung tên thật, chức danh, chuyên môn và đơn vị trước khi xác nhận.');
    transaction.set(expertRef, expert);
  });
}
export function watchConsultationExperts(admin: boolean, next: (items: ConsultationExpert[]) => void, error: (error: Error) => void) {
  const ref = collection(requireDatabase(), 'consultationExperts');
  let profiles: ConsultationExpert[] = [], blocked = new Set<string>();
  let profilesReady = false, statesReady = false;
  const emit = () => { if (profilesReady && statesReady) next(profiles.filter((p) => admin || !blocked.has(p.id)).sort((a,b) => a.name.localeCompare(b.name, 'vi'))); };
  const stopProfiles = onSnapshot(admin ? query(ref, orderBy('name')) : query(ref, where('active', '==', true)), (snap) => { profiles = snap.docs.map((item) => item.data() as ConsultationExpert); profilesReady = true; emit(); }, error);
  const stopStates = onSnapshot(collection(requireDatabase(), 'farmerAccountStates'), (snap) => { blocked = new Set(snap.docs.filter((item) => isAccountRestricted(item.data() as any)).map((item) => item.id)); statesReady = true; emit(); }, error);
  return () => { stopProfiles(); stopStates(); };
}
export function watchConsultations(mode: 'farmer' | 'expert' | 'admin', uid: string, count: number, next: (items: Consultation[]) => void, error: (error: Error) => void) {
  const ref = collection(requireDatabase(), 'consultations');
  const scope = mode === 'admin' ? query(ref, orderBy('updatedAt', 'desc'), limit(count))
    : query(ref, where(mode === 'farmer' ? 'farmerId' : 'expertId', '==', uid), orderBy('updatedAt', 'desc'), limit(count));
  return onSnapshot(scope, (snap) => next(snap.docs.map((item) => item.data() as Consultation)), error);
}
export function watchConsultationMessages(id: string, count: number, next: (items: ConsultationMessage[]) => void, error: (error: Error) => void) {
  return onSnapshot(query(collection(requireDatabase(), 'consultations', id, 'messages'), orderBy('createdAt'), limitToLast(count)), (snap) => next(snap.docs.map((item) => item.data() as ConsultationMessage)), error);
}
export function watchConsultation(id: string, next: (item: Consultation | null) => void, error: (error: Error) => void) {
  return onSnapshot(doc(requireDatabase(), 'consultations', id), snapshot => next(snapshot.exists() ? snapshot.data() as Consultation : null), error);
}
export async function createConsultation(input: { subject: string; question: string; crop: string; expertId: string }, requestId: string = crypto.randomUUID()) {
  const user = await requireActiveFarmer();
  const subject = clean(input.subject, 3, 200, 'Chủ đề');
  const question = clean(input.question, 10, 5000, 'Nội dung');
  const crop = clean(input.crop, 1, 100, 'Cây trồng');
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(requestId)) throw new Error('Mã yêu cầu chưa hợp lệ.');
  if (!input.expertId.trim()) throw new Error('Hãy chọn chuyên gia để gửi câu hỏi trực tiếp.');
  if (input.expertId === user.uid) throw new Error('Hãy chọn chuyên gia khác để gửi yêu cầu.');
  const db = requireDatabase();
  const application = await getDoc(doc(db, 'farmerApplications', user.uid));
  const farmerName = (user.displayName || application.data()?.profile?.name || 'Nhà vườn').slice(0,100);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'consultations', requestId);
    const existing = await tx.get(ref);
    if (existing.exists()) {
      if (existing.data().farmerId !== user.uid || existing.data().subject !== subject || existing.data().question !== question || existing.data().crop !== crop || existing.data().expertId !== input.expertId) throw new Error('Mã yêu cầu đã được sử dụng. Hãy tải lại biểu mẫu.');
      return;
    }
    const expert = input.expertId ? (await tx.get(doc(db, 'consultationExperts', input.expertId))).data() as ConsultationExpert | undefined : undefined;
    if (!expert?.active || expert.status !== 'active') throw new Error('Chuyên gia đã tạm ngừng nhận yêu cầu. Hãy chọn chuyên gia khác.');
    const now = Date.now();
    tx.set(ref, { id: requestId, farmerId: user.uid, farmerName, subject, question, crop, expertId: input.expertId, expertName: expert.name, status: 'waiting', revision: 1,
      messageCount: 1, lastMessage: question, lastMessageId: 'initial', lastSenderRole: 'farmer', createdAt: now, updatedAt: now } satisfies Consultation);
    tx.set(doc(ref, 'messages', 'initial'), { id: 'initial', senderId: user.uid, senderRole: 'farmer', senderName: farmerName, body: question, createdAt: now } satisfies ConsultationMessage);
  });
  return requestId;
}
export async function sendConsultationMessage(id: string, body: string, messageId?: string) {
  const user = await requireConsultationActor();
  body = clean(body, 1, 5000, 'Tin nhắn');
  const admin = (await user.getIdTokenResult()).claims.admin === true;
  const db = requireDatabase();
  const ref = doc(db, 'consultations', id);
  const messageRef = messageId ? doc(ref, 'messages', messageId) : doc(collection(ref, 'messages'));
  await runTransaction(db, async (tx) => {
    const [snapshot, existing] = await Promise.all([tx.get(ref), tx.get(messageRef)]);
    if (!snapshot.exists()) throw new Error('Không tìm thấy yêu cầu tư vấn.');
    if (existing.exists()) {
      if (existing.data().senderId !== user.uid || existing.data().body !== body) throw new Error('Mã tin nhắn đã được sử dụng.');
      return;
    }
    const current = snapshot.data() as Consultation;
    if (current.status === 'closed') throw new Error('Yêu cầu đã kết thúc. Quản trị cần mở lại trước khi trao đổi tiếp.');
    const expert = current.farmerId !== user.uid && !admin ? (await tx.get(doc(db, 'consultationExperts', user.uid))).data() as ConsultationExpert | undefined : undefined;
    const role: ConsultationRole = current.farmerId === user.uid ? 'farmer' : admin ? 'admin' : 'expert';
    if (role === 'expert' && (current.expertId !== user.uid || !expert?.active)) throw new Error('Câu hỏi không được gửi đến bạn.');
    const now = Date.now();
    tx.set(messageRef, { id: messageRef.id, senderId: user.uid, senderRole: role, senderName: role === 'farmer' ? current.farmerName : role === 'admin' ? 'Ban điều phối' : expert!.name, body, createdAt: now } satisfies ConsultationMessage);
    tx.update(ref, { revision: current.revision + 1, messageCount: current.messageCount + 1, lastMessageId: messageRef.id, lastMessage: body, lastSenderRole: role, updatedAt: now,
      status: role !== 'farmer' && current.status === 'waiting' ? 'in_progress' : current.status });
  });
  return messageRef.id;
}
export async function updateConsultation(id: string, revision: number, action: { status: ConsultationStatus }) {
  if (!['waiting','in_progress','closed'].includes(action.status)) throw new Error('Thao tác tư vấn không hợp lệ.');
  const user = await requireConsultationActor();
  const admin = (await user.getIdTokenResult()).claims.admin === true;
  const db = requireDatabase();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'consultations', id); const snapshot = await tx.get(ref);
    if (!snapshot.exists() || snapshot.data().revision !== revision) throw new Error('Yêu cầu vừa thay đổi. Hãy kiểm tra nội dung mới rồi thử lại.');
    const current = snapshot.data() as Consultation;
    if (action.status === current.status) return;
    const expert = !admin && current.farmerId !== user.uid ? (await tx.get(doc(db, 'consultationExperts', user.uid))).data() as ConsultationExpert | undefined : undefined;
    if (!admin && !(current.status !== 'closed' && (action.status === 'closed' || action.status === 'in_progress') && (current.farmerId === user.uid ? action.status === 'closed' : current.expertId === user.uid && expert?.active))) throw new Error('Bạn không có quyền đổi trạng thái này.');
    tx.update(ref, { status: action.status, revision: revision + 1, updatedAt: Date.now() });
  });
}
