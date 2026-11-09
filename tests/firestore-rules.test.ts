import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, documentId, getDoc, getDocs, onSnapshot, query, runTransaction, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { certificateFixture } from './fixtures/certificates';

let env: RulesTestEnvironment;
const location = { lat: 21.3, lng: 106.6, address: 'Vườn Chũ', commune: 'Chũ', altitudeM: 90, soilType: 'Đất đồi', waterSource: 'Giếng' };
function farmer(uid: string) {
  return { id: uid, name: uid, avatar: '', location: 'Vườn Chũ', shortLocation: 'Chũ', commune: 'Chũ', role: 'Chủ vườn', cropFocus: 'Vải', areaHa: 2, treeCount: 100, phone: '0901234567', pucCode: '', certification: 'Chưa chứng nhận', gardenLocation: location };
}
function product(id = 'p1', inStock = 20) {
  return { id, ownerId: 'seller', name: 'Vải thiều', price: 65000, inStock, unit: 'kg', category: 'lychee', image: '', description: 'Vải mới thu hoạch', certifications: [], farmerProfile: { certificates: [] }, location, cultivationLog: { watering: [], fertilizing: [], pestProtection: [] }, createdAt: 1, updatedAt: 1 };
}
function account(uid: string, verified = true) {
  return env.authenticatedContext(uid, { email: uid + '@example.test', email_verified: verified, admin: uid === 'reviewer', firebase: { sign_in_provider: 'password' } }).firestore();
}
async function reviewedProfile(profile: any, certificates: any[] = []) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'farmerApplications', profile.id), { id: profile.id, email: profile.id + '@example.test', profile,
      status: 'approved', revision: 1, submittedAt: 1, reviewedAt: 2, reviewedBy: 'reviewer', reviewNote: '' });
    for (const certificate of certificates) await setDoc(doc(context.firestore(), 'farmerApplications', profile.id, 'certificates', certificate.id), certificate);
  });
}
function order(id: string, buyerId = 'buyer', productId = 'p1', quantity = 2) {
  return { id, checkoutId: 'checkout', buyerId, sellerId: 'seller', productId, productName: 'Vải thiều', unit: 'kg', unitPrice: 65000, quantity, total: 65000 * quantity, buyer: { name: 'Khách mua', phone: '0901234567', address: 'Địa chỉ nhận hàng' }, status: 'pending', sellerNote: '', createdAt: 1, updatedAt: 1 };
}
async function checkout(buyerId: string, ids = ['p1'], quantity = 2, checkoutId = 'checkout') {
  const db = account(buyerId);
  return runTransaction(db, async (tx) => {
    const orderRefs = ids.map((id) => doc(db, 'orders', checkoutId + '_' + id));
    const previous = await Promise.all(orderRefs.map((ref) => tx.get(ref)));
    if (previous.every((snap) => snap.exists())) return;
    const refs = ids.map((id) => doc(db, 'products', id));
    const products = await Promise.all(refs.map((ref) => tx.get(ref)));
    products.forEach((snap, index) => {
      if (snap.data()!.inStock < quantity) throw new Error('insufficient stock');
      tx.set(orderRefs[index], order(orderRefs[index].id, buyerId, ids[index], quantity));
      tx.update(refs[index], { inStock: snap.data()!.inStock - quantity, lastOrderId: orderRefs[index].id, updatedAt: 2 });
    });
  });
}
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-traingot', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } }); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'farmers', 'seller'), farmer('seller'));
    for (const uid of ['seller','other']) await setDoc(doc(db, 'farmerApplications', uid), { id: uid, email: uid + '@example.test', profile: farmer(uid), status: 'approved', revision: 1, submittedAt: 1, reviewedAt: 2, reviewedBy: 'reviewer', reviewNote: '' });
    for (let index = 1; index <= 5; index++) await setDoc(doc(db, 'products', 'p' + index), product('p' + index));
  });
});
after(async () => { await env?.cleanup(); });

