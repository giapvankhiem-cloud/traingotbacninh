import { config } from 'dotenv';
import express from 'express';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { createAiRouter, readAiKey } from '../server/ai';
config({path:'.env.local',quiet:true});config({quiet:true});
if (!readAiKey(process.env.GEMINI_API_KEY)) {
  console.error('BLOCKED: Chưa có GEMINI_API_KEY trong môi trường server hoặc .env.local. Không thực hiện lời gọi Gemini.');process.exit(2);
}
const app=express();app.use(express.json({limit:'14mb'}));app.use('/api',createAiRouter());
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${(server.address() as any).port}`;
async function post(route:string,body:unknown){const response=await fetch(`${origin}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55_000)});const data=await response.json() as any;if(!response.ok||data.source!=='gemini')throw new Error(`${route}: HTTP ${response.status} ${data.code || ''} ${data.error || ''}`);return data;}
try {
  const chat=await post('chat',{prompt:'Tôi cần cung cấp những thông tin nào khi cây vải bị vàng lá? Trả lời ngắn gọn.'});
  console.log(`PASS chat: source=${chat.source}, model=${chat.model}, replyLength=${chat.reply?.length}`);
  const imagePath=process.argv.find(v=>v.startsWith('--image='))?.slice(8);
  let imageBase64:string,mimeType:string;
  if(imagePath){mimeType=({'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'} as Record<string,string>)[extname(imagePath).toLowerCase()];if(!mimeType)throw new Error('Ảnh kiểm thử cần JPG, PNG hoặc WebP.');imageBase64=(await readFile(imagePath)).toString('base64');}
  else {mimeType='image/png';imageBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4AWP4DwQACfsD/c8LaHIAAAAASUVORK5CYII=';}
  const diagnosis=await post('diagnosis',{plantType:'Vải thiều',affectedPart:'Lá',symptomsDescription:imagePath?'Phân tích ảnh, không khẳng định bệnh nếu thiếu dấu hiệu.':'Ảnh kiểm thử một pixel, không có cây. Hãy ghi rõ chưa đủ dữ liệu, không gán bệnh cụ thể.',imageBase64,mimeType});
  console.log(`PASS diagnosis: source=${diagnosis.source}, model=${diagnosis.model}, inputMode=${diagnosis.inputMode}, validStructuredResult=true`);
  console.log('Đây là kiểm tra kết nối/schema, không phải phép đo độ chính xác chẩn đoán.');
} catch(error) {console.error((error as Error).message);process.exitCode=1;}
finally {server.closeAllConnections();server.close();}
