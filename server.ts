import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAiRouter } from './server/ai';
const root = path.dirname(fileURLToPath(import.meta.url));
// Explicit environment variables (including empty test keys) always take precedence.
config({ path: path.join(root, '.env.local'), quiet: true });
config({ path: path.join(root, '.env'), quiet: true });
const app = express();
app.disable('x-powered-by');
const configuredPort = Number(process.env.PORT || 3000);
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3000;
const allowedOrigins = new Set((process.env.AI_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self)');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('Origin');
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin); res.vary('Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
  }
  next();
});
app.use(express.json({ limit: '14mb' }));
app.use('/api', createAiRouter());
app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'API không tồn tại.' }));
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  const large = error.type === 'entity.too.large';
  res.status(large ? 413 : error.type === 'entity.parse.failed' ? 400 : 500).json({ success: false, error: large ? 'Ảnh hoặc dữ liệu gửi lên quá lớn.' : error.type === 'entity.parse.failed' ? 'Dữ liệu gửi lên không phải JSON hợp lệ.' : 'Dịch vụ gặp lỗi. Vui lòng thử lại.' });
});
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ cacheDir: path.join(root, `node_modules/.vite-app-${port}`), server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(root, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
  }
  app.listen(port, '0.0.0.0', () => console.log(`Server running on port ${port}`));
}
start().catch(() => { console.error('Server failed to start.'); process.exitCode = 1; });
