import React, { useState, useEffect } from 'react';
import { 
  Building, UserPlus, KeyRound, Mail, User, ShieldCheck, 
  Trash2, Edit3, CheckCircle, AlertCircle, RefreshCw, Layers,
  Calendar, Phone, Clock
} from 'lucide-react';
import { UserProfile } from '../types';

interface SpaceItem {
  tenantId: string;
  adminName: string;
  adminEmail: string;
  adminUid: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  companyName: string;
  activationDate?: string;
  expirationDate?: string;
  supportPhone?: string;
}

interface PortalSpacesViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  onUpdateUserStatus: (uid: string, status: 'approved' | 'rejected') => Promise<void>;
  onDeleteUser: (uid: string) => Promise<void>;
  toastNotice: (msg: string) => void;
  onRefreshUsers: () => Promise<void>;
}

export default function PortalSpacesView({
  currentUser,
  users,
  onUpdateUserStatus,
  onDeleteUser,
  toastNotice,
  onRefreshUsers
}: PortalSpacesViewProps) {
  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form states to create a new Space
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  
  // Subscription fields for creation
  const [activationDate, setActivationDate] = useState(new Date().toISOString().slice(0, 10));
  const [expirationDate, setExpirationDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [supportPhone, setSupportPhone] = useState('0500000000'); // Default demo support phone
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editing space details states
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState('');
  const [editingActivationDate, setEditingActivationDate] = useState('');
  const [editingExpirationDate, setEditingExpirationDate] = useState('');
  const [editingSupportPhone, setEditingSupportPhone] = useState('');

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = sessionStorage.getItem('authToken');
    const headers = {
      ...(options.headers || {}),
    } as Record<string, string>;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, {
      ...options,
      headers
    });
  };

  const fetchSpaces = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/admin/spaces');
      if (res.ok) {
        const data = await res.json();
        setSpaces(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Error fetching tenant spaces:', errData.error || res.status);
        toastNotice(`⚠️ تعذر تحميل مساحات المستخدمين: ${errData.error || `HTTP ${res.status}`}`);
      }
    } catch (err) {
      console.error('Error fetching tenant spaces:', err);
      toastNotice('⚠️ تعذر الاتصال بالخادم لتحميل مساحات المستخدمين.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, [users]);

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim() || !companyName.trim()) {
      toastNotice('⚠️ يرجى ملء جميع الحقول المطلوبة لإنشاء المساحة.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/admin/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword: adminPassword.trim(),
          companyName: companyName.trim(),
          activationDate,
          expirationDate,
          supportPhone
        })
      });

      if (res.ok) {
        toastNotice('🚀 تم إنشاء مساحة العمل الجديدة وتحديد تاريخ الاشتراك بنجاح!');
        setAdminName('');
        setAdminEmail('');
        setAdminPassword('');
        setCompanyName('');
        setActivationDate(new Date().toISOString().slice(0, 10));
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        setExpirationDate(d.toISOString().slice(0, 10));
        setSupportPhone('0500000000');
        await onRefreshUsers();
        await fetchSpaces();
      } else {
        const errData = await res.json();
        toastNotice(`❌ فشل في إنشاء المساحة: ${errData.error || 'خطأ غير معروف'}`);
      }
    } catch (err) {
      console.error('Error creating space:', err);
      toastNotice('❌ حدث خطأ غير متوقع أثناء الاتصال بالسيرفر.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSpaceDetails = async (tenantId: string) => {
    if (!editingCompanyName.trim()) return;
    try {
      const res = await authFetch('/api/admin/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_company',
          tenantId,
          companyName: editingCompanyName.trim(),
          activationDate: editingActivationDate,
          expirationDate: editingExpirationDate,
          supportPhone: editingSupportPhone
        })
      });

      if (res.ok) {
        toastNotice('✓ تم تحديث بيانات المنشأة وتفاصيل الاشتراك بنجاح.');
        setEditingSpaceId(null);
        await fetchSpaces();
      } else {
        toastNotice('❌ فشل تحديث بيانات المنشأة.');
      }
    } catch (err) {
      console.error('Error editing space details:', err);
    }
  };

  const handleRenewSubscription = async (tenantId: string, name: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في تجديد الاشتراك سنويًا لمساحة (${name})؟ سيتم تمديد تاريخ انتهاء الاشتراك لمدة عام كامل.`)) return;
    try {
      const res = await authFetch('/api/admin/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'renew_subscription',
          tenantId
        })
      });

      if (res.ok) {
        toastNotice('✓ تم تجديد الاشتراك السنوي بنجاح وإضافة سنة كاملة لتاريخ الانتهاء.');
        await fetchSpaces();
      } else {
        toastNotice('❌ فشل تجديد الاشتراك السنوي.');
      }
    } catch (err) {
      console.error('Error renewing subscription:', err);
      toastNotice('❌ حدث خطأ أثناء إرسال طلب التجديد.');
    }
  };

  const toggleSuspendAdmin = async (uid: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'approved' ? 'rejected' : 'approved';
    const msg = nextStatus === 'approved' ? 'تنشيط' : 'إيقاف وتعطيل';
    if (confirm(`هل أنت متأكد من رغبتك في ${msg} هذه المساحة؟`)) {
      await onUpdateUserStatus(uid, nextStatus);
      await fetchSpaces();
    }
  };

  const handleDeleteSpace = async (adminUid: string, company: string) => {
    if (confirm(`⚠️ تحذير شديد: هل أنت متأكد من حذف مساحة العمل الخاصة بـ (${company}) بالكامل؟ سيؤدي ذلك لحذف حساب المدير.`)) {
      await onDeleteUser(adminUid);
      await fetchSpaces();
    }
  };

  return (
    <div className="space-y-6" id="portal-spaces-view">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block">إجمالي مساحات العمل النشطة</span>
            <span className="text-2xl font-black text-slate-900">{spaces.length}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block">مدراء الأنظمة المرخصين</span>
            <span className="text-2xl font-black text-slate-900">
              {spaces.filter(s => s.status === 'approved').length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block">مساحات معلقة أو موقوفة</span>
            <span className="text-2xl font-black text-slate-900">
              {spaces.filter(s => s.status !== 'approved').length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Creation Form */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-fade-in">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-black text-[#002f56]">تسجيل منشأة وفتح مساحة جديدة</h3>
          </div>

          <form onSubmit={handleCreateSpace} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-bold block">اسم المنشأة أو الشركة</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <Building className="w-4 h-4" />
                </span>
                <input 
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="مؤسسة الفهد التجارية"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl py-2 px-9 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-bold block">اسم مدير النظام المسؤول</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input 
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="مثال: محمد العتيبي"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl py-2 px-9 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-bold block">البريد الإلكتروني للترخيص</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input 
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl py-2 px-9 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-bold block">تعيين كلمة المرور الآمنة</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input 
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl py-2 px-9 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            {/* Subscription Parameters */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <span className="text-[11px] font-black text-amber-600 block">إعدادات ترخيص واشتراك المساحة</span>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold block">تاريخ بدء وتفعيل الاشتراك</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input 
                    type="date"
                    required
                    value={activationDate}
                    onChange={(e) => setActivationDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl py-2 px-9 text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold block">تاريخ انتهاء الاشتراك</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                    <Clock className="w-4 h-4" />
                  </span>
                  <input 
                    type="date"
                    required
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl py-2 px-9 text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold block">رقم التواصل مع مطور النظام للدعم</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input 
                    type="text"
                    required
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="05xxxxxxx"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl py-2 px-9 text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-[#002f56] hover:bg-amber-600 text-white hover:text-slate-950 font-black rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء المساحة...</span>
                </>
              ) : (
                <>
                  <span>تأكيد فتح المساحة وتفعيل الاشتراك 🚀</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Spaces List Table */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-[#002f56]" />
              <h3 className="text-sm font-black text-[#002f56]">مساحات العمل والاشتراكات النشطة في المنظومة</h3>
            </div>
            <button
              onClick={fetchSpaces}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold">
                  <th className="py-2.5">اسم المنشأة والمساحة</th>
                  <th className="py-2.5">الاشتراك وصلاحية الخدمة</th>
                  <th className="py-2.5">مدير النظام (المشترك)</th>
                  <th className="py-2.5">الحالة</th>
                  <th className="py-2.5 text-left">التحكم والعمليات</th>
                </tr>
              </thead>
              <tbody>
                {spaces.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                      🚫 لا توجد مساحات عمل مخصصة حالياً. استخدم النموذج لفتح أول مساحة!
                    </td>
                  </tr>
                ) : (
                  spaces.map((s, index) => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const isExpired = s.expirationDate ? (s.expirationDate < todayStr) : false;
                    let daysRemaining: number | null = null;
                    if (s.expirationDate) {
                      const diffTime = new Date(s.expirationDate).getTime() - new Date(todayStr).getTime();
                      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }

                    const isEditing = editingSpaceId === s.tenantId;

                    return (
                      <tr key={s.adminUid || s.tenantId || index} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 font-semibold text-slate-950">
                          {isEditing ? (
                            <div className="space-y-1.5 max-w-[180px]">
                              <div>
                                <label className="text-[9px] text-slate-400 block font-bold">اسم المنشأة</label>
                                <input 
                                  type="text"
                                  value={editingCompanyName}
                                  onChange={(e) => setEditingCompanyName(e.target.value)}
                                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold focus:outline-none w-full"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{s.companyName}</span>
                                <button
                                  onClick={() => {
                                    setEditingSpaceId(s.tenantId);
                                    setEditingCompanyName(s.companyName);
                                    setEditingActivationDate(s.activationDate || '');
                                    setEditingExpirationDate(s.expirationDate || '');
                                    setEditingSupportPhone(s.supportPhone || '');
                                  }}
                                  className="text-slate-400 hover:text-amber-600 cursor-pointer"
                                  title="تعديل بيانات المساحة والاشتراك"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 block">{s.tenantId}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          {isEditing ? (
                            <div className="space-y-1.5 max-w-[180px]">
                              <div>
                                <label className="text-[9px] text-slate-400 block font-bold">تاريخ البدء</label>
                                <input 
                                  type="date"
                                  value={editingActivationDate}
                                  onChange={(e) => setEditingActivationDate(e.target.value)}
                                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none w-full"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-slate-400 block font-bold">تاريخ الانتهاء</label>
                                <input 
                                  type="date"
                                  value={editingExpirationDate}
                                  onChange={(e) => setEditingExpirationDate(e.target.value)}
                                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none w-full"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-slate-400 block font-bold">هاتف الدعم والمطور</label>
                                <input 
                                  type="text"
                                  value={editingSupportPhone}
                                  onChange={(e) => setEditingSupportPhone(e.target.value)}
                                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none w-full"
                                />
                              </div>
                              <div className="flex gap-1.5 pt-1">
                                <button
                                  onClick={() => handleSaveSpaceDetails(s.tenantId)}
                                  className="px-2 py-1 bg-emerald-500 text-white rounded text-[10px] font-bold hover:bg-emerald-600 cursor-pointer flex items-center gap-1"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>حفظ</span>
                                </button>
                                <button
                                  onClick={() => setEditingSpaceId(null)}
                                  className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-300 cursor-pointer"
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-slate-600 font-medium text-[11px]">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>البدء: <span className="font-semibold">{s.activationDate || 'غير محدد'}</span></span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-600 font-medium text-[11px]">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>الانتهاء: <span className="font-semibold">{s.expirationDate || 'غير محدد'}</span></span>
                              </div>
                              {s.supportPhone && (
                                <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                                  <Phone className="w-2.5 h-2.5 text-slate-400" />
                                  <span>هاتف المطور: <span className="font-semibold select-all">{s.supportPhone}</span></span>
                                </div>
                              )}
                              <div className="pt-1">
                                {isExpired ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-0.5 w-fit">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    موقف - منتهي الصلاحية!
                                  </span>
                                ) : daysRemaining !== null && daysRemaining <= 30 ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-0.5 w-fit animate-pulse">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    ينتهي قريباً (خلال {daysRemaining} يوم)
                                  </span>
                                ) : daysRemaining !== null ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 w-fit block">
                                    مفعل (باقي {daysRemaining} يوم)
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-slate-700">{s.adminName}</div>
                          <div className="text-[10px] text-slate-400 font-medium select-all">{s.adminEmail}</div>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.status === 'approved' && !isExpired
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {isExpired 
                              ? '✕ موقف لانتهاء الصلاحية' 
                              : s.status === 'approved' 
                                ? '✓ نشطة ومفعلة' 
                                : '✕ معطلة إدارياً'}
                          </span>
                        </td>
                        <td className="py-3 text-left space-y-1.5">
                          <div className="flex flex-col gap-1 items-stretch max-w-[110px]">
                            <button
                              onClick={() => toggleSuspendAdmin(s.adminUid, s.status)}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer text-center ${
                                s.status === 'approved'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              }`}
                            >
                              {s.status === 'approved' ? 'تعطيل الحساب' : 'تنشيط الحساب'}
                            </button>

                            <button
                              onClick={() => handleRenewSubscription(s.tenantId, s.companyName)}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer text-center flex items-center justify-center gap-0.5"
                              title="تمديد سنة كاملة تلقائياً"
                            >
                              <RefreshCw className="w-3 h-3 animate-hover" />
                              <span>تجديد سنوي ↺</span>
                            </button>

                            <button
                              onClick={() => handleDeleteSpace(s.adminUid, s.companyName)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded text-[10px] font-bold transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
                              title="حذف المساحة والمدير بالكامل"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>إزالة نهائية</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}