import React, { useState, useEffect } from 'react';
import { 
  Employee, Payment, PricingSettings, CompanySettings, UserProfile, ActivityLog 
} from './types';
import { 
  INITIAL_BRANCHES, INITIAL_EMPLOYEES, INITIAL_LOGS, INITIAL_PAYMENTS, INITIAL_USERS 
} from './utils/dummyData';

import SidebarMenu from './components/SidebarMenu';
import DashboardView from './components/DashboardView';
import EmployeeListView from './components/EmployeeListView';
import AlertsListView from './components/AlertsListView';
import PaymentsListView from './components/PaymentsListView';
import MonthlyFinanceView from './components/MonthlyFinanceView';
import LocalSetupGuide from './components/LocalSetupGuide';
import LedgerStatement from './components/LedgerStatement';
import PortalAuthView from './components/PortalAuthView';
import PortalApprovalsView from './components/PortalApprovalsView';

import { 
  Menu, X, Sliders, RefreshCw, Upload, Building, Trash2, CheckCircle2 
} from 'lucide-react';

export default function App() {
  // App States loaded from LocalStorage
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: 'مؤسسة الرواد لإدارة العمالة والتشغيل'
  });
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    kafala: 250,
    iqama3: 3550,
    iqama6: 7100,
    iqama12: 14200,
    ramadanFree: true
  });

  // Current session config
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedStatementEmp, setSelectedStatementEmp] = useState<Employee | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Settings tab: addition forms helpers
  const [newBranchInput, setNewBranchInput] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'branch' | 'viewer'>('branch');
  const [newUserBranch, setNewUserBranch] = useState('');

  // 1. Initial global app boot loader
  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem('labor_users');
      if (storedUsers) {
        setUsers(JSON.parse(storedUsers));
      } else {
        setUsers(INITIAL_USERS);
        localStorage.setItem('labor_users', JSON.stringify(INITIAL_USERS));
      }

      // Check current session
      const storedCurrentUser = localStorage.getItem('labor_current_user');
      if (storedCurrentUser) {
        const u = JSON.parse(storedCurrentUser) as UserProfile;
        setCurrentUser(u);
      }
    } catch (e) {
      console.error('LocalStorage global boot error:', e);
    }
  }, []);

  // 2. Tenant/Workspace data loader - triggers whenever currentUser changes!
  useEffect(() => {
    if (!currentUser) return;
    try {
      const tid = currentUser.tenantId;
      const empKey = tid ? `labor_${tid}_employees` : 'labor_employees';
      const payKey = tid ? `labor_${tid}_payments` : 'labor_payments';
      const branchKey = tid ? `labor_${tid}_branches` : 'labor_branches';
      const logKey = tid ? `labor_${tid}_logs` : 'labor_logs';
      const compKey = tid ? `labor_${tid}_company` : 'labor_company';
      const pricKey = tid ? `labor_${tid}_pricing` : 'labor_pricing';

      const storedEmps = localStorage.getItem(empKey);
      const storedPays = localStorage.getItem(payKey);
      const storedBranches = localStorage.getItem(branchKey);
      const storedLogs = localStorage.getItem(logKey);
      const storedCompany = localStorage.getItem(compKey);
      const storedPricing = localStorage.getItem(pricKey);

      if (storedEmps) {
        setEmployees(JSON.parse(storedEmps));
      } else {
        setEmployees(INITIAL_EMPLOYEES);
        localStorage.setItem(empKey, JSON.stringify(INITIAL_EMPLOYEES));
      }

      if (storedPays) {
        setPayments(JSON.parse(storedPays));
      } else {
        setPayments(INITIAL_PAYMENTS);
        localStorage.setItem(payKey, JSON.stringify(INITIAL_PAYMENTS));
      }

      if (storedBranches) {
        setBranches(JSON.parse(storedBranches));
      } else {
        const initialBrs = tid ? [] : INITIAL_BRANCHES;
        setBranches(initialBrs);
        localStorage.setItem(branchKey, JSON.stringify(initialBrs));
      }

      if (storedLogs) {
        setLogs(JSON.parse(storedLogs));
      } else {
        const initialLgs = INITIAL_LOGS;
        setLogs(initialLgs);
        localStorage.setItem(logKey, JSON.stringify(initialLgs));
      }

      if (storedCompany) {
        setCompanySettings(JSON.parse(storedCompany));
      } else {
        const defaultCompany = { name: tid ? `لوحة حسابات ومساحة ${currentUser.name}` : 'مؤسسة الرواد لإدارة العمالة والتشغيل' };
        setCompanySettings(defaultCompany);
        localStorage.setItem(compKey, JSON.stringify(defaultCompany));
      }

      if (storedPricing) {
        setPricingSettings(JSON.parse(storedPricing));
      } else {
        const defaultPricing = { kafala: 250, iqama3: 3550, iqama6: 7100, iqama12: 14200, ramadanFree: true };
        setPricingSettings(defaultPricing);
        localStorage.setItem(pricKey, JSON.stringify(defaultPricing));
      }
    } catch (e) {
      console.error('Tenant load error:', e);
    }
  }, [currentUser]);

  // Dynamically update browser tab title and favicon whenever companySettings name or logoBase64 changes
  useEffect(() => {
    if (companySettings.name) {
      document.title = companySettings.name;
    } else {
      document.title = 'نظام إدارة ومتابعة العمالة';
    }
  }, [companySettings.name]);

  useEffect(() => {
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (companySettings.logoBase64) {
      if (link) {
        link.href = companySettings.logoBase64;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = companySettings.logoBase64;
        document.head.appendChild(newLink);
      }
    } else {
      // Use building emoji canvas as dynamic fallback favicon
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.font = '48px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🏢', 32, 32);
          const emojiUrl = canvas.toDataURL('image/png');
          if (link) {
            link.href = emojiUrl;
          } else {
            const newLink = document.createElement('link');
            newLink.rel = 'icon';
            newLink.href = emojiUrl;
            document.head.appendChild(newLink);
          }
        } else {
          if (link) {
            link.href = '/favicon.ico';
          }
        }
      } catch (err) {
        if (link) {
          link.href = '/favicon.ico';
        }
      }
    }
  }, [companySettings.logoBase64]);

  // Sync savers
  const saveEmployees = (list: Employee[]) => {
    setEmployees(list);
    const key = currentUser?.tenantId ? `labor_${currentUser.tenantId}_employees` : 'labor_employees';
    localStorage.setItem(key, JSON.stringify(list));
  };

  const savePayments = (list: Payment[]) => {
    setPayments(list);
    const key = currentUser?.tenantId ? `labor_${currentUser.tenantId}_payments` : 'labor_payments';
    localStorage.setItem(key, JSON.stringify(list));
  };

  const saveBranchesList = (list: string[]) => {
    setBranches(list);
    const key = currentUser?.tenantId ? `labor_${currentUser.tenantId}_branches` : 'labor_branches';
    localStorage.setItem(key, JSON.stringify(list));
  };

  const saveLogsList = (list: ActivityLog[]) => {
    setLogs(list);
    const key = currentUser?.tenantId ? `labor_${currentUser.tenantId}_logs` : 'labor_logs';
    localStorage.setItem(key, JSON.stringify(list));
  };

  const saveUsersList = (list: UserProfile[]) => {
    setUsers(list);
    localStorage.setItem('labor_users', JSON.stringify(list));
  };

  const handleLogout = () => {
    if (confirm('هل أنت متأكد من رغبتك في تسجيل الخروج الآن؟')) {
      setCurrentUser(null);
      localStorage.removeItem('labor_current_user');
      setActiveTab('dashboard');
    }
  };

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('labor_current_user', JSON.stringify(user));
    setActiveTab('dashboard');
  };

  const handleRegisterSubmit = (newUser: UserProfile) => {
    const updatedUsers = [...users, newUser];
    saveUsersList(updatedUsers);
  };

  const handleUpdateUserStatus = (uid: string, status: 'approved' | 'rejected') => {
    const updated = users.map(u => {
      if (u.uid === uid) {
        return { ...u, status };
      }
      return u;
    });
    saveUsersList(updated);
    
    const uName = users.find(u => u.uid === uid)?.name || 'مستخدم غير معروف';
    const actionText = status === 'approved' 
      ? `اعتماد وتنشيط حساب المستخدم الجديد بالبوابة: ${uName}` 
      : `رفض تفعيل حساب المستخدم الجديد بالبوابة: ${uName}`;
    logActivity('update', actionText);
    toastNotice(status === 'approved' ? '✓ تم تنشيط الحساب بنجاح!' : 'تم رفض الحساب.');
  };

  const handleDeleteUser = (uid: string) => {
    const uName = users.find(u => u.uid === uid)?.name || 'مستخدم';
    const updated = users.filter(u => u.uid !== uid);
    saveUsersList(updated);
    logActivity('update', `حذف كامل لحساب وعضوية المستخدم: ${uName} من السيرفر.`);
    toastNotice('✓ تم حذف الحساب بنجاح.');
  };

  const handleUpdateUserRole = (uid: string, role: 'admin' | 'branch' | 'viewer', branch?: string) => {
    const uName = users.find(u => u.uid === uid)?.name || 'مستخدم';
    const updated = users.map(u => {
      if (u.uid === uid) {
        return { ...u, role, branch };
      }
      return u;
    });
    saveUsersList(updated);
    logActivity('update', `تعديل صلاحيات حساب الموظف ${uName} لتصبح: ${role}`);
    toastNotice('✓ تم تعديل الرتبة بنجاح.');
  };

  const logActivity = (type: ActivityLog['type'], text: string) => {
    const newLog: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      text,
      user: currentUser?.name || 'النظام',
      time: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    saveLogsList([newLog, ...logs]);
  };

  // Mutators and state updates
  const handleAddEmployee = (emp: Employee) => {
    saveEmployees([emp, ...employees]);
    logActivity('add', `إضافة موظف عمالة جديد لقاعدة البيانات: ${emp.name} | رقم الإقامة: ${emp.iqamaNo}`);
  };

  const handleDeleteEmployee = (iqamaNo: string) => {
    const emp = employees.find(e => e.iqamaNo === iqamaNo);
    const updated = employees.filter(e => e.iqamaNo !== iqamaNo);
    saveEmployees(updated);
    
    // Cascading delete related payments too
    const filteredPayments = payments.filter(p => p.iqamaNo !== iqamaNo);
    savePayments(filteredPayments);

    if (emp) {
      logActivity('del', `حذف كلي ونهائي لملف العامل: ${emp.name} من شاشات الإدارة.`);
    }
  };

  const handleArchiveEmployee = (iqamaNo: string, reason: string) => {
    const updated = employees.map(e => {
      if (e.iqamaNo === iqamaNo) {
        return {
          ...e,
          status: 'archived' as const,
          archiveReason: reason,
          archiveDate: new Date().toISOString().slice(0, 10)
        };
      }
      return e;
    });
    saveEmployees(updated);
    
    const emp = employees.find(e => e.iqamaNo === iqamaNo);
    if (emp) {
      logActivity('arc', `أرشفة واستبعاد ملف العامل: ${emp.name} — السبب: ${reason}`);
    }
  };

  const handleRestoreEmployee = (iqamaNo: string) => {
    const updated = employees.map(e => {
      if (e.iqamaNo === iqamaNo) {
        return {
          ...e,
          status: 'active' as const,
          archiveReason: undefined,
          archiveDate: undefined
        };
      }
      return e;
    });
    saveEmployees(updated);
    
    const emp = employees.find(e => e.iqamaNo === iqamaNo);
    if (emp) {
      logActivity('restore', `إلغاء أرشفة وإرجاع الموظف ${emp.name} كنشط في النظام.`);
      alert(`✓ تم إرجاع ${emp.name} للنظام بنجاح.`);
    }
  };

  const handleWipeAllData = () => {
    if (confirm("⚠️ تحذير مدمر محاسبي نهائي!\n\nهل أنت متأكد تماماً من رغبتك في حذف وإفراغ كافة بيانات العمالة، والقيود المالية، والدفعات، وسجلات الحركة بالكامل من هذا المتصفح؟\nهذا الإجراء لا يمكن التراجع عنه أبداً وسيأخذك إلى وضع بدء التشغيل النظيف.")) {
      localStorage.removeItem('labor_employees');
      localStorage.removeItem('labor_payments');
      localStorage.removeItem('labor_logs');
      setEmployees([]);
      setPayments([]);
      const newInitLog = {
        id: `log_init_${Date.now()}`,
        type: 'update' as const,
        text: 'تم تصفير وإفراغ قاعدة البيانات بنجاح وبدء سجل نشاط جديد.',
        user: currentUser.name,
        time: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
      setLogs([newInitLog]);
      localStorage.setItem('labor_logs', JSON.stringify([newInitLog]));
      alert("🎉 تم تهيئة النظام ومسح كافة البيانات التجريبية بنجاح!");
    }
  };

  const handleUpdateEmployee = (updatedEmp: Employee) => {
    const updated = employees.map(e => {
      if (e.iqamaNo === updatedEmp.iqamaNo) {
        return updatedEmp;
      }
      return e;
    });
    saveEmployees(updated);
  };

  const handleUpdateEmployeeExpiry = (iqamaNo: string, newDate: string) => {
    const updated = employees.map(e => {
      if (e.iqamaNo === iqamaNo) {
        return { ...e, iqamaExpiry: newDate };
      }
      return e;
    });
    saveEmployees(updated);

    const emp = employees.find(e => e.iqamaNo === iqamaNo);
    if (emp) {
      logActivity('update', `تحديث مستند انتهاء إقامة الجوازات لـ ${emp.name} إلى ميلادي: ${newDate}`);
    }
  };

  const handleRegisterPayment = (
    iqamaNo: string, 
    amount: number, 
    type: string, 
    notes?: string,
    m?: string,
    y?: string
  ) => {
    const emp = employees.find(e => e.iqamaNo === iqamaNo);
    const newPayment: Payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      iqamaNo,
      name: emp ? emp.name : 'موظف مجهول',
      branch: emp ? emp.branch : branches[0],
      amount,
      type,
      date: new Date().toISOString().slice(0, 10),
      notes,
      hijriMonth: m,
      hijriYear: y
    };

    savePayments([newPayment, ...payments]);
    logActivity('pay', `تسجيل دفعة نقدية بقيمة ${amount.toLocaleString()} ريال للموظف ${emp?.name} — ببيان: ${type}`);
  };

  const handleAddKafalaOrder = (
    iqamaNo: string, 
    months: number, 
    notes?: string,
    m?: string,
    y?: string
  ) => {
    const updated = employees.map(e => {
      if (e.iqamaNo === iqamaNo) {
        return {
          ...e,
          kafalaCount: (e.kafalaCount || 0) + months
        };
      }
      return e;
    });
    saveEmployees(updated);

    const emp = employees.find(e => e.iqamaNo === iqamaNo);
    if (emp) {
      const addedAmt = months * pricingSettings.kafala;
      logActivity('update', `تسجيل قيد كفالة مستحقة بذمة ${emp.name} بعدد: ${months} أشهر بقيمة: ${addedAmt} ريال`);
      alert(`✓ تم تسجيل ${months} أشهر كفالة إضافية ممددة على ذمة العامل ${emp.name}.`);
    }
  };

  // Clear Logs
  const handleClearLogs = () => {
    saveLogsList([]);
  };

  // Demo state resetting to mock initials
  const handleResetData = () => {
    const tid = currentUser?.tenantId;
    const empKey = tid ? `labor_${tid}_employees` : 'labor_employees';
    const payKey = tid ? `labor_${tid}_payments` : 'labor_payments';
    const branchKey = tid ? `labor_${tid}_branches` : 'labor_branches';
    const logKey = tid ? `labor_${tid}_logs` : 'labor_logs';
    const compKey = tid ? `labor_${tid}_company` : 'labor_company';
    const pricKey = tid ? `labor_${tid}_pricing` : 'labor_pricing';

    setEmployees(INITIAL_EMPLOYEES);
    setPayments(INITIAL_PAYMENTS);
    setBranches(tid ? [] : INITIAL_BRANCHES);
    setLogs(INITIAL_LOGS);
    
    const defaultCompanyObj = { name: tid ? `لوحة حسابات ومساحة ${currentUser.name}` : 'مؤسسة الرواد لإدارة العمالة والتشغيل' };
    const defaultPricingObj = { kafala: 250, iqama3: 3550, iqama6: 7100, iqama12: 14200, ramadanFree: true };
    setCompanySettings(defaultCompanyObj);
    setPricingSettings(defaultPricingObj);

    localStorage.setItem(empKey, JSON.stringify(INITIAL_EMPLOYEES));
    localStorage.setItem(payKey, JSON.stringify(INITIAL_PAYMENTS));
    localStorage.setItem(branchKey, JSON.stringify(tid ? [] : INITIAL_BRANCHES));
    localStorage.setItem(logKey, JSON.stringify(INITIAL_LOGS));
    localStorage.setItem(compKey, JSON.stringify(defaultCompanyObj));
    localStorage.setItem(pricKey, JSON.stringify(defaultPricingObj));

    // Reset general users only for system administrators
    if (!tid) {
      setUsers(INITIAL_USERS);
      localStorage.setItem('labor_users', JSON.stringify(INITIAL_USERS));
    }
    
    toastNotice('تم تصفير وإعادة تعيين قاعدة البيانات بنجاح!');
  };

  // Change simulation system role
  const handleChangeUserRole = (role: 'admin' | 'branch' | 'viewer') => {
    const updatedUser = { ...currentUser, role };
    if (role === 'branch') {
      updatedUser.branch = branches[1] || 'فرع جدة الغربية';
    } else {
      updatedDebtReset(updatedUser);
    }
    // Set immediate state switch
    handleRegisterPayment('system', 0, `تغيير منظور تصفح العرض الفوري إلى رتبة: ${role}`);
  };

  const handleRegisterPaymentProxy = (iqNo: string, amt: number, type: string, n?: string, m?: string, y?: string) => {
    handleRegisterPayment(iqNo, amt, type, n, m, y);
  };

  // Settings methods
  const submitCompanySettings = (name: string, logo?: string) => {
    const updated = { name, logoBase64: logo };
    localStorage.setItem('company_settings', JSON.stringify(updated));
    alert('✓ تم ثبيت هوية الشركة والشعار الجديد المخصّص بنجاح!');
    window.location.reload();
  };

  // Quick triggers notifications toast
  const [toastMsg, setToastMsg] = useState('');

  // Dynamic user switcher helper
  const changeProfileDirect = (role: 'admin' | 'branch' | 'viewer') => {
    const matchUser = users.find(u => u.role === role);
    if (role === 'admin') {
      setCurrentUser({
        uid: 'user-admin',
        name: 'شادي ناصف',
        email: 'shady.nasif@gmail.com',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    } else if (role === 'branch') {
      setCurrentUser({
        uid: 'user-jeddah',
        name: 'أحمد الغامدي',
        email: 'jeddah.branch@company.com',
        role: 'branch',
        branch: branches[1] || 'فرع جدة الغربية',
        createdAt: new Date().toISOString()
      });
    } else {
      setCurrentUser({
        uid: 'user-viewer',
        name: 'سلطان المقرن',
        email: 'viewer@company.com',
        role: 'viewer',
        createdAt: new Date().toISOString()
      });
    }
  };

  const updatedDebtReset = (user: UserProfile) => {
    setCurrentUser(user);
    logActivity('login', `محاكاة تبديل صلاحيات العرض الجاري إلى رتبة: ${user.role}`);
  };

  // Add custom branch to settings
  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchInput.trim()) return;
    if (branches.includes(newBranchInput.trim())) {
      alert('الفرع مسجل مسبقاً في قاعدة النظام');
      return;
    }
    const updated = [...branches, newBranchInput.trim()];
    saveBranchesList(updated);
    setNewBranchInput('');
    logActivity('update', `إضافة فرع جغرافي جديد لقواعد النظام: ${newBranchInput.trim()}`);
  };

  const handleDeleteBranch = (bName: string) => {
    if (employees.some(e => e.branch === bName && e.status === 'active')) {
      alert('عذراً، لا يمكن حذف هذا الفرع لوجود عمال نشطين مسجلين تحت ملفاته الجغرافية');
      return;
    }
    const updated = branches.filter(b => b !== bName);
    saveBranchesList(updated);
    logActivity('update', `إبعاد وحذف فرع جغرافي غير مأهول: ${bName}`);
  };

  // Add mock profile security users
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    
    const newUser: UserProfile = {
      uid: `u_${Date.now()}`,
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      branch: newUserRole === 'branch' ? newUserBranch || branches[0] : undefined,
      createdAt: new Date().toISOString()
    };

    saveUsersList([...users, newUser]);
    setNewUserName('');
    setNewUserEmail('');
    logActivity('update', `دعوة وتسجيل مستخدم برتبة صلاحية جديدة: ${newUserName} (${newUserRole})`);
    alert('✓ تمت إضافة المستخدم لقائمة الصلاحيات والترخيص بنجاح.');
  };

  const toastNotice = (msg: string) => {
    alert(msg);
  };

  // Logo uploader base64 converter
  const handleCompanyLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024 * 1.5) {
        alert('حجم الملف كبير جداً! الحد الأقصى المسموح هو 1.5 ميغابايت');
        return;
      }
      const loader = new FileReader();
      loader.onload = (event) => {
        const base64 = event.target?.result as string;
        const updated = { ...companySettings, logoBase64: base64 };
        setCompanySettings(updated);
        const compKey = currentUser?.tenantId ? `labor_${currentUser.tenantId}_company` : 'labor_company';
        localStorage.setItem(compKey, JSON.stringify(updated));
        logActivity('update', 'تبديل وإدراج شعار رسمي جديد لهوية المؤسسة.');
        alert('✓ تم حفظ الشعار الجديد المرفق بنجاح.');
      };
      loader.readAsDataURL(file);
    }
  };

  const handleClearCompanyLogo = () => {
    const updated = { ...companySettings, logoBase64: undefined };
    setCompanySettings(updated);
    const compKey = currentUser?.tenantId ? `labor_${currentUser.tenantId}_company` : 'labor_company';
    localStorage.setItem(compKey, JSON.stringify(updated));
    logActivity('update', 'إزالة الشعار الرسمي المثبت والرجوع للشارة الكلاسيكية.');
    alert('تم مسح الشعار المستورد بنجاح.');
  };

  const handleSaveCompanySettingsText = () => {
    const compKey = currentUser?.tenantId ? `labor_${currentUser.tenantId}_company` : 'labor_company';
    localStorage.setItem(compKey, JSON.stringify(companySettings));
    logActivity('update', `تعديل المسمى التجاري للمنظومة ليصبح: ${companySettings.name}`);
    alert('✓ تم حفظ مسمى الشركة الجديد.');
  };

  const handleSavePricing = () => {
    const pricKey = currentUser?.tenantId ? `labor_${currentUser.tenantId}_pricing` : 'labor_pricing';
    localStorage.setItem(pricKey, JSON.stringify(pricingSettings));
    logActivity('update', 'إعادة ضبط قواعد تسعيرة رسوم الكفالة وتجديدات رخص الإقامة بمشاركة المحاسب.');
    alert('✓ تم حفظ قواعد الأسعار والرسوم بنجاح.');
  };

  // Dynamic alert totals calculated
  const getAlertTotalsCounts = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const active = employees.filter(e => e.status === 'active');
    
    // count critical expiry < 90
    const expiryCount = active.filter(e => {
      if (!e.iqamaExpiry) return false;
      const days = Math.ceil((new Date(e.iqamaExpiry + 'T00:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 90;
    }).length;

    // debtors count
    const debtCount = active.filter(e => {
      const pmts = payments.filter(p => (p.iqamaNo === e.iqamaNo || p.name === e.name) && !p.type?.includes('مديونية'));
      const paid = pmts.reduce((s, p) => s + (p.amount || 0), 0);
      const due = (e.iqamaBalance || 0) + (e.kafalaCount * pricingSettings.kafala) + (e.otherDebt || 0);
      return (paid - due) < 0;
    }).length;

    return expiryCount + debtCount;
  };

  if (!currentUser) {
    return (
      <PortalAuthView 
        users={users}
        onLoginSuccess={handleLoginSuccess}
        onRegisterSubmit={handleRegisterSubmit}
        companyName={companySettings.name}
        logoBase64={companySettings.logoBase64}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-[#f4f7fc]">
      
      {/* 1. Responsive Sidebar Navigation */}
      <SidebarMenu 
        companyName={companySettings.name}
        logoBase64={companySettings.logoBase64}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedStatementEmp(null);
        }}
        currentUser={currentUser}
        onChangeUserRole={changeProfileDirect}
        onResetData={handleResetData}
        totalEmployeesCount={employees.filter(e => e.status === 'active').length}
        totalAlertsCount={getAlertTotalsCounts()}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onLogout={handleLogout}
        pendingUsersCount={users.filter(u => u.status === 'pending').length}
      />

      {/* 2. Primary Layout Shell Area */}
      <div className="flex-1 flex flex-col lg:mr-[275px] min-w-0 transition-all duration-300">
        
        {/* Top Sticky Header */}
        <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-slate-100 rounded-lg lg:hidden transition-colors cursor-pointer text-slate-800"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-sm font-extrabold text-[#002f56] select-none uppercase tracking-wide">
              {activeTab === 'dashboard' && 'لوحة القيادة والمتابعة الفورية'}
              {activeTab === 'employees' && 'إدارة وإحصاء مِلَفّات العمالة الموثقة'}
              {activeTab === 'approvals' && 'إدارة طلبات التسجيل والموافقات بالبوابة'}
              {activeTab === 'alerts' && 'الإنذارات العاجلة والإقامات المنتهية'}
              {activeTab === 'payments' && 'دفتر قيود وإيرادات التحصيلات النقدية'}
              {activeTab === 'monthly' && 'التقارير والمقاصات المالية الشهرية'}
              {activeTab === 'archive' && 'شاشات الأرشيف والمسودات السابقة'}
              {activeTab === 'settings' && 'إعدادات المنظومة وصلاحيات الهوية'}
              {activeTab === 'help' && 'أوراق استشارة الديكري والتركيب المحلي'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-sky-50 text-sky-850 px-2.5 py-1.5 rounded-xl border border-sky-100/50 font-black">
              رتبة التصفّح: {currentUser.role === 'admin' ? 'المدير العام 💻' : (currentUser.role === 'branch' ? `مشرف ${currentUser.branch}` : 'مُشاهد 👁️')}
            </span>
          </div>
        </header>

        {/* 3. Main Central App Area */}
        <main className="flex-grow p-4 md:p-6 lg:p-8 bg-[#f4f7fc]/50">
          
          {/* 🌟 Professional Glassmorphic Content Panel with Custom Shadow & Padding 🌟 */}
          <div className="flex flex-col gap-6 p-5 md:p-7 bg-white rounded-3xl border border-slate-200/50 shadow-[0_15px_45px_0_rgba(11,40,68,0.06),0_2px_8px_-2px_rgba(0,0,0,0.015)] min-w-0 transition-all duration-300">
            
            {/* Detailed Statement View triggered (Overrides the tab content like a detail sheet) */}
            {selectedStatementEmp ? (
            <div className="space-y-4">
              <button 
                onClick={() => setSelectedStatementEmp(null)}
                className="btn btn-ghost text-xs cursor-pointer flex items-center gap-1 hover:bg-slate-205"
              >
                <span>الرجوع لجدول العمالة الرئيسي</span>
              </button>
              
              <LedgerStatement 
                employee={selectedStatementEmp}
                payments={payments}
                pricing={pricingSettings}
                companyName={companySettings.name}
                logoBase64={companySettings.logoBase64}
                onClose={() => setSelectedStatementEmp(null)}
                currentUser={currentUser}
                onDeletePayment={(id, name, amount) => {
                  const filtered = payments.filter(p => p.id !== id);
                  savePayments(filtered);
                  logActivity('del', `حذف قيد من كشف الحساب بمبلغ ${amount.toLocaleString()} ريال للموظف ${name}`);
                }}
              />
            </div>
          ) : (
            <>
              {/* Tab: Dashboard statistics */}
              {activeTab === 'dashboard' && (
                <DashboardView 
                  employees={employees}
                  payments={payments}
                  pricing={pricingSettings}
                  logs={logs}
                  branches={branches}
                  onClearLogs={handleClearLogs}
                  activeRole={currentUser.role}
                  logoBase64={companySettings.logoBase64}
                />
              )}

              {/* Tab: Approvals */}
              {activeTab === 'approvals' && currentUser.role === 'admin' && (
                <PortalApprovalsView 
                  users={users}
                  onUpdateUserStatus={handleUpdateUserStatus}
                  onDeleteUser={handleDeleteUser}
                  onUpdateUserRole={handleUpdateUserRole}
                  branches={branches}
                />
              )}

              {/* Tab: Employees Ledger List */}
              {activeTab === 'employees' && (
                <EmployeeListView 
                  employees={employees}
                  payments={payments}
                  pricing={pricingSettings}
                  branches={branches}
                  currentUser={currentUser}
                  onAddEmployee={handleAddEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  onArchiveEmployee={handleArchiveEmployee}
                  onUpdateEmployeeExpiry={handleUpdateEmployeeExpiry}
                  onUpdateEmployee={handleUpdateEmployee}
                  onRegisterPayment={handleRegisterPaymentProxy}
                  onAddKafalaOrder={handleAddKafalaOrder}
                  onShowStatement={(emp) => setSelectedStatementEmp(emp)}
                />
              )}

              {/* Tab: Critical Alerts warnings */}
              {activeTab === 'alerts' && (
                <AlertsListView 
                  employees={employees}
                  payments={payments}
                  pricing={pricingSettings}
                  activeRole={currentUser.role}
                />
              )}

              {/* Tab: Money Recorded transactions */}
              {activeTab === 'payments' && (
                <PaymentsListView 
                  payments={payments}
                  branches={branches}
                  currentUser={currentUser}
                  onDeletePayment={(id, n, amt) => {
                    const filtered = payments.filter(p => p.id !== id);
                    savePayments(filtered);
                    logActivity('del', `حذف قيد مالي محصل بمبلغ ${amt.toLocaleString()} ريال للموظف ${n}`);
                  }}
                />
              )}

              {/* Tab: Monthly analytics */}
              {activeTab === 'monthly' && (
                <MonthlyFinanceView payments={payments} />
              )}

              {/* Tab: Archive deactivated workers */}
              {activeTab === 'archive' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
                  <div className="border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-extrabold text-sm text-slate-800">أرشيف الاستبعاد وملفات العمالة التالفة</h3>
                    <p className="text-xs text-slate-500 mt-1">تجد هنا قائمة بالعمال المستبعدين مسبقاً من النظام لتسهيل تتبع الفواتير والذمم السابقة.</p>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-right">
                      <thead className="bg-[#f8fafc] text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-center">#</th>
                          <th className="px-4 py-3">اسم العامل المستبعد</th>
                          <th className="px-4 py-3 text-center">رقم الإقامة</th>
                          <th className="px-4 py-3 text-center">الفرع السابق</th>
                          <th className="px-4 py-3 text-center">تاريخ الأرشفة</th>
                          <th className="px-4 py-3">سبب الأرشفة والاستبعاد</th>
                          {currentUser.role !== 'viewer' && <th className="px-4 py-3 text-center">الإجراء</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {employees.filter(e => e.status === 'archived').map((e, idx) => (
                          <tr key={e.iqamaNo} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{e.name}</td>
                            <td className="px-4 py-3 text-center font-mono">{e.iqamaNo}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-bold">{e.branch}</span>
                            </td>
                            <td className="px-4 py-3 text-center font-mono">{e.archiveDate || '-'}</td>
                            <td className="px-4 py-3 font-semibold text-rose-800">{e.archiveReason || 'غير محدد'}</td>
                            {currentUser.role !== 'viewer' && (
                              <td className="px-4 py-3 text-center">
                                <button 
                                  onClick={() => handleRestoreEmployee(e.iqamaNo)}
                                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold transition-all cursor-pointer"
                                >
                                  إلغاء الأرشفة والارجاع للنظام ↩️
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {employees.filter(e => e.status === 'archived').length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400 font-bold bg-slate-50/20">
                              الأرشيف فارغ حالياً من أي مستبعدين.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab: System Settings brand and rules */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  
                  {/* Grid forms settings */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Identity settings card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                      <div className="border-b border-slate-100 pb-2">
                        <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 block mb-1">الهوية التسويقية</h4>
                        <h3 className="font-black text-sm text-slate-800">تخصيص شعار ومسمى المؤسسة التجاري</h3>
                      </div>

                      <div className="space-y-4 text-xs font-bold text-slate-700">
                        <div className="space-y-1.5">
                          <label>مسمى المؤسسة التجاري (يظهر بالتقارير ومقدمة الشاشة)</label>
                          <input 
                            type="text"
                            value={companySettings.name}
                            onChange={(e) => setCompanySettings({ ...companySettings, name: e.target.value })}
                            className="w-full py-2 px-3 border border-slate-200 rounded-lg text-slate-800 text-xs"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block">شعار المؤسسة الرسمي المرفق</label>
                          <div className="flex gap-4 items-center">
                            <div className="w-16 h-11 border border-slate-200 bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                              {companySettings.logoBase64 ? (
                                <img src={companySettings.logoBase64} alt="شعار المؤسسة" className="max-h-full max-w-full object-contain" />
                              ) : (
                                <span className="text-lg">🏢</span>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <label className="px-3 py-1.5 bg-primary/10 text-primary-light hover:bg-primary/15 rounded-lg font-bold cursor-pointer transition-colors text-[10px]">
                                رفع شعار جديد
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  onChange={handleCompanyLogoUpload}
                                  className="hidden" 
                                />
                              </label>
                              {companySettings.logoBase64 && (
                                <button 
                                  onClick={handleClearCompanyLogo}
                                  className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-bold transition-all text-[10px]"
                                >
                                  حذف الحالي
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={handleSaveCompanySettingsText}
                          className="btn btn-primary text-xs w-full py-2"
                        >
                          حفظ هوية المؤسسة
                        </button>
                      </div>
                    </div>

                    {/* Pricing rules cards */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                      <div className="border-b border-slate-100 pb-2">
                        <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 block mb-1">قواعد المحاسب</h4>
                        <h3 className="font-black text-sm text-slate-800">إدارة تسعيرة كشوفات العمالة</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                        <div className="space-y-1.5 col-span-2 sm:col-span-1">
                          <label>قيمة الكفالة الشهرية الصافية (ريال)</label>
                          <input 
                            type="number"
                            value={pricingSettings.kafala}
                            onChange={(e) => setPricingSettings({ ...pricingSettings, kafala: Number(e.target.value) })}
                            className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>

                        <div className="space-y-1.5 col-span-2 sm:col-span-1 flex items-center gap-1.5 pt-6 select-none cursor-pointer">
                          <input 
                            type="checkbox"
                            id="ramFree"
                            checked={pricingSettings.ramadanFree}
                            onChange={(e) => setPricingSettings({ ...pricingSettings, ramadanFree: e.target.checked })}
                            className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                          />
                          <label htmlFor="ramFree" className="cursor-pointer">إعفاء شهر رمضان المبارك 🎁</label>
                        </div>

                        <div className="space-y-1.5 col-span-2 md:col-span-1">
                          <label>تجديد إقامة — 3 أشهر (ريال)</label>
                          <input 
                            type="number"
                            value={pricingSettings.iqama3}
                            onChange={(e) => setPricingSettings({ ...pricingSettings, iqama3: Number(e.target.value) })}
                            className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1.5 col-span-2 md:col-span-1">
                          <label>تجديد إقامة — 6 أشهر (ريال)</label>
                          <input 
                            type="number"
                            value={pricingSettings.iqama6}
                            onChange={(e) => setPricingSettings({ ...pricingSettings, iqama6: Number(e.target.value) })}
                            className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1.5 col-span-2">
                          <label>تجديد إقامة — سنة كاملة 12 شهر (ريال)</label>
                          <input 
                            type="number"
                            value={pricingSettings.iqama12}
                            onChange={(e) => setPricingSettings({ ...pricingSettings, iqama12: Number(e.target.value) })}
                            className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={handleSavePricing}
                        className="btn btn-primary text-xs w-full py-2.5"
                      >
                        حفظ الرسوم وتعديلاتها
                      </button>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Branch Management settings card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                      <div className="border-b border-slate-100 pb-2">
                        <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 block mb-1">الفروع التوزيعية</h4>
                        <h3 className="font-black text-sm text-slate-800">تخصيص فروع المؤسسة وتعديل توزيعها الجغرافي</h3>
                      </div>

                      <div className="flex flex-wrap gap-2 py-1 select-none">
                        {branches.map(b => (
                          <span 
                            key={b} 
                            className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs inline-flex items-center gap-1.5"
                          >
                            <span>🏢 {b}</span>
                            {branches.length > 1 && (
                              <button 
                                onClick={() => handleDeleteBranch(b)}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>

                      <form onSubmit={handleAddBranch} className="flex gap-2">
                        <input 
                          type="text"
                          value={newBranchInput}
                          onChange={(e) => setNewBranchInput(e.target.value)}
                          placeholder="مثال: فرع المنطقة مكة المكرمة"
                          className="flex-1 py-1 px-3 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                        />
                        <button type="submit" className="px-4 py-1.5 bg-[#0d5189] text-white rounded-xl text-xs font-bold hover:bg-primary-light">
                          إضافة فرع جديد
                        </button>
                      </form>
                    </div>

                    {/* Users list management panel */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                      <div className="border-b border-slate-100 pb-2">
                        <h3 className="font-black text-sm text-slate-800">مستخدمي النظام وصلاحيات التراخيص</h3>
                      </div>

                      <div className="overflow-x-auto text-[11px] font-bold text-slate-700">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400">
                              <th className="py-2">المستخدم</th>
                              <th className="py-2">الصلاحية</th>
                              <th className="py-2">الفرع</th>
                              <th className="py-2">الإجراء</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map(u => (
                              <tr key={u.uid} className="border-b border-slate-100">
                                <td className="py-2.5">
                                  <div>{u.name}</div>
                                  <div className="text-[9px] text-slate-400 font-mono font-medium">{u.email}</div>
                                </td>
                                <td className="py-2.5">
                                  <span className={`px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span>
                                </td>
                                <td className="py-2.5 text-slate-500">{u.branch || 'كل الفروع'}</td>
                                <td className="py-2.5">
                                  {u.uid === currentUser.uid ? (
                                    <span className="text-[10px] text-slate-400 font-bold">الحساب الحالي</span>
                                  ) : (
                                    <button 
                                      onClick={() => handleDeleteUser(u.uid)}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      حذف
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <form onSubmit={handleAddUser} className="space-y-3 pt-3 border-t border-slate-100 text-xs font-bold text-slate-700">
                        <h4 className="text-slate-800">دعوة وتسجيل مستخدم جديد:</h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <input 
                            type="text" 
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            required
                            placeholder="الاسم كاملاً" 
                            className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" 
                          />
                          <input 
                            type="email" 
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            required
                            placeholder="البريد الإلكتروني" 
                            className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" 
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <select 
                            value={newUserRole} 
                            onChange={(e) => setNewUserRole(e.target.value as any)}
                            className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="admin">مسؤول رئيسي (Admin)</option>
                            <option value="branch">مشرف فرع (Branch)</option>
                            <option value="viewer">مشاهد قراءة فقط (Viewer)</option>
                          </select>
                          
                          {newUserRole === 'branch' && (
                            <select 
                              value={newUserBranch} 
                              onChange={(e) => setNewUserBranch(e.target.value)}
                              className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            >
                              {branches.map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        <button type="submit" className="w-full py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold cursor-pointer">
                          تثبيت وإرسال دعوة التسجيل
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  {currentUser.role === 'admin' && (
                    <div className="bg-rose-50/50 rounded-2xl border border-rose-200 p-5 mt-6 shadow-sm space-y-4">
                      <div className="border-b border-rose-100 pb-2">
                        <h3 className="font-black text-sm text-rose-800">صيانة النظام وتصفير البيانات التجريبية</h3>
                        <p className="text-[10px] text-rose-600 font-semibold mt-1">تتيح لك هذه اللوحة البدء بصفحة نظيفة من الصفر ومسح عينات العمالة التي تم إدراجها مسبقاً لأسباب الاختبار أو التجربة.</p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs font-bold text-slate-700 space-y-1 text-right">
                          <div className="text-rose-900 font-extrabold text-xs">⚠️ سيؤدي هذا الإجراء فوراً إلى حذف:</div>
                          <ul className="list-disc list-inside text-[11px] text-slate-550 font-normal space-y-1">
                            <li>جميع عمالة المؤسسة النشطة والأرشيفية المسجلة بالمتصفح.</li>
                            <li>سجلات الدفعات ووصولات السداد وقيود كشف الحساب المالية بالكامل.</li>
                            <li>سجل النشاط وحركات المستخدمين المنفذة مسبقاً.</li>
                          </ul>
                        </div>
                        <button 
                          onClick={handleWipeAllData}
                          className="px-6 py-3 bg-red-600 text-white rounded-xl text-xs font-black hover:bg-red-700 shadow-md cursor-pointer transition-colors whitespace-nowrap"
                        >
                          ⚠️ امسح وعيّن ليدجر عمالة فارغ وجديد
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Tab: Local Server integration guide */}
              {activeTab === 'help' && currentUser.email === 'shady.nasif@gmail.com' && (
                <LocalSetupGuide />
              )}
            </>
          )}

          </div>
        </main>
      </div>

    </div>
  );
}
