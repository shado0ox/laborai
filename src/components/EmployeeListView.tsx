import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, Payment, PricingSettings, UserProfile } from '../types';
import { g2h, g2hObj, h2g } from '../utils/hijri';
import { 
  Plus, Search, Sliders, Trash2, ShieldAlert, CheckCircle2,
  Calendar, FileText, Smartphone, MessageSquare, RefreshCw, X, Coins, HelpCircle,
  Upload
} from 'lucide-react';

const AR_HIJRI_MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
];

const getHijriMonthDistance = (fromM: string, toM: string) => {
  const idxFrom = AR_HIJRI_MONTHS.indexOf(fromM);
  const idxTo = AR_HIJRI_MONTHS.indexOf(toM);
  if (idxFrom === -1 || idxTo === -1) return 1;
  if (idxTo >= idxFrom) {
    return idxTo - idxFrom + 1;
  } else {
    return (12 - idxFrom) + (idxTo + 1);
  }
};

interface EmployeeListViewProps {
  employees: Employee[];
  payments: Payment[];
  pricing: PricingSettings;
  branches: string[];
  currentUser: UserProfile;
  onAddEmployee: (emp: Employee) => void;
  onDeleteEmployee: (iqamaNo: string) => void;
  onArchiveEmployee: (iqamaNo: string, reason: string) => void;
  onUpdateEmployeeExpiry: (iqamaNo: string, expiry: string) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onRegisterPayment: (iqamaNo: string, amount: number, type: string, notes?: string, m?: string, y?: string) => void;
  onAddKafalaOrder: (iqamaNo: string, months: number, notes?: string, m?: string, y?: string) => void;
  onShowStatement: (emp: Employee) => void;
}

