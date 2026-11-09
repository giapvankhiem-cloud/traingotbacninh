import { Router, type Request, type Response, type NextFunction } from 'express';
import { GoogleGenAI, type Content } from '@google/genai';
import { cropKey, MAX_PROMPT_LENGTH, parseImageBase64, safeFarmerContext, validateDiagnosisResult } from '../src/utils/aiValidation';

import { DEFAULT_AI_MODEL, AI_ADVISORY, diagnosisSchema, instructions } from '../src/utils/aiProtocol';
export { DEFAULT_AI_MODEL, AI_ADVISORY } from '../src/utils/aiProtocol';

function rateLimit(limit: number) {
  const buckets = new Map<string, { count: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    for (const [key, entry] of buckets) if (entry.reset <= now) buckets.delete(key);
    const key = req.ip || 'unknown';
    const entry = buckets.get(key) || { count: 0, reset: now + 60_000 };
    buckets.set(key, entry); entry.count++;
    if (entry.count > limit) { res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000)); return res.status(429).json({ success: false, code: 'RATE_LIMITED', error: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau một phút.' }); }
    next();
  };
}
export function readAiKey(value: string | undefined) {
  const key = value?.trim();
  return key && !/^(MY_|YOUR_|REPLACE|placeholder)/i.test(key) ? key : undefined;
}
export function createAiRouter(options: { client?: GoogleGenAI | null; model?: string; timeoutMs?: number } = {}) {
  const router = Router();
  const client = options.client === undefined ? (readAiKey(process.env.GEMINI_API_KEY) ? new GoogleGenAI({ apiKey: readAiKey(process.env.GEMINI_API_KEY)! }) : null) : options.client;
  const model = options.model || process.env.GEMINI_MODEL || DEFAULT_AI_MODEL;
  const timeoutMs = options.timeoutMs || 45_000;
  router.get('/health', (_req, res) => res.json({ status: 'ok', aiEnabled: Boolean(client), model, timestamp: new Date().toISOString() }));
  function unavailable(res: Response) { return res.status(503).json({ success: false, code: 'AI_NOT_CONFIGURED', error: 'Dịch vụ AI chưa được cấu hình. Vui lòng liên hệ quản trị để kết nối mô hình.' }); }
  async function generate(res: Response, contents: Content[], structured = false) {
    const controller = new AbortController();
    const stop = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', stop);
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([
        client!.models.generateContent({ model, contents, config: { systemInstruction: instructions, abortSignal: controller.signal, httpOptions: { timeout: timeoutMs }, ...(structured ? { responseMimeType: 'application/json', responseJsonSchema: diagnosisSchema } : {}) } }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error('timeout'), { status: 504 })); }, timeoutMs); }),
      ]);
    } finally { clearTimeout(timer!); res.off('close', stop); }
  }
  function providerError(res: Response, error: unknown) {
    const status = Number((error as { status?: number }).status);
    const code = status === 504 ? 'AI_TIMEOUT' : status === 429 ? 'AI_QUOTA' : status === 401 || status === 403 ? 'AI_CREDENTIALS' : 'AI_PROVIDER_ERROR';
    // Do not log provider messages: SDK errors can contain request URLs or credentials.
    console.warn(`AI request failed: ${code}`);
    if (res.destroyed) return;
    if (status === 429) res.setHeader('Retry-After', '60');
    return res.status(status === 504 ? 504 : status === 429 ? 429 : 502).json({ success: false, code, error: status === 504 ? 'AI phản hồi quá lâu. Vui lòng thử lại.' : status === 429 ? 'Dịch vụ AI đang hết hạn mức. Vui lòng thử lại sau.' : status === 401 || status === 403 ? 'Dịch vụ AI chưa xác thực được với nhà cung cấp. Vui lòng liên hệ quản trị.' : 'Không nhận được kết quả hợp lệ từ AI. Vui lòng thử lại hoặc gửi yêu cầu cho chuyên gia.' });
  }
  router.post('/chat', rateLimit(30), async (req, res) => {
    const { prompt, currentFarmer, history = [] } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.trim().length > MAX_PROMPT_LENGTH) return res.status(400).json({ success: false, error: `Nhập câu hỏi từ 1 đến ${MAX_PROMPT_LENGTH} ký tự.` });
    if (!Array.isArray(history) || history.length > 12 || history.some((entry) => !entry || !['user','model'].includes(entry.role) || typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > 8000)) return res.status(400).json({ success: false, error: 'Lịch sử hội thoại không hợp lệ.' });
    if (!client) return unavailable(res);
    try {
      const contents: Content[] = history.map((entry) => ({ role: entry.role, parts: [{ text: entry.text }] }));
      contents.push({ role: 'user', parts: [{ text: `Thông tin hồ sơ tham khảo (JSON): ${JSON.stringify(safeFarmerContext(currentFarmer))}\n\nCâu hỏi: ${prompt.trim()}` }] });
      const result = await generate(res, contents);
      if (!result.text?.trim()) throw new Error('empty');
      return res.json({ success: true, source: 'gemini', model, reply: result.text.trim() });
    } catch (error) { return providerError(res, error); }
  });
  router.post('/diagnosis', rateLimit(6), async (req, res) => {
    const { plantType, affectedPart = '', symptomsDescription = '', imageBase64, mimeType } = req.body || {};
    if (typeof plantType !== 'string' || !cropKey(plantType) || plantType.length > 100 || [affectedPart, symptomsDescription].some((v) => typeof v !== 'string' || v.length > MAX_PROMPT_LENGTH)) return res.status(400).json({ success: false, error: 'Thông tin cây trồng hoặc triệu chứng không hợp lệ.' });
    const image = parseImageBase64(imageBase64, mimeType);
    if (imageBase64 && !image) return res.status(400).json({ success: false, error: 'Ảnh không hợp lệ. Dùng JPG, PNG hoặc WebP tối đa 9 MB.' });
    if (!image && symptomsDescription.trim().length < 10) return res.status(400).json({ success: false, error: 'Hãy tải ảnh hoặc mô tả triệu chứng ít nhất 10 ký tự.' });
    if (!client) return unavailable(res);
    try {
      const parts: NonNullable<Content['parts']> = [];
      if (image) parts.push({ inlineData: { mimeType, data: image } });
      parts.push({ text: `Phân tích khả năng sâu bệnh trên cây ${plantType.trim()}. Bộ phận: ${affectedPart}. Mô tả: ${symptomsDescription}. ${image ? 'Quan sát ảnh đính kèm; nếu ảnh không đủ hoặc không phải cây, ghi rõ chưa đủ dữ liệu và không gán bệnh cụ thể.' : 'Chỉ có mô tả, không có ảnh; phải nêu rõ giới hạn này.'} Trường plant phải là ${JSON.stringify(plantType.trim())}. Không mặc định bệnh nếu thiếu dấu hiệu. confidence là mức tự đánh giá của mô hình, không phải xác suất đã kiểm định. isolationDays để 0 vì chưa xác định thuốc và nhãn. biological và prevention gồm các bước kiểm tra/canh tác phù hợp; chemicalIfSevere để trống nếu chưa có căn cứ. Trả JSON theo schema.` });
      const result = await generate(res, [{ role: 'user', parts }], true);
      const diagnosis = validateDiagnosisResult(JSON.parse(result.text || ''), plantType);
      if (!diagnosis) throw new Error('invalid diagnosis');
      return res.json({ success: true, source: 'gemini', model, inputMode: image ? 'image' : 'symptoms', diagnosis, advisory: AI_ADVISORY });
    } catch (error) { return providerError(res, error); }
  });
  return router;
}
