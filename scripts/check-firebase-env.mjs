import { loadEnv } from 'vite';
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const missing = ['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_PUBLIC_SITE_URL'].filter((key) => !env[key]);
if (missing.length) throw new Error('Thiếu cấu hình Firebase: ' + missing.join(', ') + '. Điền .env.local trước khi triển khai.');
if (env.VITE_USE_FIREBASE_EMULATORS === 'true') throw new Error('Không được triển khai bản kết nối Emulator.');
const url = new URL(env.VITE_PUBLIC_SITE_URL);
if (url.protocol !== 'https:') throw new Error('VITE_PUBLIC_SITE_URL phải dùng HTTPS để tem QR hoạt động trên thiết bị khách.');
console.log('Cấu hình Firebase hợp lệ cho dự án ' + env.VITE_FIREBASE_PROJECT_ID);

if (env.VITE_AI_PROVIDER === 'firebase' && !env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?.trim()) throw new Error('Firebase AI Logic cần VITE_RECAPTCHA_ENTERPRISE_SITE_KEY trước khi triển khai.');
