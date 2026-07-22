import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import DefaultCompanyLogo from './DefaultCompanyLogo';
import {
  ShieldCheck, Mail, Lock, User, ArrowLeft,
  UserPlus, CheckCircle2, RefreshCw, Wifi, WifiOff
} from 'lucide-react';

interface PortalAuthViewProps {
  onLoginSuccess: (user: UserProfile, token: string) => void;
  onRegisterSubmit: (newUser: UserProfile) => void;
  companyName: string;
  logoBase64?: string;
  dbStatusInfo: {
    status: 'connected' | 'disconnected';
    host: string;
    port: number;
    user: string;
    database: string;
    error: string | null;
  } | null;
  onRefreshDbStatus: () => Promise<void>;
}

export default function PortalAuthView({
  onLoginSuccess,
  onRegisterSubmit,
  companyName,
  logoBase64,
  dbStatusInfo,
  onRefreshDbStatus
}: PortalAuthViewProps) {
  const [activeMode, setActiveMode] = useState<'login' | 'register'>('login');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshDbStatus();
    setIsRefreshing(false);
  };

  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register Form States
  // ملاحظة: التسجيل العام (بدون تسجيل دخول) أصبح مقتصراً على تسجيل شركة/منشأة جديدة تطلب
  // مساحة خاصة مستقلة فقط. تسجيل أعضاء ومسؤولي الفروع التابعين لمنشأة قائمة لا يتم إلا من
  // داخل لوحة تحكم مدير الشركة (مدير المساحة)، لأن قائمة الفروع الحقيقية تنتمي لمساحة/تينانت
  // محدد ولا يمكن للزائر غير المسجل معرفتها أو اختيار فرع وهمي.
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  // --- Cursor tracking / tilt refs (visual-only, no state churn) ---
  const stageRef = useRef<HTMLDivElement>(null);
  const latticeRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const tiltZoneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (cursorDotRef.current) {
      cursorDotRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
    if (spotlightRef.current) {
      spotlightRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
    if (latticeRef.current) {
      const nx = x / rect.width - 0.5;
      const ny = y / rect.height - 0.5;
      latticeRef.current.style.transform = `translate(${nx * 14}px, ${ny * 14}px)`;
    }
    if (tiltZoneRef.current && cardRef.current) {
      const cr = tiltZoneRef.current.getBoundingClientRect();
      const cx = e.clientX - (cr.left + cr.width / 2);
      const cy = e.clientY - (cr.top + cr.height / 2);
      const rotY = Math.max(-8, Math.min(8, (cx / cr.width) * 16));
      const rotX = Math.max(-8, Math.min(8, -(cy / cr.height) * 16));
      cardRef.current.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    }
  };

  const handleStageMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    const normEmail = loginEmail.trim().toLowerCase();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normEmail, password: loginPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || '❌ فشل تسجيل الدخول.');
        return;
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setLoginError('❌ حدث خطأ في الاتصال بالخادم. يرجى التحقق من اتصال الشبكة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const normEmail = regEmail.trim().toLowerCase();
    if (normEmail === 'shady.nasif@gmail.com') {
      alert('⚠️ خطأ أمني: لا يمكن تسجيل حساب بالبريد الإلكتروني الخاص بالمطور الرئيسي!');
      return;
    }

    if (!regName || !regEmail || !regPassword) {
      alert('يرجى ملء كافة الخانات المطلوبة.');
      return;
    }

    const newUid = `user_uid_${Date.now()}`;

    // التسجيل العام هنا مخصص فقط لمنشأة جديدة تحصل على مساحة خاصة مستقلة (تينانت جديد وحساب مدير).
    // الخادم هو من يحدد ويولّد tenantId الحقيقي بعد الاعتماد، لضمان عزل كل مساحة عن الأخرى.
    const newUserObj: UserProfile = {
      uid: newUid,
      name: regName,
      email: regEmail,
      role: 'admin',
      password: regPassword,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserObj)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '❌ فشل إرسال طلب تسجيل الحساب.');
        return;
      }

      onRegisterSubmit(newUserObj);
      setRegSuccess(true);

      // Clear registration fields
      setRegName('');
      setRegEmail('');
      setRegPassword('');
    } catch (err: any) {
      alert('❌ حدث خطأ أثناء الاتصال بالخادم لإرسال طلب التسجيل.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={stageRef}
      onMouseMove={handleStageMouseMove}
      onMouseLeave={handleStageMouseLeave}
      className="min-h-screen bg-[#0B1A30] flex flex-col items-center justify-center p-4 relative overflow-hidden"
      dir="rtl"
    >
      {/* Decorative arabesque lattice backdrop (parallax on cursor move) */}
      <div
        ref={latticeRef}
        className="absolute inset-0 pointer-events-none opacity-50 transition-transform duration-300 ease-out"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='46' height='46'%3E%3Cg transform='rotate(45 23 23)' fill='none' stroke='%23C9A24B' stroke-width='0.6' opacity='0.35'%3E%3Cpath d='M23 0 L46 23 L23 46 L0 23 Z'/%3E%3Ccircle cx='23' cy='23' r='3' fill='%23C9A24B' stroke='none' opacity='0.6'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '46px 46px'
        }}
      />

      {/* Ambient glows */}
      <div className="absolute top-[-15%] right-[-10%] w-[55%] h-[55%] bg-[#C9A24B]/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-15%] left-[-10%] w-[55%] h-[55%] bg-[#1e5a8c]/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Spotlight + cursor glow (desktop cursor-tracking effect) */}
      <div
        ref={spotlightRef}
        className="hidden md:block absolute top-0 left-0 w-[420px] h-[420px] rounded-full pointer-events-none will-change-transform"
        style={{ background: 'radial-gradient(circle, rgba(201,162,75,0.18), transparent 65%)' }}
      />
      <div
        ref={cursorDotRef}
        className="hidden md:block absolute top-0 left-0 w-2.5 h-2.5 rounded-full bg-[#E4C583] pointer-events-none will-change-transform z-10"
        style={{ boxShadow: '0 0 12px 3px rgba(228,197,131,0.6)' }}
      />

      <div ref={tiltZoneRef} className="w-full max-w-md relative z-10" style={{ perspective: '900px' }}>
        {/* Seal / official emblem */}
        <div className="flex flex-col items-center mb-4 select-none">
          <div
            className="w-16 h-16 rounded-full border-2 border-[#C9A24B] bg-[#0F2440] flex items-center justify-center p-2 overflow-hidden shadow-[0_0_0_6px_rgba(201,162,75,0.08)]"
            style={{ animation: 'portal-seal-in 0.7s cubic-bezier(.2,1.4,.4,1) forwards' }}
          >
            {logoBase64 ? (
              <img src={logoBase64} alt="شعار المؤسسة المعتمد" className="w-full h-full object-contain" />
            ) : (
              <DefaultCompanyLogo className="w-full h-full" />
            )}
          </div>
        </div>

        {/* Main Card */}
        <div
          ref={cardRef}
          className="relative bg-gradient-to-b from-[#132A4A] to-[#0F2140] border border-[#C9A24B]/40 rounded-[20px] p-7 shadow-[0_24px_60px_rgba(0,0,0,0.45)] overflow-hidden transition-transform duration-150 ease-out text-right"
          style={{ animation: 'portal-card-in 0.6s ease-out 0.25s forwards', opacity: 0 }}
        >
          {/* Holographic sheen sweep */}
          <div
            className="absolute top-0 -left-[60%] w-2/5 h-full pointer-events-none"
            style={{
              background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.10), transparent)',
              transform: 'skewX(-20deg)',
              animation: 'portal-sheen-sweep 2.6s ease-in-out infinite 1.2s'
            }}
          />

          {/* Company Identity / Header */}
          <div className="text-center mb-6 select-none">
            <h1 className="font-[var(--font-display)] font-extrabold text-xl text-[#F3EFE4] mb-1 tracking-wide">{companyName}</h1>
            <p className="text-[11px] text-[#8FA0BC] font-bold tracking-[2px] uppercase">بوابة الدخول الموثقة</p>
          </div>

          {/* Dynamic Mode Switch Tabs (Login vs Register) */}
          {!regSuccess && (
            <div className="grid grid-cols-2 bg-white/[0.04] p-1 rounded-xl border border-[#C9A24B]/25 gap-1 select-none mb-5">
              <button
                onClick={() => {
                  setActiveMode('login');
                  setLoginError(null);
                }}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer font-[var(--font-display)] ${activeMode === 'login' ? 'bg-gradient-to-br from-[#E4C583] to-[#C9A24B] text-[#1B1204] shadow-md' : 'text-[#8FA0BC] hover:text-[#F3EFE4]'}`}
              >
                تسجيل الدخول
              </button>
              <button
                onClick={() => {
                  setActiveMode('register');
                  setLoginError(null);
                }}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer font-[var(--font-display)] ${activeMode === 'register' ? 'bg-gradient-to-br from-[#E4C583] to-[#C9A24B] text-[#1B1204] shadow-md' : 'text-[#8FA0BC] hover:text-[#F3EFE4]'}`}
              >
                حساب جديد
              </button>
            </div>
          )}

          {/* 1. LOGIN MODE */}
          {activeMode === 'login' && !regSuccess && (
            <form onSubmit={handleLogin} className="space-y-4">

              <div className="space-y-1.5">
                <label className="text-[11px] text-[#8FA0BC] font-bold block">البريد الإلكتروني المعتمد</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#5E7191]">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-white/5 text-[#F3EFE4] border border-white/10 focus:border-[#C9A24B] rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none placeholder:text-[#5E7191] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-[#8FA0BC] font-bold block">كلمة المرور أو الرمز السري</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#5E7191]">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 text-[#F3EFE4] border border-white/10 focus:border-[#C9A24B] rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none placeholder:text-[#5E7191] transition-colors"
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-red-950/45 border border-red-900/30 text-rose-300 text-[11px] rounded-lg font-bold leading-normal">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-br from-[#E4C583] to-[#C9A24B] hover:brightness-110 text-[#1B1204] rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 mt-4 font-[var(--font-display)] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.97]"
              >
                <span>{isSubmitting ? 'جاري الدخول...' : 'دخول آمن'}</span>
                <ArrowLeft className="w-4 h-4" />
              </button>

            </form>
          )}

          {/* 2. REGISTER MODE */}
          {activeMode === 'register' && !regSuccess && (
            <form onSubmit={handleRegister} className="space-y-4">

              <div className="space-y-1.5">
                <label className="text-[11px] text-[#8FA0BC] font-bold block">الاسم بالكامل (أو اسم منشأتك)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#5E7191]">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="شادي ناصف أو مؤسسة التقنية"
                    className="w-full bg-white/5 text-[#F3EFE4] border border-white/10 focus:border-[#C9A24B] rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none placeholder:text-[#5E7191] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-[#8FA0BC] font-bold block">البريد الإلكتروني المعتمد لتلقي التنبيهات</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#5E7191]">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="w-full bg-white/5 text-[#F3EFE4] border border-white/10 focus:border-[#C9A24B] rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none placeholder:text-[#5E7191] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-[#8FA0BC] font-bold block">تعيين كلمة المرور الجديدة</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#5E7191]">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 text-[#F3EFE4] border border-white/10 focus:border-[#C9A24B] rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none placeholder:text-[#5E7191] transition-colors"
                  />
                </div>
              </div>

              {/* Account Isolation Space Info */}
              <div className="space-y-2 border-t border-white/10 pt-3">
                <div className="p-3 rounded-xl border bg-[#C9A24B]/10 border-[#C9A24B]/50 flex flex-col text-right">
                  <span className="font-extrabold text-xs text-[#F3EFE4] font-[var(--font-display)]">مساحة خاصة مستقلة (برنامج خاص بمنشأتك)</span>
                  <span className="text-[9px] text-[#8FA0BC] mt-1 font-normal leading-relaxed">
                    هذا التسجيل مخصص للمنشآت الجديدة فقط: ستحصل منشأتك على مساحة عمالة خاصة ومنفصلة كلياً، وسيتم تعيينك مديراً لها بعد الاعتماد.
                  </span>
                </div>

                <div className="p-3 rounded-xl border bg-white/[0.03] border-white/10 flex flex-col text-right">
                  <span className="font-extrabold text-[11px] text-[#C7D2E0] font-[var(--font-display)]">هل أنت عضو أو مسؤول فرع تابع لمنشأة قائمة؟</span>
                  <span className="text-[9px] text-[#8FA0BC] mt-1 font-normal leading-relaxed">
                    لا يتم تسجيل حسابات الفروع من هنا. يرجى التواصل مع مدير الشركة (مدير المساحة) الخاص بمنشأتك،
                    حيث يقوم هو فقط بإضافتك وتحديد فرعك الصحيح من داخل لوحة التحكم بعد تسجيل دخوله.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-br from-[#E4C583] to-[#C9A24B] hover:brightness-110 text-[#1B1204] font-bold rounded-xl text-xs shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 mt-2 font-[var(--font-display)] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.97]"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري الإرسال...' : 'تقديم طلب الحساب الجديد والاعتماد'}</span>
              </button>

            </form>
          )}

          {/* 3. REGISTRATION SUCCESS BUBBLE */}
          {regSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-800/60 p-5 rounded-2xl text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-slate-950">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="font-extrabold text-sm text-emerald-400 font-[var(--font-display)]">لقد تم تقديم طلب الاعتماد بنجاح!</h3>
                <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                  تم استلام وتسجيل بيانات حسابك بالخوادم بنجاح وجعلها <strong>⏳ بانتظار الاعتماد والموافقة</strong>.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/10 text-[10px] text-slate-300 leading-relaxed text-right space-y-1">
                <div className="text-white font-bold mb-1">• ما الذي يجب القيام به الآن؟</div>
                <p>1. يرجى إرسال إخطار لمدير البرنامج شادي ناصف بطلبك.</p>
                <p>2. عندما يقوم المدير بالدخول لحسابه الإداري وبقسم "طلبات التسجيل بالبوابة" الموافقة عليه، ستتمكن فوراً من تسجيل دخولك.</p>
              </div>

              <button
                onClick={() => {
                  setRegSuccess(false);
                  setActiveMode('login');
                }}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs cursor-pointer transition-colors w-full"
              >
                العودة لبوابة الدخول
              </button>
            </div>
          )}

          {/* DB connection status (subtle, uses existing dbStatusInfo/onRefreshDbStatus props) */}
          {dbStatusInfo && (
            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] text-[#8FA0BC] select-none">
              <div className="flex items-center gap-1.5">
                {dbStatusInfo.status === 'connected' ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>{dbStatusInfo.status === 'connected' ? 'متصل بقاعدة البيانات' : 'غير متصل بقاعدة البيانات'}</span>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 text-[#C9A24B] hover:text-[#E4C583] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
              </button>
            </div>
          )}

        </div>
      </div>

      <div className="text-[10px] text-slate-500 font-bold select-none mt-5 relative z-10 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-[#C9A24B]" />
        <span>تصميم وتطوير الأستاذ Shady Nassef © 2026</span>
      </div>

    </div>
  );
}
