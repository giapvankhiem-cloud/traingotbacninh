import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const environment = import.meta.env ?? (typeof process !== 'undefined' ? process.env : {});
const config = {
  apiKey: environment.VITE_FIREBASE_API_KEY,
  authDomain: environment.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: environment.VITE_FIREBASE_PROJECT_ID,
  appId: environment.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every((value) => typeof value === 'string' && value.length > 0);
export const firebaseApp = firebaseConfigured ? initializeApp(config) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;

if (environment.DEV && environment.VITE_USE_FIREBASE_EMULATORS === 'true' && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export function requireDatabase() {
  if (!db) throw new Error('Chưa kết nối Firebase. Vui lòng liên hệ quản trị website.');
  return db;
}

export function requireFarmer() {
  if (!auth?.currentUser || auth.currentUser.isAnonymous) throw new Error('Vui lòng đăng nhập tài khoản nhà vườn.');
  if (!auth.currentUser.emailVerified) throw new Error('Vui lòng xác minh email trước khi cập nhật vườn và đăng bán.');
  return auth.currentUser;
}