test('approved sellers can publish and reclassify mandarin, longan and grape products while unknown categories are rejected', async () => {
  const db = account('seller');
  for (const category of ['mandarin', 'longan', 'grape']) {
    const id = `fruit-${category}`;
    const ref = doc(db, 'products', id);
    await assertSucceeds(setDoc(ref, { ...product(id), category }));
    await assertSucceeds(updateDoc(doc(db, 'products', 'p1'), { category }));
    assert.equal((await getDoc(ref)).data()!.category, category);
  }
  await assertFails(setDoc(doc(db, 'products', 'unknown-fruit'), { ...product('unknown-fruit'), category: 'unknown' }));
  await assertFails(updateDoc(doc(db, 'products', 'p1'), { category: 'unknown' }));
});

test('only an admin publishes six reviewed certificate declarations and public readers see attachments', async () => {
  const certificates = ['VietGAP', 'GlobalGAP', 'OCOP', 'Hữu cơ', 'An toàn thực phẩm', 'Khác'].map((type, index) => certificateFixture({ id: `cert-${index}`, type: type as any, ...(type === 'OCOP' ? { ocopStars: 4 as const } : {}) }));
  const db = account('reviewer'); const batch = writeBatch(db);
  const ids = certificates.map((certificate) => certificate.id);
  await reviewedProfile({ ...farmer('seller'), certificateIds: ids }, certificates);
  batch.update(doc(db, 'farmers', 'seller'), { certificateIds: ids });
  certificates.forEach((certificate) => batch.set(doc(db, 'farmers', 'seller', 'certificates', certificate.id), certificate));
  await assertSucceeds(batch.commit());
  const publicDb = env.unauthenticatedContext().firestore();
  const publicCertificates = await getDocs(query(collection(publicDb, 'farmers', 'seller', 'certificates'), where(documentId(), 'in', ids)));
  assert.equal(publicCertificates.size, 6);
  assert.equal(publicCertificates.docs[0].data().documentImage, certificates[0].documentImage);
  await reviewedProfile({ ...farmer('seller'), certificateIds: [] });
  const remove = writeBatch(db); remove.update(doc(db, 'farmers', 'seller'), { certificateIds: [] });
  certificates.forEach((certificate) => remove.delete(doc(db, 'farmers', 'seller', 'certificates', certificate.id)));
  await assertSucceeds(remove.commit());
  await assertFails(getDoc(doc(publicDb, 'farmers', 'seller', 'certificates', ids[0])));
});

test('certificate write rules reject foreign/unverified accounts and forged verification status', async () => {
  const certificate = certificateFixture();
  await reviewedProfile({ ...farmer('seller'), certificateIds: [certificate.id] }, [certificate]);
  await updateDoc(doc(account('reviewer'), 'farmers', 'seller'), { certificateIds: [certificate.id] });
  await assertFails(setDoc(doc(account('intruder'), 'farmers', 'seller', 'certificates', certificate.id), certificate));
  await assertFails(setDoc(doc(account('seller', false), 'farmers', 'seller', 'certificates', certificate.id), certificate));
  await assertFails(setDoc(doc(account('reviewer'), 'farmers', 'seller', 'certificates', certificate.id), { ...certificate, verified: true }));
  await assertFails(setDoc(doc(account('seller'), 'farmers', 'seller', 'certificates', 'not-listed'), { ...certificate, id: 'not-listed' }));
});

