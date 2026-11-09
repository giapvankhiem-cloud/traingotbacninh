import { validateStoredStory } from '../utils/story';
import { validateMedia } from '../utils/media';
import {
  collection, doc, documentId, getDoc, getDocs, getDocFromServer, query, runTransaction, setDoc, where, writeBatch,
  type DocumentSnapshot, type Firestore, type Transaction,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, requireDatabase } from '../lib/firebase';
import type { BuyerDetails, CartItem, FarmOrder, FarmerAccount, OrderStatus, ProduceItem } from '../types/agriculture';
import { canChangeOrderStatus, isValidPhone, validateBuyer } from '../utils/orders';
import { appendCultivationLog, CultivationLogInput, CultivationLogType } from '../utils/cultivationLogs';
import { normalizeCertificates } from '../utils/certificates';
import { requireApprovedFarmer } from './moderation';
import { isAccountRestricted, requireActiveFarmer, type FarmerAccountState } from './accountModeration';

function plain<T>(data: T): T {
  const encoded = JSON.stringify(data);
  if (new TextEncoder().encode(encoded).length > 700_000) throw new Error('Dữ liệu quá lớn. Vui lòng giảm số ảnh hoặc nội dung.');
  return JSON.parse(encoded);
}

/** Re-read inventory only when a denied write raced with an actual stock change.
 * Rules remain enforced on every attempt; a genuine denial is not retried when
 * the product is unchanged. This also preserves checkout IDs across retries.
 */
