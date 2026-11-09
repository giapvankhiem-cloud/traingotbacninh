import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createUserWithEmailAndPassword, getIdToken, reload, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
Object.assign(process.env, { VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-traingot.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'demo-traingot', VITE_FIREBASE_APP_ID: 'demo-app', VITE_USE_FIREBASE_EMULATORS: 'true', DEV: 'true' });
const { auth, db } = await import('../src/lib/firebase');
const service = await import('../src/services/consultations');
let env: RulesTestEnvironment;
const password = 'Consultation-Emulator-only-2026';
const id = 'consultation_test_00000001';
const profile = (uid='expert', status='active', internalAccount=false) => ({ id: uid, name: 'Người tư vấn kiểm thử', title: 'Chức danh thử nghiệm', organization: 'Đơn vị kiểm thử', specialties: 'Cây ăn quả', bio: '', phone: '', availability: '', active: status === 'active', status, internalAccount, updatedAt: 1, updatedBy: 'admin' });
const root = (expertId='expert') => ({ id, farmerId: 'owner', farmerName: 'Nhà vườn kiểm thử', subject: 'Cây vải bị vàng lá', question: 'Vườn vải bị vàng lá sau mưa lớn.', crop: 'Vải', expertId, expertName: expertId ? profile().name : 'Ban điều phối', status: 'waiting', revision: 1, messageCount: 1, lastMessage: 'Vườn vải bị vàng lá sau mưa lớn.', lastMessageId: 'initial', lastSenderRole: 'farmer', createdAt: 1, updatedAt: 1 });
const initial = () => ({ id: 'initial', senderId: 'owner', senderRole: 'farmer', senderName: root().farmerName, body: root().question, createdAt: 1 });
const context = (uid: string, claims={}) => env.authenticatedContext(uid, { email_verified: true, firebase: { sign_in_provider: 'password' }, ...claims }).firestore();
async function seed(expertId='expert') { await env.withSecurityRulesDisabled(async (ctx) => { const d=ctx.firestore(); await setDoc(doc(d,'consultationExperts','expert'),profile()); await setDoc(doc(d,'consultations',id),root(expertId)); await setDoc(doc(d,'consultations',id,'messages','initial'),initial()); await setDoc(doc(d,'farmerApplications','expert'),{id:'expert'}); }); }
async function account(admin=false, verified=true) {
  const email=`${crypto.randomUUID()}@example.test`; const {user}=await createUserWithEmailAndPassword(auth!,email,password);
  const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update',{ method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({ localId:user.uid,emailVerified:verified,customAttributes:JSON.stringify({admin}) })}); assert.equal(r.ok,true); await reload(user);await getIdToken(user,true);
  await env.withSecurityRulesDisabled(async (ctx)=>setDoc(doc(ctx.firestore(),'farmerApplications',user.uid),{id:user.uid,email,profile:{name:'Tài khoản kiểm thử'}}));
  return {uid:user.uid,email};
}
async function login(a: {email:string}) { await signInWithEmailAndPassword(auth!,a.email,password); }
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-traingot',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});});
beforeEach(async()=>{await signOut(auth!);await env.clearFirestore();});
after(async()=>{await signOut(auth!);await env.cleanup();const{deleteApp}=await import('firebase/app');await deleteApp(auth!.app);});

test('real accounts: create directly, persist, expert reply, realtime, owner reply, close and admin reopen',async()=>{
 const owner=await account(); const expert=await account(false,false); const admin=await account(true);
 await service.saveConsultationExpert({...profile(expert.uid,'active',true)});
 await login(owner); const requestId=await service.createConsultation({subject:'Vải vàng lá',question:'Vải có lá vàng sau mưa, cần chăm sóc thế nào?',crop:'Vải',expertId:expert.uid});
 const input={subject:'Vải vàng lá',question:'Vải có lá vàng sau mưa, cần chăm sóc thế nào?',crop:'Vải',expertId:expert.uid}; await service.createConsultation(input,requestId);
 assert.equal((await getDoc(doc(db!,'consultations',requestId))).data()?.messageCount,1);
 let data=(await getDoc(doc(db!,'consultations',requestId))).data()!;assert.equal(data.expertId,expert.uid);
 await login(expert);assert.equal((await getDocs(query(collection(db!,'consultations'),where('expertId','==',expert.uid)))).size,1);
 await login(expert); assert.equal(auth!.currentUser!.emailVerified,false);
 const delivered=new Promise<void>((resolve,reject)=>{let stop=()=>{};stop=onSnapshot(doc(db!,'consultations',requestId),(s)=>{if(s.data()?.messageCount===2){stop();resolve();}},reject);});
 await service.sendConsultationMessage(requestId,'Kiểm tra thoát nước và tình trạng rễ trước khi bón phân.','12345678901234567890');await delivered;
 await service.sendConsultationMessage(requestId,'Kiểm tra thoát nước và tình trạng rễ trước khi bón phân.','12345678901234567890');
 data=(await getDoc(doc(db!,'consultations',requestId))).data()!;assert.equal(data.messageCount,2);assert.equal(data.status,'in_progress');
 await login(owner);await service.sendConsultationMessage(requestId,'Tôi sẽ kiểm tra hệ thống thoát nước.');data=(await getDoc(doc(db!,'consultations',requestId))).data()!;await service.updateConsultation(requestId,data.revision,{status:'closed'});
 await assert.rejects(service.sendConsultationMessage(requestId,'Gửi sau khi đóng'),/kết thúc/);
 await assert.rejects(service.updateConsultation(requestId,data.revision+1,{status:'waiting'}),/không có quyền/);
 await login(admin);await service.updateConsultation(requestId,data.revision+1,{status:'waiting'});
 await login(owner);assert.equal((await getDocs(collection(db!,'consultations',requestId,'messages'))).size,3);
});

