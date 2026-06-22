import React, { useState, useEffect } from 'react';
import { Employee, Payment, PricingSettings, UserProfile } from '../types';
import { g2h, g2hObj, h2g } from '../utils/hijri';
import { Printer, X, Coins, Calendar, FileText, CheckCircle2, TrendingUp, AlertCircle, Sparkles, Trash2 } from 'lucide-react';

interface LedgerStatementProps {
  employee: Employee;
  payments: Payment[];
  pricing: PricingSettings;
  companyName: string;
  logoBase64?: string;
  onClose: () => void;
  onDeletePayment?: (id: string, name: string, amount: number) => void;
  currentUser?: UserProfile;
}

interface LedgerLine {
  key: string;
  date: string;
  hijri: string;
  bayan: string;
  debit: number;
  credit: number;
  color: string;
}

export default function LedgerStatement({
  employee,
  payments,
  pricing,
  companyName,
  logoBase64,
  onClose,
  onDeletePayment,
  currentUser
}: LedgerStatementProps) {
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`stmt_notes_${employee.iqamaNo}`);
      if (stored) {
        setLocalNotes(JSON.parse(stored));
      }
    } catch (e) {}
  }, [employee.iqamaNo]);

  const saveLineNote = (lineKey: string, val: string) => {
    const updated = { ...localNotes, [lineKey]: val };
    setLocalNotes(updated);
    try {
      localStorage.setItem(`stmt_notes_${employee.iqamaNo}`, JSON.stringify(updated));
    } catch (e) {}
  };

  const formattedHijriExpiry = g2h(employee.iqamaExpiry);

  const AR_MONTH_NAMES = [
    '',
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];

  // Filter payments for this specific employee
  const empPayments = payments.filter(
    p => p.iqamaNo === employee.iqamaNo || p.name === employee.name
  );

  const kafalaPays = empPayments.filter(p => p.type?.includes('كفالة'));
  const iqamaPays = empPayments.filter(p => p.type?.includes('إقامة') || p.type?.includes('رخصة') || p.type?.includes('تجديد'));
  const ramadanPays = kafalaPays.filter(p => p.hijriMonth && parseInt(p.hijriMonth, 10) === 9);

  // Determine last paid month text
  let lastPaidMonthText = 'لم يُسجل سداد';
  if (kafalaPays.length > 0) {
    const last = kafalaPays[0]; // Already ordered by date desc in parent
    if (last.hijriMonth) {
      const mIdx = parseInt(last.hijriMonth, 10);
      lastPaidMonthText = `${AR_MONTH_NAMES[mIdx] || last.hijriMonth} ${last.hijriYear || ''}`;
    } else {
      lastPaidMonthText = last.date || last.type;
    }
  }

  // Pre-calculate estimate remaining months
  let remainingMonthsText = '';
  if (employee.iqamaExpiry) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const expiry = new Date(employee.iqamaExpiry + 'T00:00:00');
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      const todayH = g2hObj(today);
      const expiryH = g2hObj(expiry);
      if (todayH && expiryH) {
        let monthsCount = (expiryH.y - todayH.y) * 12 + (expiryH.m - todayH.m);
        if (monthsCount < 0) monthsCount = 0;
        let estimateCost = 0;
        for (let i = 0; i < monthsCount; i++) {
          const currentM = ((todayH.m - 1 + i) % 12) + 1;
          if (!(currentM === 9 && pricing.ramadanFree)) {
            estimateCost += pricing.kafala;
          }
        }
        remainingMonthsText = `${monthsCount} شهر كفالة متبقّية — القيمة التقديرية: ${estimateCost.toLocaleString('ar-SA')} ريال`;
      } else {
        remainingMonthsText = `${diffDays} يوم متبقّي على انتهاء الإقامة`;
      }
    } else {
      remainingMonthsText = '⚠️ الإقامة منتهية الصلاحية حالياً';
    }
  }

  // Generate complete interactive double-entry ledger list
  const ledger: LedgerLine[] = [];

  // Sum up subsequent debt transactions by category so we can subtract them from initial balances
  let subIqamaDebts = 0;
  let subKafalaDebts = 0;
  let subOtherDebts = 0;

  empPayments.forEach(p => {
    if (p.type?.includes('مديونية')) {
      const amt = parseFloat(String(p.amount || 0));
      if (p.type?.includes('كفالة')) {
        subKafalaDebts += amt;
      } else if (p.type?.includes('إقامة') || p.type?.includes('تجديد')) {
        subIqamaDebts += amt;
      } else {
        subOtherDebts += amt;
      }
    }
  });

  const initialIqDeb = Math.max(0, parseFloat(String(employee.iqamaBalance || 0)) - subIqamaDebts);
  if (initialIqDeb > 0) {
    ledger.push({
      key: 'init_iqama',
      date: employee.addedDate?.slice(0, 10) || '-',
      hijri: '',
      bayan: 'رصيد رسوم الإقامة الافتتاحي المستحق',
      debit: initialIqDeb,
      credit: 0,
      color: 'bg-red-50/40 border-r-4 border-red-500'
    });
  }

  const initialKfDeb = Math.max(0, (parseFloat(String(employee.kafalaCount || 0)) * pricing.kafala) - subKafalaDebts);
  if (initialKfDeb > 0) {
    const adjustedKfMonths = Math.max(0, Math.round(initialKfDeb / pricing.kafala));
    ledger.push({
      key: 'init_kafala',
      date: employee.addedDate?.slice(0, 10) || '-',
      hijri: '',
      bayan: `رسوم الكفالة التراكمية الافتتاحية (${adjustedKfMonths} أشهر × ${pricing.kafala} ريال)`,
      debit: initialKfDeb,
      credit: 0,
      color: 'bg-red-50/40 border-r-4 border-red-500'
    });
  }

  const initialOthDeb = Math.max(0, parseFloat(String(employee.otherDebt || 0)) - subOtherDebts);
  if (initialOthDeb > 0) {
    ledger.push({
      key: 'init_other',
      date: employee.addedDate?.slice(0, 10) || '-',
      hijri: '',
      bayan: employee.otherDebtDesc ? `متعلقات أخرى: ${employee.otherDebtDesc}` : 'مديونية سابقة معلقة أخرى',
      debit: initialOthDeb,
      credit: 0,
      color: 'bg-amber-50/40 border-r-4 border-amber-500'
    });
  }

  // Add all payments / transactions
  empPayments.forEach((p, idx) => {
    const isKafala = p.type?.includes('كفالة');
    const isIqama = p.type?.includes('تجديد') || p.type?.includes('إقامة');
    const isRamadan = isKafala && p.hijriMonth && parseInt(p.hijriMonth, 10) === 9;
    const isDebt = p.type?.includes('مديونية');
    
    let hijriLabel = '';
    if (isKafala && p.hijriMonth) {
      const idxM = parseInt(p.hijriMonth, 10);
      hijriLabel = `${AR_MONTH_NAMES[idxM] || p.hijriMonth} ${p.hijriYear || ''}`;
    } else if (isIqama) {
      hijriLabel = 'إقامة';
    }

    const desc = p.type + (isRamadan && pricing.ramadanFree ? ' 🎁 عفو رمضان المجاني' : '') + (p.notes ? ` — ${p.notes}` : '');
    
    if (isDebt) {
      ledger.push({
        key: p.id || `pay_${idx}`,
        date: p.date,
        hijri: hijriLabel,
        bayan: desc,
        debit: parseFloat(String(p.amount || 0)),
        credit: 0,
        color: 'bg-red-50/20 border-r-4 border-red-400'
      });
    } else {
      ledger.push({
        key: p.id || `pay_${idx}`,
        date: p.date,
        hijri: hijriLabel,
        bayan: desc,
        debit: 0,
        credit: parseFloat(String(p.amount || 0)),
        color: isRamadan ? 'bg-emerald-50/30 border-r-4 border-emerald-400' : 'bg-slate-50/40 border-r-4 border-slate-300'
      });
    }
  });

  // Sort chronologically
  ledger.sort((a, b) => a.date.localeCompare(b.date));

  let runningBalance = 0;
  const totalDebit = ledger.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = ledger.reduce((sum, item) => sum + item.credit, 0);
  const finalBalance = totalDebit - totalCredit;

  // Print friendly view using standard high-quality printing
  const handlePrint = () => {
    const logoSource = logoBase64 ? `<img src="${logoBase64}" style="max-height:80px; max-width:200px; object-fit:contain; border-radius:10px;" />` : '';
    const todayStr = new Date().toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });
    
    let running = 0;
    const printRows = ledger.map((t, i) => {
      running += t.debit - t.credit;
      const statusLabel = running > 0 ? 'مدين 🔴' : running < 0 ? 'دائن 🟢' : 'متوازن';
      const customNote = localNotes[t.key] !== undefined ? localNotes[t.key] : t.bayan;
      return `
        <tr style="background-color: ${t.debit > 0 ? '#fffdfd' : '#fdfdfd'}; font-size: 11px;">
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${i + 1}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-family: monospace;">${t.date}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; color: #475569;">${t.hijri || '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: right;">${customNote}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-weight: bold; color: #b91c1c;">${t.debit > 0 ? t.debit.toLocaleString('ar-SA') : ''}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-weight: bold; color: #15803d;">${t.credit > 0 ? t.credit.toLocaleString('ar-SA') : ''}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-weight: bold; color: ${running > 0 ? '#b91c1c' : '#15803d'};">
            ${Math.abs(running).toLocaleString('ar-SA')} ${statusLabel}
          </td>
        </tr>
      `;
    }).join('');

    const html = `
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>كشف حساب ${employee.name}</title>
        <link href="https://fonts.googleapis.com/css2family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
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
            border-bottom: 3px solid #0d5189;
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
            color: #0d5189;
          }
          .doc-title {
            text-align: left;
          }
          .doc-title h1 {
            margin: 0;
            font-size: 20px;
            color: #0d5189;
            font-weight: 800;
          }
          .doc-title p {
            margin: 5px 0 0 0;
            font-size: 12px;
            color: #64748b;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 13px;
          }
          .info-table td {
            padding: 9px 12px;
            border: 1px solid #e2e8f0;
          }
          .info-table td.label-col {
            background-color: #f1f5f9;
            font-weight: bold;
            width: 20%;
          }
          .stats-grid {
            display: grid;
            grid-template-cols: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 25px;
          }
          .stat-card {
            border-radius: 10px;
            padding: 12px;
            text-align: center;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
          }
          .stat-card .label {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 5px;
          }
          .stat-card .value {
            font-size: 16px;
            font-weight: bold;
            color: #0d5189;
          }
          .ledger-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 15px;
          }
          .ledger-table th {
            background-color: #0d5189;
            color: white;
            padding: 10px;
            font-weight: bold;
            border: 1px solid #0d5189;
          }
          .footer-note {
            margin-top: 40px;
            font-size: 11px;
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
              <div style="font-size:12px; color:#64748b;">إدارة العمالة ومتابعة التراخيص</div>
            </div>
          </div>
          <div class="doc-title">
            <h1>كشف حساب الموظف</h1>
            <p>تاريخ الطباعة: ${todayStr}</p>
          </div>
        </div>

        <table class="info-table">
          <tr>
            <td class="label-col">اسم الموظف:</td>
            <td><strong>${employee.name}</strong></td>
            <td class="label-col">رقم التعريف:</td>
            <td><strong>${employee.employeeId || 'غير مسجل'}</strong></td>
          </tr>
          <tr>
            <td class="label-col">رقم الإقامة:</td>
            <td style="font-family: monospace;">${employee.iqamaNo}</td>
            <td class="label-col">الفرع التابع:</td>
            <td>${employee.branch || '-'}</td>
          </tr>
          <tr>
            <td class="label-col">رقم الجوال:</td>
            <td>${employee.mobile || '-'}</td>
            <td class="label-col">انتهاء الإقامة (هجري):</td>
            <td><strong>${formattedHijriExpiry || '-'} <small style="font-weight: normal; color: #64748b;">(ميلادي: ${employee.iqamaExpiry})</small></strong></td>
          </tr>
        </table>

        <div class="stats-grid">
          <div class="stat-card" style="border-right: 4px solid #b91c1c;">
            <div class="label">إجمالي المطلوب والرسوم</div>
            <div class="value" style="color: #b91c1c;">${totalDebit.toLocaleString('ar-SA')} ريال</div>
          </div>
          <div class="stat-card" style="border-right: 4px solid #15803d;">
            <div class="label">إجمالي المدفوع سلفاً</div>
            <div class="value" style="color: #15803d;">${totalCredit.toLocaleString('ar-SA')} ريال</div>
          </div>
          <div class="stat-card" style="border-right: 4px solid ${finalBalance > 0 ? '#b91c1c' : '#15803d'}; background-color: ${finalBalance > 0 ? '#fef2f2' : '#f0fdf4'};">
            <div class="label">حالة الرصيد الحالي</div>
            <div class="value" style="color: ${finalBalance > 0 ? '#b91c1c' : '#15803d'};">
              ${Math.abs(finalBalance).toLocaleString('ar-SA')} ريال ${finalBalance > 0 ? '(مطلوب سداد)' : '(رصيد دائن)'}
            </div>
          </div>
          <div class="stat-card" style="border-right: 4px solid #0d5189;">
            <div class="label">مسدد له كفالة حتى شهر</div>
            <div class="value" style="font-size:12px;">${lastPaidMonthText}</div>
          </div>
        </div>

        <h3 style="color:#0d5189; border-bottom: 2px solid #0d5189; padding-bottom: 6px; margin-top:30px; font-size:14px;">
          📒 تفاصيل الحركات المالية والقيود التفصيلية (مدين / دائن)
        </h3>

        <table class="ledger-table">
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 15%;">تاريخ القيد</th>
              <th style="width: 15%;">الشهر الهجري</th>
              <th style="width: 40%">البيان التفصيلي للعملية</th>
              <th style="width: 10%">سحب دَين (مدين)</th>
              <th style="width: 10%">توريد دفعة (دائن)</th>
              <th style="width: 15%">المتبقي الجاري</th>
            </tr>
          </thead>
          <tbody>
            ${printRows}
          </tbody>
          <tfoot>
            <tr style="background-color: #f1f5f9; font-weight: bold; font-size: 12px;">
              <td colspan="4" style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">إجمالي الأرصدة والمطابقات</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #b91c1c;">${totalDebit.toLocaleString('ar-SA')}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #15803d;">${totalCredit.toLocaleString('ar-SA')}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: ${finalBalance > 0 ? '#b91c1c' : '#15803d'};">
                ${Math.abs(finalBalance).toLocaleString('ar-SA')} ريال ${finalBalance > 0 ? '(مدين)' : '(دائن)'}
              </td>
            </tr>
          </tfoot>
        </table>

        <div class="footer-note">
          تعتبر هذه الوثيقة كشف حساب داخلي لشركة ${companyName || 'المؤسسة'} - تم استخراجه وتصنيفه برمجياً.
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

  return (
    <div className="space-y-6">
      {/* Information grid header card & Profile */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
              <span className="text-xs text-slate-500 font-bold">ملف حساب العميل غير المسدد</span>
            </div>
            <h3 className="text-xl font-extrabold text-[#0d5189]">{employee.name}</h3>
            <p className="text-xs text-slate-500 mt-1">كشف ذمة مالية دقيق يدمج رسوم رخص الإقامة، الكفالة التراكمية، ومقبوضات السداد.</p>
          </div>
          
          <button
            onClick={handlePrint}
            className="btn btn-primary shadow-sm text-sm"
          >
            <Printer className="w-4 h-4 ml-1" />
            <span>طباعة وتصدير PDF كشف رسمي</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
          <div className="space-y-2">
            <span className="text-slate-400 block text-xs">رقم التعريف (الكود)</span>
            <span className="font-mono font-bold text-slate-800 text-sm bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg inline-block">{employee.employeeId || 'غير مسجل'}</span>
          </div>
          <div className="space-y-2">
            <span className="text-slate-400 block text-xs">رقم الإقامة</span>
            <span className="font-mono font-semibold text-slate-700 text-sm bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg inline-block">{employee.iqamaNo}</span>
          </div>
          <div className="space-y-2">
            <span className="text-slate-400 block text-xs">الجوال الشخصي</span>
            <span className="text-slate-800 font-medium">{employee.mobile || 'غير مسجل'}</span>
          </div>
          <div className="space-y-2">
            <span className="text-slate-400 block text-xs">انتهاء الإقامة (بالتقويم الهجري)</span>
            <span className="text-[#0d5189] font-extrabold text-base">{formattedHijriExpiry || '-'} <small className="text-xs text-slate-400 font-bold">(الموافق {employee.iqamaExpiry})</small></span>
          </div>
        </div>

        {remainingMonthsText && (
          <div className="mt-4 bg-[#f0f9ff] text-[#0284c7] px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold border border-sky-100">
            <Sparkles className="w-4 h-4" />
            <span>{remainingMonthsText}</span>
          </div>
        )}
      </div>

      {/* Numerical Stats overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 text-center">
          <span className="text-xs text-slate-500 block mb-1">إجمالي المستحقات (مدين)</span>
          <span className="text-xl font-black text-red-700">{totalDebit.toLocaleString()} ريال</span>
        </div>
        
        <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 text-center">
          <span className="text-xs text-slate-500 block mb-1">إجمالي المدفوعات (دائن)</span>
          <span className="text-xl font-black text-emerald-700">{totalCredit.toLocaleString()} ريال</span>
        </div>

        <div className={`rounded-2xl p-4 text-center border ${finalBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <span className="text-xs text-slate-500 block mb-1">الرصيد الجاري المستحق</span>
          <span className={`text-xl font-black ${finalBalance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {Math.abs(finalBalance).toLocaleString()} ريال {finalBalance > 0 ? '(مدين)' : '(دائن/دفع مسبق)'}
          </span>
        </div>

        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 text-center">
          <span className="text-xs text-slate-400 block mb-1">آخر كفالة مسددة</span>
          <span className="text-sm font-bold text-primary block mt-1.5">{lastPaidMonthText}</span>
        </div>
      </div>

      {/* Summary distribution grids */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xs uppercase tracking-wider font-extrabold text-slate-500 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            <span>دفتر القيود والمعاملات الجاري — قابلة للتعديل</span>
          </h4>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
            * اضغط مباشرة على حقل البيان لتعديل الاسم والوصف وتوجيه القيد يدويًا.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#f8fafc] text-slate-700 text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-center font-bold">#</th>
                <th className="px-4 py-3 text-center font-bold">تاريخ القيد</th>
                <th className="px-4 py-3 text-center font-bold">الشهر الهجري</th>
                <th className="px-4 py-3 font-bold text-right">البيان التفصيلي للعملية (اضغط للتعديل)</th>
                <th className="px-4 py-3 text-center font-bold text-red-600">القيمة المطلوبة (مدين)</th>
                <th className="px-4 py-3 text-center font-bold text-emerald-600">القيمة المدفوعة (دائن)</th>
                <th className="px-4 py-3 text-center font-bold">الرصيد التراكمي</th>
                {currentUser?.role !== 'viewer' && (
                  <th className="px-4 py-3 text-center font-bold">التحكم</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((line, idx) => {
                const isDebit = line.debit > 0;
                const valueText = isDebit ? `+${line.debit}` : `-${line.credit}`;
                // Get edited note if any
                const currentBayan = localNotes[line.key] !== undefined ? localNotes[line.key] : line.bayan;

                // Running balance calculation dynamically
                let runningAtThisPoint = 0;
                for (let k = 0; k <= idx; k++) {
                  runningAtThisPoint += ledger[k].debit - ledger[k].credit;
                }

                const isDeletable = line.key !== 'init_iqama' && line.key !== 'init_kafala' && line.key !== 'init_other';

                return (
                  <tr key={line.key} className={`hover:bg-slate-50/50 transition-colors ${line.color}`}>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs text-center">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-center text-slate-600">{line.date}</td>
                    <td className="px-4 py-3 text-center text-slate-500 text-xs">{line.hijri || '-'}</td>
                    <td className="px-4 py-3">
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const val = e.currentTarget.textContent || '';
                          saveLineNote(line.key, val);
                        }}
                        className="p-1 rounded text-slate-800 text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none hover:bg-slate-200/50 cursor-pointer transition-all border border-transparent"
                        title="انقر هنا لتغيير وصف هذا القيد"
                      >
                        {currentBayan}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-red-600">
                      {isDebit ? line.debit.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-600">
                      {!isDebit ? line.credit.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      <span className={`font-bold ${runningAtThisPoint > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {Math.abs(runningAtThisPoint).toLocaleString()} ريال {runningAtThisPoint > 0 ? 'مدين' : 'دائن'}
                      </span>
                    </td>
                    {currentUser?.role !== 'viewer' && (
                      <td className="px-4 py-3 text-center">
                        {isDeletable ? (
                          <button
                            onClick={() => {
                              if (onDeletePayment) {
                                const amt = isDebit ? line.debit : line.credit;
                                const typeLabel = isDebit ? 'قيد مديونية' : 'دفعة سداد';
                                if (confirm(`⚠️ تحذير محاسبي!\nهل أنت متأكد من رغبتك في حذف هذا القيد (${typeLabel}) بقيمة ${amt.toLocaleString()} ريال نهائياً من ذمة العامل؟`)) {
                                  onDeletePayment(line.key, employee.name, amt);
                                }
                              }
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer font-bold"
                            title="حذف هذا القيد المدخل بالخطأ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] hidden lg:inline">حذف</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-normal select-none">قيد أساسي</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {ledger.length > 0 && (
              <tfoot className="bg-slate-50 text-slate-800 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-center">المقاصة الإجمالية الجارية</td>
                  <td className="px-4 py-3 text-center text-red-600 font-black">{totalDebit.toLocaleString()} ريال</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-black">{totalCredit.toLocaleString()} ريال</td>
                  <td className="px-4 py-3 text-center font-black">
                    <span className={finalBalance > 0 ? 'text-red-700' : 'text-emerald-700'}>
                      {Math.abs(finalBalance).toLocaleString()} ريال {finalBalance > 0 ? 'متبقي مدين' : 'فائض دائن'}
                    </span>
                  </td>
                  {currentUser?.role !== 'viewer' && <td className="px-4 py-3 text-center"></td>}
                </tr>
              </tfoot>
            )}
          </table>
          {ledger.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              لا توجد قيود تاريخية مسجلة لهذا العامل في النظام.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
