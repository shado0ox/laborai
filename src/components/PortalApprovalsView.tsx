import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ShieldCheck, UserX, UserCheck, Trash2, Mail, Calendar, Shield, Building, Sparkles, UserCheck2, ClipboardList } from 'lucide-react';

interface PortalApprovalsViewProps {
  users: UserProfile[];
  onUpdateUserStatus: (uid: string, status: 'approved' | 'rejected') => void;
  onDeleteUser: (uid: string) => void;
  onUpdateUserRole: (uid: string, role: 'admin' | 'branch' | 'viewer', branch?: string) => void;
  branches: string[];
}

export default function PortalApprovalsView({
  users,
  onUpdateUserStatus,
  onDeleteUser,
  onUpdateUserRole,
  branches
}: PortalApprovalsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'branch' | 'viewer'>('branch');
  const [editBranch, setEditBranch] = useState<string>('');

  // Filter users
  const filteredUsers = users.filter(u => {
    // Exclude the default program manager so they don't accidentally edit or delete themselves
    if (u.email === 'shady.nasif@gmail.com') return false;

    // مطور البرنامج يرى فقط مدراء المساحات (المدراء الرئيسيين) ولا يرى المساعدين أو المشرفين الفرعيين للمساحة
    if (u.role !== 'admin') return false;

    if (activeSubTab === 'all') return true;
    if (activeSubTab === 'pending') return u.status === 'pending' || !u.status;
    return u.status === activeSubTab;
  });

  const getStatusBadge = (status?: string) => {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-850 border border-emerald-200';
    if (status === 'rejected') return 'bg-red-100 text-red-850 border border-red-200';
    return 'bg-amber-100 text-amber-850 border border-amber-200 animate-pulse';
  };

  const getStatusLabel = (status?: string) => {
    if (status === 'approved') return '✅ نشط ومفعّل';
    if (status === 'rejected') return '❌ شهادة مرفوضة';
    return '⏳ بانتظار الموافقة';
  };

  const handleStartEdit = (user: UserProfile) => {
    setEditingUid(user.uid);
    setEditRole(user.role);
    setEditBranch(user.branch || '');
  };

  const handleSaveRoleChange = (uid: string) => {
    onUpdateUserRole(uid, editRole, editRole === 'branch' ? editBranch : undefined);
    setEditingUid(null);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 font-bold block">إجمالي المسجلين بالبوابة</span>
            <span className="text-2xl font-black text-[#002f56]">{users.length} مستخدم</span>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
            <ClipboardList className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] text-amber-600 font-bold block">طلبات تنشيط معلقة</span>
            <span className="text-2xl font-black text-amber-650">{users.filter(u => u.status === 'pending' || !u.status).length} طلبات</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] text-[#007f5f] font-bold block">مساحات مستقلة نشطة</span>
            <span className="text-2xl font-black text-emerald-700">{users.filter(u => u.status === 'approved' && u.tenantId).length} مساحات</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 font-bold block">مستخدمين فرعيين مفعّلين</span>
            <span className="text-2xl font-black text-slate-700">
              {users.filter(u => u.status === 'approved' && !u.tenantId).length} أعضاء
            </span>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
            <UserCheck2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-sm">
        
        {/* Header Tabs */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-white space-y-1">
            <h3 className="font-extrabold text-sm flex items-center gap-1.5">
              <Shield className="text-amber-500 w-5 h-5" />
              <span>لوحة قرارات الموافقة وتفعيل العضويات الفردية والمساحات الخاصة</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">بصفتك المالك لبرنامج ليدجر، يمكنك فرز طلبات التسجيل المقدمة واعتماد تفعيلها فوراً أو مسحها.</p>
          </div>

          <div className="flex gap-1.5 bg-slate-950/40 p-1 rounded-xl">
            <button
              onClick={() => setActiveSubTab('pending')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'pending' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ⏳ طلبات معلقة ({users.filter(u => u.status === 'pending' || !u.status).length})
            </button>
            <button
              onClick={() => setActiveSubTab('approved')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'approved' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ✅ نشطين ({users.filter(u => u.status === 'approved' && u.email !== 'shady.nasif@gmail.com').length})
            </button>
            <button
              onClick={() => setActiveSubTab('rejected')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'rejected' ? 'bg-red-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ❌ طلبات مرفوضة ({users.filter(u => u.status === 'rejected').length})
            </button>
            <button
              onClick={() => setActiveSubTab('all')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'all' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              📂 الكل ({users.filter(u => u.email !== 'shady.nasif@gmail.com').length})
            </button>
          </div>
        </div>

        {/* Users List Table */}
        <div className="overflow-x-auto min-h-[250px]">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <UserX className="w-12 h-12 text-slate-300 stroke-[1.5]" />
              <p className="font-extrabold text-xs text-slate-500 mt-3">لا توجد طلبات لتسجيل بالبوابة في هذا الفرز</p>
              <p className="text-[10px] text-slate-400 mt-1">أي طلب حساب مع مساحة جديدة أو فرعية سيظهر هنا فور تقديمه من بوابة الدخول.</p>
            </div>
          ) : (
            <table className="w-full text-xs font-bold text-slate-700 divide-y divide-slate-100">
              <thead className="bg-slate-50/75 select-none">
                <tr>
                  <th className="px-5 py-3 text-right">صاحب الطلب / البريد الالكتروني</th>
                  <th className="px-5 py-3 text-center">نوع المساحة والتسجيل</th>
                  <th className="px-5 py-3 text-center">الصلاحيات المنظومة</th>
                  <th className="px-5 py-3 text-center">تاريخ تقديم الطلب</th>
                  <th className="px-5 py-3 text-center">الحالة الحالية</th>
                  <th className="px-5 py-3 text-center">قرارات وقرارات التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredUsers.map((user) => {
                  const isPending = user.status === 'pending' || !user.status;

                  return (
                    <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name and Email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center border border-slate-200 capitalize">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-850 block">{user.name}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 select-all">
                              <Mail className="w-3 h-3 text-slate-350" />
                              <span>{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Workspace and Space Isolation */}
                      <td className="px-5 py-4 text-center">
                        {user.tenantId ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              💼 مساحة خاصة مستقلة
                            </span>
                            <span className="text-[9px] text-slate-400 mt-1 select-all font-mono">
                              ID: {user.tenantId}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] bg-blue-500/10 text-blue-600 border border-blue-500/20">
                              🏢 عضو فرعي ببرنامج إدارة العمالة المهنية
                            </span>
                            <span className="text-[9px] text-slate-400 mt-1 font-normal">
                              الفرع: {user.branch || 'كامل الفروع'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Current Role and Permissions */}
                      <td className="px-5 py-4 text-center">
                        {editingUid === user.uid ? (
                          <div className="flex items-center gap-1.5 justify-center">
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value as any)}
                              className="bg-slate-50 border border-slate-250 py-1 px-2 rounded-md text-[11px] focus:outline-none"
                            >
                              <option value="admin">مدير فرعي</option>
                              <option value="branch">مشرف فرع</option>
                              <option value="viewer">مشاهد فقط</option>
                            </select>
                            
                            {editRole === 'branch' && (
                              <select
                                value={editBranch}
                                onChange={(e) => setEditBranch(e.target.value)}
                                className="bg-slate-50 border border-slate-250 py-1 px-2 rounded-md text-[11px] focus:outline-none"
                              >
                                {branches.map(b => (
                                  <option key={b} value={b}>{b}</option>
                                ))}
                              </select>
                            )}

                            <button
                              onClick={() => handleSaveRoleChange(user.uid)}
                              className="bg-[#002f56] text-white px-2 py-1 rounded text-[10px] hover:bg-slate-800"
                            >
                              حفظ
                            </button>
                            <button
                              onClick={() => setEditingUid(null)}
                              className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-[10px] hover:bg-slate-350"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <span className="text-slate-800">
                              {user.role === 'admin' ? 'مدير نظام 💻' : (user.role === 'branch' ? `مشرف فرع 🏢` : 'مشاهد👁️')}
                            </span>
                            {!user.tenantId && user.status === 'approved' && (
                              <button
                                onClick={() => handleStartEdit(user)}
                                className="text-[10px] text-sky-600 hover:underline mr-1 font-semibold"
                              >
                                (تعديل)
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Register date */}
                      <td className="px-5 py-4 text-center text-slate-450 font-mono text-[10px]">
                        <div className="inline-flex items-center gap-1 justify-center">
                          <Calendar className="w-3 h-3 text-slate-300" />
                          <span>{new Date(user.createdAt).toLocaleDateString('ar-SA')}</span>
                        </div>
                      </td>

                      {/* Current Approval Status */}
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${getStatusBadge(user.status)}`}>
                          {getStatusLabel(user.status)}
                        </span>
                      </td>

                      {/* Primary Actions */}
                      <td className="px-5 py-4 text-center">
                        <div className="flex gap-2 justify-center items-center">
                          
                          {isPending && (
                            <>
                              <button
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من رغبتك في قبول طلب حساب الموظف ${user.name} وتفعيله بالمنظومة؟`)) {
                                    onUpdateUserStatus(user.uid, 'approved');
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>قبول واعتماد</span>
                              </button>

                              <button
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من رغبتك في رفض طلب تسجيل الموظف ${user.name}؟`)) {
                                    onUpdateUserStatus(user.uid, 'rejected');
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer border border-rose-200"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>رفض الطلب</span>
                              </button>
                            </>
                          )}

                          {user.status === 'rejected' && (
                            <button
                              onClick={() => {
                                if (confirm(`هل تريد إعادة فتح حساب الموظف ${user.name} وقبوله كعضو رسمي بالمستودع؟`)) {
                                  onUpdateUserStatus(user.uid, 'approved');
                                }
                              }}
                              className="text-[11px] text-slate-600 hover:bg-slate-100 px-2 py-1 rounded border border-slate-200"
                            >
                              إعادة تفعيل الحساب
                            </button>
                          )}

                          {user.status === 'approved' && (
                            <button
                              onClick={() => {
                                if (confirm(`⚠️ تحذير!\nهل أنت متأكد من إلغاء تفعيل حساب ${user.name} وجعله مرفوضاً مؤقتاً؟`)) {
                                  onUpdateUserStatus(user.uid, 'rejected');
                                }
                              }}
                              className="text-[10px] text-red-600 hover:bg-red-50 py-1 px-2 rounded-lg font-bold"
                            >
                              إلغاء التفعيل ✕
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (confirm(`⚠️ إجراء نهائي!\nهل أنت متأكد تماماً من رغبتك في حذف طلب وتفاصيل الموظف ${user.name} نهائياً وبشكل كامل من سجلات البوابة؟`)) {
                                onDeleteUser(user.uid);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="حذف هذا الحساب بالكامل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer hints */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-[10px] text-slate-550 leading-relaxed font-semibold">
          💡 <strong>معلومة تقنية هامة:</strong> المنصة تفصل بيانات عمالة المسجلين مع "مساحة خاصة مستقلة" بشكل كلي. يقوم المتصفح بتوليد مفتاح تخزين منفصل باسم المعرّف (tenantId) الخاص بهذا المستخدم وتخزين مِلفّات عمالته بشكل خاص بالمتصفح، بحيث يعمل برنامج ليدجر الخاص به بشكل منفرد تماماً، كأنه برنامج مستقل مثبت خصيصاً له!
        </div>

      </div>

    </div>
  );
}
