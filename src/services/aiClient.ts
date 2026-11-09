import { MAX_PROMPT_LENGTH, safeFarmerContext, validateDiagnosisResult, type ValidDiagnosis } from '../utils/aiValidation';
export type AiHistory = { role: 'user' | 'model'; text: string }[];
export function aiEndpoint(path: 'chat' | 'diagnosis') {
  const base = (import.meta.env?.VITE_AI_API_URL || '').trim().replace(/\/$/, '');
  if (base && !/^https:\/\//i.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base)) throw new Error('Địa chỉ dịch vụ AI chưa hợp lệ. Vui lòng liên hệ quản trị.');
  return `${base}/api/${path}`;
}
async function request(path: 'chat' | 'diagnosis', body: unknown, signal?: AbortSignal): Promise<any> {
  if (import.meta.env?.VITE_AI_PROVIDER === 'firebase') {
    const { requestFirebaseAi } = await import('./firebaseAi');
    return requestFirebaseAi(path, body, signal);
  }
  let response: Response;
  try {
    response = await fetch(aiEndpoint(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(55_000)]) : AbortSignal.timeout(55_000) });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error((error as Error).name === 'TimeoutError' ? 'AI phản hồi quá lâu. Vui lòng thử lại.' : 'Không kết nối được dịch vụ AI. Vui lòng kiểm tra mạng hoặc liên hệ quản trị.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Website chưa kết nối API AI. Vui lòng liên hệ quản trị để cấu hình dịch vụ.');
  let data: any;
  try { data = await response.json(); } catch { throw new Error('Dịch vụ AI trả dữ liệu không hợp lệ. Vui lòng thử lại.'); }
  if (!response.ok || data.success !== true) throw new Error(typeof data.error === 'string' ? data.error : 'AI chưa xử lý được yêu cầu. Vui lòng thử lại.');
  if (data.source !== 'gemini' || data.fallback || data.isOfflineKnowledge) throw new Error('Chưa nhận được kết quả từ mô hình AI thật. Vui lòng thử lại sau.');
  return data;
}
export async function askAi(prompt: string, history: AiHistory, farmer?: unknown, signal?: AbortSignal): Promise<{ reply: string; model: string }> {
  if (!prompt.trim() || prompt.trim().length > MAX_PROMPT_LENGTH) throw new Error(`Nhập câu hỏi từ 1 đến ${MAX_PROMPT_LENGTH} ký tự.`);
  const data = await request('chat', { prompt: prompt.trim(), history: history.slice(-12).map((m) => ({ ...m, text: m.text.slice(0,8000) })), currentFarmer: safeFarmerContext(farmer) }, signal);
  if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('AI chưa trả lời câu hỏi. Vui lòng thử lại.');
  return { reply: data.reply, model: data.model };
}
export async function diagnosePlant(input: { plantType: string; affectedPart: string; symptomsDescription: string; imageBase64?: string | null; mimeType?: string }, signal?: AbortSignal): Promise<{ diagnosis: ValidDiagnosis; advisory: string; model: string; inputMode: string }> {
  const data = await request('diagnosis', input, signal);
  const diagnosis = validateDiagnosisResult(data.diagnosis, input.plantType);
  if (!diagnosis) throw new Error('Kết quả AI không hợp lệ hoặc không khớp cây đã chọn. Vui lòng thử lại.');
  return { diagnosis, advisory: data.advisory, model: data.model, inputMode: data.inputMode };
}
