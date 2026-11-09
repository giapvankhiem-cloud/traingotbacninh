import assert from 'node:assert/strict';
import { before, after, afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
let server: ViteDevServer, dom: JSDOM, AiAssistantTab: any, DiagnosisTab: any;
let render: any, screen: any, fireEvent: any, waitFor: any, cleanup: any, act: any;
const originalFetch=globalThis.fetch;
const sample={name:'Chưa đủ dữ liệu xác nhận bệnh',plant:'Vải thiều',confidence:0,severity:'Nhẹ',causes:'Cần quan sát thêm',symptoms:['Lá vàng sau mưa'],treatment:{biological:['Kiểm tra thoát nước'],chemicalIfSevere:[],prevention:['Theo dõi thêm']},expertAdvice:'Kiểm tra thực địa',isolationDays:0};
const reply=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
before(async()=>{
  dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:4173'});
  for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','MutationObserver','Event','MouseEvent'])Object.defineProperty(globalThis,key,{configurable:true,value:(dom.window as any)[key]});
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:(fn:any)=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout});
  ({render,screen,fireEvent,waitFor,cleanup,act}=await import('@testing-library/react'));
  server = await createServer({
    configFile: false,
    envDir: '.tools/no-env',
    cacheDir: '.tools/vite-ai-ui',
    plugins: [react()],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    define: { 'import.meta.env.VITE_AI_API_URL': JSON.stringify('') },
  });
  ({AiAssistantTab}=await server.ssrLoadModule('/src/components/AiAssistantTab.tsx'));({DiagnosisTab}=await server.ssrLoadModule('/src/components/DiagnosisTab.tsx'));
});
afterEach(()=>{cleanup();globalThis.fetch=originalFetch;});
after(async()=>{await server?.close();dom?.window.close();});
const change=(label:string,text:string)=>fireEvent.change(screen.getByLabelText(label),{target:{value:text}});
test('chat sends real responses, remembers context and strips private fields before transport',async()=>{
  const bodies:any[]=[];globalThis.fetch=async(_url:any,init:any)=>{bodies.push(JSON.parse(init.body));return reply({success:true,source:'gemini',model:'fixture-model',reply:`Phản hồi thật ${bodies.length}`});};
  render(<AiAssistantTab currentFarmer={{name:'Vườn thử',phone:'PRIVATE-PHONE',email:'PRIVATE-EMAIL',certificates:['PRIVATE-PROOF']} as any}/>);
  change('Câu hỏi cho trợ lý AI','Cây vải bị vàng lá');fireEvent.click(screen.getByRole('button',{name:'Gửi câu hỏi'}));await screen.findByText('Phản hồi thật 1');
  change('Câu hỏi cho trợ lý AI','Cần kiểm tra gì tiếp?');fireEvent.click(screen.getByRole('button',{name:'Gửi câu hỏi'}));await screen.findByText('Phản hồi thật 2');
  assert.deepEqual(bodies[1].history,[{role:'user',text:'Cây vải bị vàng lá'},{role:'model',text:'Phản hồi thật 1'}]);assert.doesNotMatch(JSON.stringify(bodies),/PRIVATE-/);
});
test('chat locks quick prompts and Enter while pending; reset discards late responses',async()=>{
  let resolve:any,count=0;globalThis.fetch=()=>{count++;return new Promise(r=>{resolve=r;});};
  render(<AiAssistantTab/>);change('Câu hỏi cho trợ lý AI','Cây vải bị vàng lá');fireEvent.click(screen.getByRole('button',{name:'Gửi câu hỏi'}));
  fireEvent.keyDown(screen.getByLabelText('Câu hỏi cho trợ lý AI'),{key:'Enter'});fireEvent.click(screen.getByRole('button',{name:'Cách hãm lộc đông cho cây vải thiều khi trời ấm?'}));assert.equal(count,1);
  fireEvent.click(screen.getByTitle('Làm mới hội thoại'));
  await act(async()=>resolve(reply({success:true,source:'gemini',model:'fixture',reply:'Phản hồi đã bị hủy'})));assert.equal(screen.queryByText('Phản hồi đã bị hủy'),null);
});
for(const kind of ['html','unavailable','fallback'])test(`chat ${kind} displays an error and preserves the question for retry`,async()=>{
  globalThis.fetch=async()=>kind==='html'?new Response('<html>Hosting SPA</html>',{headers:{'Content-Type':'text/html'}}):kind==='unavailable'?reply({success:false,error:'Dịch vụ AI chưa được cấu hình'},503):reply({success:true,fallback:true,reply:'Bệnh giả'});
  render(<AiAssistantTab/>);change('Câu hỏi cho trợ lý AI','Cây cam vàng lá');fireEvent.click(screen.getByRole('button',{name:'Gửi câu hỏi'}));await screen.findByRole('alert');assert.equal(screen.getByLabelText('Câu hỏi cho trợ lý AI').value,'Cây cam vàng lá');assert.equal(screen.queryByText('Bệnh giả'),null);
});
test('diagnosis starts empty, preserves zero confidence and labels model and input mode',async()=>{
  globalThis.fetch=async()=>reply({success:true,source:'gemini',model:'fixture',inputMode:'symptoms',advisory:'Cần kiểm tra thực địa',diagnosis:sample});
  render(<DiagnosisTab/>);assert.ok(screen.getByText(/Chưa có kết quả/));assert.equal(screen.queryByText('Độ tin cậy AI'),null);
  change('Mô tả triệu chứng','Lá cây vàng sau mưa kéo dài');fireEvent.click(screen.getByRole('button',{name:'Tiến Hành Chẩn Đoán AI Ngay'}));await screen.findByText(sample.name);assert.ok(screen.getByText('0%'));assert.ok(screen.getByText(/Chỉ dựa trên mô tả/));assert.equal(screen.queryByText('Lưu Vào Nhật Ký Vườn'),null);
  change('Loại cây trồng','Cam đường Canh');assert.equal(screen.queryByText(sample.name),null);assert.ok(screen.getByText(/Chưa có kết quả/));
});
test('diagnosis failure never falls back to a sample disease or invented confidence',async()=>{
  globalThis.fetch=async()=>reply({success:false,error:'Hết hạn mức AI'},429);render(<DiagnosisTab/>);change('Loại cây trồng','Bưởi Diễn');change('Mô tả triệu chứng','Vỏ quả có đốm màu lạ');fireEvent.click(screen.getByRole('button',{name:'Tiến Hành Chẩn Đoán AI Ngay'}));await screen.findByRole('alert');assert.ok(screen.getByText(/Chưa có kết quả/));assert.equal(screen.queryByText('95%'),null);
});
test('changing input cancels analysis and ignores a stale diagnosis',async()=>{
  let resolve:any;globalThis.fetch=()=>new Promise(r=>{resolve=r;});render(<DiagnosisTab/>);change('Mô tả triệu chứng','Lá cây vàng sau mưa kéo dài');fireEvent.click(screen.getByRole('button',{name:'Tiến Hành Chẩn Đoán AI Ngay'}));change('Loại cây trồng','Nho');await act(async()=>resolve(reply({success:true,source:'gemini',model:'fixture',inputMode:'symptoms',diagnosis:sample})));assert.equal(screen.queryByText(sample.name),null);
});

