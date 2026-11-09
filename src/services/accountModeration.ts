import { doc, getDocFromServer, runTransaction, collection } from 'firebase/firestore';
import { requireDatabase, requireFarmer } from '../lib/firebase';

export type FarmerAccountStatus = 'active' | 'suspended' | 'deleted';
export interface FarmerAccountState {
  id: string;
  status: FarmerAccountStatus;
  version: number;
  updatedAt: number;
  lastActionId: string;
}
export interface FarmerAccountAction {
  id: string;
  farmerId: string;
  previousStatus: FarmerAccountStatus;
  status: FarmerAccountStatus;
  version: number;
  reviewerId: string;
  note: string;
  createdAt: number;
}
export const accountStatusLabels: Record<FarmerAccountStatus, string> = {
  active: 'Đang hoạt động', suspended: 'Tạm dừng tài khoản', deleted: 'Đã xóa khỏi website',
};
export function isAccountRestricted(state?: Pick<FarmerAccountState, 'status'>) {
  return state?.status === 'suspended' || state?.status === 'deleted';
}
export async function requireActiveFarmer() {
  const user = requireFarmer();
  const state = (await getDocFromServer(doc(requireDatabase(), 'farmerAccountStates', user.uid))).data() as FarmerAccountState | undefined;
  if (isAccountRestricted(state)) throw new Error('Tài khoản đã tạm dừng hoặc bị xóa khỏi website. Vui lòng liên hệ quản trị.');
  return user;
}

/** Website access is reversible; Firebase Authentication credentials are retained. */
export async function changeFarmerAccountStatus(uid: string, applicationRevision: number, expectedVersion: number, status: FarmerAccountStatus, note: string, confirmation = '') {
  const user = await requireActiveFarmer();
  if ((await user.getIdTokenResult()).claims.admin !== true) throw new Error('Bạn không có quyền quản trị.');
  if (uid === user.uid) throw new Error('Không thể xử lý tài khoản quản trị đang sử dụng.');
  note = note.trim();
  if (!note || note.length > 1000) throw new Error('Nhập lý do xử lý từ 1 đến 1.000 ký tự.');
  const db = requireDatabase();
  const actionRef = doc(collection(db, 'farmerAccountActions'));
  await runTransaction(db, async (tx) => {
    const application = await tx.get(doc(db, 'farmerApplications', uid));
    const stateRef = doc(db, 'farmerAccountStates', uid);
    const current = await tx.get(stateRef);
    const previous = current.data() as FarmerAccountState | undefined;
    const previousStatus = previous?.status || 'active';
    if (!application.exists() || application.data().revision !== applicationRevision || (previous?.version || 0) !== expectedVersion) throw new Error('Tài khoản vừa thay đổi. Hãy mở lại hồ sơ trước khi xử lý.');
    if (previousStatus === status || (previousStatus === 'deleted' && status !== 'active')) throw new Error('Trạng thái tài khoản không phù hợp với thao tác này.');
    if (status === 'deleted' && confirmation.trim().toLowerCase() !== application.data().email.toLowerCase()) throw new Error('Nhập đúng email nhà vườn để xác nhận xóa khỏi website.');
    const version = expectedVersion + 1;
    const now = Date.now();
    tx.set(stateRef, { id: uid, status, version, updatedAt: now, lastActionId: actionRef.id } satisfies FarmerAccountState);
    tx.set(actionRef, { id: actionRef.id, farmerId: uid, previousStatus, status, version, reviewerId: user.uid, note, createdAt: now } satisfies FarmerAccountAction);
  });
}
