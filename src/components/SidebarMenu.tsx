import React from 'react';
import { 
  BarChart3, Users, AlertTriangle, Coins, CalendarDays, 
  Archive, Settings, HelpCircle, LogOut, ShieldAlert, Building, ShieldCheck
} from 'lucide-react';
import { UserProfile } from '../types';

interface SidebarMenuProps {
  companyName: string;
  logoBase64?: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserProfile;
  onChangeUserRole: (role: 'admin' | 'branch' | 'viewer') => void;
  onResetData: () => void;
  totalEmployeesCount: number;
  totalAlertsCount: number;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
  pendingUsersCount: number;
}

export default function SidebarMenu({
  companyName,
  logoBase64,
  activeTab,
  setActiveTab,
  currentUser,
  onChangeUserRole,
  onResetData,
  totalEmployeesCount,
  totalAlertsCount,
  isSidebarOpen,
  onToggleSidebar,
  onLogout,
  pendingUsersCount
}: SidebarMenuProps) {
  
  const guestRoleLabels = {
    admin: 'مدير النظام (كامل الصلاحيات)',
    branch: `مسؤول فرع (${currentUser.branch || 'جدة'})`,
    viewer: 'مشاهد (قراءة فقط)'
  };

  const navItems = [
    { id: 'dashboard', label: 'لوحة المتابعة', icon: <BarChart3 className="w-5 h-5" />, section: 'الرئيسية' },
    { 
      id: 'employees', 
      label: 'الموظفون العمالة', 
      icon: <Users className="w-5 h-5" />, 
      badge: totalEmployeesCount,
      section: 'الرئيسية' 
    },
    ...(currentUser.role === 'admin' ? [{
      id: 'approvals',
      label: 'طلبات التسجيل بالبوابة',
      icon: <ShieldCheck className="w-5 h-5" />,
      badge: pendingUsersCount,
      badgeColor: 'bg-amber-500 text-white animate-pulse',
      section: 'الرئيسية'
    }] : []),
    { 
      id: 'alerts', 
      label: 'التنبيهات العاجلة', 
      icon: <AlertTriangle className="w-5 h-5" />, 
      badge: totalAlertsCount,
      badgeColor: 'bg-red-500 text-white animate-pulse',
      section: 'الرئيسية' 
    },
    { id: 'payments', label: 'سجل المقبوضات والمدفوعات', icon: <Coins className="w-5 h-5" />, section: 'المالية' },
    { id: 'monthly', label: 'التقرير الهجري المالي', icon: <CalendarDays className="w-5 h-5" />, section: 'المالية' },
    { id: 'archive', label: 'الأرشيف والمستبعدين', icon: <Archive className="w-5 h-5" />, section: 'قواعد البيانات' },
    { id: 'settings', label: 'هوية الشركة والأسعار', icon: <Settings className="w-5 h-5" />, section: 'الإدارة العامة' },
    ...(currentUser.email === 'shady.nasif@gmail.com' ? [
      { id: 'docker', label: 'تبويب الدوكر ومعالج الاتصال', icon: <HelpCircle className="w-5 h-5" />, section: 'الإعادة والدعم' }
    ] : [])
  ];

  const groupedNav: Record<string, typeof navItems> = {};
  navItems.forEach(item => {
    if (!groupedNav[item.section]) groupedNav[item.section] = [];
    groupedNav[item.section].push(item);
  });

  return (
    <>
      {/* Mobile Drawer Overlay background */}
      {isSidebarOpen && (
        <div 
          onClick={onToggleSidebar}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
        ></div>
      )}

      <aside className={`fixed top-0 bottom-0 right-0 z-50 flex flex-col w-[275px] bg-[#0b2844] text-slate-100 border-l border-slate-800 shadow-2xl transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        
        {/* Brand identity Wrapper */}
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/5 shadow-inner">
            {logoBase64 ? (
              <img src={logoBase64} alt="شعار الشركة" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xl font-bold text-yellow-400">🏢</span>
            )}
          </div>
          <div className="truncate">
            <h1 className="text-[14px] font-black tracking-wide truncate text-white" title={companyName}>
              {companyName}
            </h1>
            <span className="text-[10px] text-slate-400 block font-medium mt-0.5">الإصدار المهني المطور 2026</span>
          </div>
        </div>

        {/* Dynamic User Profile info and Demonstration Role Selector */}
        <div className="mx-4 my-3 p-3.5 bg-slate-900/50 rounded-xl border border-slate-800/85">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] uppercase font-extrabold text-emerald-450 tracking-wider">الجلسة نشطة</span>
            </div>
            <button 
              onClick={onLogout}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-black flex items-center gap-1 hover:bg-rose-500/10 py-1 px-2 rounded-md transition-all cursor-pointer"
              title="الخروج من النظام بأمان"
            >
              <LogOut className="w-3 h-3" />
              <span>تسجيل خروج</span>
            </button>
          </div>
          <div className="text-xs font-bold text-slate-200 truncate">{currentUser.name}</div>
          <p className="text-[10px] text-slate-500 truncate mt-0.5" title={currentUser.email}>{currentUser.email}</p>
          {currentUser.tenantId && (
            <div className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold px-1.5 py-0.5 rounded mt-1.5 inline-block">
              💼 مساحة خاصة مستقلة معزولة
            </div>
          )}
          
          <div className="mt-3 pt-2.5 border-t border-slate-800/80">
            <label className="text-[10px] text-slate-400 block font-semibold mb-1">تعديل الصلاحية الفورية (للعرض والترخيص):</label>
            <select 
              value={currentUser.role}
              onChange={(e) => onChangeUserRole(e.target.value as any)}
              className="w-full bg-[#152e46] text-white text-[11px] font-bold py-1.5 px-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-light"
            >
              <option value="admin">مدير النظام (Admin) — كامل الصلاحيات</option>
              <option value="branch">مسؤول الفرع (Branch) — يرى فرعه فقط</option>
              <option value="viewer">مشاهد كلاسيكي (Viewer) — معطل جزئي</option>
            </select>
          </div>
        </div>

        {/* Interactive Menu Nav */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-2 space-y-4">
          {Object.entries(groupedNav).map(([section, items]) => (
            <div key={section} className="space-y-1">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest px-3 block mb-1">
                {section}
              </span>
              {items.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (window.innerWidth <= 1024) {
                        onToggleSidebar();
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-right text-xs font-bold transition-all duration-200 group ${isActive ? 'bg-primary-light text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-slate-800 text-slate-400'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Fixed Footer Reset/Demonstration area */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/30 text-center gap-1.5 flex flex-col">
          <button 
            onClick={() => {
              if (confirm('هل تريد إعادة تعيين كافة البيانات إلى الحالة الافتراضية؟ سيتم إزالة التعديلات والمدفوعات الجديدة.')) {
                onResetData();
              }
            }}
            className="w-full text-[10px] bg-red-950/40 text-red-400 border border-red-900/40 hover:bg-red-950/80 hover:text-red-300 py-1.5 px-2 rounded-lg font-bold transition-colors cursor-pointer"
          >
            🔄 إعادة تعيين وتصفير قاعدة البيانات
          </button>
          
          <div className="text-[9px] text-slate-500 leading-normal mt-1">
            تصميم وبرمجة المهندس <strong>Shady Nassef</strong><br />
            حقوق الملكية الفكرية محفوظة © 2026
          </div>
        </div>

      </aside>
    </>
  );
}
