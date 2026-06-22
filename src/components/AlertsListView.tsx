import React from 'react';
import { Employee, Payment, PricingSettings } from '../types';
import { g2h } from '../utils/hijri';
import { AlertTriangle, Clock, MessageSquare, Coins, Sliders } from 'lucide-react';

interface AlertsListViewProps {
  employees: Employee[];
  payments: Payment[];
  pricing: PricingSettings;
  activeRole: string;
}

export default function AlertsListView({
  employees,
  payments,
  pricing,
  activeRole
}: AlertsListViewProps) {
  
  const today = new Date();
  today.setHours(0,0,0,0);

  const activeEmployees = employees.filter(e => e.status === 'active');

  // Compute expirations (days left < 90 days)
  const expiringList = activeEmployees.map(e => {
    let daysLeft: number | null = null;
    if (e.iqamaExpiry) {
      const expDate = new Date(e.iqamaExpiry + 'T00:00:00');
      daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    return { ...e, daysLeft };
  })
  .filter(e => e.daysLeft !== null && e.daysLeft <= 90)
  .sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0));

  // Compute debtors (balance < 0)
  const debtorsList = activeEmployees.map(e => {
    const empPays = payments.filter(p => (p.iqamaNo === e.iqamaNo || p.name === e.name) && !p.type?.includes('مديونية'));
    const paid = empPays.reduce((sum, p) => sum + (p.amount || 0), 0);
    const due = (e.iqamaBalance || 0) + (e.kafalaCount * pricing.kafala) + (e.otherDebt || 0);
    const balance = paid - due;
    return { ...e, balance };
  })
  .filter(e => e.balance < 0)
  .sort((a, b) => a.balance - b.balance);

  return (
    <div className="space-y-6">
      
      {/* Expiry alerts document list */}
      <div className="bg-white rounded-2xl border border-rose-200 overflow-hidden shadow-sm">
        
        <div className="bg-gradient-to-r from-red-700 to-red-650 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 animate-pulse text-yellow-300" />
            <div>
              <h3 className="font-extrabold text-sm">مستندات وإقامات تنتهي قريباً (أقل من 90 يوم)</h3>
              <p className="text-[10px] text-red-100 mt-0.5">تنبيه آلي عاجل لتجديد الوثائق وفواتير الإقامات لتلافي الغرامات القانونية.</p>
            </div>
          </div>
          <span className="text-xs font-black bg-white/15 px-3 py-1 rounded-full">{expiringList.length} حالات معلقة</span>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-right">
            <thead className="bg-red-50/50 text-red-950 font-bold border-b border-rose-100">
              <tr>
                <th className="px-4 py-3 text-center">#</th>
                <th className="px-4 py-3">الاسم الكامل للعامل</th>
                <th className="px-4 py-3 text-center">رقم الإقامة</th>
                <th className="px-4 py-3 text-center font-bold">الفرع التابع</th>
                <th className="px-4 py-3 text-center">تاريخ الانتهاء ميلادي</th>
                <th className="px-4 py-3 text-center">تاريخ الانتهاء هجري</th>
                <th className="px-4 py-3 text-center">الأيام المتبقية للتنفيذ</th>
                <th className="px-4 py-3 text-center">ارتباط الواتساب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50/50">
              {expiringList.map((e, index) => {
                const hExp = g2h(e.iqamaExpiry);
                const safeMob = e.mobile?.replace(/\D/g, '');
                const formattedMob = safeMob ? (safeMob.startsWith('0') ? '966' + safeMob.slice(1) : (safeMob.startsWith('966') ? safeMob : '966' + safeMob)) : '';
                const waTxt = encodeURIComponent(`السلام عليكم موظف ${e.name}، نفيدكم علماً بأن رخصة الإقامة الخاصة بكم تنتهي رسمياً بتاريخ هجري ${hExp} الموافق ميلادي ${e.iqamaExpiry}. يرجى التنسيق بشكل طارئ مع الإدارة لمراجعة التجديد ومطابقة الرسوم والمستلزمات.`);

                const isCritical = e.daysLeft !== null && e.daysLeft <= 30;

                return (
                  <tr key={e.iqamaNo} className={`hover:bg-red-50/10 transition-colors ${isCritical ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 text-center text-slate-400 font-mono">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950">{e.name}</td>
                    <td className="px-4 py-3 text-center font-mono text-slate-600">{e.iqamaNo}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg font-bold">{e.branch}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono">{e.iqamaExpiry}</td>
                    <td className="px-4 py-3 text-center font-extrabold text-[#0d5189]">{hExp}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full font-black ${isCritical ? 'bg-red-200 text-red-900 animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
                        {e.daysLeft !== null ? (e.daysLeft < 0 ? `منتهية بـ ${Math.abs(e.daysLeft)} يوم` : `${e.daysLeft} يوم متبقي`) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {formattedMob ? (
                        <a 
                          href={`https://wa.me/${formattedMob}?text=${waTxt}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 transition-colors inline-flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>إرسال تنبيه</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">جوال غير مسجل</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {expiringList.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-emerald-600 font-bold bg-emerald-50/20">
                    ✓ رائع! جميع عمالتكم يملكون رخص إقامة سارية المفعول لأكثر من 90 يوم.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Debtors alerts list */}
      <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden shadow-sm">
        
        <div className="bg-gradient-to-r from-amber-700 to-amber-650 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-300" />
            <div>
              <h3 className="font-extrabold text-sm">عمالة معلق بذمتهم مبالغ مالية متأخرة (عليهم مديونيات معلقة)</h3>
              <p className="text-[10px] text-amber-100 mt-0.5">سجل الموظفين الذين تجاوزت رسوم كفالتهم ورخص إقامتهم قيمة المبالغ المسددة سلفاً في النظام.</p>
            </div>
          </div>
          <span className="text-xs font-black bg-white/15 px-3 py-1 rounded-full">{debtorsList.length} عمال مدينين</span>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-right">
            <thead className="bg-amber-50/50 text-amber-950 font-bold border-b border-amber-100">
              <tr>
                <th className="px-4 py-3 text-center animate-none">#</th>
                <th className="px-4 py-3">الاسم رباعياً</th>
                <th className="px-4 py-3 text-center">رقم الإقامة</th>
                <th className="px-4 py-3 text-center font-bold">الفرع</th>
                <th className="px-4 py-3 text-center text-red-600">القيمة المتبقية بذمة العامل</th>
                <th className="px-4 py-3 text-center">أيام الإقامة المتبقية</th>
                <th className="px-4 py-3 text-center">تاريخ انتهاء الإقامة (هجري)</th>
                <th className="px-4 py-3 text-center">تنبيه السداد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50/30">
              {debtorsList.map((e, index) => {
                const hExp = g2h(e.iqamaExpiry);
                const daysDiff = e.iqamaExpiry ? Math.ceil((new Date(e.iqamaExpiry + 'T00:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

                const cleanM = e.mobile?.replace(/\D/g, '');
                const formattedM = cleanM ? (cleanM.startsWith('0') ? '966' + cleanM.slice(1) : (cleanM.startsWith('966') ? cleanM : '966' + cleanM)) : '';
                const waTxt = encodeURIComponent(`السلام عليكم موظف ${e.name}، نود تذكيركم بلطف لوجود مستحقات مالية متراكمة لصالح كفالة ورخص إقامتك الموثقة بقيمة مالية قدرها ${Math.abs(e.balance || 0).toLocaleString()} ريال سعودي. يرجى المبادرة بالتسديد أو مطابقة السندات مع قسم الحسابات بأقرب فرصة.`);

                return (
                  <tr key={e.iqamaNo} className="hover:bg-amber-50/10 transition-colors">
                    <td className="px-4 py-3 text-center text-slate-400 font-mono">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950">{e.name}</td>
                    <td className="px-4 py-3 text-center font-mono text-slate-600">{e.iqamaNo}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg font-bold">{e.branch}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-black text-red-700 bg-red-50/10">
                      {Math.abs(e.balance || 0).toLocaleString()} ريال
                    </td>
                    <td className="px-4 py-3 text-center">
                      {daysDiff !== null ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${daysDiff <= 30 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                          {daysDiff < 0 ? `منتهية منذ ${Math.abs(daysDiff)}` : `${daysDiff} يوم متبقي`}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">{hExp}</td>
                    <td className="px-4 py-3 text-center">
                      {formattedM ? (
                        <a 
                          href={`https://wa.me/${formattedM}?text=${waTxt}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-650 transition-colors inline-flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>إرسال سند السداد</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">جوال غير مسجل</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {debtorsList.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-emerald-600 font-bold bg-emerald-50/20">
                    ✓ مبارك! جميع العمال الحاليين مسددون بالكامل للرسوم والكفالات المستحقة بذمتهم.
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
