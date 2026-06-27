import React, { useState } from 'react';
import { Employee, Payment, ActivityLog, PricingSettings } from '../types';
import { 
  Users, AlertCircle, Coins, ShieldCheck, HeartHandshake, 
  Trash2, Filter, Activity, FileText, Sparkles, AlertTriangle 
} from 'lucide-react';

interface DashboardViewProps {
  employees: Employee[];
  payments: Payment[];
  pricing: PricingSettings;
  logs: ActivityLog[];
  branches: string[];
  onClearLogs: () => void;
  activeRole: string;
  logoBase64?: string;
}

export default function DashboardView({
  employees,
  payments,
  pricing,
  logs,
  branches,
  onClearLogs,
  activeRole,
  logoBase64
}: DashboardViewProps) {
  const [logFilter, setLogFilter] = useState<string>('');

  const activeEmployees = employees.filter(e => e.status === 'active');
  const archivedCount = employees.filter(e => e.status === 'archived').length;

  const today = new Date();
  today.setHours(0,0,0,0);

  // Compute stats
  let totalPayments = 0;
  let totalDues = 0;
  let criticalCount30 = 0;
  let alertCount60 = 0;
  let activeDebtorsCount = 0;

  // Branch statistics mapping
  const branchMap: Record<string, {
    activeCount: number;
    debtorsCount: number;
    totalDues: number;
    totalPaid: number;
    criticalCount: number;
  }> = {};

  branches.forEach(b => {
    branchMap[b] = { activeCount: 0, debtorsCount: 0, totalDues: 0, totalPaid: 0, criticalCount: 0 };
  });

  activeEmployees.forEach(e => {
    // Paid sum
    const empPaid = payments
      .filter(p => (p.iqamaNo === e.iqamaNo || p.name === e.name) && !p.type?.includes('مديونية'))
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Due sum
    const empDue = (e.iqamaBalance || 0) + (e.kafalaCount * pricing.kafala) + (e.otherDebt || 0);
    const balance = empPaid - empDue;

    totalPayments += empPaid;
    totalDues += empDue;

    if (balance < 0) {
      activeDebtorsCount++;
    }

    // Days remaining till expiry
    let daysDiff: number | null = null;
    if (e.iqamaExpiry) {
      const expDate = new Date(e.iqamaExpiry + 'T00:00:00');
      const timeDiff = expDate.getTime() - today.getTime();
      daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }

    if (daysDiff !== null) {
      if (daysDiff >= 0 && daysDiff <= 30) {
        criticalCount30++;
      } else if (daysDiff > 30 && daysDiff <= 60) {
        alertCount60++;
      }
    }

    // Accumulate branch level
    const b = e.branch;
    if (branchMap[b]) {
      branchMap[b].activeCount++;
      branchMap[b].totalDues += empDue;
      branchMap[b].totalPaid += empPaid;
      if (balance < 0) branchMap[b].debtorsCount++;
      if (daysDiff !== null && daysDiff >= 0 && daysDiff <= 30) branchMap[b].criticalCount++;
    }
  });

  const totalOutstanding = totalDues - totalPayments;

  // Filtered Logs
  const filteredLogs = logFilter ? logs.filter(l => l.type === logFilter) : logs;

  const kpis = [
    { label: 'إجمالي الموظفين النشطين', value: activeEmployees.length, sub: 'بالمواقع الحقلية والفروع', color: 'border-r-4 border-sky-500 bg-sky-50/20 text-sky-800' },
    { label: 'تجديدات حرجة (خلال 30 يوم)', value: criticalCount30, sub: 'تتطلب تمديداً فوريّاً', color: `border-r-4 border-red-500 ${criticalCount30 > 0 ? 'bg-red-50 text-red-800 animate-pulse' : 'bg-slate-50 text-slate-700'}` },
    { label: 'تجديدات وشيكة (خلال 60 يوم)', value: alertCount60, sub: 'المهلة والمطابقات جارية', color: 'border-r-4 border-amber-500 bg-amber-50/20 text-amber-800' },
    { label: 'عمالة يترتب عليهم مبالغ', value: activeDebtorsCount, sub: 'تصفية الذمم المالية معلّقة', color: 'border-r-4 border-violet-500 bg-violet-50/20 text-violet-800' },
    { label: 'إجمالي المستحقات العالقة', value: `${totalOutstanding.toLocaleString()} ريال`, sub: 'ثمن الكفالة ورخص الإقامة', color: 'border-r-4 border-rose-500 bg-rose-50/20 text-rose-800' },
    { label: 'إجمالي المقبوضات المحصلة', value: `${totalPayments.toLocaleString()} ريال`, sub: 'المودعة بالخزينة والحسابات', color: 'border-r-4 border-emerald-500 bg-emerald-50/20 text-emerald-800' },
    { label: 'مستندات العمالة المؤرشفة', value: archivedCount, sub: 'خدمات منقولة واستبعاد نهائي', color: 'border-r-4 border-slate-500 bg-slate-50/20 text-slate-800' }
  ];

  const logIcons: Record<string, string> = {
    login: '🔐', add: '➕', pay: '💰', arc: '📁', del: '🗑️', restore: '↩️', update: '🔧'
  };

  return (
    <div className="space-y-4">
      {/* Streamlined Welcome Title Bar */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right">
        <div className="flex items-center gap-3">
          {logoBase64 ? (
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
              <img src={logoBase64} alt="شعار المؤسسة المعتمد" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[#0d5189]" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
              <span>لوحة المؤشرات والمعلومات التحليلية الفورية</span>
            </div>
            <h2 className="text-sm font-black text-[#0b2844] mt-0.5">مرحباً، {activeRole === 'admin' ? 'المدير العام للمنظومة' : 'المشرف المسؤول عن الفرع'}</h2>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-[10px] bg-white border border-slate-200/80 shadow-xs rounded-lg py-1 px-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-slate-600 font-bold">حالة تدفق البيانات:</span>
          <span className="font-mono bg-emerald-50 text-emerald-800 px-1 py-0.2 rounded font-bold text-[9px]">نشط تلقائياً</span>
        </div>
      </div>

      {/* High-Density KPI Control Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {kpis.map((k, ind) => (
          <div key={ind} className={`p-3 rounded-xl border border-slate-200/70 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.03)] ${k.color} flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xs`}>
            <div>
              <span className="text-[10px] text-slate-500 block truncate font-semibold">{k.label}</span>
              <span className="text-base md:text-lg font-black block leading-none mt-1 tracking-tight">{k.value}</span>
            </div>
            <span className="text-[9px] text-slate-400 block mt-1.5 font-normal truncate">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Multi-Section Analysis Content: Branches distribution & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Branch Statistics Cards list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <span className="inline-block w-2.5 h-4 bg-primary rounded-sm"></span>
              <span>تحليل عمالة الفروع وبناء المقاصة الشاملة</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">بموجب آخر حركات</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(branchMap).map(([bName, stats]) => {
              const outstanding = stats.totalDues - stats.totalPaid;
              return (
                <div key={bName} className="p-4 rounded-xl bg-[#f8fafc] border border-slate-200/65 hover:shadow-md transition-shadow">
                  <h4 className="font-extrabold text-xs text-[#0d5189] mb-3 flex items-center justify-between">
                    <span>🏢 {bName}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                      {stats.activeCount} عمال
                    </span>
                  </h4>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>إقامات متبقي أقل من 30 يوم:</span>
                      <strong className={stats.criticalCount > 0 ? 'text-red-600 animate-pulse font-black' : 'text-slate-700'}>
                        {stats.criticalCount} وثائق
                      </strong>
                    </div>
                    
                    <div className="flex justify-between text-slate-500">
                      <span>عدد العمال المدينين:</span>
                      <strong className={stats.debtorsCount > 0 ? 'text-amber-700 font-bold' : 'text-slate-700'}>
                        {stats.debtorsCount}
                      </strong>
                    </div>

                    <div className="flex justify-between pt-2 border-t border-slate-200/80 mt-1">
                      <span className="font-bold text-slate-600">المبلغ المعلق (المتبقي):</span>
                      <strong className={`font-black ${outstanding > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {outstanding.toLocaleString()} ريال
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visual Percentage Progress Charts */}
          <div className="bg-[#fcfdfe] p-4 rounded-xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 mb-3 block">مؤشر التحصيل المالي الإجمالي لكل فرع:</h4>
            <div className="space-y-3">
              {Object.entries(branchMap).map(([bName, stats]) => {
                const percent = stats.totalDues > 0 ? Math.round((stats.totalPaid / stats.totalDues) * 100) : 100;
                const progressWidth = Math.min(Math.max(percent, 0), 100);
                return (
                  <div key={bName} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span className="font-medium truncate max-w-[180px]">{bName}</span>
                      <span className="font-bold">{percent}% ({stats.totalPaid.toLocaleString()} ريال)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressWidth}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dynamic Activity Logs Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              <span>أحدث عمليات وسجل الأنشطة الجارية</span>
            </h3>
            {activeRole === 'admin' && logs.length > 0 && (
              <button 
                onClick={onClearLogs}
                className="text-[10px] text-red-600 font-bold hover:underline"
              >
                مسح السجل
              </button>
            )}
          </div>

          {/* Logs Category filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-bold focus:outline-none w-full"
            >
              <option value="">كل العمليات</option>
              <option value="login">🔐 تسجيل الدخول</option>
              <option value="add">➕ الموظفون الجدد</option>
              <option value="pay">💰 سدادات مالية</option>
              <option value="arc">📁 الأرشفة والاستبعاد</option>
              <option value="del">🗑️ الحذف والاسترجاع</option>
            </select>
          </div>

          <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
            {filteredLogs.map(l => (
              <div key={l.id} className="flex gap-3 items-start border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <span className="text-base p-1.5 bg-slate-100 rounded-lg">{logIcons[l.type] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 leading-normal">{l.text}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-semibold">
                    <span>بواسطة: {l.user}</span>
                    <span>•</span>
                    <span className="font-mono">{l.time}</span>
                  </div>
                </div>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="text-center text-slate-400 py-12 text-xs">
                لا توجد سجلات مطابقة للفلتر المحدد حالياً.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
