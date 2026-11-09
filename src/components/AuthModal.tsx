import React, { useState } from 'react';
import { createUserWithEmailAndPassword, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { Eye, EyeOff, X } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { storedAssetUrl } from '../utils/assetUrl';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState(Boolean(auth?.currentUser && !auth.currentUser.isAnonymous && !auth.currentUser.emailVerified));
  function changeMode(next: 'login' | 'register' | 'reset') {
    setMode(next); setShowPassword(false); setMessage('');
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setShowPassword(false); setMessage('');
    try {
      if (!auth || !db) throw new Error('Website chưa được cấu hình kết nối Firebase.');
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage('Nếu email đã đăng ký, hướng dẫn khôi phục mật khẩu sẽ được gửi tới hộp thư.'); return;
      }
      if (mode === 'register' && !name.trim()) throw new Error('Vui lòng nhập họ và tên chủ vườn.');
      const credential = mode === 'register'
        ? await createUserWithEmailAndPassword(auth, email.trim(), password)
        : await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
      if (mode === 'register') {
        await updateProfile(credential.user, { displayName: name.trim() });
        const profile = {
          id: credential.user.uid, name: name.trim(), avatar: storedAssetUrl('/farmer-avatar.svg'),
          location: '', shortLocation: '', commune: '', role: 'Chủ nhà vườn', cropFocus: '',
          areaHa: 0, treeCount: 0, phone: '', pucCode: '', certification: 'Chưa chứng nhận',
        };
        await setDoc(doc(db, 'farmerApplications', credential.user.uid), { id: credential.user.uid, email: credential.user.email,
          profile, status: 'draft', revision: 1, submittedAt: 0, reviewedAt: 0, reviewedBy: '', reviewNote: '' });
        await sendEmailVerification(credential.user);
      }
      const internal = (await getDocFromServer(doc(db, 'consultationExperts', credential.user.uid))).data()?.internalAccount === true;
      if (!credential.user.emailVerified && !internal) {
        setVerification(true); setMessage('Hãy mở email xác minh tài khoản rồi bấm “Tôi đã xác minh”.');
      } else onClose();
    } catch (error) {
      const code = (error as { code?: string }).code;
      setMessage(code ? ({
        'auth/invalid-credential': 'Email hoặc mật khẩu chưa đúng.',
        'auth/email-already-in-use': 'Email đã đăng ký. Hãy đăng nhập hoặc khôi phục mật khẩu.',
        'auth/weak-password': 'Mật khẩu cần ít nhất 10 ký tự.',
        'auth/too-many-requests': 'Có quá nhiều yêu cầu. Vui lòng thử lại sau.',
        'auth/operation-not-allowed': 'Quản trị viên chưa bật phương thức đăng nhập này trên Firebase.',
      }[code] || 'Không thể xác thực. Vui lòng kiểm tra kết nối và thông tin đã nhập.') : (error as Error).message);
    } finally { setBusy(false); }
  }
  async function checkVerification() {
    if (!auth?.currentUser) return;
    setBusy(true);
    try {
      await reload(auth.currentUser); await auth.currentUser.getIdToken(true);
      if (auth.currentUser.emailVerified) onClose();
      else setMessage('Email chưa được xác minh. Hãy kiểm tra cả thư mục Spam.');
    } catch { setMessage('Chưa kiểm tra được email. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  return <div className="ui-dialog fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <form onSubmit={submit} className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl bg-white p-6 space-y-4 shadow-xl">
      <div className="ui-banner rounded-2xl px-4 py-2 flex justify-between items-center gap-2"><h2 id="auth-title" className="ui-section-title">{verification ? 'Xác minh tài khoản' : mode === 'register' ? 'Đăng ký nhà vườn' : mode === 'reset' ? 'Khôi phục mật khẩu' : 'Đăng nhập nhà vườn'}</h2><button type="button" onClick={onClose} aria-label="Đóng"><X /></button></div>
      {!verification && <>
        {mode === 'register' && <label className="block">Họ và tên<input required maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>}
        <label className="block">Email<input type="email" required autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
        {mode !== 'reset' && <div>
          <label htmlFor="auth-password" className="block">Mật khẩu</label>
          <div className="relative mt-1">
            <input id="auth-password" type={showPassword ? 'text' : 'password'} required minLength={mode === 'register' ? 10 : 1} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border p-3 pr-14" />
            <button type="button" disabled={busy} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} aria-controls="auth-password" title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(value => !value)} className="absolute right-1 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50">
              {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>}
        <button disabled={busy} className="ui-button-primary w-full p-3 disabled:opacity-50">{busy ? 'Đang xử lý…' : mode === 'register' ? 'Tạo tài khoản' : mode === 'reset' ? 'Gửi hướng dẫn' : 'Đăng nhập'}</button>
        <div className="flex flex-wrap justify-between gap-2 text-sm"><button type="button" onClick={() => changeMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Đã có tài khoản' : 'Đăng ký nhà vườn mới'}</button><button type="button" onClick={() => changeMode('reset')}>Quên mật khẩu?</button></div>
      </>}
      {verification && <div className="space-y-3"><p>Xác minh email, sau đó khai báo hồ sơ vườn và gửi quản trị duyệt trước khi đăng thông tin.</p><button type="button" disabled={busy} onClick={checkVerification} className="ui-button-primary w-full p-3">Tôi đã xác minh</button><button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await sendEmailVerification(auth!.currentUser!); setMessage('Đã gửi lại email xác minh.'); } catch { setMessage('Chưa gửi được email. Vui lòng thử lại sau.'); } finally { setBusy(false); } }}>Gửi lại email xác minh</button></div>}
      {message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    </form>
  </div>;
}
