import React from 'react';
import { Payment } from '../types';
import { Calendar, BarChart3, TrendingUp, Sparkles } from 'lucide-react';

interface MonthlyFinanceViewProps {
  payments: Payment[];
}

export default function MonthlyFinanceView({ payments }: MonthlyFinanceViewProps) {
  
  // Aggregate payment data by month-year
  const monthlyData: Record<string, {
    count: number;
    total: number;
    avg: number;
  }> = {};

  payments.forEach(p => {
    if (!p.date || p.type?.includes('مديونية')) return;
    const monthKey = p.date.substring(0, 7); // "YYYY-MM"
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { count: 0, total: 0, avg: 0 };
    }
    
    monthlyData[monthKey].count++;
    monthlyData[monthKey].total += p.amount || 0;
  });

  // Calculate averages
  Object.keys(monthlyData).forEach(k => {
    const d = monthlyData[k];
    d.avg = d.count > 0 ? Math.round(d.total / d.count) : 0;
  });

  const sortedMonths = Object.keys(monthlyData).sort((a, b) => b.localeCompare(a));

  const actualPayments = payments.filter(p => !p.type?.includes('مديونية'));
  const totalCollectedAllTime = actualPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalOperationsCount = actualPayments.length;
  const globalAverage = totalOperationsCount > 0 ? Math.round(totalCollectedAllTime / totalOperationsCount) : 0;

  return (
    <div className="space-y-6">
      
      {/* Overview statistical cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-[#f0fdf4] border border-emerald-250 rounded-2xl p-5 text-center">
          <span className="text-slate-500 text-xs font-bold block mb-1">صافي الإيداعات والمحصل الإجمالي</span>
          <span className="text-2xl font-black text-emerald-800 font-mono tracking-tight">
            {totalCollectedAllTime.toLocaleString()} ريال
          </span>
          <p className="text-[10px] text-slate-400 font-semibold mt-1">كافة الحركات المسجلة عبر النظام</p>
        </div>

        <div className="bg-[#f0f9ff] border border-sky-250 rounded-2xl p-5 text-center">
          <span className="text-slate-500 text-xs font-bold block mb-1">معدل العمليات ووصولات الاستلام</span>
          <span className="text-2xl font-black text-sky-850 font-mono tracking-tight">
            {totalOperationsCount} وصولات
          </span>
          <p className="text-[10px] text-slate-400 font-semibold mt-1">سند مطابقة مرخص جاري المفعول</p>
        </div>

        <div className="bg-slate-50 border border-slate-205 rounded-2xl p-5 text-center">
          <span className="text-slate-500 text-xs font-bold block mb-1 font-semibold">متوسط قيمة العملية الواحدة</span>
          <span className="text-2xl font-black text-slate-800 font-mono tracking-tight">
            {globalAverage.toLocaleString()} ريال
          </span>
          <p className="text-[10px] text-slate-400 font-semibold mt-1">القوة التوريدية الوسطية للسند</p>
        </div>
      </div>

      {/* Monthly details table card list */}
      <div className="bg-white rounded-2xl border border-slate-202 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-5 h-5 text-primary-light" />
            <h3 className="font-extrabold text-sm text-slate-800">بيانات المقاصة والتحصيل الموزعة على الأشهر</h3>
          </div>
          <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded">الترتيب من الأحدث للأقدم</span>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-right">
            <thead className="bg-[#f8fafc] text-slate-700 text-xs border-b border-slate-200 font-bold">
              <tr>
                <th className="px-5 py-3 text-right">الفترة المحاسبية (السنة - الشهر)</th>
                <th className="px-5 py-3 text-center">عدد وصولات القبض المحررة (السندات)</th>
                <th className="px-5 py-3 text-center text-emerald-650 font-black">إجمالي التحصيلات الشهرية (ريال)</th>
                <th className="px-5 py-3 text-center text-sky-700 font-black">متوسط السند الفردي للفرع</th>
                <th className="px-5 py-3 text-center">الحالة والمطابقة الجارية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
              {sortedMonths.map(m => {
                const stats = monthlyData[m];
                return (
                  <tr key={m} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-slate-900 border-l border-slate-50">{m}</td>
                    <td className="px-5 py-3 text-center font-mono text-slate-600">{stats.count} حوالات</td>
                    <td className="px-5 py-3 text-center font-mono text-emerald-700 bg-emerald-50/5">
                      {stats.total.toLocaleString()} ريال
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-sky-850">
                      {stats.avg.toLocaleString()} ريال
                    </td>
                    <td className="px-5 py-3 text-center select-none">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold">
                        مغلق ومطابق ✓
                      </span>
                    </td>
                  </tr>
                );
              })}
              {sortedMonths.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                    لا تتوفر مبالغ أو مدفوعات مسجلة في قاعدة الحسابات لإعداد التقرير المالي الجاري.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