test('certificate rules independently reject bad dates, dangerous links, excess files and private fields', async () => {
  const db = account('reviewer'); const profileRef = doc(db, 'farmers', 'seller');
  await reviewedProfile({ ...farmer('seller'), certificateIds: ['certificate-test-1'] }, [certificateFixture()]);
  await updateDoc(profileRef, { certificateIds: ['certificate-test-1'] });
  const ref = doc(db, 'farmers', 'seller', 'certificates', 'certificate-test-1');
  for (const patch of [{ issuedDate: '2026-02-29' }, { issuedDate: '2026-04-31' }, { expiryDate: '2024-01-01' }, { documentUrl: 'javascript:alert(1)' }, { documentUrl: 'https://user:password@example.test/a.pdf' }, { documentImage: 'data:image/svg+xml;base64,PHN2Zy8+' }, { documentImage: 'data:image/png;base64,' + 'A'.repeat(140000) }, { password: 'not-public' }]) {
    await reviewedProfile({ ...farmer('seller'), certificateIds: ['certificate-test-1'] }, [{ ...certificateFixture(), ...patch }]);
    await assertFails(setDoc(ref, { ...certificateFixture(), ...patch }));
  }
  await assertFails(updateDoc(profileRef, { certificateIds: Array.from({ length: 7 }, (_, index) => String(index)) }));
  assert.equal((await getDoc(ref)).exists(), false);
});

test('public traceability is readable and farmer profiles cannot contain passwords', async () => {
  const publicDb = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publicDb, 'products', 'p1')));
  await assertSucceeds(getDoc(doc(publicDb, 'farmers', 'seller')));
  await assertFails(updateDoc(doc(account('seller'), 'farmers', 'seller'), { password: 'do-not-store' }));
});
test('verified owners still need admin review for a public garden; only an approved owner edits produce', async () => {
  await assertFails(updateDoc(doc(account('intruder'), 'farmers', 'seller'), { name: 'Hacked' }));
  await assertFails(updateDoc(doc(account('seller', false), 'products', 'p1'), { price: 1 }));
  await assertFails(updateDoc(doc(account('intruder'), 'products', 'p1'), { price: 1 }));
  await assertFails(updateDoc(doc(account('seller'), 'farmers', 'seller'), { gardenLocation: { ...location, lat: 21.4 } }));
  await assertSucceeds(updateDoc(doc(account('seller'), 'products', 'p1'), { price: 70000 }));
});
test('order and reservation must be committed together; price cannot be forged', async () => {
  const db = account('buyer');
  await assertFails(setDoc(doc(db, 'orders', 'forged'), order('forged')));
  await assertFails(updateDoc(doc(db, 'products', 'p1'), { inStock: 18 }));
  const batch = writeBatch(db);
  batch.set(doc(db, 'orders', 'forged'), { ...order('forged'), unitPrice: 1, total: 2 });
  batch.update(doc(db, 'products', 'p1'), { inStock: 18, lastOrderId: 'forged', updatedAt: 2 });
  await assertFails(batch.commit());
});
test('checkout reserves five products atomically and retry does not duplicate stock deduction', async () => {
  await assertSucceeds(checkout('buyer', ['p1','p2','p3','p4','p5']));
  await assertSucceeds(checkout('buyer', ['p1','p2','p3','p4','p5']));
  assert.equal((await getDoc(doc(account('seller'), 'products', 'p1'))).data()!.inStock, 18);
});
test('orders expose buyer contact details only to the seller and that buyer', async () => {
  await checkout('buyer');
  await assertSucceeds(getDoc(doc(account('buyer'), 'orders', 'checkout_p1')));
  await assertSucceeds(getDocs(query(collection(account('seller'), 'orders'), where('sellerId', '==', 'seller'))));
  await assertFails(getDoc(doc(account('intruder'), 'orders', 'checkout_p1')));
  await assertFails(getDocs(collection(account('seller'), 'orders')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'orders', 'checkout_p1')));
});
test('only seller progresses an order, and cancellation requires stock restoration', async () => {
  await checkout('buyer');
  await assertFails(updateDoc(doc(account('buyer'), 'orders', 'checkout_p1'), { status: 'confirmed' }));
  const db = account('seller');
  await assertSucceeds(updateDoc(doc(db, 'orders', 'checkout_p1'), { status: 'confirmed', updatedAt: 3 }));
  await assertFails(updateDoc(doc(db, 'orders', 'checkout_p1'), { status: 'completed', updatedAt: 4 }));
  await assertFails(updateDoc(doc(db, 'orders', 'checkout_p1'), { status: 'cancelled', updatedAt: 4 }));
  const batch = writeBatch(db);
  batch.update(doc(db, 'orders', 'checkout_p1'), { status: 'cancelled', updatedAt: 4 });
  batch.update(doc(db, 'products', 'p1'), { inStock: 20, updatedAt: 4 });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(db, 'orders', 'checkout_p1'), { status: 'confirmed', updatedAt: 5 }));
});
test('concurrent buyers cannot buy more stock than exists', async () => {
  await updateDoc(doc(account('seller'), 'products', 'p1'), { inStock: 1 });
  const results = await Promise.allSettled([checkout('buyer-a', ['p1'], 1, 'a'), checkout('buyer-b', ['p1'], 1, 'b')]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal((await getDoc(doc(account('seller'), 'products', 'p1'))).data()!.inStock, 0);
});
test('another browser receives garden changes through a realtime listener', async () => {
  const publicDb = env.unauthenticatedContext().firestore();
  const observed = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { stop(); reject(new Error('Realtime update timed out')); }, 8000);
    const stop = onSnapshot(doc(publicDb, 'farmers', 'seller'), (snap) => {
      if (snap.data()?.gardenLocation.lat === 21.8) { clearTimeout(timeout); stop(); resolve(); }
    }, reject);
  });
  await reviewedProfile({ ...farmer('seller'), gardenLocation: { ...location, lat: 21.8 } });
  await updateDoc(doc(account('reviewer'), 'farmers', 'seller'), { gardenLocation: { ...location, lat: 21.8 } });
  await observed;
});

