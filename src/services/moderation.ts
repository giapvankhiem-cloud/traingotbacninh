import { doc, getDoc, getDocFromServer, runTransaction } from 'firebase/firestore';
import { requireDatabase, requireFarmer } from '../lib/firebase';
import type { Certificate, FarmerAccount, FarmerApplication } from '../types/agriculture';
import { normalizeCertificates } from '../utils/certificates';
import { requireActiveFarmer } from './accountModeration';

export const applicationLabels: Record<FarmerApplication['status'], string> = {
  draft: 'Chưa gửi hồ sơ', pending: 'Đang chờ quản trị duyệt', approved: 'Đã được duyệt đăng thông tin',
  rejected: 'Cần bổ sung hồ sơ', suspended: 'Đã khóa quyền đăng thông tin',
};
export async function requireApprovedFarmer() {
  const user = await requireActiveFarmer();
  const application = await getDocFromServer(doc(requireDatabase(), 'farmerApplications', user.uid));
  if (application.data()?.status !== 'approved') throw new Error('Tài khoản và hồ sơ nhà vườn cần được quản trị duyệt trước khi đăng thông tin. Vào Tổng quan để gửi hồ sơ.');
  return user;
}

/** The revision check prevents a reviewer approving a newer, unseen submission. */
export async function reviewFarmerApplication(uid: string, revision: number, decision: 'approved' | 'rejected' | 'suspended', note: string) {
  const user = requireFarmer();
  if ((await user.getIdTokenResult()).claims.admin !== true) throw new Error('Bạn không có quyền quản trị.');
  note = note.trim();
  if (note.length > 1000 || (decision !== 'approved' && !note)) throw new Error('Nhập lý do xử lý (tối đa 1.000 ký tự).');
  const db = requireDatabase();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'farmerApplications', uid);
    const snapshot = await tx.get(ref);
    const application = snapshot.data() as FarmerApplication | undefined;
    if (!application || application.revision !== revision || (decision === 'suspended' ? application.status !== 'approved' : decision === 'rejected' ? !['pending','suspended'].includes(application.status) : application.status !== 'pending')) {
      throw new Error('Hồ sơ vừa thay đổi hoặc đã được xử lý. Hãy mở lại để kiểm tra.');
    }
    const publicRef = doc(db, 'farmers', uid);
    const previous = await tx.get(publicRef);
    const ids = application.profile.certificateIds || [];
    const documents = decision === 'approved' ? await Promise.all(ids.map((id) => tx.get(doc(db, 'farmerApplications', uid, 'certificates', id)))) : [];
    if (documents.some((document) => !document.exists())) throw new Error('Hồ sơ chứng nhận chưa đầy đủ. Hãy yêu cầu chủ vườn bổ sung.');
    const certificates = normalizeCertificates(documents.map((document) => document.data()) as Certificate[]);
    const now = Date.now();
    tx.update(ref, { status: decision, reviewedAt: now, reviewedBy: user.uid, reviewNote: note });
    tx.set(doc(db, 'farmerApplications', uid, 'reviews', `${revision}-${decision}`), {
      revision, decision, reviewerId: user.uid, reviewedAt: now, note,
    });
    if (decision === 'approved') {
      tx.set(publicRef, application.profile);
      for (const certificate of certificates) tx.set(doc(db, 'farmers', uid, 'certificates', certificate.id), certificate);
      for (const id of (previous.data()?.certificateIds || [])) if (!ids.includes(id)) tx.delete(doc(db, 'farmers', uid, 'certificates', id));
    }
  });
}

export async function getApplicationCertificates(uid: string, profile: FarmerAccount) {
  const documents = await Promise.all((profile.certificateIds || []).map((id) => getDoc(doc(requireDatabase(), 'farmerApplications', uid, 'certificates', id))));
  return documents.filter((document) => document.exists()).map((document) => document.data() as Certificate);
}
