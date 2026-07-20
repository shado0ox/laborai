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
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regType, setRegType] = useState<'private' | 'sub'>('private');
  const [regBranch, setRegBranch] = useState('');
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
    const newTenantId = regType === 'private' ? `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` : undefined;

    const newUserObj: UserProfile = {
      uid: newUid,
      name: regName,
      email: regEmail,
      role: regType === 'private' ? 'admin' : 'branch', 
      branch: regType === 'sub' ? (regBranch || 'فرع الرياض الأساسي') : undefined,
      password: regPassword,
      status: 'pending',
      tenantId: newTenantId,
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

            {/* Developer Login Toggle Option */}
            <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 select-none">
              <label className="flex items-center gap-2 cursor-pointer text-right w-full">
                <input 
                  type="checkbox"
                  checked={isDeveloperMode}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsDeveloperMode(checked);
                  }}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-slate-950 border-slate-800 cursor-pointer"
                />
                <div className="flex flex-col text-right">
                  <span className="text-[11px] text-amber-500 font-black">دخول لوحة مطور النظام 💻</span>
                  <span className="text-[9px] text-slate-500">خاص بصيانة البرمجة وتفعيل المشتركين</span>
                </div>
              </label>
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

            {/* Account Isolation Space Selection */}
            <div className="space-y-2 border-t border-slate-900 pt-3">
              <label className="text-[11px] text-slate-400 font-bold block">تخصيص المساحة للتطبيق (برنامج مستقل):</label>
              
              <div className="space-y-1.5 grid grid-cols-1 select-none">
                <label className={`p-3 rounded-xl border flex flex-col text-right cursor-pointer transition-all ${regType === 'private' ? 'bg-amber-600/10 border-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="reg_type" 
                      checked={regType === 'private'} 
                      onChange={() => setRegType('private')} 
                      className="accent-amber-500 text-amber-500 scale-105" 
                    />
                    <span className="font-extrabold text-xs text-white">💼 مساحة خاصة مستقلة (برنامج خاص بك)</span>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 mr-5 font-normal">
                    تحصل على مساحة عمالة خاصة ومنفصلة كلياً عن عمالة المؤسسة، سيبدو البرنامج كأنه محفظتك لوحدك.
                  </span>
                </label>

                <label className={`p-3 rounded-xl border flex flex-col text-right cursor-pointer transition-all ${regType === 'sub' ? 'bg-amber-600/10 border-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="reg_type" 
                      checked={regType === 'sub'} 
                      onChange={() => setRegType('sub')} 
                      className="accent-amber-500 text-amber-500 scale-105" 
                    />
                    <span className="font-extrabold text-xs text-white">🏢 عضو ومسؤول فرع تحت المنشأة الأساسية</span>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 mr-5 font-normal">
                    تنضم كمشرف مساعد أو مشاهد يتم توجيه ومعالجة طلبك بواسطة المشرف شادي ناصف بمقر العمل الحالي.
                  </span>
                </label>
              </div>
            </div>

            {regType === 'sub' && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-100">
                <label className="text-[11px] text-slate-400 block font-bold">تحديد فرع المؤسسة المراد الإشراف عليه:</label>
                <select
                  value={regBranch}
                  onChange={(e) => setRegBranch(e.target.value)}
                  className="w-full bg-slate-900 text-white rounded-xl border border-slate-800 py-2 px-3 text-xs font-semibold focus:outline-none"
                >
                  <option value="فرع الرياض الأساسي">فرع الرياض الأساسي 🏢</option>
                  <option value="فرع جدة الغربية">فرع جدة الغربية 🌊</option>
                  <option value="فرع الدمام الشرقية">فرع الدمام الشرقية 🌴</option>
                  <option value="فرع مكة المكرمة">فرع مكة المكرمة 🕋</option>
                </select>
              </div>
            )}

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