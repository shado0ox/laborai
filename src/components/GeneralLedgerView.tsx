import React, { useState, useEffect } from 'react';
import { Payment, UserProfile, GeneralLedgerEntry } from '../types';
import { 
  Plus, Trash2, Calendar, TrendingUp, TrendingDown, Printer, Coins, 
  Lock, CheckCircle2, ArrowRightLeft, FileText, BarChart3, HelpCircle 
} from 'lucide-react';

interface GeneralLedgerViewProps {
  payments: Payment[];
  currentUser: UserProfile;
  companyName: string;
  logoBase64?: string;
}

interface MergedTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  bayan: string;
  debit: number; // صادر / مصاريف
  credit: number; // وارد / مقبوضات
  isAutomatic: boolean;
  source: 'employee_payment' | 'manual_ledger';
}

// يرفق رمز الدخول (JWT) في كل الطلبات لهذا التبويب، تمامًا زي دالة authFetch الرئيسية
// في App.tsx — لازمة هنا لأن هذا المكوّن مستقل ولا يستقبل authFetch كـ prop.
const ledgerAuthFetch = async (url: string, options: RequestInit = {}) => {
  const token = sessionStorage.getItem('authToken');
  const headers = { ...(options.headers || {}) } as Record<string, string>;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
};

export default function GeneralLedgerView({
  payments,
  currentUser,
  companyName,
  logoBase64
}: GeneralLedgerViewProps) {
  // State for manual general ledger entries from backend
  const [manualEntries, setManualEntries] = useState<GeneralLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states for manual ledger recording
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formType, setFormType] = useState<'credit' | 'debit'>('credit'); // credit=وارد, debit=صادر
  const [formBayan, setFormBayan] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formIsSubmitting, setFormIsSubmitting] = useState(false);

  // Active month key (e.g. "YYYY-MM")
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Fetch manual entries from backend
  const fetchManualEntries = async () => {
    setLoading(true);
    try {
      const tid = currentUser.tenantId || '';
      const res = await ledgerAuthFetch(`/api/general-ledger?tenantId=${tid}`);
      if (res.ok) {
        const data = await res.json();
        setManualEntries(data);
        setError(null);
      } else {
        setError('فشل جلب قيود دفتر الحسابات العامة');
      }
    } catch (err: any) {
      console.error(err);
      setError('لا يمكن الاتصال بالسيرفر، يجري العمل بنمط الذاكرة المحلية المؤقتة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManualEntries();
  }, [currentUser]);

  // Helper for Arabic months
  const getArabicMonthName = (monthKey: string) => {
    if (!monthKey || !monthKey.includes('-')) return monthKey;
    const [year, monthStr] = monthKey.split('-');
    const monthIdx = parseInt(monthStr, 10);
    const arabicMonths = [
      'يناير (كانون الثاني)', 'فبراير (شباط)', 'مارس (آذار)', 'أبريل (نيسان)', 'مايو (أيار)', 'يونيو (حزيران)',
      'يوليو (تموز)', 'أغسطس (آب)', 'سبتمبر (أيلول)', 'أكتوبر (تشرين الأول)', 'نوفمبر (تشرين الثاني)', 'ديسمبر (كانون الأول)'
    ];
    return `${arabicMonths[monthIdx - 1]} ${year}`;
  };

  // Merge automatic employee receipts & manual entries
  const getMergedTransactions = (): MergedTransaction[] => {
    const merged: MergedTransaction[] = [];

    // 1. Add employee payments (credit / وارد) if not debit/debt entries
    payments.forEach(p => {
      if (p.type?.includes('مديونية')) return;
      merged.push({
        id: p.id,
        date: p.date,
        bayan: `مقبوضات من العامل: ${p.name} - ${p.type} (${p.branch})` + (p.notes ? ` [${p.notes}]` : ''),
        debit: 0,
        credit: p.amount || 0,
        isAutomatic: true,
        source: 'employee_payment'
      });
    });

    // 2. Add manual entries (credit or debit)
    manualEntries.forEach(e => {
      merged.push({
        id: e.id,
        date: e.date,
        bayan: e.bayan,
        debit: e.debit || 0,
        credit: e.credit || 0,
        isAutomatic: false,
        source: 'manual_ledger'
      });
    });

    // Sort chronologically by date
    return merged.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });
  };

  const allTransactions = getMergedTransactions();

  // Extract all unique months in order YYYY-MM
  const getAvailableMonths = (): string[] => {
    const monthsSet = new Set<string>();
    
    // Always include current month
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    monthsSet.add(currentMonthKey);

    allTransactions.forEach(t => {
      if (t.date && t.date.length >= 7) {
        monthsSet.add(t.date.substring(0, 7));
      }
    });

    return Array.from(monthsSet).sort();
  };

  const availableMonths = getAvailableMonths();

  // Auto-set the selected month to current if not set
  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      const currentM = new Date().toISOString().slice(0, 7);
      if (availableMonths.includes(currentM)) {
        setSelectedMonth(currentM);
      } else {
        setSelectedMonth(availableMonths[availableMonths.length - 1]);
      }
    }
  }, [availableMonths, selectedMonth]);

  // Compute roll-over balances month-by-month
  // Returns: Map<monthKey, { startingBalance, endingBalance, transactions, totalCredit, totalDebit }>
  const computeMonthlyLedger = () => {
    const ledgerMap = new Map<string, {
      startingBalance: number;
      endingBalance: number;
      transactions: MergedTransaction[];
      totalCredit: number;
      totalDebit: number;
    }>();

    let cumulativeBalance = 0;

    // Loop through sorted months contiguous or available
    availableMonths.forEach((monthKey) => {
      const startingBalance = cumulativeBalance;
      
      // Filter transactions for this month
      const monthTx = allTransactions.filter(t => t.date.startsWith(monthKey));
      
      let totalCredit = 0;
      let totalDebit = 0;

      monthTx.forEach(t => {
        totalCredit += t.credit;
        totalDebit += t.debit;
        cumulativeBalance += (t.credit - t.debit);
      });

      const endingBalance = cumulativeBalance;

      ledgerMap.set(monthKey, {
        startingBalance,
        endingBalance,
        transactions: monthTx,
        totalCredit,
        totalDebit
      });
    });

    return ledgerMap;
  };

  const monthlyLedger = computeMonthlyLedger();
  const currentMonthData = monthlyLedger.get(selectedMonth) || {
    startingBalance: 0,
    endingBalance: 0,
    transactions: [],
    totalCredit: 0,
    totalDebit: 0
  };

  // Submit manual transaction (وارد / صادر)
  const handleSubmitManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBayan.trim() || !formAmount || isNaN(parseFloat(formAmount))) {
      alert('الرجاء إدخال بيان صحيح وقيمة مالية صالحة');
      return;
    }

    const amt = parseFloat(formAmount);
    if (amt <= 0) {
      alert('الرجاء إدخال مبلغ أكبر من الصفر');
      return;
    }

    setFormIsSubmitting(true);
    const newEntry: GeneralLedgerEntry = {
      id: `gl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      date: formDate,
      bayan: formBayan.trim(),
      debit: formType === 'debit' ? amt : 0,
      credit: formType === 'credit' ? amt : 0,
      createdAt: new Date().toISOString()
    };

    try {
      const tid = currentUser.tenantId || '';
      const res = await ledgerAuthFetch(`/api/general-ledger?tenantId=${tid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      });

      if (res.ok) {
        setManualEntries(prev => [newEntry, ...prev]);
        setFormBayan('');
        setFormAmount('');
        // Make sure the month of the added transaction is selected
        const addedMonth = formDate.substring(0, 7);
        setSelectedMonth(addedMonth);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`⚠️ لم يتم حفظ القيد في قاعدة البيانات: ${errData.error || 'حدث خطأ أثناء الحفظ على السيرفر'}`);
      }
    } catch (err) {
      console.error('API save ledger entry error:', err);
      alert('⚠️ تعذر الاتصال بالخادم — لم يتم حفظ القيد. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.');
    } finally {
      setFormIsSubmitting(false);
    }
  };

  // Delete manual transaction
  const handleDeleteManualEntry = async (id: string, description: string, amount: number) => {
    if (currentUser.role === 'viewer') {
      alert('عذراً، رتبة المشاهد لا تملك صلاحية الحذف');
      return;
    }

    if (!confirm(`⚠️ تأكيد محاسبي!\nهل أنت متأكد من حذف هذا القيد المالي (${description}) بقيمة ${amount.toLocaleString()} ريال نهائياً؟`)) {
      return;
    }

    try {
      const res = await ledgerAuthFetch(`/api/general-ledger/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setManualEntries(prev => prev.filter(e => e.id !== id));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`⚠️ لم يتم حذف القيد من قاعدة البيانات: ${errData.error || 'فشل حذف القيد من السيرفر'}`);
      }
    } catch (err) {
      console.error('API delete ledger entry error:', err);
      alert('⚠️ تعذر الاتصال بالخادم — لم يتم حذف القيد. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.');
    }
  };

  // Professional Printing Function for Monthly General Ledger Statement
  const handlePrintLedger = () => {
    const todayStr = new Date().toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });
    const logoSource = logoBase64 ? `<img src="${logoBase64}" style="max-height:80px; max-width:200px; object-fit:contain; border-radius:10px;" />` : '';

    let running = currentMonthData.startingBalance;
    const printRows = currentMonthData.transactions.map((t, idx) => {
      running += t.credit - t.debit;
      return `
        <tr style="font-size: 11px; background-color: ${t.debit > 0 ? '#fffefd' : '#fdfdfd'};">
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-family: monospace;">${t.date}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${t.bayan}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: #b91c1c;">${t.debit > 0 ? t.debit.toLocaleString('ar-SA') : '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: #15803d;">${t.credit > 0 ? t.credit.toLocaleString('ar-SA') : '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; font-family: monospace;">${running.toLocaleString('ar-SA')} ريال</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>كشف الوارد والصادر المالي لشهر ${getArabicMonthName(selectedMonth)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Tajawal', sans-serif;
            margin: 0;
            padding: 30px;
            background: #fff;
            color: #1a2536;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #002f56;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }
          .company-profile {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .company-name {
            font-size: 22px;
            font-weight: 800;
            color: #002f56;
          }
          .doc-title {
            text-align: left;
          }
          .doc-title h1 {
            margin: 0;
            font-size: 18px;
            color: #002f56;
            font-weight: 800;
          }
          .doc-title p {
            margin: 5px 0 0 0;
            font-size: 11px;
            color: #64748b;
          }
          .summary-grid {
            display: grid;
            grid-template-cols: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 25px;
          }
          .summary-card {
            border-radius: 10px;
            padding: 12px;
            text-align: center;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
          }
          .summary-card .label {
            font-size: 10px;
            color: #64748b;
            margin-bottom: 4px;
          }
          .summary-card .value {
            font-size: 15px;
            font-weight: bold;
            color: #002f56;
          }
          .ledger-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 15px;
          }
          .ledger-table th {
            background-color: #002f56;
            color: white;
            padding: 10px;
            font-weight: bold;
            border: 1px solid #002f56;
          }
          .footer-note {
            margin-top: 40px;
            font-size: 10px;
            text-align: center;
            color: #94a3b8;
            border-top: 1px dashed #e2e8f0;
            padding-top: 15px;
          }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div class="company-profile">
            ${logoSource}
            <div>
              <div class="company-name">${companyName || 'نظام إدارة العمالة'}</div>
              <div style="font-size:11px; color:#64748b;">دفتر الحسابات العام والتدفق النقدي</div>
            </div>
          </div>
          <div class="doc-title">
            <h1>كشف حساب الوارد والصادر التفصيلي</h1>
            <p>الفترة المحاسبية: ${getArabicMonthName(selectedMonth)}</p>
            <p>تاريخ الاستخراج: ${todayStr}</p>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card" style="border-right: 4px solid #475569;">
            <div class="label">الرصيد الافتتاحي (مرحل)</div>
            <div class="value">${currentMonthData.startingBalance.toLocaleString('ar-SA')} ريال</div>
          </div>
          <div class="summary-card" style="border-right: 4px solid #15803d;">
            <div class="label">إجمالي المقبوضات (الوارد)</div>
            <div class="value" style="color:#15803d;">+${currentMonthData.totalCredit.toLocaleString('ar-SA')} ريال</div>
          </div>
          <div class="summary-card" style="border-right: 4px solid #b91c1c;">
            <div class="label">إجمالي المدفوعات (الصادر)</div>
            <div class="value" style="color:#b91c1c;">-${currentMonthData.totalDebit.toLocaleString('ar-SA')} ريال</div>
          </div>
          <div class="summary-card" style="border-right: 4px solid #002f56; background-color: #f0fdf4;">
            <div class="label">الرصيد الختامي (مرحل للفرع التالي)</div>
            <div class="value" style="font-weight: 800; color: #166534;">${currentMonthData.endingBalance.toLocaleString('ar-SA')} ريال</div>
          </div>
        </div>

        <h3 style="color:#002f56; border-bottom: 2px solid #002f56; padding-bottom: 5px; margin-top:20px; font-size:13px;">
          📊 جدول القيود والتدفقات النقدية الجارية
        </h3>

        <table class="ledger-table">
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 15%;">التاريخ</th>
              <th style="width: 45%;">البيان التفصيلي للعملية</th>
              <th style="width: 11%; color: #fee2e2;">صادر (مدين / مصاريف)</th>
              <th style="width: 11%; color: #d1fae5;">وارد (دائن / تحصيل)</th>
              <th style="width: 13%;">الرصيد التراكمي للعملية</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #f8fafc; font-weight: bold;">
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">-</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">-</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color:#475569;">رصيد مرحل افتتاحي من الشهر السابق</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">-</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">-</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-family: monospace;">${currentMonthData.startingBalance.toLocaleString('ar-SA')} ريال</td>
            </tr>
            ${printRows}
          </tbody>
          <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">صافي الحركات والمجاميع والترصيد</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #b91c1c;">${currentMonthData.totalDebit.toLocaleString('ar-SA')}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #15803d;">${currentMonthData.totalCredit.toLocaleString('ar-SA')}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #1e3a8a;">${currentMonthData.endingBalance.toLocaleString('ar-SA')} ريال</td>
            </tr>
          </tfoot>
        </table>

        <div class="footer-note">
          كشف حساب معتمد ومطابق برمجياً مستخرج من منظومة إدارة العمالة. شركة ${companyName || 'المؤسسة'}.
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
    }
  };

  // Grand totals of all times for stats header
  const grandTotalCredit = allTransactions.reduce((sum, t) => sum + t.credit, 0);
  const grandTotalDebit = allTransactions.reduce((sum, t) => sum + t.debit, 0);
  const grandNetBalance = grandTotalCredit - grandTotalDebit;

  return (
    <div className="space-y-6">
      
      {/* 📊 Top Financial Statistics overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 p-5 rounded-2xl shadow-sm text-right relative overflow-hidden">
          <div className="absolute left-4 top-4 bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="text-xs text-slate-500 font-bold block mb-1">إجمالي الوارد (التحصيلات والمقبوضات)</span>
          <span className="text-2xl font-black text-emerald-700 tracking-tight font-mono">
            +{grandTotalCredit.toLocaleString()} ريال
          </span>
          <p className="text-[10px] text-slate-400 font-semibold mt-1">يضم مقبوضات العمالة التلقائية والإيداعات المسجلة</p>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200 p-5 rounded-2xl shadow-sm text-right relative overflow-hidden">
          <div className="absolute left-4 top-4 bg-rose-500/10 p-2.5 rounded-xl text-rose-600">
            <TrendingDown className="w-6 h-6" />
          </div>
          <span className="text-xs text-slate-500 font-bold block mb-1">إجمالي الصادر (المصاريف والدفعات)</span>
          <span className="text-2xl font-black text-rose-700 tracking-tight font-mono">
            -{grandTotalDebit.toLocaleString()} ريال
          </span>
          <p className="text-[10px] text-slate-400 font-semibold mt-1">المصروفات العامة والتشغيلية المقيّدة بالدفتر</p>
        </div>

        <div className="bg-gradient-to-br from-sky-50 to-sky-100/50 border border-sky-200 p-5 rounded-2xl shadow-sm text-right relative overflow-hidden">
          <div className="absolute left-4 top-4 bg-sky-500/10 p-2.5 rounded-xl text-sky-600">
            <Coins className="w-6 h-6" />
          </div>
          <span className="text-xs text-slate-500 font-bold block mb-1">صافي الصندوق / السيولة الجارية</span>
          <span className="text-2xl font-black text-sky-900 tracking-tight font-mono">
            {grandNetBalance.toLocaleString()} ريال
          </span>
          <p className="text-[10px] text-slate-400 font-semibold mt-1">صافي قيمة الخزينة المتراكم للمنشأة</p>
        </div>
      </div>

      {/* 📅 Months Horizontal Segmented Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <label className="text-xs font-black text-slate-500 block mb-3 flex items-center gap-1">
          <Calendar className="w-4 h-4 text-[#002f56]" />
          <span>اختر الفترة المحاسبية (كل شهر بشهر والموازنة تترحل تلقائياً):</span>
        </label>
        
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {availableMonths.map((monthKey) => {
            const isActive = selectedMonth === monthKey;
            const data = monthlyLedger.get(monthKey);
            const bal = data ? data.endingBalance : 0;
            return (
              <button
                key={monthKey}
                onClick={() => setSelectedMonth(monthKey)}
                className={`flex-shrink-0 flex flex-col items-start px-4 py-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#002f56] text-white border-[#002f56] shadow-sm font-bold' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] font-semibold opacity-75">{monthKey}</span>
                <span className="text-xs font-bold mt-0.5">{getArabicMonthName(monthKey)}</span>
                <span className={`text-[10px] mt-1 font-mono ${isActive ? 'text-emerald-300' : 'text-slate-500'}`}>
                  رصيد: {bal.toLocaleString()} ريال
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 📓 Main Month General Ledger and Transaction table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Register New Ledger Entry Form */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-extrabold text-[#002f56] text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>قيد حركة مالية جديدة بالدفتر</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                سجل واردات الصندوق ومصاريفه، تظهر وتترحل تلقائياً حسب ترتيب التواريخ والأشهر.
              </p>
            </div>

            {currentUser.role === 'viewer' ? (
              <div className="p-4 bg-slate-50 border border-slate-200 text-slate-400 text-xs rounded-xl flex items-center gap-2 select-none">
                <Lock className="w-4 h-4 text-slate-400" />
                <span>المشاهد لا يمكنه إدخال قيود محاسبية</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitManualEntry} className="space-y-4 text-xs">
                {/* Type: Credit vs Debit Selector */}
                <div>
                  <label className="text-slate-500 font-bold block mb-1.5">نوع المعاملة المالية</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType('credit')}
                      className={`py-2 px-3 rounded-lg border text-center transition-all font-bold ${
                        formType === 'credit'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block text-xs font-black">وارد (+ دائن)</span>
                      <span className="text-[9px] block font-semibold opacity-75">مقبوضات / إيرادات</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('debit')}
                      className={`py-2 px-3 rounded-lg border text-center transition-all font-bold ${
                        formType === 'debit'
                          ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block text-xs font-black">صادر (- مدين)</span>
                      <span className="text-[9px] block font-semibold opacity-75">مصاريف / دفعات</span>
                    </button>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="text-slate-500 font-bold block mb-1">تاريخ القيد المالي</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-slate-50 text-slate-800 pr-10 pl-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#002f56]"
                    />
                  </div>
                </div>

                {/* Bayan / Description */}
                <div>
                  <label className="text-slate-500 font-bold block mb-1">البيان والشرح التفصيلي للعملية</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="مثال: فاتورة كهرباء الفرع، أو إيرادات تأجير..."
                    value={formBayan}
                    onChange={(e) => setFormBayan(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#002f56] resize-none"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-slate-500 font-bold block mb-1">المبلغ المالي (ريال سعودي)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#002f56] font-bold text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={formIsSubmitting}
                  className="w-full py-2.5 bg-[#002f56] hover:bg-[#00203d] text-white rounded-xl font-black transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{formIsSubmitting ? 'جاري الحفظ...' : 'قيد الحركة المالية بالدفتر 📝'}</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Ledger Detailed Table for Selected Month */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-5 h-5 text-[#002f56]" />
                  <span>كشف حساب فترة: {getArabicMonthName(selectedMonth)}</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  دفتر الأستاذ واليومية العام للوارد والصادر، والرصيد يرحل تلقائياً.
                </p>
              </div>

              <button
                onClick={handlePrintLedger}
                className="px-3.5 py-1.5 bg-[#002f56] hover:bg-[#00203d] text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة وتصدير الكشف</span>
              </button>
            </div>

            {/* Monthly Balances Rollover Banner */}
            <div className="grid grid-cols-2 gap-px bg-slate-200 border-b border-slate-200 text-xs">
              <div className="bg-slate-50/80 p-3 text-center">
                <span className="text-slate-400 text-[10px] block mb-0.5">الرصيد الافتتاحي المرحل من الشهر السابق</span>
                <span className="font-mono font-bold text-slate-700">
                  {currentMonthData.startingBalance.toLocaleString()} ريال
                </span>
              </div>
              <div className="bg-[#f0fdf4] p-3 text-center">
                <span className="text-slate-500 text-[10px] block mb-0.5 font-bold text-emerald-800">الرصيد الختامي المرحل للشهر التالي</span>
                <span className="font-mono font-black text-emerald-700">
                  {currentMonthData.endingBalance.toLocaleString()} ريال
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-[#f8fafc] text-slate-700 text-[10px] border-b border-slate-200 font-bold uppercase">
                  <tr>
                    <th className="px-4 py-3 text-center">#</th>
                    <th className="px-4 py-3 text-center">التاريخ</th>
                    <th className="px-4 py-4 text-right">البيان التفصيلي للعملية</th>
                    <th className="px-4 py-3 text-center text-rose-600">صادر (مدين / مصاريف)</th>
                    <th className="px-4 py-3 text-center text-emerald-600">وارد (دائن / تحصيل)</th>
                    <th className="px-4 py-3 text-center">الرصيد التراكمي</th>
                    <th className="px-4 py-3 text-center">المصدر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Row 0: Starting Balance Row */}
                  <tr className="bg-slate-50/40 text-slate-500 italic">
                    <td className="px-4 py-2.5 text-center font-mono">-</td>
                    <td className="px-4 py-2.5 text-center font-mono">-</td>
                    <td className="px-4 py-2.5 font-bold">رصيد افتتاحي مرحل من الشهر السابق (موازنة بداية المدة)</td>
                    <td className="px-4 py-2.5 text-center font-mono">-</td>
                    <td className="px-4 py-2.5 text-center font-mono">-</td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-600">
                      {currentMonthData.startingBalance.toLocaleString()} ريال
                    </td>
                    <td className="px-4 py-2.5 text-center text-[10px] font-bold">رصيد مرحّل</td>
                  </tr>

                  {/* Detail Transaction Rows */}
                  {currentMonthData.transactions.map((t, idx) => {
                    // Compute balance at this exact transaction
                    let runningAtThisPoint = currentMonthData.startingBalance;
                    for (let k = 0; k <= idx; k++) {
                      runningAtThisPoint += currentMonthData.transactions[k].credit - currentMonthData.transactions[k].debit;
                    }

                    return (
                      <tr key={t.id} className={`hover:bg-slate-50/50 transition-colors ${t.debit > 0 ? 'bg-rose-50/10' : 'bg-emerald-50/5'}`}>
                        <td className="px-4 py-3 text-slate-400 font-mono text-center">{idx + 1}</td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600">{t.date}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {t.bayan}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-rose-600 font-mono">
                          {t.debit > 0 ? t.debit.toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-600 font-mono">
                          {t.credit > 0 ? t.credit.toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          <span className="font-bold text-slate-700">
                            {runningAtThisPoint.toLocaleString()} ريال
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {t.isAutomatic ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-100 rounded text-[9px] font-bold" title="تم ترحيلها آلياً من مقبوضات العمالة بالبوابة">
                              <Lock className="w-2.5 h-2.5" />
                              <span>آلي 🤖</span>
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-bold">
                                يدوي ✍️
                              </span>
                              {currentUser.role !== 'viewer' && (
                                <button
                                  onClick={() => handleDeleteManualEntry(t.id, t.bayan, t.debit || t.credit)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded transition-all cursor-pointer"
                                  title="حذف هذا القيد المالي"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Empty state within active month */}
                  {currentMonthData.transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                        لا توجد حركة وارد أو صادر مقيّدة في هذا الشهر حتى الآن. 
                        أرصدة هذا الشهر تظل مطابقة تماماً للرصيد الافتتاحي المرحل من الشهر السابق.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom summary info card */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-700">
              <div className="flex flex-wrap gap-4 text-xs font-bold justify-center sm:justify-start">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>مجمل الوارد (المقبوضات):</span>
                  <span className="text-emerald-700 font-mono">+{currentMonthData.totalCredit.toLocaleString()} ريال</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span>مجمل الصادر (المصاريف):</span>
                  <span className="text-rose-700 font-mono">-{currentMonthData.totalDebit.toLocaleString()} ريال</span>
                </span>
              </div>
              <div className="text-xs font-black text-slate-800">
                <span>الرصيد الختامي للشهر:</span>
                <span className="font-mono text-emerald-800 bg-emerald-100/40 border border-emerald-200 px-2.5 py-1 rounded-lg ml-1 text-sm">
                  {currentMonthData.endingBalance.toLocaleString()} ريال
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}