test('community posts, edits, likes and comments obey ownership and verification', async () => {
  const owner = account('seller'); const other = account('other');
  const post = { id: 'post1', ownerId: 'seller', author: 'Nhà vườn', content: 'Kinh nghiệm tưới nước', image: '', createdAt: 1 };
  await assertFails(setDoc(doc(account('seller', false), 'posts', 'post1'), post));
  await assertSucceeds(setDoc(doc(owner, 'posts', 'post1'), post));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'posts', 'post1')));
  await assertFails(updateDoc(doc(other, 'posts', 'post1'), { content: 'Sửa trái phép' }));
  await assertFails(updateDoc(doc(owner, 'posts', 'post1'), { ownerId: 'other' }));
  await assertSucceeds(updateDoc(doc(owner, 'posts', 'post1'), { content: 'Đã cập nhật kinh nghiệm' }));
  await assertSucceeds(setDoc(doc(other, 'posts', 'post1', 'likes', 'other'), { ownerId: 'other' }));
  await assertFails(setDoc(doc(other, 'posts', 'post1', 'likes', 'seller'), { ownerId: 'seller' }));
  await assertSucceeds(deleteDoc(doc(other, 'posts', 'post1', 'likes', 'other')));
  const comment = { id: 'c1', ownerId: 'other', author: 'Nhà vườn khác', text: 'Cảm ơn chia sẻ', createdAt: 2 };
  await assertSucceeds(setDoc(doc(other, 'posts', 'post1', 'comments', 'c1'), comment));
  await assertFails(setDoc(doc(other, 'posts', 'post1', 'comments', 'c2'), { ...comment, id: 'c2', ownerId: 'seller' }));
  await assertFails(deleteDoc(doc(other, 'posts', 'post1')));
  await assertSucceeds(deleteDoc(doc(owner, 'posts', 'post1')));
  await assertFails(setDoc(doc(other, 'posts', 'post1', 'comments', 'c3'), { ...comment, id: 'c3' }));
});

