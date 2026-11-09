import { cropKey, MAX_PROMPT_LENGTH, parseImageBase64, safeFarmerContext, validateDiagnosisResult } from '../utils/aiValidation';
import { AI_ADVISORY, DEFAULT_AI_MODEL, diagnosisSchema, instructions } from '../utils/aiProtocol';
import type { Content, GenerateContentRequest } from 'firebase/ai';
export type FirebaseGenerate = (request: GenerateContentRequest, structured: boolean, signal?: AbortSignal) => Promise<string>;
let initialized: Promise<FirebaseGenerate> | undefined;
async function initialize(): Promise<FirebaseGenerate> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?.trim();
  if (!siteKey) throw new Error('Dịch vụ AI chưa được cấu hình App Check. Vui lòng liên hệ quản trị.');
  const [{ firebaseApp }, sdk, check] = await Promise.all([import('../lib/firebase'), import('firebase/ai'), import('firebase/app-check')]);
  if (!firebaseApp) throw new Error('Website chưa được cấu hình Firebase.');
  check.initializeAppCheck(firebaseApp, { provider: new check.ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
  const service = sdk.getAI(firebaseApp, { backend: new sdk.GoogleAIBackend() });
  const modelName = import.meta.env.VITE_AI_MODEL || DEFAULT_AI_MODEL;
  const chat = sdk.getGenerativeModel(service, { model: modelName, systemInstruction: instructions }, { timeout: 45_000 });
  const vision = sdk.getGenerativeModel(service, { model: modelName, systemInstruction: instructions, generationConfig: { responseMimeType: 'application/json', responseJsonSchema: diagnosisSchema } }, { timeout: 45_000 });
  return async (request, structured, signal) => (await (structured ? vision : chat).generateContent(request, { signal })).response.text();
}
export async function runFirebaseAiRequest(path: 'chat' | 'diagnosis', body: any, generate: FirebaseGenerate, signal?: AbortSignal, model = DEFAULT_AI_MODEL) {
  let contents: Content[];
  if (path === 'chat') {
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_LENGTH) throw new Error('Câu hỏi không hợp lệ.');
    if (!Array.isArray(body.history) || body.history.length > 12 || body.history.some((m:any) => !m || !['user','model'].includes(m.role) || typeof m.text !== 'string' || !m.text.trim() || m.text.length > 8000)) throw new Error('Lịch sử hội thoại không hợp lệ.');
    contents = body.history.map((m:any) => ({ role:m.role, parts:[{type:'text',text:m.text}] }));
    contents.push({ role:'user', parts:[{type:'text',text:`Thông tin hồ sơ tham khảo (JSON): ${JSON.stringify(safeFarmerContext(body.currentFarmer))}\n\nCâu hỏi: ${body.prompt.trim()}`}] });
    const reply = await generate({contents}, false, signal);
    if (!reply?.trim()) throw new Error('AI chưa trả lời câu hỏi. Vui lòng thử lại.');
    return {success:true,source:'gemini',model,reply};
  }
  if (typeof body.plantType !== 'string' || body.plantType.length > 100 || !cropKey(body.plantType) || typeof body.symptomsDescription !== 'string' || body.symptomsDescription.length > MAX_PROMPT_LENGTH || typeof body.affectedPart !== 'string' || body.affectedPart.length > MAX_PROMPT_LENGTH) throw new Error('Thông tin cây trồng hoặc triệu chứng không hợp lệ.');
  const image = parseImageBase64(body.imageBase64, body.mimeType);
  if (body.imageBase64 && !image) throw new Error('Ảnh không hợp lệ. Dùng JPG, PNG hoặc WebP tối đa 9 MB.');
  if (!image && body.symptomsDescription.trim().length < 10) throw new Error('Hãy tải ảnh hoặc mô tả triệu chứng ít nhất 10 ký tự.');
  const parts: Content['parts'] = [];
  if (image) parts.push({type:'inlineData',inlineData:{mimeType:body.mimeType,data:image}});
  parts.push({type:'text',text:`Phân tích khả năng sâu bệnh trên cây ${body.plantType}. Bộ phận: ${body.affectedPart}. Triệu chứng: ${body.symptomsDescription}. ${image ? 'Quan sát ảnh, không gán bệnh nếu ảnh không rõ hoặc không phải cây.' : 'Không có ảnh, chỉ có mô tả; phải ghi rõ giới hạn này.'} Trường plant phải là ${JSON.stringify(body.plantType)}. confidence là mức tự đánh giá, không phải xác suất đã kiểm định. Không bịa bệnh hay liều thuốc. isolationDays để 0 vì chưa xác định thuốc/nhãn. biological và prevention gồm các bước kiểm tra/canh tác; chemicalIfSevere để trống khi chưa có căn cứ. Trả JSON theo schema.`});
  const text = await generate({contents:[{role:'user',parts}]}, true, signal);
  let diagnosis;
  try { diagnosis = validateDiagnosisResult(JSON.parse(text), body.plantType); } catch { /* Report an invalid result below. */ }
  if (!diagnosis) throw new Error('Kết quả AI không hợp lệ hoặc không khớp cây đã chọn. Vui lòng thử lại.');
  return {success:true,source:'gemini',model,inputMode:image?'image':'symptoms',diagnosis,advisory:AI_ADVISORY};
}
export async function requestFirebaseAi(path:'chat'|'diagnosis', body:unknown, signal?:AbortSignal) {
  try {
    // Keep the initializer promise even on failure to avoid duplicate App Check initialization.
    initialized ||= initialize();
    const generate = await initialized;
    return await runFirebaseAiRequest(path,body,generate,signal ? AbortSignal.any([signal,AbortSignal.timeout(55_000)]) : AbortSignal.timeout(55_000),import.meta.env.VITE_AI_MODEL||DEFAULT_AI_MODEL);
  } catch(error) {
    if (signal?.aborted) throw error;
    throw firebaseAiError(error);
  }
}

export function firebaseAiError(error: unknown): Error {
  const e = (error || {}) as { code?: unknown; message?: unknown; name?: string };
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message : '';
  if (['TimeoutError','AbortError'].includes(e.name || '')) return new Error('AI phản hồi quá lâu. Vui lòng thử lại.');
  if (code.startsWith('appCheck/') || code.startsWith('app-check/')) return new Error('Không xác minh được ứng dụng với App Check. Vui lòng tải lại trang hoặc liên hệ quản trị.');
  if (code.startsWith('AI/') || code.startsWith('ai/')) {
    if (/429|quota|RESOURCE_EXHAUSTED/i.test(message)) return new Error('Dịch vụ AI đang hết hạn mức. Vui lòng thử lại sau.');
    if (/403|401|PERMISSION_DENIED/i.test(message)) return new Error('Dịch vụ AI chưa được cấp quyền hoặc App Check chưa hợp lệ. Vui lòng liên hệ quản trị.');
    return new Error('Không nhận được kết quả từ Firebase AI. Vui lòng thử lại hoặc liên hệ quản trị.');
  }
  return error instanceof Error ? error : new Error('Dịch vụ AI gặp lỗi. Vui lòng thử lại.');
}
