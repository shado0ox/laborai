import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ArrowLeft, Building2, CheckCircle2, Eye, EyeOff, LoaderCircle, ShieldCheck, Users, Wallet } from 'lucide-react';

interface PortalAuthViewProps {
  onLoginSuccess: (user: UserProfile, token: string) => void;
  onRegisterSubmit: (newUser: UserProfile) => void;
  companyName: string;
  logoBase64?: string;
  dbStatusInfo: unknown;
  onRefreshDbStatus: () => Promise<void>;
}

export default function PortalAuthView({ onLoginSuccess, onRegisterSubmit, companyName, logoBase64 }: PortalAuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch(mode === 'login' ? '/api/auth/login' : '/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { email: email.trim().toLowerCase(), password } : {
          uid: crypto.randomUUID(), name: name.trim(), email: email.trim().toLowerCase(), password, role: 'admin'
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'تعذر تنفيذ الطلب. حاول مرة أخرى.'); return; }
      if (mode === 'login') onLoginSuccess(data.user, data.token);
      else { onRegisterSubmit(data.user); setRegistered(true); setPassword(''); }
    } catch { setError('تعذر الاتصال بالخادم. تحقق من الاتصال ثم حاول مرة أخرى.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-layout" dir="rtl">
      <section className="auth-story" aria-label="عن LaborAI">
        <div className="auth-brand"><Building2 size={26} aria-hidden="true" /><span translate="no">LaborAI</span></div>
        <div className="auth-story-content">
          <h1>ملفات العمالة.<br />متابعة واضحة كل يوم.</h1>
          <p>الإقامات والكفالات والتحصيلات في مكان واحد، لتعرف ما يحتاج إجراءً وما تم إنجازه.</p>
          <div className="auth-capabilities">
            <div><Users aria-hidden="true" /><span>ملف موحد لكل عامل</span></div>
            <div><ShieldCheck aria-hidden="true" /><span>متابعة انتهاء الإقامات</span></div>
            <div><Wallet aria-hidden="true" /><span>كشف المستحقات والمدفوعات</span></div>
          </div>
        </div>
        <p className="auth-story-footer">إدارة العمالة والفروع لشركات الاستقدام والخدمات</p>
      </section>
      <main className="auth-main" id="main-content">
        <div className="auth-form-panel">
          {logoBase64 && <img src={logoBase64} width="56" height="56" alt="شعار الشركة" className="auth-company-logo" />}
          <p className="auth-company-name">{companyName}</p>
          {registered ? (
            <div className="auth-success" role="status">
              <CheckCircle2 size={42} aria-hidden="true" />
              <h2>تم إرسال طلب التسجيل</h2>
              <p>حساب منشأتك بانتظار اعتماد الإدارة. يمكنك تسجيل الدخول بعد تفعيله.</p>
              <button className="auth-submit" onClick={() => { setRegistered(false); setMode('login'); }}>العودة لتسجيل الدخول</button>
            </div>
          ) : <>
            <h2>{mode === 'login' ? 'تسجيل الدخول' : 'تسجيل منشأة جديدة'}</h2>
            <p className="auth-description">{mode === 'login' ? 'أدخل بيانات حسابك للمتابعة إلى مساحة منشأتك.' : 'قدّم طلبًا لمساحة مستقلة لإدارة عمالة منشأتك.'}</p>
            <div className="auth-switch" aria-label="نوع الطلب">
              <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>تسجيل الدخول</button>
              <button type="button" aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>منشأة جديدة</button>
            </div>
            <form onSubmit={submit} className="auth-form" aria-busy={busy}>
              {mode === 'register' && <div><label htmlFor="auth-name">اسم المدير أو المنشأة</label><input id="auth-name" name="name" autoComplete="organization" required value={name} onChange={e => setName(e.target.value)} placeholder="اسم منشأتك…" /></div>}
              <div><label htmlFor="auth-email">البريد الإلكتروني</label><input id="auth-email" name="email" type="email" inputMode="email" autoComplete="username" spellCheck={false} dir="ltr" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" /></div>
              <div><label htmlFor="auth-password">كلمة المرور</label><div className="auth-password"><input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} aria-describedby={mode === 'register' ? 'password-hint' : undefined} /><button type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button></div>{mode === 'register' && <p id="password-hint" className="auth-hint">8 أحرف على الأقل. حسابات الفروع يضيفها مدير المنشأة من الداخل.</p>}</div>
              {error && <p role="alert" className="auth-error">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={19} aria-hidden="true" /> : <ArrowLeft size={19} aria-hidden="true" />}<span>{busy ? 'جارٍ تنفيذ الطلب…' : mode === 'login' ? 'تسجيل الدخول' : 'إرسال طلب التسجيل'}</span></button>
            </form>
            <p className="auth-help">تحتاج حسابًا لفرع قائم؟ تواصل مع مدير منشأتك.</p>
          </>}
        </div>
      </main>
    </div>
  );
}