test('public profiles reject credential fields and oversized images; products reject invalid stock and certificates', async () => {
  const db = account('seller');
  for (const field of ['password', 'email', 'accessToken', 'refreshToken']) {
    await assertFails(updateDoc(doc(db, 'farmers', 'seller'), { [field]: 'private-value' }));
  }
  await assertFails(updateDoc(doc(db, 'farmers', 'seller'), { avatar: 'x'.repeat(70001) }));
  await assertFails(updateDoc(doc(db, 'products', 'p1'), { image: 'x'.repeat(150001) }));
  await assertFails(updateDoc(doc(db, 'products', 'p1'), { inStock: -1 }));
  await assertFails(updateDoc(doc(db, 'products', 'p1'), { price: 0 }));
  await assertFails(updateDoc(doc(db, 'products', 'p1'), { farmerProfile: { certificates: [{ verified: true }] } }));
});

test('private task completion cannot be read or overwritten by another account', async () => {
  await assertSucceeds(setDoc(doc(account('seller'), 'farmers', 'seller', 'tasks', 't1'), { completed: true }));
  await assertFails(getDoc(doc(account('intruder'), 'farmers', 'seller', 'tasks', 't1')));
  await assertFails(setDoc(doc(account('intruder'), 'farmers', 'seller', 'tasks', 't1'), { completed: false }));
  await assertFails(setDoc(doc(account('seller'), 'farmers', 'seller', 'tasks', 't1'), { completed: 'true' }));
  await assertFails(setDoc(doc(account('seller'), 'farmers', 'seller', 'tasks', 't1'), { completed: false, password: 'forbidden' }));
});