export default function EmployeeListView({
  employees,
  payments,
  pricing,
  branches,
  currentUser,
  onAddEmployee,
  onDeleteEmployee,
  onArchiveEmployee,
  onUpdateEmployeeExpiry,
  onUpdateEmployee,
  onRegisterPayment,
  onAddKafalaOrder,
  onShowStatement
}: EmployeeListViewProps) {
  
  // App States for list
  const [filterSearch, setFilterSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDebt, setFilterDebt] = useState('');
  const [filterExpiry, setFilterExpiry] = useState('');

  // Modals visibility toggles
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isExpiryOpen, setIsExpiryOpen] = useState(false);
  const [isKafalaOpen, setIsKafalaOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  // Active selected row employee
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Form states: New Employee
  const [gregMode, setGregMode] = useState(true);
  const [newIqama, setNewIqama] = useState('');
  const [newName, setNewName] = useState('');
  const [newExpiryGreg, setNewExpiryGreg] = useState('');
  const [newExpiryHijri, setNewExpiryHijri] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [newKafalaStartMonth, setNewKafalaStartMonth] = useState('شعبان');
  const [newKafalaStartYear, setNewKafalaStartYear] = useState('1447');
  const [newIqamaBalance, setNewIqamaBalance] = useState(0);
  const [newKafalaCount, setNewKafalaCount] = useState(0);
  const [newOtherDebt, setNewOtherDebt] = useState(0);
  const [newOtherDebtDesc, setNewOtherDebtDesc] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Form states: Payment
  const [payTab, setPayTab] = useState<'kafala' | 'iqama' | 'other'>('kafala');
  const [payHijriMonth, setPayHijriMonth] = useState('1');
  const [payHijriYear, setPayHijriYear] = useState('1447');
  const [payAmountKafala, setPayAmountKafala] = useState(pricing.kafala);
  const [payIqamaDuration, setPayIqamaDuration] = useState<3 | 6 | 12>(12);
  const [payIqamaFromMonth, setPayIqamaFromMonth] = useState('1');
  const [payIqamaFromYear, setPayIqamaFromYear] = useState('2026');
  const [payAmountIqama, setPayAmountIqama] = useState(pricing.iqama12);
  const [payOtherType, setPayOtherType] = useState('دفعة جزئية');
  const [payAmountOther, setPayAmountOther] = useState(0);
  const [payOtherNotes, setPayOtherNotes] = useState('');

  // Form states: Renew iqama
  const [renewDuration, setRenewDuration] = useState<3 | 6 | 12>(12);
  const [renewCost, setRenewCost] = useState(pricing.iqama12);
  const [renewNotes, setRenewNotes] = useState('');

  // Form states: Update Expiry Date
  const [newExpDateRaw, setNewExpDateRaw] = useState('');
  const [renewGregMode, setRenewGregMode] = useState(true);
  const [renewExpiryHijri, setRenewExpiryHijri] = useState('');

  // Form states: Register Kafala order
  const [newKafalaOrderMonths, setNewKafalaOrderMonths] = useState(1);
  const [newKafalaRegFromM, setNewKafalaRegFromM] = useState('محرم');
  const [newKafalaRegFromY, setNewKafalaRegFromY] = useState('1447');
  const [newKafalaRegNotes, setNewKafalaRegNotes] = useState('');

  // Form states: Archive employee
  const [archiveReason, setArchiveReason] = useState('نقل خدمات');

  // Form states: Edit Opening Balance (الرصيد الافتتاحي)
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [openingIqamaBalance, setOpeningIqamaBalance] = useState(0);
  const [openingKafalaCount, setOpeningKafalaCount] = useState(0);
  const [openingOtherDebt, setOpeningOtherDebt] = useState(0);
  const [openingOtherDebtDesc, setOpeningOtherDebtDesc] = useState('');

  const handleOpenOpening = (emp: Employee) => {
    setSelectedEmp(emp);
    setOpeningIqamaBalance(emp.iqamaBalance || 0);
    setOpeningKafalaCount(emp.kafalaCount || 0);
    setOpeningOtherDebt(emp.otherDebt || 0);
    setOpeningOtherDebtDesc(emp.otherDebtDesc || '');
    setIsOpeningOpen(true);
  };

  const submitSaveOpening = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    const updated: Employee = {
      ...selectedEmp,
      iqamaBalance: Number(openingIqamaBalance) || 0,
      kafalaCount: Number(openingKafalaCount) || 0,
      otherDebt: Number(openingOtherDebt) || 0,
      otherDebtDesc: openingOtherDebtDesc
    };
    onUpdateEmployee(updated);
    setIsOpeningOpen(false);
    alert(`✓ تم تعديل وتحديث الرصيد الافتتاحي للعامِل ${selectedEmp.name} بنجاح`);
  };

  // Form states: New Consolidated Debt (إثبات مديونية)
  const [isDebtOpen, setIsDebtOpen] = useState(false);
  const [debtTab, setDebtTab] = useState<'kafala' | 'iqama' | 'insurance' | 'other'>('kafala');
  const [debtKafalaMonths, setDebtKafalaMonths] = useState(1);
  const [debtKafalaAmount, setDebtKafalaAmount] = useState(pricing.kafala);
  const [debtKafalaFromM, setDebtKafalaFromM] = useState('محرم');
  const [debtKafalaToM, setDebtKafalaToM] = useState('ذو الحجة');
  const [debtKafalaFromY, setDebtKafalaFromY] = useState('1447');
  const [hasFreeMonths, setHasFreeMonths] = useState(false);
  const [debtFreeFromM, setDebtFreeFromM] = useState('رجب');
  const [debtFreeToM, setDebtFreeToM] = useState('رمضان');
  const [debtKafalaNotes, setDebtKafalaNotes] = useState('');

  useEffect(() => {
    if (debtTab === 'kafala') {
      const totalM = getHijriMonthDistance(debtKafalaFromM, debtKafalaToM);
      const freeM = hasFreeMonths ? getHijriMonthDistance(debtFreeFromM, debtFreeToM) : 0;
      const paidM = Math.max(0, totalM - freeM);
      setDebtKafalaMonths(paidM);
      setDebtKafalaAmount(paidM * pricing.kafala);
    }
  }, [debtKafalaFromM, debtKafalaToM, hasFreeMonths, debtFreeFromM, debtFreeToM, pricing.kafala, debtTab]);
  
  const [debtIqamaDur, setDebtIqamaDur] = useState<3 | 6 | 12>(12);
  const [debtIqamaCost, setDebtIqamaCost] = useState(pricing.iqama12);
  const [debtIqamaNotes, setDebtIqamaNotes] = useState('');
  
  const [debtInsuranceAmt, setDebtInsuranceAmt] = useState(0);
  const [debtInsuranceNotes, setDebtInsuranceNotes] = useState('');
  
  const [debtOtherTitle, setDebtOtherTitle] = useState('');
  const [debtOtherAmt, setDebtOtherAmt] = useState(0);
  const [debtOtherNotes, setDebtOtherNotes] = useState('');

  // Form states: Unified pay options expanded
  const [payAmountInsurance, setPayAmountInsurance] = useState(0);

  // Form states: new employee ID
  const [newEmployeeId, setNewEmployeeId] = useState('');

  const activeRole = currentUser.role;
  const isReadOnly = activeRole === 'viewer';

  // Computed employees showing based on active & filters
  const activeEmployees = employees.filter(e => e.status === 'active');
  const roleFiltered = activeRole === 'branch' && currentUser.branch 
    ? activeEmployees.filter(e => e.branch === currentUser.branch)
    : activeEmployees;

  const today = new Date();
  today.setHours(0,0,0,0);

  const finalEmployeesList = roleFiltered.filter(e => {
    // 1. Search filter
    const matchesSearch = !filterSearch || 
      e.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
      e.iqamaNo.includes(filterSearch) ||
      e.mobile.includes(filterSearch);

    // 2. Branch filter
    const matchesBranch = !filterBranch || e.branch === filterBranch;

    // 3. Expiry status countdown filter
    let matchesExpiry = true;
    let daysDiff: number | null = null;
    if (e.iqamaExpiry) {
      const expDate = new Date(e.iqamaExpiry + 'T00:00:00');
      const timeDiff = expDate.getTime() - today.getTime();
      daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }

    if (filterExpiry === '30') {
      matchesExpiry = daysDiff !== null && daysDiff >= 0 && daysDiff <= 30;
    } else if (filterExpiry === '60') {
      matchesExpiry = daysDiff !== null && daysDiff > 30 && daysDiff <= 60;
    } else if (filterExpiry === 'expired') {
      matchesExpiry = daysDiff !== null && daysDiff < 0;
    }

    // 4. Debt status filter
    const empPaid = payments
      .filter(p => (p.iqamaNo === e.iqamaNo || p.name === e.name) && !p.type?.includes('مديونية'))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const empDue = (e.iqamaBalance || 0) + (e.kafalaCount * pricing.kafala) + (e.otherDebt || 0);
    const balance = empPaid - empDue;

    let matchesDebt = true;
    if (filterDebt === 'debt') {
      matchesDebt = balance < 0;
    } else if (filterDebt === 'clean') {
      matchesDebt = balance >= 0;
    }

    return matchesSearch && matchesBranch && matchesExpiry && matchesDebt;
  });

  const handleOpenPay = (emp: Employee) => {
    setSelectedEmp(emp);
    setPayTab('kafala');
    setPayAmountKafala(pricing.kafala);
    setPayAmountIqama(pricing.iqama12);
    setPayIqamaDuration(12);
    setPayAmountOther(0);
    setPayOtherNotes('');
    setIsPayOpen(true);
  };

  const handleOpenRenew = (emp: Employee) => {
    setSelectedEmp(emp);
    setRenewDuration(12);
    setRenewCost(pricing.iqama12);
    setRenewNotes('');
    setIsRenewOpen(true);
  };

  const handleOpenExpiry = (emp: Employee) => {
    setSelectedEmp(emp);
    setNewExpDateRaw(emp.iqamaExpiry || '');
    setRenewExpiryHijri(emp.iqamaExpiry ? g2h(emp.iqamaExpiry) : '');
    setRenewGregMode(true);
    setIsExpiryOpen(true);
  };

  const handleOpenKafala = (emp: Employee) => {
    setSelectedEmp(emp);
    setNewKafalaOrderMonths(1);
    setNewKafalaRegNotes('');
    setIsKafalaOpen(true);
  };

  const handleOpenArchive = (emp: Employee) => {
    setSelectedEmp(emp);
    setArchiveReason('نقل خدمات');
    setIsArchiveOpen(true);
  };

  const submitAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newIqama.trim()) {
      alert('الرجاء إدخال اسم العامل ورقم الإقامة للإكمال');
      return;
    }

    let calculatedExpiry = newExpiryGreg;
    if (!gregMode && newExpiryHijri) {
      calculatedExpiry = h2g(newExpiryHijri);
    }

    if (!calculatedExpiry) {
      alert('الرجاء إدخال تاريخ انتهاء إقامة صحيح');
      return;
    }

    const payload: Employee = {
      iqamaNo: newIqama.trim(),
      name: newName.trim(),
      employeeId: newEmployeeId.trim() || undefined,
      iqamaExpiry: calculatedExpiry,
      mobile: newMobile.trim() || '-',
      branch: newBranch || branches[0] || 'فرع الرياض الأساسي',
      iqamaBalance: Number(newIqamaBalance) || 0,
      kafalaCount: Number(newKafalaCount) || 0,
      otherDebt: Number(newOtherDebt) || 0,
      otherDebtDesc: newOtherDebtDesc.trim(),
      notes: newNotes.trim() || 'لا توجد ملاحظات',
      status: 'active',
      addedDate: new Date().toISOString(),
      kafalaStartMonth: newKafalaStartMonth,
      kafalaStartYear: newKafalaStartYear
    };

    onAddEmployee(payload);
    setIsAddOpen(false);
    resetAddForm();
  };

  const resetAddForm = () => {
    setNewIqama('');
    setNewName('');
    setNewExpiryGreg('');
    setNewExpiryHijri('');
    setNewMobile('');
    setNewKafalaStartMonth('شعبان');
    setNewKafalaStartYear('1447');
    setNewIqamaBalance(0);
    setNewKafalaCount(0);
    setNewOtherDebt(0);
    setNewOtherDebtDesc('');
    setNewNotes('');
    setNewEmployeeId('');
  };

  const submitPayment = () => {
    if (!selectedEmp) return;
    
    let paidAmt = 0;
    let payType = '';
    let hMonth = '';
    let hYear = '';

    const AR_MONTH_NAMES = [
      '',
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
      'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];

    if (payTab === 'kafala') {
      paidAmt = Number(payAmountKafala) || 0;
      hMonth = payHijriMonth;
      hYear = payHijriYear;
      payType = `من المقبوضات: سداد رسوم كفالة — لشهر ${AR_MONTH_NAMES[parseInt(payHijriMonth, 10)] || payHijriMonth} ${payHijriYear}`;
    } else if (payTab === 'iqama') {
      paidAmt = Number(payAmountIqama) || 0;
      payType = `من المقبوضات: سداد رسوم إقامة — تجديد ${payIqamaDuration} أشهر | من ${payIqamaFromMonth}/${payIqamaFromYear}`;
    } else if (payTab === 'insurance' as any) {
      paidAmt = Number(payAmountInsurance) || 0;
      payType = `من المقبوضات: سداد رسوم التأمين الطبي`;
    } else {
      paidAmt = Number(payAmountOther) || 0;
      payType = payOtherType;
    }

    onRegisterPayment(selectedEmp.iqamaNo, paidAmt, payType, payOtherNotes, hMonth, hYear);
    setIsPayOpen(false);
  };

  const handleOpenDebt = (emp: Employee) => {
    setSelectedEmp(emp);
    setDebtTab('kafala');
    setDebtKafalaMonths(1);
    setDebtKafalaAmount(pricing.kafala);
    setDebtKafalaFromM('محرم');
    setDebtKafalaToM('ذو الحجة');
    setDebtKafalaFromY('1447');
    setHasFreeMonths(false);
    setDebtFreeFromM('رجب');
    setDebtFreeToM('رمضان');
    setDebtKafalaNotes('');
    
    setDebtIqamaDur(12);
    setDebtIqamaCost(pricing.iqama12);
    setDebtIqamaNotes('');
    
    setDebtInsuranceAmt(0);
    setDebtInsuranceNotes('');
    
    setDebtOtherTitle('');
    setDebtOtherAmt(0);
    setDebtOtherNotes('');
    
    setIsDebtOpen(true);
  };

  const submitDebtOrder = () => {
    if (!selectedEmp) return;

    if (debtTab === 'kafala') {
      const months = Number(debtKafalaMonths) || 0;
      const customAmt = Number(debtKafalaAmount) || 0;
      
      const updated = {
        ...selectedEmp,
        kafalaCount: (selectedEmp.kafalaCount || 0) + months
      };
      
      const defaultCost = months * pricing.kafala;
      const diff = customAmt - defaultCost;
      if (diff !== 0) {
        updated.otherDebt = (updated.otherDebt || 0) + diff;
        updated.otherDebtDesc = updated.otherDebtDesc 
          ? `${updated.otherDebtDesc} + فرق كفالة` 
          : `فرق تكلفة كفالة هجرية`;
      }
      
      let detailDesc = `إثبات كفالة بقيمة ${customAmt} ر.س — للفترة من ${debtKafalaFromM} إلى ${debtKafalaToM}`;
      if (hasFreeMonths) {
        detailDesc += ` (ويوجد شهور مجانية من ${debtFreeFromM} إلى ${debtFreeToM})`;
      }
      detailDesc += ` هـ مضافة للمديونية`;
      
      onUpdateEmployee(updated);
      onRegisterPayment(selectedEmp.iqamaNo, customAmt, `قيد مديونية: ${detailDesc}`, debtKafalaNotes, debtKafalaFromM, debtKafalaFromY);
    } 
    
    else if (debtTab === 'iqama') {
      const cost = Number(debtIqamaCost) || 0;
      const updated = {
        ...selectedEmp,
        iqamaBalance: (selectedEmp.iqamaBalance || 0) + cost
      };
      
      onUpdateEmployee(updated);
      onRegisterPayment(selectedEmp.iqamaNo, cost, `قيد مديونية: إثبات رسوم إقامة بقيمة ${cost} ر.س — تجديد ${debtIqamaDur} أشهر`, debtIqamaNotes);
    } 
    
    else if (debtTab === 'insurance') {
      const amt = Number(debtInsuranceAmt) || 0;
      const updated = {
        ...selectedEmp,
        otherDebt: (selectedEmp.otherDebt || 0) + amt,
        otherDebtDesc: selectedEmp.otherDebtDesc 
          ? `${selectedEmp.otherDebtDesc} + تأمين طبي` 
          : `رسوم تأمين طبي`
      };
      
      onUpdateEmployee(updated);
      onRegisterPayment(selectedEmp.iqamaNo, amt, `قيد مديونية: إثبات رسوم تأمين طبي بقيمة ${amt} ر.س`, debtInsuranceNotes);
    } 
    
    else {
      const amt = Number(debtOtherAmt) || 0;
      const updated = {
        ...selectedEmp,
        otherDebt: (selectedEmp.otherDebt || 0) + amt,
        otherDebtDesc: debtOtherTitle.trim() || 'مديونية أخرى معلقة'
      };
      
      onUpdateEmployee(updated);
      onRegisterPayment(selectedEmp.iqamaNo, amt, `قيد مديونية: إثبات مديونية أخرى (${debtOtherTitle || 'مديونية معلقة'}) بقيمة ${amt} ر.س`, debtOtherNotes);
    }

    setIsDebtOpen(false);
    alert(`✓ تم تسجيل وتوثيق الاستحقاق المالي بنجاح في مديونية الموظف ${selectedEmp.name}`);
  };

  const submitUpdateExpiry = () => {
    if (!selectedEmp) return;
    let finalExpiry = newExpDateRaw;
    if (!renewGregMode && renewExpiryHijri) {
      finalExpiry = h2g(renewExpiryHijri);
    }
    if (!finalExpiry) {
      alert('الرجاء إدخال تاريخ انتهاء إقامة صحيح');
      return;
    }
    onUpdateEmployeeExpiry(selectedEmp.iqamaNo, finalExpiry);
    setIsExpiryOpen(false);
  };

  const submitArchive = () => {
    if (!selectedEmp) return;
    onArchiveEmployee(selectedEmp.iqamaNo, archiveReason);
    setIsArchiveOpen(false);
  };

  // Safe Excel exporter
  const triggerExcelExport = () => {
    let tsv = 'الاسم\tرقم الإقامة\tالفرع الجاري\tانتهاء الإقامة ميلادي\tانتهاء الإقامة هجري\tالجوال\tالمطلوب الإجمالي\tإجمالي المدفوع\tالرصيد المتبقي\n';
    
    finalEmployeesList.forEach(e => {
      const pmts = payments.filter(p => (p.iqamaNo === e.iqamaNo || p.name === e.name) && !p.type?.includes('مديونية'));
      const paid = pmts.reduce((s, p) => s + (p.amount || 0), 0);
      const due = (e.iqamaBalance || 0) + (e.kafalaCount * pricing.kafala) + (e.otherDebt || 0);
      const bal = paid - due;
      const hExp = g2h(e.iqamaExpiry);

      tsv += `${e.name}\t${e.iqamaNo}\t${e.branch}\t${e.iqamaExpiry}\t${hExp}\t${e.mobile}\t${due}\t${paid}\t${bal}\n`;
    });

    const blob = new Blob(['\uFEFF' + tsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `كشف_العمالة_تصدير_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length <= 1) {
          alert('الملف فارغ أو لا يحتوي على صفوف بيانات.');
          return;
        }

        const headers = data[0].map(h => String(h || '').trim());
        const findColIdx = (names: string[]) => {
          return headers.findIndex(h => names.some(n => h.includes(n) || n.includes(h)));
        };

        const nameIdx = findColIdx(['الاسم', 'اسم الموظف', 'العامل', 'الرباعي', 'Name', 'employee_name']);
        const iqamaIdx = findColIdx(['الإقامة', 'رقم الإقامة', 'الهوية', 'Iqama', 'national_id', 'iqama_no']);
        const empIdIdx = findColIdx(['رقم الموظف', 'الرقم الوظيفي', 'رقم تعريف الموظف', 'كود', 'Employee ID', 'employee_id']);
        const expiryIdx = findColIdx(['تاريخ الانتهاء', 'انتهاء الإقامة', 'انتهاء الاقامه', 'الانتهاء', 'expiry', 'iqama_expiry']);
        const mobileIdx = findColIdx(['الجوال', 'رقم الجوال', 'هاتف', 'جوال', 'Mobile', 'phone']);
        const branchIdx = findColIdx(['الفرع', 'الفرع التابع', 'فرع', 'Branch', 'branch_name']);
        const iqamaBalIdx = findColIdx(['رصيد الإقامة', 'الرصيد', 'رصيد الاقامة', 'رصيد', 'iqama_balance', 'iqama_bal']);
        const kafalaCountIdx = findColIdx(['أشهر الكفالة', 'عدد الكفالات', 'كفالة', 'كفالات', 'kafala_count', 'kafala']);
        const otherDebtIdx = findColIdx(['ديون أخرى', 'ديون اخرى', 'مديونية أخرى', 'other_debt']);
        const otherDebtDescIdx = findColIdx(['تفاصيل الديون', 'تفاصيل الديون الأخرى', 'وصف الديون', 'other_debt_desc']);
        const notesIdx = findColIdx(['ملاحظات', 'ملاحظه', 'Notes', 'notes']);

        if (nameIdx === -1 || iqamaIdx === -1) {
          alert('خطأ: لم يتم العثور على أعمدة أساسية ("الاسم الرباعي" و "رقم الإقامة") في الملف المرفوع. يرجى التأكد من تسمية الأعمدة بشكل واضح.');
          return;
        }

        let importCount = 0;
        let skipCount = 0;

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const rawIqama = String(row[iqamaIdx] || '').trim();
          const name = String(row[nameIdx] || '').trim();

          if (!rawIqama || !name) {
            continue;
          }

          // Check if it already exists
          if (employees.some(emp => emp.iqamaNo === rawIqama)) {
            skipCount++;
            continue;
          }

          // Parse Expiry Date
          let rawExpiry = expiryIdx !== -1 ? String(row[expiryIdx] || '').trim() : '';
          let calculatedExpiry = '';

          if (rawExpiry) {
            if (!isNaN(Number(rawExpiry)) && Number(rawExpiry) > 40000) {
              const excelDate = new Date((Number(rawExpiry) - 25569) * 86400 * 1000);
              calculatedExpiry = excelDate.toISOString().slice(0, 10);
            } else {
              if (rawExpiry.includes('/') || rawExpiry.includes('-')) {
                const parts = rawExpiry.split(/[\/\-]/);
                const firstPart = parseInt(parts[0], 10);
                if (firstPart > 1300 && firstPart < 1500) {
                  calculatedExpiry = h2g(rawExpiry);
                } else {
                  if (firstPart < 100) {
                    const d = new Date(rawExpiry);
                    if (!isNaN(d.getTime())) {
                      calculatedExpiry = d.toISOString().slice(0, 10);
                    }
                  } else {
                    calculatedExpiry = rawExpiry;
                  }
                }
              }
            }
          }

          if (!calculatedExpiry) {
            const future = new Date();
            future.setFullYear(future.getFullYear() + 1);
            calculatedExpiry = future.toISOString().slice(0, 10);
          }

          const empId = empIdIdx !== -1 && row[empIdIdx] ? String(row[empIdIdx]).trim() : undefined;
          const mobile = mobileIdx !== -1 && row[mobileIdx] ? String(row[mobileIdx]).trim() : '-';
          const branch = branchIdx !== -1 && row[branchIdx] ? String(row[branchIdx]).trim() : (branches[0] || 'فرع الرياض الأساسي');
          const iqamaBalance = iqamaBalIdx !== -1 ? Number(row[iqamaBalIdx]) || 0 : 0;
          const kafalaCount = kafalaCountIdx !== -1 ? Number(row[kafalaCountIdx]) || 0 : 0;
          const otherDebt = otherDebtIdx !== -1 ? Number(row[otherDebtIdx]) || 0 : 0;
          const otherDebtDesc = otherDebtDescIdx !== -1 && row[otherDebtDescIdx] ? String(row[otherDebtDescIdx]).trim() : '';
          const notes = notesIdx !== -1 && row[notesIdx] ? String(row[notesIdx]).trim() : 'لا توجد ملاحظات';

          const newEmp: Employee = {
            iqamaNo: rawIqama,
            name: name,
            employeeId: empId,
            iqamaExpiry: calculatedExpiry,
            mobile: mobile,
            branch: branch,
            iqamaBalance: iqamaBalance,
            kafalaCount: kafalaCount,
            otherDebt: otherDebt,
            otherDebtDesc: otherDebtDesc,
            notes: notes,
            status: 'active',
            addedDate: new Date().toISOString(),
            kafalaStartMonth: 'شعبان',
            kafalaStartYear: '1447'
          };

          onAddEmployee(newEmp);
          importCount++;
        }

        alert(`✓ تم استيراد عدد (${importCount}) موظف بنجاح من ملف الإكسيل. تم تخطي عدد (${skipCount}) موظف مكرر أو غير مكتمل البيانات.`);
        e.target.value = '';
      } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء قراءة ملف الإكسيل، يرجى التأكد من صحة تنسيق الملف وامتداده (.xlsx, .xls).');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-4">
      
      {/* Header controls and Search view: Ultra Condensed Single-Row Hub */}
      <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-xl shadow-2xs">
        <div className="flex flex-row flex-wrap items-center gap-1.5 text-xs font-bold">
          
          {/* Quick Info icon & title */}
          <div className="flex items-center gap-1 text-slate-700 font-extrabold shrink-0 bg-white px-2 py-1 rounded-lg border border-slate-200">
            <Sliders className="w-3.5 h-3.5 text-primary-light" />
            <span className="text-[10px]">تصفية العمالة</span>
          </div>

          {/* Combined Search/Filter Inputs */}
          <div className="flex-1 min-w-[150px] relative">
            <input 
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="البحث بالاسم، الإقامة، الجوال..."
              className="w-full pl-7 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light text-slate-800 text-[11px] h-[28px]"
            />
            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <div className="shrink-0 min-w-[100px]">
            <select 
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg py-0.5 px-1.5 focus:outline-none text-slate-800 text-[11px] h-[28px]"
            >
              <option value="">كل الفروع</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="shrink-0 min-w-[100px]">
            <select 
              value={filterExpiry}
              onChange={(e) => setFilterExpiry(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg py-0.5 px-1.5 focus:outline-none text-slate-800 text-[11px] h-[28px]"
            >
              <option value="">حالة الإنتهاء</option>
              <option value="30">ينتهي قريباً (30 يوم)</option>
              <option value="60">ينتهي قريباً (60 يوم)</option>
            </select>
          </div>

          {/* Quick Actions (Add/Import/Export) directly adjacent to inputs */}
          <div className="flex items-center gap-1 flex-wrap ml-auto">
            {!isReadOnly && (
              <>
                <button 
                  onClick={() => setIsAddOpen(true)}
                  className="btn btn-primary text-[10px] cursor-pointer flex items-center gap-0.5 px-2 py-1 rounded-lg font-black h-[28px]"
                >
                  <Plus className="w-3 h-3" />
                  <span>إضافة موظف 👤</span>
                </button>
                <input 
                  type="file" 
                  id="excelImportFile" 
                  accept=".xlsx, .xls" 
                  onChange={handleExcelImport} 
                  className="hidden" 
                />
                <button 
                  onClick={() => document.getElementById('excelImportFile')?.click()}
                  className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-[10px] flex items-center gap-0.5 cursor-pointer font-bold px-2 py-1 rounded-lg h-[28px]"
                >
                  <Upload className="w-3 h-3" />
                  <span>استيراد 📥</span>
                </button>
              </>
            )}
            <button 
              onClick={triggerExcelExport}
              className="btn btn-green text-[10px] flex items-center gap-0.5 px-2 py-1 rounded-lg h-[28px]"
            >
              <span>تصدير 📤</span>
            </button>
          </div>

        </div>
      </div>

      {/* Employees Table view */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-right border-collapse">
            <thead className="bg-[#0b2844] text-white text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-2 py-2 text-center font-extrabold">#</th>
                <th className="px-2 py-2 font-extrabold text-right">الاسم الرباعي للعامل</th>
                <th className="px-2 py-2 text-center font-extrabold">رقم التعريف (الكود)</th>
                <th className="px-2 py-2 text-center font-extrabold">رقم الإقامة</th>
                <th className="px-2 py-2 text-center font-extrabold">الفرع</th>
                <th className="px-2 py-2 text-center font-extrabold">تاريخ الانتهاء ميلادي</th>
                <th className="px-2 py-2 text-center font-extrabold">الانتهاء هجري</th>
                <th className="px-2 py-2 text-center font-extrabold">أيام متبقية</th>
                <th className="px-2 py-2 text-center font-extrabold">الهاتف</th>
                <th className="px-2 py-2 text-center font-extrabold">المطلوب</th>
                <th className="px-2 py-2 text-center font-extrabold">المسدد</th>
                <th className="px-2 py-2 text-center font-extrabold">الرصيد المتبقي</th>
                <th className="px-2 py-2 text-center font-extrabold">الإجراءات والقيود</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {finalEmployeesList.map((e, index) => {
                const empPays = payments.filter(p => (p.iqamaNo === e.iqamaNo || p.name === e.name) && !p.type?.includes('مديونية'));
                const totalPaid = empPays.reduce((sum, p) => sum + (p.amount || 0), 0);
                const totalDue = (e.iqamaBalance || 0) + (e.kafalaCount * pricing.kafala) + (e.otherDebt || 0);
                const balance = totalPaid - totalDue;

                // Expiry colors
                let daysLeftVal: number | null = null;
                if (e.iqamaExpiry) {
                  const expDate = new Date(e.iqamaExpiry + 'T00:00:00');
                  daysLeftVal = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                }

                const iqamaHijri = g2h(e.iqamaExpiry);

                let badgeExpiryColor = 'bg-emerald-50 text-emerald-700';
                let rowBgColor = '';

                if (daysLeftVal !== null) {
                  if (daysLeftVal < 0) {
                    badgeExpiryColor = 'bg-red-100 text-red-700 font-black animate-pulse';
                    rowBgColor = 'bg-red-50/20';
                  } else if (daysLeftVal <= 30) {
                    badgeExpiryColor = 'bg-red-50 text-red-750 font-black';
                    rowBgColor = 'bg-red-50/10';
                  } else if (daysLeftVal <= 60) {
                    badgeExpiryColor = 'bg-amber-50 text-amber-800';
                    rowBgColor = 'bg-amber-50/10';
                  }
                }

                // WhatsApp messaging generators
                const cleanMob = e.mobile?.replace(/\D/g, '');
                const formattedMob = cleanMob ? (cleanMob.startsWith('0') ? '966' + cleanMob.slice(1) : (cleanMob.startsWith('966') ? cleanMob : '966' + cleanMob)) : '';
                const waText = encodeURIComponent(`عزيزي الموظف ${e.name}، نود إشعارك بقرب انتهاء رخصة الإقامة كفيلك الحالي بتاريخ هجري ${iqamaHijri} الموافق ${e.iqamaExpiry}. كما يرجى مراجعة الإدارة لسداد المستحقات وقدرها ${Math.abs(balance).toLocaleString()} ريال لتفادي الغرامات المتراكمة.`);

                return (
                  <tr key={e.iqamaNo} className={`hover:bg-slate-50/60 transition-colors ${rowBgColor}`}>
                    <td className="px-2 py-1.5 text-center text-slate-400 font-mono text-[10px]">{index + 1}</td>
                    <td className="px-2 py-1.5 font-bold text-slate-900 text-right">
                      <div>{e.name}</div>
                      {e.kafalaStartMonth && (
                        <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
                          بداية الكفالة: {e.kafalaStartMonth} {e.kafalaStartYear}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input 
                        type="text" 
                        value={e.employeeId || ''} 
                        placeholder="يدوي ✎"
                        disabled={isReadOnly}
                        onChange={(event) => {
                          const val = event.target.value;
                          onUpdateEmployee({ ...e, employeeId: val });
                        }}
                        className="w-20 text-center font-mono font-bold text-[10px] py-0.5 px-1 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-light text-slate-700 placeholder:text-slate-300 placeholder:font-normal"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono text-slate-600 font-semibold">{e.iqamaNo}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 font-extrabold text-[10px]">{e.branch}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono text-slate-600">{e.iqamaExpiry}</td>
                    <td className="px-2 py-1.5 text-center font-extrabold text-primary">{iqamaHijri}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${badgeExpiryColor}`}>
                        {daysLeftVal !== null ? (daysLeftVal < 0 ? `منتهية ${Math.abs(daysLeftVal)} يوم` : `${daysLeftVal} يوم`) : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono text-[10px]">{e.mobile || 'غير مسجل'}</td>
                    <td className="px-2 py-1.5 text-center font-black text-red-600">{totalDue.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-center font-black text-emerald-600">{totalPaid.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`px-1.5 py-0.2 rounded font-black text-[10px] ${balance < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {balance.toLocaleString()} {balance < 0 ? 'مستحق' : 'فائض'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1 flex-wrap min-w-[200px]">
                        <button 
                          onClick={() => onShowStatement(e)}
                          className="px-1.5 py-0.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-[10px] font-bold transition-all cursor-pointer"
                        >
                          📋 كشف
                        </button>
                        
                        {!isReadOnly && (
                          <>
                             <button 
                              onClick={() => handleOpenPay(e)}
                              className="px-1.5 py-0.5 bg-emerald-100 text-emerald-850 hover:bg-emerald-200 rounded text-[10px] font-bold transition-all cursor-pointer"
                            >
                              💵 دفعة
                            </button>
                             <button 
                              onClick={() => handleOpenDebt(e)}
                              className="px-1.5 py-0.5 bg-rose-100 text-rose-850 hover:bg-rose-200 rounded text-[10px] font-bold transition-all cursor-pointer"
                            >
                              ⚖️ مديونية
                            </button>
                             <button 
                              onClick={() => handleOpenOpening(e)}
                              className="px-1.5 py-0.5 bg-amber-100 text-amber-900 hover:bg-amber-150 rounded text-[10px] font-bold transition-all cursor-pointer"
                              title="تعديل وتحديث الرصيد الافتتاحي المستحق"
                            >
                              💳 افتتاح
                            </button>
                            <button 
                              onClick={() => handleOpenExpiry(e)}
                              className="px-1.5 py-0.5 bg-sky-100 text-sky-850 hover:bg-sky-200 rounded text-[10px] font-bold transition-all cursor-pointer"
                            >
                              📅 تاريخ
                            </button>
                            <button 
                              onClick={() => handleOpenArchive(e)}
                              className="px-1.5 py-0.5 bg-slate-200 text-slate-800 hover:bg-slate-350 rounded text-[10px] font-bold transition-all cursor-pointer"
                            >
                              📦 أرشفة
                            </button>
                            {activeRole === 'admin' && (
                              <button 
                                onClick={() => {
                                  if (confirm(`تحذير نهائي! هل أنت متأكد من حذف الموظف "${e.name}" بشكل كلي ونهائي من قاعدة البيانات؟ سيتم مسح قيوده المالية كذلك.`)) {
                                    onDeleteEmployee(e.iqamaNo);
                                  }
                                }}
                                className="px-1 py-0.5 text-red-600 hover:bg-red-50 rounded transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}

                        {formattedMob && (
                          <a 
                            href={`https://wa.me/${formattedMob}?text=${waText}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-[#25d366]/10 text-emerald-600 hover:bg-[#25d366]/20 rounded-lg font-bold transition-all flex items-center gap-0.5"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>واتساب</span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {finalEmployeesList.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400 font-bold">
                    لا تتوفر السجلات المطابقة لفلتر البحث الجاري.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📥 MODAL 1: ADD EMPLOYEE */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitAddEmployee} className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden text-right">
            <div className="bg-gradient-to-r from-primary to-primary-light p-4 text-white flex justify-between items-center bg-[#0d5189]">
              <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                <Plus className="w-5 h-5" />
                <span>إضافة موظف عمالة جديد لقاعدة البيانات</span>
              </h4>
              <button type="button" onClick={() => setIsAddOpen(false)} className="text-white hover:bg-white/10 p-1 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-5 max-h-[80vh] overflow-y-auto space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1.5">
                <label className="text-slate-600 block mb-1 font-extrabold">📅 نوع التقويم لتاريخ انتهاء الإقامة:</label>
                <div className="flex gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button 
                    type="button" 
                    onClick={() => setGregMode(true)}
                    className={`flex-1 py-1.5 text-center rounded-lg font-bold text-xs transition-colors cursor-pointer ${gregMode ? 'bg-[#0d5189] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-700'}`}
                  >
                    ميلادي (اختر التاريخ)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setGregMode(false)}
                    className={`flex-1 py-1.5 text-center rounded-lg font-bold text-xs transition-colors cursor-pointer ${!gregMode ? 'bg-[#0d5189] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-700'}`}
                  >
                    هجري (كتابة مع تحويل تلقائي)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label>رقم تعريف الموظف (يدوي)</label>
                  <input type="text" value={newEmployeeId} onChange={(e) => setNewEmployeeId(e.target.value)} placeholder="مثال: EMP-105" className="w-full text-xs font-mono py-2 px-3 border border-slate-200 rounded-lg bg-amber-50/10 placeholder:text-slate-400 font-bold" />
                </div>
                <div className="space-y-1.5">
                  <label>رقم الإقامة أو الهوية الوطنية *</label>
                  <input type="text" value={newIqama} onChange={(e) => setNewIqama(e.target.value)} required maxLength={10} placeholder="مثال: 2398471029" className="w-full text-xs font-mono py-2 px-3 border border-slate-200 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <label>اسم الموظف الرباعي *</label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="عبد الرحمن رحمن خان" className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs" />
                </div>
              </div>

              {gregMode ? (
                <div className="space-y-1.5">
                  <label>تاريخ انتهاء الإقامة (ميلادي) *</label>
                  <input type="date" value={newExpiryGreg} onChange={(e) => setNewExpiryGreg(e.target.value)} required className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label>تاريخ انتهاء الإقامة هجرياً (مثال: 1447/10/15) *</label>
                  <input type="text" value={newExpiryHijri} onChange={(e) => setNewExpiryHijri(e.target.value)} required placeholder="مثال: 1447/09/25" className="w-full text-xs font-mono py-2 px-3 border border-slate-200 rounded-lg" />
                  <span className="text-[10px] text-slate-400 block mt-1">سيقوم الخوارزمي بتحويل التاريخ لميلادي وتثبيته فوراً.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label>الجوال (Saudi Mobile) *</label>
                  <input type="text" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} placeholder="مثال: 0551234567" className="w-full text-xs font-mono py-2 px-3 border border-slate-200 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <label>الفرع التابع *</label>
                  <select value={newBranch} onChange={(e) => setNewBranch(e.target.value)} className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs">
                    <option value="">-- اختر الفرع --</option>
                    {branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1.5 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label>شهر بداية محاسبة الكفالة (هجري) *</label>
                  <select value={newKafalaStartMonth} onChange={(e) => setNewKafalaStartMonth(e.target.value)} className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs">
                    {['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label>السنة الهجرية لبداية الكفالة *</label>
                  <select value={newKafalaStartYear} onChange={(e) => setNewKafalaStartYear(e.target.value)} className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs">
                    {['1445', '1446', '1447', '1448', '1449'].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-3 pt-2">
                <span className="text-rose-900 text-xs block font-black mb-1">💳 إثبات الأرصدة الإفتتاحية المستحقة (إن وجدت):</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500">رصيد الإقامة المستحق (ريال)</label>
                    <input type="number" min={0} value={newIqamaBalance} onChange={(e) => setNewIqamaBalance(Number(e.target.value))} className="w-full text-xs py-1.5 px-2 border border-slate-200 bg-white rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500">عدد كفالات سابقة غير مدفوعة (أشهر)</label>
                    <input type="number" min={0} value={newKafalaCount} onChange={(e) => setNewKafalaCount(Number(e.target.value))} className="w-full text-xs py-1.5 px-2 border border-slate-200 bg-white rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500">مبالغ أو مديونيات أخرى (ريال)</label>
                    <input type="number" min={0} value={newOtherDebt} onChange={(e) => setNewOtherDebt(Number(e.target.value))} className="w-full text-xs py-1.5 px-2 border border-slate-200 bg-white rounded-lg" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500">تفاصيل المديونية أو الديون الأخرى</label>
                  <input type="text" value={newOtherDebtDesc} onChange={(e) => setNewOtherDebtDesc(e.target.value)} placeholder="مثال: رسوم خروج وعودة غير مستردة" className="w-full text-xs py-1.5 px-2 border border-slate-200 bg-white rounded-lg" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label>ملاحظات إضافية للملف</label>
                <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="اكتب أي ملاحظات للرجوع إليها..." className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs" style={{ minHeight: '60px' }}></textarea>
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5">
              <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-300">أغلق</button>
              <button type="submit" className="px-4 py-2 bg-[#0d5189] text-white rounded-lg text-xs hover:bg-primary-light font-bold">إضافة الموظف</button>
            </div>
          </form>
        </div>
      )}

      {/* 💳 MODAL 2: RECORD PAYMENT */}
      {isPayOpen && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-right">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 text-white flex justify-between items-center">
              <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                <Coins className="w-5 h-5 animate-bounce" />
                <span>تسجيل دفعة واردة للخزينة</span>
              </h4>
              <button onClick={() => setIsPayOpen(false)} className="text-white hover:bg-white/10 p-1 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-5 space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1">
                <span className="text-slate-400 font-medium block">اسم الموظف:</span>
                <span className="text-slate-800 text-sm block mt-0.5">{selectedEmp.name}</span>
              </div>

              {/* Dynamic Responsive Payment category selector tabs */}
              <div className="grid grid-cols-2 sm:flex sm:flex-row gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                {['kafala', 'iqama', 'insurance', 'other'].map(tab => (
                  <button 
                    key={tab}
                    type="button"
                    onClick={() => setPayTab(tab as any)}
                    className={`flex-1 py-1.5 px-1.5 text-center rounded-lg whitespace-nowrap font-bold text-xs transition-all duration-200 ${payTab === tab ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'}`}
                  >
                    {tab === 'kafala' ? 'كفالة' : tab === 'iqama' ? 'إقامة' : tab === 'insurance' ? 'تأمين طبي' : 'أخرى'}
                  </button>
                ))}
              </div>

              {payTab === 'kafala' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label>الشهر الهجري</label>
                      <select 
                        value={payHijriMonth} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setPayHijriMonth(val);
                          // Ramadan month is 9
                          setPayAmountKafala(val === '9' && pricing.ramadanFree ? 0 : pricing.kafala);
                        }}
                        className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs"
                      >
                        {['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'].map((m, i) => (
                          <option key={m} value={String(i + 1)}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label>السنة الهجرية</label>
                      <select value={payHijriYear} onChange={(e) => setPayHijriYear(e.target.value)} className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs">
                        {['1445', '1446', '1447', '1448', '1449'].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label>المبلغ المدفوع (ريال) *</label>
                    <input type="number" value={payAmountKafala} onChange={(e) => setPayAmountKafala(Number(e.target.value))} className="w-full text-xs font-mono font-bold leading-relaxed py-2 px-3 border border-slate-200 rounded-lg bg-emerald-50 text-emerald-800" />
                    {payHijriMonth === '9' && pricing.ramadanFree && (
                      <span className="text-[10px] text-emerald-600 block mt-1 font-bold">🎁 شهر رمضان المبارك معفي وسعره صفر! (يمكن تغييره يدوياً إذا رغبت).</span>
                    )}
                  </div>
                </div>
              )}

              {payTab === 'iqama' && (
                <div className="space-y-3">
                  <label className="block mb-1">فترة التجديد المقابلة للدفع:</label>
                  <div className="flex gap-2">
                    {[3, 6, 12].map(duration => (
                      <button 
                        key={duration}
                        type="button"
                        onClick={() => {
                          setPayIqamaDuration(duration as any);
                          setPayAmountIqama(duration === 3 ? pricing.iqama3 : (duration === 6 ? pricing.iqama6 : pricing.iqama12));
                        }}
                        className={`flex-1 py-1.5 text-center rounded-lg border font-bold text-xs ${payIqamaDuration === duration ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-500 bg-white'}`}
                      >
                        {duration === 12 ? 'سنة كاملة' : `${duration} أشهر`}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label>ابتداءً من شهر</label>
                      <select value={payIqamaFromMonth} onChange={(e) => setPayIqamaFromMonth(e.target.value)} className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs">
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i+1} value={String(i + 1)}>{i + 1}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label>السنة الميلادية</label>
                      <select value={payIqamaFromYear} onChange={(e) => setPayIqamaFromYear(e.target.value)} className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs">
                        {['2025', '2026', '2027', '2028'].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label>المبلغ المودع للتجديد (ريال) *</label>
                    <input type="number" value={payAmountIqama} onChange={(e) => setPayAmountIqama(Number(e.target.value))} className="w-full font-mono text-xs font-bold py-2 px-3 border border-slate-200 rounded-lg bg-emerald-50 text-emerald-800" />
                  </div>
                </div>
              )}

              {payTab === 'insurance' as any && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label>المبلغ المدفوع للتأمين الطبي (ريال) *</label>
                    <input 
                      type="number" 
                      value={payAmountInsurance} 
                      onChange={(e) => setPayAmountInsurance(Number(e.target.value))} 
                      className="w-full font-mono text-xs font-bold py-2 px-3 border border-slate-200 rounded-lg bg-emerald-50 text-emerald-800" 
                    />
                  </div>
                </div>
              )}

              {payTab === 'other' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label>نوع العملية والوصف</label>
                      <select value={payOtherType} onChange={(e) => setPayOtherType(e.target.value)} className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs">
                        <option>دفعة جزئية</option>
                        <option>تسوية رصيد</option>
                        <option>خصم عمالةพิเศษ</option>
                        <option>مساندات وتصفية</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label>المبلغ المستلم (ريال)</label>
                      <input type="number" value={payAmountOther} onChange={(e) => setPayAmountOther(Number(e.target.value))} className="w-full font-mono text-xs py-2 px-3 border border-slate-200 rounded-lg bg-emerald-50 text-emerald-850" />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label>ملاحظات وسند استلام الحوالة</label>
                <textarea value={payOtherNotes} onChange={(e) => setPayOtherNotes(e.target.value)} placeholder="مثال: رقم العملية 09482 بمطابقة حساب بنك الراجحي" className="w-full py-1.5 px-3 border border-slate-200 rounded-lg text-xs" style={{ minHeight: '50px' }}></textarea>
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5">
              <button onClick={() => setIsPayOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-300 font-semibold">أغلق</button>
              <button onClick={submitPayment} className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 font-bold shadow-md">تسجيل الدفعة والتاكيد ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚖️ MODAL 3: UNIFIED DEBT ORDER (REGISTER LIABILITY) */}
      {isDebtOpen && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-red-700 to-rose-600 p-4 text-white flex justify-between items-center flex-shrink-0">
              <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                <Sliders className="w-5 h-5 animate-pulse" />
                <span>إثبات واستحقاق مديونية جديدة</span>
              </h4>
              <button onClick={() => setIsDebtOpen(false)} className="text-white hover:bg-white/10 p-1 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-5 space-y-4 text-xs font-bold text-slate-700 overflow-y-auto max-h-[calc(90vh-120px)] flex-1">
              <div className="space-y-1 select-none">
                <span className="text-slate-400 font-semibold block">الموظف المدين:</span>
                <span className="text-slate-800 text-sm block">{selectedEmp.name}</span>
              </div>

              {/* Dynamic Responsive Debt category selector tabs */}
              <div className="grid grid-cols-2 sm:flex sm:flex-row gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                {(['kafala', 'iqama', 'insurance', 'other'] as const).map(tab => (
                  <button 
                    key={tab}
                    type="button"
                    onClick={() => setDebtTab(tab)}
                    className={`flex-1 py-1.5 px-1.5 text-center rounded-lg whitespace-nowrap text-xs font-bold transition-all duration-200 ${debtTab === tab ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'}`}
                  >
                    {tab === 'kafala' ? 'كفالة' : tab === 'iqama' ? 'إقامة' : tab === 'insurance' ? 'تأمين طبي' : 'أخرى'}
                  </button>
                ))}
              </div>

              {debtTab === 'kafala' && (
                <div className="space-y-4">
                  {/* Kafala Period Range Selection */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-3">
                    <span className="font-extrabold text-xs text-slate-600 block">فترة الكفالة الكلية</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500">من شهر هجري</label>
                        <select 
                          value={debtKafalaFromM} 
                          onChange={(e) => setDebtKafalaFromM(e.target.value)} 
                          className="w-full py-1.5 px-2 border border-slate-200 rounded-lg text-xs bg-white font-bold cursor-pointer"
                        >
                          {AR_HIJRI_MONTHS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500">إلى شهر هجري</label>
                        <select 
                          value={debtKafalaToM} 
                          onChange={(e) => setDebtKafalaToM(e.target.value)} 
                          className="w-full py-1.5 px-2 border border-slate-200 rounded-lg text-xs bg-white font-bold cursor-pointer"
                        >
                          {AR_HIJRI_MONTHS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-end">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500">السنة الهجرية</label>
                        <select 
                          value={debtKafalaFromY} 
                          onChange={(e) => setDebtKafalaFromY(e.target.value)} 
                          className="w-full py-1.5 px-2 border border-slate-200 rounded-lg text-xs bg-white font-bold cursor-pointer"
                        >
                          {['1445', '1446', '1447', '1448', '1449'].map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <div className="bg-slate-200/60 p-2 rounded-lg text-center font-bold text-[11px] text-slate-700 h-[34px] flex items-center justify-center">
                        عدد الشهور الكلية: {getHijriMonthDistance(debtKafalaFromM, debtKafalaToM)} أشهر
                      </div>
                    </div>
                  </div>

                  {/* Free Months Option */}
                  <div className="border border-amber-200 bg-amber-50/20 p-3 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="hasFreeMonthsCheckbox" 
                        checked={hasFreeMonths} 
                        onChange={(e) => setHasFreeMonths(e.target.checked)} 
                        className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                      />
                      <label htmlFor="hasFreeMonthsCheckbox" className="font-extrabold text-xs text-slate-700 cursor-pointer select-none">
                        تخصم شهور مجانية (لا تحسب عليها كفالة)؟
                      </label>
                    </div>

                    {hasFreeMonths && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-100/50">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">مجانى من شهر</label>
                          <select 
                            value={debtFreeFromM} 
                            onChange={(e) => setDebtFreeFromM(e.target.value)} 
                            className="w-full py-1.5 px-2 border border-amber-150 rounded-lg text-xs bg-white font-bold text-amber-900 cursor-pointer"
                          >
                            {AR_HIJRI_MONTHS.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">مجانى إلى شهر</label>
                          <select 
                            value={debtFreeToM} 
                            onChange={(e) => setDebtFreeToM(e.target.value)} 
                            className="w-full py-1.5 px-2 border border-amber-150 rounded-lg text-xs bg-white font-bold text-amber-900 cursor-pointer"
                          >
                            {AR_HIJRI_MONTHS.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <span className="col-span-2 text-[10px] text-amber-700 font-bold block bg-amber-100/30 p-1.5 rounded-md text-center mt-1">
                          عدد الشهور المجانية المخصومة: {getHijriMonthDistance(debtFreeFromM, debtFreeToM)} أشهر
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Calculations breakdown info card */}
                  <div className="p-3 bg-red-50/50 border border-red-100/50 rounded-xl space-y-1 text-[11px] text-slate-700">
                    <div className="flex justify-between">
                      <span>إجمالي شهور العقد:</span>
                      <span className="font-bold">{getHijriMonthDistance(debtKafalaFromM, debtKafalaToM)} أشهر</span>
                    </div>
                    {hasFreeMonths && (
                      <div className="flex justify-between text-amber-700">
                        <span>شهور معفاة مجانية:</span>
                        <span className="font-bold">-{getHijriMonthDistance(debtFreeFromM, debtFreeToM)} أشهر</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200/50 pt-1.5 font-extrabold text-slate-800 text-xs">
                      <span>الصافي المدفوع:</span>
                      <span>{debtKafalaMonths} أشهر × {pricing.kafala} ريال/شهر</span>
                    </div>
                  </div>

                  {/* Editable Amount */}
                  <div className="space-y-1">
                    <label>المبلغ المستحق النهائي للتدوين (ريال) *</label>
                    <input 
                      type="number" 
                      value={debtKafalaAmount} 
                      onChange={(e) => setDebtKafalaAmount(Number(e.target.value))} 
                      className="w-full text-xs font-mono font-bold leading-relaxed py-2 px-3 border border-slate-200 rounded-lg bg-red-50 text-red-950" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label>ملاحظات إثبات الكفالة</label>
                    <textarea 
                      value={debtKafalaNotes} 
                      onChange={(e) => setDebtKafalaNotes(e.target.value)} 
                      placeholder="مثال: تسجيل مديونية الكفالة للفترة المتفق عليها" 
                      className="w-full py-1.5 px-3 border border-slate-200 rounded-lg text-xs" 
                      style={{ minHeight: '40px' }}
                    ></textarea>
                  </div>
                </div>
              )}

              {debtTab === 'iqama' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block mb-1">فترة تجديد الإقامة ذات الصلة:</label>
                    <div className="flex gap-2">
                      {[3, 6, 12].map(dur => (
                        <button 
                          key={dur}
                          type="button"
                          onClick={() => {
                            setDebtIqamaDur(dur as any);
                            setDebtIqamaCost(dur === 3 ? pricing.iqama3 : (dur === 6 ? pricing.iqama6 : pricing.iqama12));
                          }}
                          className={`flex-1 py-1.5 text-center rounded-lg border font-bold text-xs ${debtIqamaDur === dur ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-200 text-slate-500 bg-white'}`}
                        >
                          {dur === 12 ? 'سنة كاملة' : `${dur} أشهر`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1 font-bold">
                    <label>تكلفة التجديد والرسوم الحكومية المستحقة (ريال) *</label>
                    <input 
                      type="number" 
                      value={debtIqamaCost} 
                      onChange={(e) => setDebtIqamaCost(Number(e.target.value))} 
                      className="w-full text-xs font-mono font-bold leading-relaxed py-2 px-3 border border-slate-200 rounded-lg bg-red-50 text-red-900" 
                    />
                    <span className="text-[10px] text-red-700 block font-light leading-normal mt-1">&#8595; ستضاف هذه التكلفة لرصيد الإقامة المستحق بذمة العامل.</span>
                  </div>

                  <div className="space-y-1">
                    <label>سجل وملاحظات التجديد</label>
                    <textarea value={debtIqamaNotes} onChange={(e) => setDebtIqamaNotes(e.target.value)} placeholder="مثال: استحقاق رسوم رخصة عمل وتجديد الإقامة" className="w-full py-1.5 px-3 border border-slate-200 rounded-lg text-xs" style={{ minHeight: '55px' }}></textarea>
                  </div>
                </div>
              )}

              {debtTab === 'insurance' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label>تكلفة رسوم التأمين الطبي المستحقة (ريال) *</label>
                    <input 
                      type="number" 
                      value={debtInsuranceAmt} 
                      onChange={(e) => setDebtInsuranceAmt(Number(e.target.value))} 
                      className="w-full text-xs font-mono font-bold py-2 px-3 border border-slate-200 rounded-lg bg-red-50 text-red-900" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label>ملاحظات وسجل التأمين</label>
                    <textarea value={debtInsuranceNotes} onChange={(e) => setDebtInsuranceNotes(e.target.value)} placeholder="مثال: قيمة بوليصة التأمين الطبي السنوية فئة C" className="w-full py-1.5 px-3 border border-slate-200 rounded-lg text-xs" style={{ minHeight: '50px' }}></textarea>
                  </div>
                </div>
              )}

              {debtTab === 'other' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label>بيان ووصف المديونية *</label>
                    <input 
                      type="text" 
                      value={debtOtherTitle} 
                      onChange={(e) => setDebtOtherTitle(e.target.value)} 
                      placeholder="مثال: تكلفة رسوم مرافقة بموجب كشف المطابقات" 
                      className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label>المبلغ المطلوب إثباته (ريال) *</label>
                    <input 
                      type="number" 
                      value={debtOtherAmt} 
                      onChange={(e) => setDebtOtherAmt(Number(e.target.value))} 
                      className="w-full text-xs font-mono font-bold py-2 px-3 border border-slate-200 rounded-lg bg-red-50 text-red-900" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label>تفاصيل وملاحظات إضافية</label>
                    <textarea value={debtOtherNotes} onChange={(e) => setDebtOtherNotes(e.target.value)} placeholder="تفاصيل الدين والأمور الداعية لتسجيله" className="w-full py-1.5 px-3 border border-slate-200 rounded-lg text-xs" style={{ minHeight: '50px' }}></textarea>
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5">
              <button onClick={() => setIsDebtOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-300 font-bold">أغلق</button>
              <button onClick={submitDebtOrder} className="px-5 py-2 bg-rose-600 text-white rounded-lg text-xs hover:bg-rose-700 font-bold shadow-md">✓ إثبات وتثبيت الدين</button>
            </div>
          </div>
        </div>
      )}

      {/* 📅 MODAL 4: UPDATE EXPIRY DATE GREGORIAN OR HIJRI */}
      {isExpiryOpen && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-right">
            <div className="bg-[#0d5189] p-4 text-white flex justify-between items-center">
              <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                <Calendar className="w-5 h-5 animate-pulse" />
                <span>تحديث مستند انتهاء الإقامة للجوازات</span>
              </h4>
              <button onClick={() => setIsExpiryOpen(false)} className="text-white hover:bg-white/10 p-1 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-5 space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1.5">
                <span className="text-slate-400 font-medium block">الموظف المعني:</span>
                <span className="text-slate-800 text-sm block">{selectedEmp.name}</span>
              </div>

              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setRenewGregMode(true)}
                  className={`flex-1 py-1.5 text-center rounded-lg text-[11px] font-bold ${renewGregMode ? 'bg-[#0b2844] text-white' : 'bg-slate-150 text-slate-700'}`}
                >
                  ميلادي
                </button>
                <button 
                  type="button" 
                  onClick={() => setRenewGregMode(false)}
                  className={`flex-1 py-1.5 text-center rounded-lg text-[11px] font-bold ${!renewGregMode ? 'bg-[#0b2844] text-white' : 'bg-slate-150 text-slate-700'}`}
                >
                  هجري
                </button>
              </div>

              {renewGregMode ? (
                <div className="space-y-1.5">
                  <label>تاريخ انتهاء الإقامة الميلادي الجديد *</label>
                  <input type="date" value={newExpDateRaw} onChange={(e) => setNewExpDateRaw(e.target.value)} required className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs font-mono" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label>تاريخ انتهاء الإقامة الهجري الجديد (مثال: 1447/10/15) *</label>
                  <input type="text" value={renewExpiryHijri} onChange={(e) => setRenewExpiryHijri(e.target.value)} placeholder="مثال: 1447/09/25" className="w-full text-xs font-mono py-2 px-3 border border-slate-200 rounded-lg" required />
                  <span className="text-[10px] text-slate-400 block leading-normal mt-1">سيقوم الخوارزمي بتحويل التاريخ لميلادي وتثبيته فوراً بعد الحفظ.</span>
                </div>
              )}

              <span className="text-[10px] text-slate-400 block leading-normal mt-1.5">سيقوم النظام بإجراء الترقيم الهجري وتقديم التنبيهات اللازمة بالصفحة الرئيسية تلقائيّاً بعد الحفظ.</span>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5">
              <button onClick={() => setIsExpiryOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-300">أغلق</button>
              <button onClick={submitUpdateExpiry} className="px-5 py-2 bg-[#0d5189] text-white rounded-lg text-xs hover:bg-primary-light font-bold shadow-md">حفظ تاريخ الإقامة الجديد</button>
            </div>
          </div>
        </div>
      )}



      {/* 📦 MODAL 6: ARCHIVE EMPLOYEE */}
      {isArchiveOpen && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-right">
            <div className="bg-slate-700 p-4 text-white flex justify-between items-center">
              <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                <Sliders className="w-5 h-5" />
                <span>أرشفة واستبعاد الموظف من المنظومة</span>
              </h4>
              <button onClick={() => setIsArchiveOpen(false)} className="text-white hover:bg-white/10 p-1 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-5 space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1 font-semibold block">
                <span className="text-slate-400 font-medium">العامل المراد استبعاده:</span>
                <span className="text-slate-800 text-sm block mt-0.5">{selectedEmp.name}</span>
              </div>

              <div className="space-y-1.5">
                <label>سبب الأرشفة والاستبعاد الاستراتيجي *</label>
                <select value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 font-bold">
                  <option value="نقل خدمات">نقل خدمات (خدمة أخرى)</option>
                  <option value="خرج نهائي">سفر نهائي / خروج نهائي</option>
                  <option value="إلغاء عقد">إلغاء عقد من طرف الإدارة</option>
                  <option value="انتهاء عقد">انتهاء عقد العمل المتفق عليه</option>
                </select>
                <span className="text-[10px] text-slate-400 block leading-normal mt-2">ستنقل سجلات هذا العامل بالكامل وقائمة مدفوعاته إلى صفحة "الأرشيف والمستبعدين" تلقائيّاً لمرجعية المحاسب بوضوح.</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5">
              <button onClick={() => setIsArchiveOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-300 font-semibold font-bold">أغلق</button>
              <button onClick={submitArchive} className="px-5 py-2 bg-slate-700 text-white rounded-lg text-xs hover:bg-slate-800 font-bold shadow-md">أرشف في مستندات الكفيليات ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* 💳 MODAL 7: EDIT OPENING BALANCE */}
      {isOpeningOpen && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitSaveOpening} className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 p-4 text-white flex justify-between items-center">
              <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                <Coins className="w-5 h-5 animate-pulse" />
                <span>تعديل الأرصدة والمديونيات الافتتاحية للعامِل</span>
              </h4>
              <button type="button" onClick={() => setIsOpeningOpen(false)} className="text-white hover:bg-white/10 p-1 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1 select-none">
                <span className="text-slate-400 font-semibold block">الموظف:</span>
                <span className="text-slate-800 text-sm block">{selectedEmp.name}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 block">رصيد الإقامة الافتتاحي المستحق (ريال)</label>
                <input 
                  type="number" 
                  min={0} 
                  value={openingIqamaBalance} 
                  onChange={(e) => setOpeningIqamaBalance(Number(e.target.value))} 
                  className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 block">عدد أشهر الكفالة الافتتاحية السابقة المستحقة (أشهر)</label>
                <input 
                  type="number" 
                  min={0} 
                  value={openingKafalaCount} 
                  onChange={(e) => setOpeningKafalaCount(Number(e.target.value))} 
                  className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 block">رصيد مبالغ أو مديونيات أخرى افتتاحي (ريال)</label>
                <input 
                  type="number" 
                  min={0} 
                  value={openingOtherDebt} 
                  onChange={(e) => setOpeningOtherDebt(Number(e.target.value))} 
                  className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 block">تفاصيل وبيان المديونية الافتتاحية الأخرى</label>
                <input 
                  type="text" 
                  value={openingOtherDebtDesc} 
                  onChange={(e) => setOpeningOtherDebtDesc(e.target.value)} 
                  placeholder="مثال: رسوم خروج وعودة غير مستردة" 
                  className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none placeholder:text-slate-350" 
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5">
              <button 
                type="button" 
                onClick={() => setIsOpeningOpen(false)} 
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-350 font-bold cursor-pointer"
              >
                أغلق
              </button>
              <button 
                type="submit" 
                className="px-5 py-2 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700 font-bold shadow-md cursor-pointer"
              >
                تحديث وحفظ الأرصدة الافتتاحية ✓
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
