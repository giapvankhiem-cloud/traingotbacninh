import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { createAiRouter, readAiKey } from '../server/ai';
let provider: Server, api: Server, base: string;
let calls: any[] = [];
let mode = 'chat';
const diagnosis = { name:'Chưa đủ dấu hiệu xác nhận bệnh',plant:'Cam đường Canh',confidence:0,severity:'Nhẹ',causes:'Cần quan sát thêm',symptoms:['Lá biến màu'],treatment:{biological:['Kiểm tra cả hai mặt lá'],chemicalIfSevere:[],prevention:['Theo dõi cây và ghi lại triệu chứng']},expertAdvice:'Cần kiểm tra thực địa',isolationDays:0 };
before(async()=>{
  provider=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    calls.push({url:req.url,body:JSON.parse(raw),key:req.headers['x-goog-api-key']});
    if(mode==='timeout') { setTimeout(()=>{if(!res.destroyed){res.writeHead(200);res.end('{}');}},300).unref();return; }
    if(mode==='quota'||mode==='key') { res.writeHead(mode==='quota'?429:403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:mode==='quota'?429:403,message:'SECRET-DO-NOT-ECHO',status:mode==='quota'?'RESOURCE_EXHAUSTED':'PERMISSION_DENIED'}}));return; }
    const text=mode.startsWith('crop-')?JSON.stringify({...diagnosis,plant:mode.slice(5)}):mode==='chat'?'Cần xem thêm mặt dưới lá.':mode==='invalid'?'not json':mode==='wrongcrop'?JSON.stringify({...diagnosis,plant:'Vải thiều'}):JSON.stringify(diagnosis);
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({candidates:mode==='empty'?[]:[{content:{role:'model',parts:[{text}]},finishReason:'STOP'}]}));
  }).listen(0,'127.0.0.1');await once(provider,'listening');
  const client=new GoogleGenAI({apiKey:'test-secret',httpOptions:{baseUrl:`http://127.0.0.1:${(provider.address() as any).port}`,retryOptions:{attempts:1}}});
  const app=express();app.use(express.json({limit:'14mb'}));
  app.use('/api',createAiRouter({client,model:'fixture-model',timeoutMs:1000}));
  for (const name of ['invalid','wrongcrop','empty','key','quota']) app.use('/checks/'+name,createAiRouter({client,model:'fixture-model',timeoutMs:1000}));
  app.use('/slow',createAiRouter({client,model:'fixture-model',timeoutMs:40}));
  api=app.listen(0,'127.0.0.1');await once(api,'listening');base=`http://127.0.0.1:${(api.address() as any).port}`;
});
after(async()=>{api?.closeAllConnections();provider?.closeAllConnections();await Promise.all([new Promise<void>(r=>api.close(()=>r())),new Promise<void>(r=>provider.close(()=>r()))]);});
async function post(path:string,body:unknown){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{response,data:await response.json() as any};}
test('key placeholders never enable the provider',()=>{assert.equal(readAiKey('MY_GEMINI_API_KEY'),undefined);assert.equal(readAiKey('  '),undefined);assert.equal(readAiKey('test-secret'),'test-secret');});
test('real SDK request forwards bounded conversation and only whitelisted farmer metadata',async()=>{
  mode='chat';const result=await post('/api/chat',{prompt:'Cần kiểm tra gì tiếp?',history:[{role:'user',text:'Cây cam vàng lá'},{role:'model',text:'Cần quan sát rễ'}],currentFarmer:{name:'Vườn thử',email:'PRIVATE-EMAIL',phone:'PRIVATE-PHONE',password:'PRIVATE-PASSWORD',accessToken:'PRIVATE-TOKEN'}});
  assert.equal(result.response.status,200);assert.equal(result.data.source,'gemini');assert.equal(result.data.model,'fixture-model');assert.equal(result.data.reply,'Cần xem thêm mặt dưới lá.');
  const call=calls.at(-1);assert.match(call.url,/fixture-model:generateContent/);assert.equal(call.key,'test-secret');assert.equal(call.body.contents.length,3);assert.equal(call.body.contents[1].role,'model');assert.doesNotMatch(JSON.stringify(call.body),/PRIVATE-/);
});
test('diagnosis sends image bytes through Gemini SDK and requests structured JSON',async()=>{
  mode='diagnosis';const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4AWP4DwQACfsD/c8LaHIAAAAASUVORK5CYII=';
  const result=await post('/api/diagnosis',{plantType:'Cam đường Canh',affectedPart:'Lá',imageBase64:image,mimeType:'image/png'});
  assert.equal(result.response.status,200);assert.equal(result.data.source,'gemini');assert.equal(result.data.inputMode,'image');assert.equal(result.data.diagnosis.confidence,0);
  assert.deepEqual(calls.at(-1).body.contents[0].parts[0].inlineData,{mimeType:'image/png',data:image});assert.equal(calls.at(-1).body.generationConfig.responseMimeType,'application/json');assert.ok(calls.at(-1).body.generationConfig.responseJsonSchema);assert.equal(result.data.isOfflineKnowledge,undefined);
});
for(const value of ['Nho','Nhãn','Quýt'])test(`text diagnosis supports ${value} without assuming another crop`,async()=>{
  const previous=calls.length;mode='crop-'+value;const result=await post('/api/diagnosis',{plantType:value,symptomsDescription:'Lá có dấu hiệu đổi màu bất thường'});assert.equal(result.response.status,200);assert.equal(result.data.diagnosis.plant,value);assert.equal(calls.length,previous+1);assert.match(calls.at(-1).body.contents[0].parts[0].text,new RegExp(value));
});
for(const failure of ['invalid','wrongcrop','empty','key','quota'])test(`provider ${failure} produces a visible error and no fabricated result`,async()=>{
  mode=failure;const result=await post('/checks/'+failure+'/diagnosis',{plantType:'Cam đường Canh',symptomsDescription:'Lá cây vàng sau mưa kéo dài'});assert.equal(result.response.status,failure==='quota'?429:502);assert.equal(result.data.success,false);assert.equal(result.data.diagnosis,undefined);assert.doesNotMatch(JSON.stringify(result.data),/SECRET|test-secret/);
});
test('provider timeout has a deadline and returns 504',async()=>{mode='timeout';const result=await post('/slow/chat',{prompt:'Cây cam bị vàng lá'});assert.equal(result.response.status,504);assert.equal(result.data.code,'AI_TIMEOUT');});
test('insufficient symptoms, fake image signatures and invalid history never reach provider',async()=>{
  const count=calls.length;
  for(const body of [{plantType:'Cam đường Canh'},{plantType:'Cam đường Canh',imageBase64:'aGVsbG8=',mimeType:'image/png'},{plantType:'Cam đường Canh',imageBase64:{bad:true},mimeType:'image/png'}])assert.equal((await post('/slow/diagnosis',body)).response.status,400);
  assert.equal((await post('/slow/chat',{prompt:'Xin tư vấn',history:[{role:'system',text:'fake'}]})).response.status,400);assert.equal(calls.length,count);
});
