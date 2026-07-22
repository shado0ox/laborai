import React, { useState } from 'react';
import { UserProfile } from '../types';
import DefaultCompanyLogo from './DefaultCompanyLogo';
import { 
  ShieldCheck, Mail, Lock, User, Sparkles, Building, KeyRound, 
  ArrowRight, UserPlus, FileText, CheckCircle2, RefreshCw, Database, Wifi, WifiOff, AlertTriangle 
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
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      
      {/* Decorative glowing backdrops */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] bg-[#002f56]/40 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main Core Auth Layout Container */}
      <div className="max-w-md w-full bg-slate-950/80 backdrop-blur-md rounded-3xl border border-slate-800 shadow-2xl p-6 relative z-10 text-right space-y-6">
        
        {/* Company Identity / Header Layout */}
        <div className="flex flex-col items-center space-y-3 mb-2 select-none">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center p-2.5 overflow-hidden shadow-inner">
            {logoBase64 ? (
              <img src={logoBase64} alt="شعار المؤسسة المعتمد" className="w-full h-full object-contain" />
            ) : (
              <DefaultCompanyLogo className="w-full h-full" />
            )}
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-lg font-black text-white tracking-wide">{companyName}</h1>
            <p className="text-[10px] text-slate-400 font-extrabold tracking-widest uppercase">بوابة الدخول والتفويض المشترك</p>
          </div>
        </div>

        {/* Dynamic Mode Switch Tabs (Login vs Register) */}
        {!regSuccess && (
          <div className="grid grid-cols-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800/80 gap-1 select-none">
            <button
              onClick={() => {
                setActiveMode('login');
                setLoginError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${activeMode === 'login' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              🔑 تسجيل الدخول بالمنفذ
            </button>
            <button
              onClick={() => {
                setActiveMode('register');
                setLoginError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${activeMode === 'register' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              📝 طلب حساب جديد مجاناً
            </button>
          </div>
        )}

        {/* 1. LOGIN MODE */}
        {activeMode === 'login' && !regSuccess && (
          <form onSubmit={handleLogin} className="space-y-4">
            
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-bold block">البريد الإلكتروني المعتمد</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input 
                  type="email" 
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-900/60 text-white border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-bold block">كلمة المرور أو الرمز السري</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type="password" 
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/60 text-white border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-red-950/45 border border-red-900/30 text-rose-350 text-[11px] rounded-lg font-bold leading-normal">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-slate-950 hover:text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 mt-4 text-[#0b2844]"
            >
              <span>تسجيل الدخول الآمن 🔒</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>

            {/* Quick Demo Accounts Hints */}

          </form>
        )}

        {/* 2. REGISTER MODE */}
        {activeMode === 'register' && !regSuccess && (
          <form onSubmit={handleRegister} className="space-y-4">
            
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-bold block">الاسم بالكامل (أو اسم منشأتك)</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="شادي ناصف أو مؤسسة التقنية"
                  className="w-full bg-slate-900/60 text-white border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-bold block">البريد الإلكتروني المعتمد لتلقي التنبيهات</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input 
                  type="email" 
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full bg-slate-900/60 text-white border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-bold block">تعيين كلمة المرور الجديدة</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type="password" 
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/60 text-white border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Account Isolation Space Info */}
            <div className="space-y-2 border-t border-slate-900 pt-3">
              <div className="p-3 rounded-xl border bg-amber-600/10 border-amber-500 flex flex-col text-right">
                <span className="font-extrabold text-xs text-white">💼 مساحة خاصة مستقلة (برنامج خاص بمنشأتك)</span>
                <span className="text-[9px] text-slate-400 mt-1 font-normal">
                  هذا التسجيل مخصص للمنشآت الجديدة فقط: ستحصل منشأتك على مساحة عمالة خاصة ومنفصلة كلياً، وسيتم تعيينك مديراً لها بعد الاعتماد.
                </span>
              </div>

              <div className="p-3 rounded-xl border bg-slate-900 border-slate-800 flex flex-col text-right">
                <span className="font-extrabold text-[11px] text-slate-300">🏢 هل أنت عضو أو مسؤول فرع تابع لمنشأة قائمة؟</span>
                <span className="text-[9px] text-slate-400 mt-1 font-normal leading-relaxed">
                  لا يتم تسجيل حسابات الفروع من هنا. يرجى التواصل مع مدير الشركة (مدير المساحة) الخاص بمنشأتك،
                  حيث يقوم هو فقط بإضافتك وتحديد فرعك الصحيح من داخل لوحة التحكم بعد تسجيل دخوله.
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-slate-950 font-black rounded-xl text-xs hover:text-white shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 mt-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>تقديم طلب الحساب الجديد والاعتماد 📝</span>
            </button>

          </form>
        )}

        {/* 3. REGISTRATION SUCCESS BUBBLE */}
        {regSuccess && (
          <div className="bg-[#122e20]/65 border border-emerald-800 p-5 rounded-2xl text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-slate-950">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-extrabold text-sm text-emerald-400">لقد تم تقديم طلب الاعتماد بنجاح!</h3>
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                تم استلام وتسجيل بيانات حسابك بالخوادم بنجاح وجعلها <strong>⏳ بانتظار الاعتماد والموافقة</strong>.
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 text-[10px] text-slate-450 leading-relaxed text-right space-y-1">
              <div className="text-white font-bold mb-1">• ما الذي يجب القيام به الآن؟</div>
              <p>1. يرجى إرسال اللفظ المعتمد أو توجيه إخطار لمدير البرنامج شادي ناصف بطلبك.</p>
              <p>2. عندما يقوم المدير بالدخول لحسابه الإداري وبقسم "طلبات التسجيل بالبوابة" الموافقة عليه، ستتمكن فوراً من تسجيل دخولك.</p>
            </div>

            <button
              onClick={() => {
                setRegSuccess(false);
                setActiveMode('login');
              }}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs cursor-pointer transition-colors w-full"
            >
              العودة لبوابة الدخول 🔒
            </button>
          </div>
        )}



      </div>

      <div className="text-[10px] text-slate-550 font-bold select-none mt-4">
        تصميم وتطوير الأستاذ Shady Nassef © 2026
      </div>

    </div>
  );
}