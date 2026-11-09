import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runFirebaseAiRequest,firebaseAiError,type FirebaseGenerate} from '../src/services/firebaseAi';
const sample={name:'Cần kiểm tra thêm',plant:'Vải thiều',confidence:0,severity:'Nhẹ',causes:'Chưa xác định',symptoms:['Lá vàng'],treatment:{biological:['Kiểm tra mặt dưới lá'],chemicalIfSevere:[],prevention:['Theo dõi cây']},expertAdvice:'Kiểm tra thực địa',isolationDays:0};
test('Firebase AI transport sends conversation roles and excludes private farmer fields',async()=>{
 let captured:any;const generate:FirebaseGenerate=async(request,structured)=>{captured=request;assert.equal(structured,false);return 'Kiểm tra rễ và thoát nước';};
 const result=await runFirebaseAiRequest('chat',{prompt:'Cần kiểm tra gì?',history:[{role:'user',text:'Cây vải vàng lá'},{role:'model',text:'Có ngập úng không?'}],currentFarmer:{name:'Vườn thử',email:'PRIVATE-EMAIL',certificates:['PRIVATE-PROOF']}},generate);
 assert.equal(result.source,'gemini');assert.equal(captured.contents.length,3);assert.deepEqual(captured.contents[0].parts,[{type:'text',text:'Cây vải vàng lá'}]);assert.doesNotMatch(JSON.stringify(captured),/PRIVATE-/);
});
test('Firebase AI image transport preserves image MIME/data and validates structured output',async()=>{
 let captured:any;const generate:FirebaseGenerate=async(request,structured)=>{captured=request;assert.equal(structured,true);return JSON.stringify(sample);};
 const result=await runFirebaseAiRequest('diagnosis',{plantType:'Vải thiều',affectedPart:'Lá',symptomsDescription:'',imageBase64:'data:image/jpeg;base64,/9j/4AAQ',mimeType:'image/jpeg'},generate);
 assert.equal(result.inputMode,'image');assert.equal(result.diagnosis?.confidence,0);assert.deepEqual(captured.contents[0].parts[0],{type:'inlineData',inlineData:{mimeType:'image/jpeg',data:'/9j/4AAQ'}});
});
for(const mode of ['wrongcrop','invalid','empty'])test(`Firebase AI ${mode} never becomes a successful diagnosis`,async()=>{
 const generate:FirebaseGenerate=async()=>mode==='wrongcrop'?JSON.stringify({...sample,plant:'Cam đường Canh'}):mode==='empty'?'':'broken json';
 await assert.rejects(runFirebaseAiRequest('diagnosis',{plantType:'Vải thiều',affectedPart:'Lá',symptomsDescription:'Lá cây có đốm màu vàng'},generate),/không hợp lệ/);
});
test('Firebase AI blocks insufficient input and fake image bytes before contacting provider',async()=>{
 let calls=0;const generate:FirebaseGenerate=async()=>{calls++;return '{}';};
 for(const input of [{plantType:'Vải thiều',affectedPart:'Lá',symptomsDescription:''},{plantType:'Vải thiều',affectedPart:'Lá',symptomsDescription:'',imageBase64:'aGVsbG8=',mimeType:'image/png'}])await assert.rejects(runFirebaseAiRequest('diagnosis',input,generate));
 assert.equal(calls,0);
});
test('Firebase AI passes cancellation to the SDK call and does not hide provider failure',async()=>{
 const controller=new AbortController();const generate:FirebaseGenerate=async(_request,_structured,signal)=>{assert.equal(signal,controller.signal);throw new Error('fixture unavailable');};
 await assert.rejects(runFirebaseAiRequest('chat',{prompt:'Cây vải vàng lá',history:[]},generate,controller.signal),/fixture unavailable/);
});

test('Firebase AI SDK serializes image/text to its gateway and parses real response format',async()=>{
 const {createServer}=await import('node:http');const {once}=await import('node:events');
 const {initializeApp,deleteApp}=await import('firebase/app');const {getAI,GoogleAIBackend,getGenerativeModel}=await import('firebase/ai');
 const {diagnosisSchema}=await import('../src/utils/aiProtocol');let captured:any;
 const gateway=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;captured={url:req.url,body:JSON.parse(raw)};res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(sample)}]},finishReason:'STOP'}]}));}).listen(0,'127.0.0.1');await once(gateway,'listening');
 const app=initializeApp({apiKey:'demo-key',projectId:'demo-ai-fixture',appId:'demo-app'},'firebase-ai-wire-fixture');
 try {
   const model=getGenerativeModel(getAI(app,{backend:new GoogleAIBackend()}),{model:'fixture-model',generationConfig:{responseMimeType:'application/json',responseJsonSchema:diagnosisSchema}},{baseUrl:`http://127.0.0.1:${(gateway.address() as any).port}`,timeout:1000});
   const generate:FirebaseGenerate=async(request,_structured,signal)=>(await model.generateContent(request,{signal})).response.text();
   const result=await runFirebaseAiRequest('diagnosis',{plantType:'Vải thiều',affectedPart:'Lá',symptomsDescription:'',imageBase64:'data:image/jpeg;base64,/9j/4AAQ',mimeType:'image/jpeg'},generate);
   assert.equal(result.diagnosis?.confidence,0);assert.match(captured.url,/fixture-model:generateContent/);assert.equal(captured.body.contents[0].parts[0].inlineData.data,'/9j/4AAQ');assert.equal(captured.body.generationConfig.responseMimeType,'application/json');assert.ok(captured.body.generationConfig.responseJsonSchema);
 } finally {await deleteApp(app);gateway.closeAllConnections();await new Promise<void>(r=>gateway.close(()=>r()));}
});

for (const error of [Object.assign(new Error('aborted'),{name:'AbortError',code:20}), Object.assign(new Error('timeout'),{name:'TimeoutError',code:23})]) test('Firebase AI numeric DOMException code becomes a readable timeout: '+error.name,()=>{assert.match(firebaseAiError(error).message,/phản hồi quá lâu/);});
test('Firebase AI maps quota errors without exposing provider details',()=>{const result=firebaseAiError({code:'AI/fetch-error',message:'429 RESOURCE_EXHAUSTED SECRET'});assert.match(result.message,/hết hạn mức/);assert.doesNotMatch(result.message,/SECRET/);});