async function inventoryTransaction<T>(db: Firestore, work: (tx: Transaction, watch: (snapshot: DocumentSnapshot) => void) => Promise<T>): Promise<T> {
  const version = (snapshot: DocumentSnapshot) => {
    const data = snapshot.data();
    return JSON.stringify([snapshot.exists(), data?.ownerId, data?.price, data?.inStock, data?.lastOrderId, data?.updatedAt]);
  };
  for (let attempt = 0; ; attempt++) {
    let observed: DocumentSnapshot[] = [];
    try {
      return await runTransaction(db, async (tx) => {
        observed = [];
        return work(tx, (snapshot) => observed.push(snapshot));
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'permission-denied' || attempt >= 7 || observed.length === 0) throw error;
      const fresh = await Promise.all(observed.map((snapshot) => getDocFromServer(snapshot.ref)));
      if (fresh.every((snapshot, index) => version(snapshot) === version(observed[index]))) throw error;
      await new Promise((resolve) => setTimeout(resolve, (20 + Math.random() * 60) * (attempt + 1)));
    }
  }
}

export async function saveFarmer(farmer: FarmerAccount) {
  validateMedia(farmer.introductionMedia || []);
  if (farmer.introductionContent) validateStoredStory(farmer.introductionContent);
  const user = await requireActiveFarmer();
  if (farmer.id !== user.uid) throw new Error('Bạn chỉ được chỉnh sửa vườn của mình.');
  if (!farmer.name.trim() || !isValidPhone(farmer.phone, 30) || !farmer.location.trim()) {
    throw new Error('Vui lòng nhập tên chủ vườn, số điện thoại và địa chỉ hợp lệ.');
  }
  if (!Number.isFinite(farmer.areaHa) || farmer.areaHa < 0 || !Number.isInteger(farmer.treeCount) || farmer.treeCount < 0) {
    throw new Error('Diện tích và số gốc cây không hợp lệ.');
  }
  const location = farmer.gardenLocation;
  if (!location || !Number.isFinite(location.lat) || Math.abs(location.lat) > 90 || !Number.isFinite(location.lng) || Math.abs(location.lng) > 180) {
    throw new Error('Vui lòng nhập tọa độ hợp lệ cho khu vườn.');
  }
  const db = requireDatabase();
  const ref = doc(db, 'farmerApplications', user.uid);
  const current = await getDoc(ref);
  if (current.data()?.status === 'suspended') throw new Error('Quyền đăng đang bị khóa. Vui lòng liên hệ quản trị.');
  if (farmer.applicationRevision !== undefined && farmer.applicationRevision !== (current.data()?.revision || 0)) throw new Error('Hồ sơ vừa thay đổi. Hãy mở lại trước khi gửi duyệt.');
  const oldIds: string[] = current.data()?.profile?.certificateIds || [];
  if (farmer.certificateIds && JSON.stringify(farmer.certificateIds) !== JSON.stringify(oldIds)) throw new Error('Danh sách chứng nhận vừa thay đổi. Hãy mở lại hồ sơ trước khi lưu.');
  const oldCertificates = await getDocs(collection(db, 'farmerApplications', user.uid, 'certificates'));
  const byId = new Map(oldCertificates.docs.map((snapshot) => [snapshot.id, snapshot.data()]));
  // Older callers that omit certificates preserve declarations already on file.
  const certificates = normalizeCertificates(farmer.certificates ?? oldIds.map((id) => byId.get(id)) as FarmerAccount['certificates']);
  const { certificates: _certificates, certificateIds: _certificateIds, applicationRevision: _revision, ...profile } = farmer;
  const batch = writeBatch(db);
  batch.set(ref, plain({ id: user.uid, email: user.email, profile: { ...profile, certificateIds: certificates.map((certificate) => certificate.id) },
    status: 'pending', revision: (current.data()?.revision || 0) + 1, submittedAt: Date.now(), reviewedAt: 0, reviewedBy: '', reviewNote: '' }));
  for (const certificate of certificates) batch.set(doc(db, 'farmerApplications', user.uid, 'certificates', certificate.id), plain(certificate));
  for (const snapshot of oldCertificates.docs) if (!certificates.some((certificate) => certificate.id === snapshot.id)) batch.delete(snapshot.ref);
  await batch.commit();
}

export async function saveProduce(product: ProduceItem, isNew = false) {
  const user = await requireApprovedFarmer();
  if (!product.name.trim() || !Number.isFinite(product.price) || product.price <= 0 || !Number.isInteger(product.inStock) || product.inStock < 0) {
    throw new Error('Tên, giá và số lượng tồn kho không hợp lệ.');
  }
  const db = requireDatabase();
  const profile = await getDoc(doc(db, 'farmers', user.uid));
  if (!profile.exists() || !profile.data().gardenLocation) throw new Error('Hãy khai báo và lưu vị trí khu vườn trước khi đăng bán.');
  const declared = product.farmerProfile.certificates;
  if (declared.length) {
    const ids: string[] = profile.data().certificateIds || [];
    const certificates = ids.length ? await getDocs(query(collection(db, 'farmers', user.uid, 'certificates'), where(documentId(), 'in', ids))) : null;
    const byId = new Map(certificates?.docs.map((snapshot) => [snapshot.id, snapshot.data()]) || []);
    if (JSON.stringify(normalizeCertificates(declared)) !== JSON.stringify(normalizeCertificates(ids.map((id) => byId.get(id)) as FarmerAccount['certificates']))) {
      throw new Error('Hồ sơ chứng nhận vừa thay đổi hoặc không thuộc vườn. Hãy mở lại bài đăng; khai báo chứng nhận tại hồ sơ nhà vườn.');
    }
  }
  // Only the farmer document owns declarations. Listings keep no stale copies.
  product = { ...product, farmerProfile: { ...product.farmerProfile, certificates: [] } };
  const ref = doc(db, 'products', product.id);
  if (isNew) {
    const value = plain({ ...product, ownerId: user.uid, createdAt: Date.now(), updatedAt: Date.now() });
    await runTransaction(db, async (tx) => {
      if ((await tx.get(ref)).exists()) throw new Error('Mã bài đăng đã tồn tại.');
      tx.set(ref, value);
    });
  } else {
    await runTransaction(db, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists() || current.data().ownerId !== user.uid) throw new Error('Bạn không có quyền sửa bài đăng này.');
      if (current.data().updatedAt !== product.updatedAt) throw new Error('Bài đăng hoặc tồn kho vừa thay đổi. Hãy đóng cửa sổ và mở lại trước khi lưu.');
      // Reject stale edits so reservations and cultivation history are not overwritten.
      tx.update(ref, plain({ ...product, ownerId: user.uid, createdAt: current.data().createdAt, updatedAt: Date.now() }));
    });
  }
}

export async function addProductLog(productId: string, logType: CultivationLogType, data: CultivationLogInput) {
  const user = await requireApprovedFarmer();
  const db = requireDatabase();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'products', productId);
    const current = await tx.get(ref);
    if (!current.exists() || current.data().ownerId !== user.uid) throw new Error('Không tìm thấy trái cây của nhà vườn.');
    const product = appendCultivationLog(current.data() as ProduceItem, logType, data);
    tx.update(ref, { cultivationLog: plain(product.cultivationLog), updatedAt: Date.now() });
  });
}

/** One private order per product, atomically reserves stock across the checkout. */
export async function placeOrders(cart: CartItem[], buyer: BuyerDetails, checkoutId: string): Promise<string[]> {
  const db = requireDatabase();
  validateBuyer(buyer);
  if (!auth) throw new Error('Chưa kết nối dịch vụ đặt hàng.');
  if (!auth.currentUser) await signInAnonymously(auth);
  const buyerId = auth.currentUser!.uid;
  return reserveOrders(db, buyerId, cart, buyer, checkoutId);
}

