import React, { useState } from 'react';
import { Payment, UserProfile } from '../types';
import { Search, Calendar, Trash2, Filter } from 'lucide-react';

interface PaymentsListViewProps {
  payments: Payment[];
  branches: string[];
  currentUser: UserProfile;
  onDeletePayment: (id: string, name: string, amount: number) => void;
}

export default function PaymentsListView({
  payments,
  branches,
  currentUser,
  onDeletePayment
}: PaymentsListViewProps) {
  
  // Local filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const activeRole = currentUser.role;
  const isReadOnly = activeRole === 'viewer';

  // Filters payments checklist (exclude debt entries from receipt logs)
  const roleFiltered = activeRole === 'branch' && currentUser.branch
    ? payments.filter(p => p.branch === currentUser.branch && !p.type?.includes('مديونية'))
    : payments.filter(p => !p.type?.includes('مديونية'));

  const finalFiltered = roleFiltered.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.iqamaNo.includes(searchQuery);
    const matchesBranch = !filterBranch || p.branch === filterBranch;
    const matchesFrom = !dateFrom || p.date >= dateFrom;
    const matchesTo = !dateTo || p.date <= dateTo;

    return matchesSearch && matchesBranch && matchesFrom && matchesTo;
  });

  const triggerExcelExport = () => {
    let tsv = 'الاسم\tرقم الإقامة\tالفرع التابع\tتاريخ القبض\tالمبلغ المسدد ريال\tنوع العملية\tملاحظات السند\n';
    finalFiltered.forEach(p => {
      tsv += `${p.name}\t${p.iqamaNo}\t${p.branch}\t${p.date}\t${p.amount}\t${p.type}\t${p.notes || '-'}\n`;
    });

    const blob = new Blob(['\uFEFF' + tsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `دفتر_المقبوضات_تصدير_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      
      {/* Search and Date filter controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-800">
            <Filter className="w-5 h-5 text-primary-light" />
            <h3 className="text-sm font-black">فلترة وتصدير سجل الحسابات المودعة</h3>
          </div>

          <button 
            onClick={triggerExcelExport}
            className="btn btn-green text-xs"
          >
            تصدير سجل السدادات الحالي Excel
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-bold text-slate-700">
          <div className="relative">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم العامل أو الإقامة..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <div>
            <select 
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none"
            >
              <option value="">كل الفروع المعنية</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold shrink-0">من:</span>
            <input 
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-2.5 focus:outline-none font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold shrink-0">إلى:</span>
            <input 
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-2.5 focus:outline-none font-mono text-xs"
            />
          </div>
        </div>

      </div>

      {/* Main transactions grid list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-slate-700 text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-center">#</th>
                <th className="px-4 py-3">اسم الموظف المسدد</th>
                <th className="px-4 py-3 text-center">رقم الإقامة</th>
                <th className="px-4 py-3 text-center font-bold">الفرع التابع</th>
                <th className="px-4 py-3 text-center">تاريخ تحصيل الدفعة</th>
                <th className="px-4 py-3 text-center font-bold text-emerald-600">المبلغ المحصل (ريال)</th>
                <th className="px-4 py-3 text-center font-bold">نوع السداد والمقابل</th>
                <th className="px-4 py-3">ملاحظات وسند الاستيراد</th>
                {activeRole === 'admin' && <th className="px-4 py-3 text-center">الإجراء</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {finalFiltered.map((p, index) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-center text-slate-400 font-mono">{index + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-500">{p.iqamaNo}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-bold">{p.branch}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-slate-600">{p.date}</td>
                  <td className="px-4 py-3 text-center font-extrabold text-emerald-650 bg-emerald-50/10">
                    {p.amount.toLocaleString()} ريال
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold">{p.type}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-medium max-w-[250px] truncate" title={p.notes}>
                    {p.notes || '-'}
                  </td>
                  {activeRole === 'admin' && (
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => {
                          if (confirm(`تحذير محاسبي! هل أنت متأكد من رغبتك في حذف هذا القيد المالي المحصل بمبلغ (${p.amount} ريال) من القيود والترتيب الإحصائي؟`)) {
                            onDeletePayment(p.id, p.name, p.amount);
                          }
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {finalFiltered.length === 0 && (
                <tr>
                  <td colSpan={activeRole === 'admin' ? 9 : 8} className="p-8 text-center text-slate-400 font-bold">
                    لا تتوفر مبالغ محصلة مطابقة لشروط الفلترة المحددة.
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