test('admin manages pending, active, suspended, revoked and restores; suspended expert cannot read or reply',async()=>{
 const expert=await account(false,false);const owner=await account();const admin=await account(true);
 for(const status of ['pending','active','suspended','revoked','active'] as const){await service.saveConsultationExpert({...profile(expert.uid,status,true)});assert.equal((await getDoc(doc(db!,'consultationExperts',expert.uid))).data()?.status,status);}
 await login(owner);const requestId=await service.createConsultation({subject:'Cây cam vàng lá',question:'Xin tư vấn chăm sóc cam sau mưa.',crop:'Cam',expertId:expert.uid});
 await login(admin);await service.saveConsultationExpert({...profile(expert.uid,'suspended',true)});
 await login(expert);await assertFails(getDoc(doc(db!,'consultations',requestId)));await assert.rejects(service.sendConsultationMessage(requestId,'Không được phép trả lời'),/xác nhận/);
 await login(owner);await assert.rejects(service.createConsultation({subject:'Cây cam vàng lá',question:'Xin tư vấn chăm sóc cam sau mưa.',crop:'Cam',expertId:expert.uid}),/tạm ngừng/);
});

test('placeholder expert cannot be activated; ordinary user cannot self approve',async()=>{
 const expert=await account();const admin=await account(true);await assert.rejects(service.saveConsultationExpert({...profile(expert.uid),name:'Chuyên gia 01'}),/Bổ sung tên thật/);
 await login(expert);await assert.rejects(service.saveConsultationExpert(profile(expert.uid) as any),/Chỉ quản trị/);
 await assertFails(setDoc(doc(db!,'consultationExperts',expert.uid),profile(expert.uid)));
});
for(const actor of ['guest','stranger','expert2'])test(`${actor} cannot read or list private requests/messages`,async()=>{
 await seed();const d=actor==='guest'?env.unauthenticatedContext().firestore():context(actor);
 await assertFails(getDoc(doc(d,'consultations',id)));await assertFails(getDocs(collection(d,'consultations')));await assertFails(getDoc(doc(d,'consultations',id,'messages','initial')));await assertFails(getDocs(collection(d,'consultations',id,'messages')));
});
for(const actor of ['owner','expert','admin'])test(`${actor} can read only authorized scope`,async()=>{
 await seed();const d=context(actor,actor==='admin'?{admin:true}:{});assert.equal((await getDoc(doc(d,'consultations',id))).exists(),true);
 const q=actor==='admin'?collection(d,'consultations'):query(collection(d,'consultations'),where(actor==='owner'?'farmerId':'expertId','==',actor));assert.equal((await getDocs(q)).size,1);
 assert.equal((await getDocs(collection(d,'consultations',id,'messages'))).size,1);
});
for(const status of ['pending','suspended','revoked'])test(`${status} expert denied even with a stale assignment`,async()=>{
 await seed();await env.withSecurityRulesDisabled(async(ctx)=>setDoc(doc(ctx.firestore(),'consultationExperts','expert'),profile('expert',status,true)));
 await assertFails(getDoc(doc(context('expert',{email_verified:false}),'consultations',id)));
});
test('trusted internal expert can read; unverified noninternal expert cannot',async()=>{
 await seed();const d=context('expert',{email_verified:false});await assertFails(getDoc(doc(d,'consultations',id)));
 await env.withSecurityRulesDisabled(async(ctx)=>updateDoc(doc(ctx.firestore(),'consultationExperts','expert'),{internalAccount:true}));assert.equal((await getDoc(doc(d,'consultations',id))).exists(),true);
});
for(const status of ['suspended','deleted'])test(`globally ${status} expert loses access even when expert profile active`,async()=>{
 await seed();await env.withSecurityRulesDisabled(async(ctx)=>setDoc(doc(ctx.firestore(),'farmerAccountStates','expert'),{status}));await assertFails(getDoc(doc(context('expert'),'consultations',id)));
});
test('unassigned expert cannot read even with active expert role',async()=>{
 await seed('');await assertFails(getDoc(doc(context('expert'),'consultations',id)));
});
test('messages cannot be forged, orphaned, edited, deleted or created without atomic summary update',async()=>{
 await seed();const d=context('owner');const message={...initial(),id:'12345678901234567890',body:'Giả danh chuyên gia',senderRole:'expert'};
 await assertFails(setDoc(doc(d,'consultations',id,'messages',message.id),message));await assertFails(updateDoc(doc(d,'consultations',id,'messages','initial'),{body:'Sửa lịch sử'}));await assertFails(deleteDoc(doc(d,'consultations',id,'messages','initial')));
 await assertFails(setDoc(doc(d,'consultations','missing_consultation_01','messages',message.id),{...message,senderRole:'farmer'}));
 await assertFails(updateDoc(doc(d,'consultations',id),{revision:2,messageCount:2,lastMessage:'Tin nhắn không tồn tại',lastMessageId:message.id}));
});
test('owner cannot alter participant, original question, admin role, counter or reopen closed case',async()=>{
 await seed();const d=context('owner');for(const patch of [{farmerId:'stranger'},{expertId:''},{question:'Sửa câu hỏi ban đầu'},{messageCount:20},{status:'in_progress'}])await assertFails(updateDoc(doc(d,'consultations',id),{...patch,revision:2}));
 await updateDoc(doc(d,'consultations',id),{status:'closed',revision:2,updatedAt:2});await assertFails(updateDoc(doc(d,'consultations',id),{status:'waiting',revision:3}));
});
test('request must contain the first message atomically; unverified account cannot create',async()=>{
 await seed();const newId='new_consultation_000001';await assertFails(setDoc(doc(context('owner'),'consultations',newId),{...root(),id:newId}));
 const d=context('owner',{email_verified:false});const batch=writeBatch(d);batch.set(doc(d,'consultations',newId),{...root(),id:newId});batch.set(doc(d,'consultations',newId,'messages','initial'),initial());await assertFails(batch.commit());
});
test('request validation and stale revisions fail without writes',async()=>{
 const owner=await account();await assert.rejects(service.createConsultation({subject:'x',question:'short',crop:'',expertId:''}),/Chủ đề/);
 await env.withSecurityRulesDisabled(async(ctx)=>setDoc(doc(ctx.firestore(),'consultationExperts','expert'),profile()));
 const requestId=await service.createConsultation({subject:'Xin tư vấn',question:'Cây cam có hiện tượng rụng quả.',crop:'Cam',expertId:'expert'});await assert.rejects(service.updateConsultation(requestId,0,{status:'closed'}),/vừa thay đổi/);
 await assert.rejects(service.createConsultation({subject:'Xin tư vấn',question:'Thay đổi nội dung yêu cầu cũ.',crop:'Cam',expertId:'expert'},requestId),/đã được sử dụng/);
 assert.equal((await getDocs(query(collection(db!,'consultations'),where('farmerId','==',owner.uid)))).size,1);
});

 test('direct requests require a chosen active expert in service and rules; admin cannot reroute',async()=>{
 await seed();await account();
 await assert.rejects(service.createConsultation({subject:'Xin tư vấn',question:'Cây vải bị vàng lá sau mưa.',crop:'Vải',expertId:''}),/chọn chuyên gia/);
 const d=context('owner');for(const expertId of ['', 'missing', 'owner']) {
 const newId='direct_request_'+String(expertId||'empty').padEnd(20,'0');const batch=writeBatch(d);batch.set(doc(d,'consultations',newId),{...root(expertId),id:newId});batch.set(doc(d,'consultations',newId,'messages','initial'),initial());await assertFails(batch.commit());
 }
 const admin=context('admin',{admin:true});await assertFails(updateDoc(doc(admin,'consultations',id),{expertId:'',expertName:'Ban điều phối',revision:2,updatedAt:2}));
 await env.withSecurityRulesDisabled(async(ctx)=>setDoc(doc(ctx.firestore(),'consultationExperts','expert2'),profile('expert2')));
 await assertFails(updateDoc(doc(admin,'consultations',id),{expertId:'expert2',expertName:profile().name,revision:2,updatedAt:2}));
 });