/** Shared checkout for an authenticated Firestore client. Rules check buyerId. */
export async function reserveOrders(db: Firestore, buyerId: string, cart: CartItem[], buyer: BuyerDetails, checkoutId: string): Promise<string[]> {
  validateBuyer(buyer);
  if (cart.length === 0 || cart.length > 5 || new Set(cart.map((line) => line.item.id)).size !== cart.length) {
    throw new Error('Mỗi lần đặt tối đa 5 loại trái cây khác nhau.');
  }
  const ids = cart.map(({ item }) => `${checkoutId}_${item.id}`);
  await inventoryTransaction(db, async (tx, watch) => {
    const refs = cart.map(({ item }) => doc(db, 'products', item.id));
    const orderRefs = ids.map((id) => doc(db, 'orders', id));
    const previous = await Promise.all(orderRefs.map((ref) => tx.get(ref)));
    if (previous.every((snap) => snap.exists() && snap.data().buyerId === buyerId)) return;
    if (previous.some((snap) => snap.exists())) throw new Error('Mã giao dịch đã được sử dụng. Vui lòng thử lại với giỏ hàng mới.');
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    snapshots.forEach(watch);
    const sellerIds = [...new Set(snapshots.map((snapshot) => snapshot.data()?.ownerId).filter(Boolean))] as string[];
    const states = await Promise.all([...new Set([buyerId, ...sellerIds])].map((uid) => tx.get(doc(db, 'farmerAccountStates', uid))));
    if (states.some((snapshot) => isAccountRestricted(snapshot.data() as FarmerAccountState | undefined))) throw new Error('Tài khoản người mua hoặc nhà vườn đã tạm dừng hoạt động. Đơn mới chưa được tạo.');
    const now = Date.now();
    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) throw new Error('Trái cây đã được gỡ khỏi sạp.');
      const item = snapshot.data() as ProduceItem;
      const quantity = cart[index].quantity;
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > item.inStock) throw new Error(`${item.name}: số lượng tồn kho không đủ.`);
      if (!item.ownerId) throw new Error('Trái cây chưa sẵn sàng nhận đơn.');
      if (item.price !== cart[index].item.price) throw new Error(`Giá ${item.name} vừa thay đổi. Vui lòng xem lại giỏ hàng.`);
      const order: FarmOrder = {
        id: ids[index], checkoutId, buyerId, sellerId: item.ownerId, productId: item.id, productName: item.name,
        unit: item.unit, unitPrice: item.price, quantity, total: item.price * quantity,
        buyer: { name: buyer.name.trim(), phone: buyer.phone.trim(), address: buyer.address.trim() },
        status: 'pending', createdAt: now, updatedAt: now, sellerNote: '',
      };
      tx.set(orderRefs[index], plain(order));
      tx.update(refs[index], { inStock: item.inStock - quantity, lastOrderId: ids[index], updatedAt: now });
    });
  });
  return ids;
}

export async function changeOrderStatus(orderId: string, status: OrderStatus, sellerNote: string) {
  const user = await requireActiveFarmer();
  const db = requireDatabase();
  await inventoryTransaction(db, async (tx, watch) => {
    const ref = doc(db, 'orders', orderId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Không tìm thấy đơn hàng.');
    const order = snap.data() as FarmOrder;
    if (order.sellerId !== user.uid || !canChangeOrderStatus(order.status, status)) throw new Error('Không thể chuyển trạng thái đơn hàng này.');
    if (sellerNote.length > 500) throw new Error('Ghi chú tối đa 500 ký tự.');
    if (status === 'cancelled') {
      const productRef = doc(db, 'products', order.productId);
      const product = await tx.get(productRef);
      watch(product);
      if (!product.exists()) throw new Error('Không tìm thấy trái cây để hoàn tồn kho.');
      tx.update(productRef, { inStock: product.data().inStock + order.quantity, lastOrderId: order.id, updatedAt: Date.now() });
    }
    tx.update(ref, { status, sellerNote: sellerNote.trim(), updatedAt: Date.now() });
  });
}

export async function saveTaskStatus(id: string, taskId: string, completed: boolean) {
  const user = await requireActiveFarmer();
  if (user.uid !== id) throw new Error('Không có quyền cập nhật.');
  await setDoc(doc(collection(requireDatabase(), 'farmers', id, 'tasks'), taskId), { completed });
}