test('uploaded image can be replaced after preview and is sent as image data',async()=>{
  const previousImage=(globalThis as any).Image, previousCreate=URL.createObjectURL, previousRevoke=URL.revokeObjectURL;
  const proto=dom.window.HTMLCanvasElement.prototype;const previousContext=proto.getContext,previousData=proto.toDataURL;
  const bodies:any[]=[];
  try {
    (globalThis as any).Image=class { width=100;height=100;onload:any;onerror:any;set src(_v:string){queueMicrotask(()=>this.onload());} };
    URL.createObjectURL=()=> 'blob:fixture';URL.revokeObjectURL=()=>{};
    proto.getContext=(()=>({drawImage(){}})) as any;proto.toDataURL=()=> 'data:image/jpeg;base64,/9j/4AAQ';
    globalThis.fetch=async(_url:any,init:any)=>{bodies.push(JSON.parse(init.body));return reply({success:true,source:'gemini',model:'fixture',inputMode:'image',diagnosis:sample});};
    render(<DiagnosisTab/>);
    const input=screen.getByLabelText('Ảnh cây trồng');
    fireEvent.change(input,{target:{files:[new dom.window.File(['photo'],'one.jpg',{type:'image/jpeg'})]}});
    await screen.findByText(sample.name);assert.equal(bodies[0].imageBase64,'data:image/jpeg;base64,/9j/4AAQ');
    assert.equal(screen.getByLabelText('Ảnh cây trồng'),input);
    let clicks=0;input.addEventListener('click',()=>{clicks++;});fireEvent.click(screen.getByRole('button',{name:'Đổi ảnh khác'}));assert.equal(clicks,1);
    fireEvent.change(input,{target:{files:[new dom.window.File(['photo2'],'two.png',{type:'image/png'})]}});
    await waitFor(()=>assert.equal(bodies.length,2));await screen.findByText(sample.name);
  } finally { (globalThis as any).Image=previousImage;URL.createObjectURL=previousCreate;URL.revokeObjectURL=previousRevoke;proto.getContext=previousContext;proto.toDataURL=previousData; }
});
test('a camera stream resolving after close is stopped instead of staying active',async()=>{
  const previous=Object.getOwnPropertyDescriptor(navigator,'mediaDevices');let resolve:any,stops=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(r=>{resolve=r;})}});
  try {
    render(<DiagnosisTab/>);fireEvent.click(screen.getByRole('button',{name:/Chụp bằng máy ảnh/}));fireEvent.click(screen.getByRole('button',{name:'Đóng máy ảnh'}));
    await act(async()=>resolve({getTracks:()=>[{stop:()=>{stops++;}}]}));assert.equal(stops,1);assert.equal(screen.queryByRole('button',{name:'Chụp Ngay'}),null);
  } finally { if(previous)Object.defineProperty(navigator,'mediaDevices',previous);else delete (navigator as any).mediaDevices; }
});