const mediaImage = {type:'image',url:'data:image/jpeg;base64,/9j/2Q==',caption:'Ảnh vườn'};
const mediaVideo = {type:'video',url:'https://www.youtube.com/watch?v=abcDEF123_-',caption:'Video vườn'};
test('garden media: mixed community gallery persists; invalid URLs, excess media and strangers are denied',async()=>{
 const post={id:'gallery',ownerId:'seller',author:'Nhà vườn',content:'Thăm vườn',image:'',media:Array.from({length:6},(_,i)=>i%2?{...mediaVideo,url:'https://example.test/garden.mp4'}:mediaImage),createdAt:1};
 await assertSucceeds(setDoc(doc(account('seller'),'posts','gallery'),post));
 assert.equal((await getDoc(doc(env.unauthenticatedContext().firestore(),'posts','gallery'))).data()!.media.length,6);
 for(const media of [[...Array(7).fill(mediaImage)],[{...mediaVideo,url:'javascript:alert(1)'}],[{...mediaVideo,url:'https://youtube.com.evil.test/watch?v=abcDEF123_-'}],[{...mediaImage,url:'data:image/svg+xml;base64,AA=='}],[{...mediaImage,caption:'x'.repeat(161)}]])await assertFails(setDoc(doc(account('seller'),'posts','invalid'),{...post,id:'invalid',media}));
 await assertFails(setDoc(doc(account('other'),'posts','forged'),{...post,id:'forged'}));
});
test('garden media: profile submission keeps evidence private until review; invalid evidence fails rules',async()=>{
 const base={id:'seller',email:'seller@example.test',profile:{...farmer('seller'),introductionMedia:[mediaImage,mediaVideo]},status:'pending',revision:2,submittedAt:3,reviewedAt:0,reviewedBy:'',reviewNote:''};
 await assertSucceeds(setDoc(doc(account('seller'),'farmerApplications','seller'),base));
 assert.equal((await getDoc(doc(account('seller'),'farmers','seller'))).data()!.introductionMedia,undefined);
 for(const media of [Array(7).fill(mediaImage),[{...mediaVideo,url:'http://example.com/v.mp4'}],[{...mediaImage,type:'html'}]])await assertFails(setDoc(doc(account('seller'),'farmerApplications','seller'),{...base,revision:3,profile:{...base.profile,introductionMedia:media}}));
 const reviewer=account('reviewer');const batch=writeBatch(reviewer);batch.update(doc(reviewer,'farmerApplications','seller'),{status:'approved',reviewedAt:4,reviewedBy:'reviewer'});batch.set(doc(reviewer,'farmers','seller'),base.profile);batch.set(doc(reviewer,'farmerApplications','seller','reviews','2-approved'),{revision:2,decision:'approved',reviewerId:'reviewer',reviewedAt:4,note:''});await assertSucceeds(batch.commit());
 assert.equal((await getDoc(doc(env.unauthenticatedContext().firestore(),'farmers','seller'))).data()!.introductionMedia.length,2);
});
test('inline introduction rules: compact ordered story validates every text and media item before publication',async()=>{
 const content={paragraphs:Array.from({length:7},(_,i)=>'Đoạn '+i),media:Array.from({length:6},(_,i)=>i%2?{...mediaVideo,url:'https://example.test/garden.mp4'}:mediaImage)};
 const base={id:'seller',email:'seller@example.test',profile:{...farmer('seller'),bio:'Trước ảnh\nSau ảnh\nKết thúc',introductionContent:{paragraphs:content.paragraphs,media:content.media.map(m=>(m.type==='image'?'i:':'v:')+m.url)}},status:'pending',revision:2,submittedAt:3,reviewedAt:0,reviewedBy:'',reviewNote:''};const owner=account('seller');
 await assertSucceeds(setDoc(doc(owner,'farmerApplications','seller'),base));
 for(const blocks of [[],{},42,'x'.repeat(650001),{paragraphs:['x','y'],media:['v:javascript:alert(1)']},{paragraphs:['x'.repeat(5001)],media:[]},{paragraphs:[42],media:[]},{paragraphs:['a','b'],media:['i:data:image/svg+xml;base64,AA==']}])await assertFails(setDoc(doc(owner,'farmerApplications','seller'),{...base,revision:3,profile:{...base.profile,introductionContent:blocks}}));
 const reviewer=account('reviewer'),batch=writeBatch(reviewer);batch.update(doc(reviewer,'farmerApplications','seller'),{status:'approved',reviewedAt:4,reviewedBy:'reviewer'});batch.set(doc(reviewer,'farmers','seller'),base.profile);batch.set(doc(reviewer,'farmerApplications','seller','reviews','2-approved'),{revision:2,decision:'approved',reviewerId:'reviewer',reviewedAt:4,note:''});await assertSucceeds(batch.commit());
 assert.deepEqual((await getDoc(doc(env.unauthenticatedContext().firestore(),'farmers','seller'))).data()!.introductionContent.media.map((b:string)=>b.startsWith('i:')?'image':'video'),content.media.map(b=>b.type));
});
test('inline introduction: admin cannot publish invalid staged story through a status-only review',async()=>{
 const profile={...farmer('seller'),introductionContent:{paragraphs:['a','b'],media:['v:javascript:alert(1)']}};
 await env.withSecurityRulesDisabled(async(ctx)=>setDoc(doc(ctx.firestore(),'farmerApplications','seller'),{id:'seller',email:'seller@example.test',profile,status:'pending',revision:2,submittedAt:3,reviewedAt:0,reviewedBy:'',reviewNote:''}));
 const reviewer=account('reviewer'),batch=writeBatch(reviewer);batch.update(doc(reviewer,'farmerApplications','seller'),{status:'approved',reviewedAt:4,reviewedBy:'reviewer'});batch.set(doc(reviewer,'farmers','seller'),profile);batch.set(doc(reviewer,'farmerApplications','seller','reviews','2-approved'),{revision:2,decision:'approved',reviewerId:'reviewer',reviewedAt:4,note:''});await assertFails(batch.commit());
 assert.equal((await getDoc(doc(reviewer,'farmers','seller'))).data()!.introductionContent,undefined);
});
async function seedNoticeExpert(uid='season-expert',active=true){await env.withSecurityRulesDisabled(async(ctx)=>setDoc(doc(ctx.firestore(),'consultationExperts',uid),{id:uid,name:'Người tư vấn mùa vụ thử',title:'Kỹ sư',organization:'Đơn vị kiểm thử',specialties:'Vải',bio:'',phone:'',availability:'',active,status:active?'active':'suspended',internalAccount:true,updatedAt:1,updatedBy:'reviewer'}));}
const seasonalNotice=(id='seasonal_notice_000001')=>({id,authorId:'season-expert',authorName:'Người tư vấn mùa vụ thử',title:'Lưu ý lịch canh tác',body:'Thông tin thử nghiệm cho lịch chăm sóc vườn.',crop:'lychee',from:'2026-11-01',until:'2026-11-30',published:true,createdAt:1,updatedAt:1});
test('seasonal notices: only active experts publish, identity and dates cannot be forged',async()=>{
 await seedNoticeExpert();const good=seasonalNotice();const expert=account('season-expert',false);
 await assertSucceeds(setDoc(doc(expert,'seasonalNotices',good.id),good));
 for(const uid of ['seller','reviewer','other'])await assertFails(setDoc(doc(account(uid),'seasonalNotices','seasonal_forbidden_001'),{...good,id:'seasonal_forbidden_001',authorId:uid}));
 for(const [i,patch] of [{authorName:'Giả danh'},{authorId:'seller'},{crop:'invalid'},{from:'2026-02-30'},{from:'2026-12-01'},{until:'2026-11-31'},{body:'x'},{published:false},{extra:'secret'}].entries()){const id='seasonal_bad_'+String(i).padStart(10,'0');await assertFails(setDoc(doc(expert,'seasonalNotices',id),{...good,id,...patch}));}
 await seedNoticeExpert('suspended-expert',false);await assertFails(setDoc(doc(account('suspended-expert'),'seasonalNotices','seasonal_suspended_001'),{...good,id:'seasonal_suspended_001',authorId:'suspended-expert'}));
});
test('seasonal notices: owner withdraws or republishes; other experts cannot change it and withdrawn content is private',async()=>{
 await seedNoticeExpert();await seedNoticeExpert('another-expert');const data=seasonalNotice(),expert=account('season-expert'),guest=env.unauthenticatedContext().firestore();
 await setDoc(doc(expert,'seasonalNotices',data.id),data);assert.equal((await getDocs(query(collection(guest,'seasonalNotices'),where('published','==',true)))).size,1);
 await assertFails(updateDoc(doc(account('another-expert'),'seasonalNotices',data.id),{published:false,updatedAt:2}));await assertFails(updateDoc(doc(expert,'seasonalNotices',data.id),{body:'Thay đổi trái quy trình'}));await assertFails(deleteDoc(doc(expert,'seasonalNotices',data.id)));
 await assertSucceeds(updateDoc(doc(expert,'seasonalNotices',data.id),{published:false,updatedAt:2}));await assertFails(getDoc(doc(guest,'seasonalNotices',data.id)));assert.equal((await getDocs(query(collection(guest,'seasonalNotices'),where('published','==',true)))).size,0);assert.equal((await getDoc(doc(expert,'seasonalNotices',data.id))).data()!.published,false);assert.equal((await getDocs(query(collection(expert,'seasonalNotices'),where('authorId','==','season-expert')))).size,1);
 await assertSucceeds(updateDoc(doc(expert,'seasonalNotices',data.id),{published:true,updatedAt:3}));
 await env.withSecurityRulesDisabled(async(ctx)=>setDoc(doc(ctx.firestore(),'farmerAccountStates','season-expert'),{status:'suspended'}));await assertFails(updateDoc(doc(expert,'seasonalNotices',data.id),{published:false,updatedAt:4}));
});
