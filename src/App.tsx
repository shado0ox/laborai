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
import GeneralLedgerView from './components/GeneralLedgerView';
import LedgerStatement from './components/LedgerStatement';
import PortalAuthView from './components/PortalAuthView';
import PortalApprovalsView from './components/PortalApprovalsView';
import PortalSpacesView from './components/PortalSpacesView';
import PortalDevPanelView from './components/PortalDevPanelView';

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
    name: 'برنامج إدارة العمالة المهنية'
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

  // DB diagnostics and migration states
  const [dbStatusInfo, setDbStatusInfo] = useState<{
    status: 'connected' | 'disconnected';
    host: string;
    port: number;
    user: string;
    database: string;
    error: string | null;
  } | null>(null);

  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'migrating' | 'success' | 'error' | 'no_data'>('idle');
  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  const [hasLocalData, setHasLocalData] = useState(false);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch('/api/db-status');
      if (res.ok) {
        const data = await res.json();
        setDbStatusInfo(data);
      }
    } catch (e) {
      console.warn('Failed to fetch db status (this is normal if server is booting or offline):', e);
    }
  };

  // Check if there is local data in localStorage
  useEffect(() => {
    let found = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('labor_') && (key.includes('employees') || key.includes('payments')) && !key.includes('current_user') && !key.includes('users')) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
              found = true;
            }
          } catch(e) {}
        }
      }
    }
    setHasLocalData(found);
  }, []);

  const runMigration = async () => {
    setMigrationStatus('migrating');
    setMigrationLog(['جاري بدء ترحيل البيانات المحلية من المتصفح إلى السيرفر...']);
    try {
      let employeesMigrated = 0;
      let paymentsMigrated = 0;
      let logsMigrated = 0;
      let branchesMigrated = 0;

      // Scan and find data
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (key.startsWith('labor_') && !key.includes('current_user') && !key.includes('users')) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch(e) {
            continue;
          }

          // Detect tenant id
          // Key format: labor_employees or labor_EP_employees
          const parts = key.split('_');
          let tenantId = '';
          if (parts.length > 2) {
            // e.g. labor_EP_employees -> parts is ["labor", "EP", "employees"]
            tenantId = parts[1];
          }

          // 1. Employees
          if (key.includes('employees') && Array.isArray(parsed)) {
            setMigrationLog(p => [...p, `جاري ترحيل ${parsed.length} موظف إلى السيرفر لـ ${tenantId || 'الرئيسي'}...`]);
            for (const emp of parsed) {
              await fetch(`/api/employees?tenantId=${tenantId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emp)
              });
              employeesMigrated++;
            }
          }

          // 2. Payments
          if (key.includes('payments') && Array.isArray(parsed)) {
            setMigrationLog(p => [...p, `جاري ترحيل ${parsed.length} دفعة مالية إلى السيرفر لـ ${tenantId || 'الرئيسي'}...`]);
            for (const pmt of parsed) {
              await fetch(`/api/payments?tenantId=${tenantId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pmt)
              });
              paymentsMigrated++;
            }
          }

          // 3. Branches
          if (key.includes('branches') && Array.isArray(parsed)) {
            setMigrationLog(p => [...p, `جاري ترحيل الفروع إلى السيرفر لـ ${tenantId || 'الرئيسي'}...`]);
            await fetch(`/api/branches?tenantId=${tenantId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsed)
            });
            branchesMigrated += parsed.length;
          }

          // 4. Logs
          if (key.includes('logs') && Array.isArray(parsed)) {
            setMigrationLog(p => [...p, `جاري ترحيل سجلات الحركة إلى السيرفر لـ ${tenantId || 'الرئيسي'}...`]);
            for (const logItem of parsed) {
              await fetch(`/api/logs?tenantId=${tenantId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logItem)
              });
              logsMigrated++;
            }
          }
        }
      }

      setMigrationLog(p => [...p, `✅ تم اكتمال الترحيل بنجاح!`]);
      setMigrationLog(p => [...p, `📊 الإحصائيات: تم ترحيل ${employeesMigrated} موظف، ${paymentsMigrated} دفعة مالية، ${branchesMigrated} فروع، ${logsMigrated} سجل حركة.`]);
      setMigrationStatus('success');
      setHasLocalData(false);

      // Refresh states
      if (currentUser) {
        const tid = currentUser.tenantId || '';
        const empRes = await fetch(`/api/employees?tenantId=${tid}`);
        if (empRes.ok) setEmployees(await empRes.json());
        const payRes = await fetch(`/api/payments?tenantId=${tid}`);
        if (payRes.ok) setPayments(await payRes.json());
        const logRes = await fetch(`/api/logs?tenantId=${tid}`);
        if (logRes.ok) setLogs(await logRes.json());
      }

      if (confirm('✅ تم ترحيل كافة البيانات وحفظها بنجاح بقاعدة البيانات!\n\nهل ترغب في مسح البيانات المؤقتة والقديمة من متصفحك الآن لتجنب تكرار هذا التنبيه؟')) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('labor_') && !key.includes('current_user') && !key.includes('users')) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setMigrationLog(p => [...p, `❌ حدث خطأ أثناء الترحيل: ${err.message || String(err)}`]);
      setMigrationStatus('error');
    }
  };

  useEffect(() => {
    fetchDbStatus();
    const interval = setInterval(fetchDbStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // 1. Initial global app boot loader
  useEffect(() => {
    async function loadGlobalData() {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const fetchedUsers = await res.json() as UserProfile[];
          if (fetchedUsers.length === 0) {
            // Seed INITIAL_USERS to database
            for (const u of INITIAL_USERS) {
              await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(u)
              });
            }
            setUsers(INITIAL_USERS);
          } else {
            setUsers(fetchedUsers);
          }
        } else {
          setUsers(INITIAL_USERS);
        }

        // Check current session
        const storedCurrentUser = localStorage.getItem('labor_current_user');
        if (storedCurrentUser) {
          const u = JSON.parse(storedCurrentUser) as UserProfile;
          setCurrentUser(u);
          if (u.email === 'shady.nasif@gmail.com') {
            setActiveTab('dev_panel');
          }
        }
      } catch (e) {
        console.warn('API global boot error (offline fallback used):', e);
        setUsers(INITIAL_USERS);
      }
    }
    loadGlobalData();
  }, []);

  // 2. Tenant/Workspace data loader - triggers whenever currentUser changes!
  useEffect(() => {
    if (!currentUser) return;
    async function loadTenantData() {
      const tid = currentUser.tenantId || '';
      try {
        // Fetch Employees
        const empRes = await fetch(`/api/employees?tenantId=${tid}`);
        if (empRes.ok) {
          const data = await empRes.json();
          setEmployees(data);
        }

        // Fetch Payments
        const payRes = await fetch(`/api/payments?tenantId=${tid}`);
        if (payRes.ok) {
          const data = await payRes.json();
          setPayments(data);
        }

        // Fetch Branches
        const branchRes = await fetch(`/api/branches?tenantId=${tid}`);
        if (branchRes.ok) {
          const data = await branchRes.json();
          if (data && data.length > 0) {
            setBranches(data);
          } else {
            const initialBrs = tid ? [] : INITIAL_BRANCHES;
            setBranches(initialBrs);
            if (initialBrs.length > 0) {
              await fetch(`/api/branches?tenantId=${tid}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(initialBrs)
              });
            }
          }
        }

        // Fetch Logs
        const logRes = await fetch(`/api/logs?tenantId=${tid}`);
        if (logRes.ok) {
          const data = await logRes.json();
          if (data && data.length > 0) {
            setLogs(data);
          } else {
            setLogs(INITIAL_LOGS);
            await fetch(`/api/logs?tenantId=${tid}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(INITIAL_LOGS[0])
            });
          }
        }

        // Fetch Company
        const compRes = await fetch(`/api/company-settings?tenantId=${tid}`);
        if (compRes.ok) {
          const data = await compRes.json();
          setCompanySettings(data);
        }

        // Fetch Pricing
        const pricRes = await fetch(`/api/pricing-settings?tenantId=${tid}`);
        if (pricRes.ok) {
          const data = await pricRes.json();
          setPricingSettings(data);
        }
      } catch (err) {
        console.warn('API tenant load error, using fallback states (this is normal if server is booting or offline):', err);
      }
    }
    loadTenantData();
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

  // Sync savers (pure React updates - API persists on action)
  const saveEmployees = (list: Employee[]) => {
    setEmployees(list);
  };

  const savePayments = (list: Payment[]) => {
    setPayments(list);
  };

  const saveBranchesList = async (list: string[]) => {
    setBranches(list);
    try {
      await fetch(`/api/branches?tenantId=${currentUser?.tenantId || ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list)
      });
    } catch (err) {
      console.error('API branches save error:', err);
    }
  };

  const saveLogsList = (list: ActivityLog[]) => {
    setLogs(list);
  };

  const saveUsersList = (list: UserProfile[]) => {
    setUsers(list);
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
    if (user.email === 'shady.nasif@gmail.com') {
      setActiveTab('dev_panel');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleRegisterSubmit = async (newUser: UserProfile) => {
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
    } catch (err) {
      console.error('API register user error:', err);
    }
  };

  const handleUpdateUserStatus = async (uid: string, status: 'approved' | 'rejected') => {
    const updated = users.map(u => {
      if (u.uid === uid) {
        return { ...u, status };
      }
      return u;
    });
    setUsers(updated);
    
    const uName = users.find(u => u.uid === uid)?.name || 'مستخدم غير معروف';
    try {
      await fetch(`/api/users/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const actionText = status === 'approved' 
        ? `اعتماد وتنشيط حساب المستخدم الجديد بالبوابة: ${uName}` 
        : `رفض تفعيل حساب المستخدم الجديد بالبوابة: ${uName}`;
      logActivity(status === 'approved' ? 'update' : 'del', actionText);
      toastNotice(status === 'approved' ? '✓ تم تنشيط الحساب بنجاح!' : 'تم رفض الحساب.');
    } catch (err) {
      console.error('API user status update error:', err);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    const targetUser = users.find(u => u.uid === uid);
    if (targetUser?.email === 'shady.nasif@gmail.com') {
      toastNotice('⚠️ خطأ: لا يمكن حذف حساب مطور البرنامج الرئيسي!');
      return;
    }
    const uName = targetUser?.name || 'مستخدم';
    const updated = users.filter(u => u.uid !== uid);
    setUsers(updated);
    try {
      await fetch(`/api/users/${uid}`, {
        method: 'DELETE'
      });
      logActivity('update', `حذف كامل لحساب وعضوية المستخدم: ${uName} من السيرفر.`);
      toastNotice('✓ تم حذف الحساب بنجاح.');
    } catch (err) {
      console.error('API user delete error:', err);
    }
  };

  const handleUpdateUserRole = async (uid: string, role: 'admin' | 'branch' | 'viewer', branch?: string) => {
    const uName = users.find(u => u.uid === uid)?.name || 'مستخدم';
    const updated = users.map(u => {
      if (u.uid === uid) {
        return { ...u, role, branch };
      }
      return u;
    });
    setUsers(updated);
    try {
      await fetch(`/api/users/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, branch })
      });
      logActivity('update', `تعديل صلاحيات حساب الموظف ${uName} لتصبح: ${role}`);
      toastNotice('✓ تم تعديل الرتبة بنجاح.');
    } catch (err) {
      console.error('API user role update error:', err);
    }
  };

  const logActivity = async (type: ActivityLog['type'], text: string) => {
    const newLog: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      text,
      user: currentUser?.name || 'النظام',
      time: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    setLogs(prev => [newLog, ...prev]);
    try {
      await fetch(`/api/logs?tenantId=${currentUser?.tenantId || ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
    } catch (err) {
      console.error('API log activity error:', err);
    }
  };

  // Mutators and state updates
  const handleAddEmployee = async (emp: Employee) => {
    const updated = [emp, ...employees];
    setEmployees(updated);
    try {
      await fetch(`/api/employees?tenantId=${currentUser?.tenantId || ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emp)
      });
      logActivity('add', `إضافة موظف عمالة جديد لقاعدة البيانات: ${emp.name} | رقم الإقامة: ${emp.iqamaNo}`);
    } catch (err) {
      console.error('API add employee error:', err);
    }
  };

  const handleDeleteEmployee = async (iqamaNo: string) => {
    const emp = employees.find(e => e.iqamaNo === iqamaNo);
    const updated = employees.filter(e => e.iqamaNo !== iqamaNo);
    setEmployees(updated);
    
    // Cascading delete related payments too
    const filteredPayments = payments.filter(p => p.iqamaNo !== iqamaNo);
    setPayments(filteredPayments);

    try {
      await fetch(`/api/employees/${iqamaNo}`, {
        method: 'DELETE'
      });
      if (emp) {
        logActivity('del', `حذف كلي ونهائي لملف العامل: ${emp.name} من شاشات الإدارة.`);
      }
    } catch (err) {
      console.error('API delete employee error:', err);
    }
  };

  const handleArchiveEmployee = async (iqamaNo: string, reason: string) => {
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
    setEmployees(updated);
    
    const emp = updated.find(e => e.iqamaNo === iqamaNo);
    if (emp) {
      try {
        await fetch(`/api/employees?tenantId=${currentUser?.tenantId || ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emp)
        });
        logActivity('arc', `أرشفة واستبعاد ملف العامل: ${emp.name} — السبب: ${reason}`);
      } catch (err) {
        console.error('API archive employee error:', err);
      }
    }
  };

  const handleRestoreEmployee = async (iqamaNo: string) => {
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
    setEmployees(updated);
    
    const emp = updated.find(e => e.iqamaNo === iqamaNo);
    if (emp) {
      try {
        await fetch(`/api/employees?tenantId=${currentUser?.tenantId || ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emp)
        });
        logActivity('restore', `إلغاء أرشفة وإرجاع الموظف ${emp.name} كنشط في النظام.`);
        alert(`✓ تم إرجاع ${emp.name} للنظام بنجاح.`);
      } catch (err) {
        console.error('API restore employee error:', err);
      }
    }
  };

  const handleWipeAllData = async () => {
    if (confirm("⚠️ تحذير مدمر محاسبي نهائي!\n\nهل أنت متأكد تماماً من رغبتك في حذف وإفراغ كافة بيانات العمالة، والقيود المالية، والدفعات، وسجلات الحركة بالكامل؟\nهذا الإجراء لا يمكن التراجع عنه أبداً وسيتم حذفها من قاعدة البيانات.")) {
      try {
        const tid = currentUser?.tenantId || '';
        await fetch(`/api/system/wipe?tenantId=${tid}`, {
          method: 'POST'
        });
        
        setEmployees([]);
        setPayments([]);
        
        const newInitLog = {
          id: `log_init_${Date.now()}`,
          type: 'update' as const,
          text: 'تم تصفير وإفراغ قاعدة البيانات بنجاح وبدء سجل نشاط جديد.',
          user: currentUser?.name || 'النظام',
          time: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
        setLogs([newInitLog]);
        
        await fetch(`/api/logs?tenantId=${tid}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newInitLog)
        });
        
        alert("🎉 تم تهيئة النظام ومسح كافة البيانات بنجاح!");
      } catch (err) {
        console.error('API wipe error:', err);
      }
    }
  };

  const handleUpdateEmployee = async (updatedEmp: Employee) => {
    const updated = employees.map(e => {
      if (e.iqamaNo === updatedEmp.iqamaNo) {
        return updatedEmp;
      }
      return e;
    });
    setEmployees(updated);
    try {
      await fetch(`/api/employees?tenantId=${currentUser?.tenantId || ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEmp)
      });
    } catch (err) {
      console.error('API update employee error:', err);
    }
  };

  const handleUpdateEmployeeExpiry = async (iqamaNo: string, newDate: string) => {
    const updated = employees.map(e => {
      if (e.iqamaNo === iqamaNo) {
        return { ...e, iqamaExpiry: newDate };
      }
      return e;
    });
    setEmployees(updated);

    const emp = updated.find(e => e.iqamaNo === iqamaNo);
    if (emp) {
      try {
        await fetch(`/api/employees?tenantId=${currentUser?.tenantId || ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emp)
        });
        logActivity('update', `تحديث مستند انتهاء إقامة الجوازات لـ ${emp.name} إلى ميلادي: ${newDate}`);
      } catch (err) {
        console.error('API update employee expiry error:', err);
      }
    }
  };

  const handleRegisterPayment = async (
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
      branch: emp ? emp.branch : (branches[0] || 'فرع الرياض الأساسي'),
      amount,
      type,
      date: new Date().toISOString().slice(0, 10),
      notes,
      hijriMonth: m,
      hijriYear: y
    };

    setPayments(prev => [newPayment, ...prev]);
    try {
      await fetch(`/api/payments?tenantId=${currentUser?.tenantId || ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPayment)
      });
      logActivity('pay', `تسجيل دفعة نقدية بقيمة ${amount.toLocaleString()} ريال للموظف ${emp?.name} — ببيان: ${type}`);
    } catch (err) {
      console.error('API register payment error:', err);
    }
  };

  const handleAddKafalaOrder = async (
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
    setEmployees(updated);

    const emp = updated.find(e => e.iqamaNo === iqamaNo);
    if (emp) {
      try {
        await fetch(`/api/employees?tenantId=${currentUser?.tenantId || ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emp)
        });
        const addedAmt = months * pricingSettings.kafala;
        logActivity('update', `تسجيل قيد كفالة مستحقة بذمة ${emp.name} بعدد: ${months} أشهر بقيمة: ${addedAmt} ريال`);
        alert(`✓ تم تسجيل ${months} أشهر كفالة إضافية ممددة على ذمة العامل ${emp.name}.`);
      } catch (err) {
        console.error('API add kafala order error:', err);
      }
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    setLogs([]);
    try {
      await fetch(`/api/logs?tenantId=${currentUser?.tenantId || ''}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('API clear logs error:', err);
    }
  };

  // Reset data to blank states on DB
  const handleResetData = async () => {
    const tid = currentUser?.tenantId || '';
    try {
      await fetch(`/api/system/wipe?tenantId=${tid}`, {
        method: 'POST'
      });
      
      setEmployees([]);
      setPayments([]);
      
      const initialBrs = tid ? [] : INITIAL_BRANCHES;
      setBranches(initialBrs);
      await fetch(`/api/branches?tenantId=${tid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialBrs)
      });
      
      setLogs(INITIAL_LOGS);
      await fetch(`/api/logs?tenantId=${tid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(INITIAL_LOGS[0])
      });
      
      const defaultCompanyObj = { name: tid ? `لوحة حسابات ومساحة ${currentUser.name}` : 'برنامج إدارة العمالة المهنية' };
      const defaultPricingObj = { kafala: 250, iqama3: 3550, iqama6: 7100, iqama12: 14200, ramadanFree: true };
      setCompanySettings(defaultCompanyObj);
      setPricingSettings(defaultPricingObj);
      
      await fetch(`/api/company-settings?tenantId=${tid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultCompanyObj)
      });
      
      await fetch(`/api/pricing-settings?tenantId=${tid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultPricingObj)
      });
      
      toastNotice('تم تصفير وإعادة تعيين قاعدة البيانات بنجاح!');
    } catch (err) {
      console.error('API reset data error:', err);
    }
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
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    const emailLower = newUserEmail.trim().toLowerCase();
    if (emailLower === 'shady.nasif@gmail.com') {
      toastNotice('⚠️ خطأ أمني: لا يمكن تسجيل مستخدم بالبريد الإلكتروني الخاص بالمطور الرئيسي!');
      return;
    }
    
    const newUser: UserProfile = {
      uid: `u_${Date.now()}`,
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      branch: newUserRole === 'branch' ? newUserBranch || branches[0] : undefined,
      status: 'approved',
      tenantId: currentUser?.tenantId || 'main',
      createdAt: new Date().toISOString()
    };

    saveUsersList([...users, newUser]);
    setNewUserName('');
    setNewUserEmail('');
    
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      logActivity('update', `دعوة وتسجيل مستخدم برتبة صلاحية جديدة: ${newUserName} (${newUserRole})`);
      toastNotice('✓ تمت إضافة المستخدم لقائمة الصلاحيات وحفظه بقاعدة البيانات بنجاح.');
    } catch (err) {
      console.error('API save user error:', err);
      toastNotice('⚠️ خطأ في حفظ بيانات المستخدم الجديد بالسيرفر.');
    }
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
      loader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const updated = { ...companySettings, logoBase64: base64 };
        setCompanySettings(updated);
        try {
          await fetch(`/api/company-settings?tenantId=${currentUser?.tenantId || ''}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          });
          logActivity('update', 'تبديل وإدراج شعار رسمي جديد لهوية المؤسسة.');
          alert('✓ تم حفظ الشعار الجديد المرفق بنجاح.');
        } catch (err) {
          console.error('API save logo error:', err);
        }
      };
      loader.readAsDataURL(file);
    }
  };

  const handleClearCompanyLogo = async () => {
    const updated = { ...companySettings, logoBase64: undefined };
    setCompanySettings(updated);
    try {
      await fetch(`/api/company-settings?tenantId=${currentUser?.tenantId || ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      logActivity('update', 'إزالة الشعار الرسمي المثبت والرجوع للشارة الكلاسيكية.');
      alert('تم مسح الشعار المستورد بنجاح.');
    } catch (err) {
      console.error('API clear logo error:', err);
    }
  };

  const handleSaveCompanySettingsText = async () => {
    try {
      await fetch(`/api/company-settings?tenantId=${currentUser?.tenantId || ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companySettings)
      });
      logActivity('update', `تعديل إعدادات وهوية المؤسسة (المسمى: ${companySettings.name}، صلاحية الكشف للموظفين: ${companySettings.allowLedgerForUsers ? 'مسموح' : 'غير مسموح'}).`);
      alert('✓ تم حفظ إعدادات وهوية المؤسسة بنجاح.');
    } catch (err) {
      console.error('API save company name error:', err);
    }
  };

  const handleSavePricing = async () => {
    try {
      await fetch(`/api/pricing-settings?tenantId=${currentUser?.tenantId || ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricingSettings)
      });
      logActivity('update', 'إعادة ضبط قواعد تسعيرة رسوم الكفالة وتجديدات رخص الإقامة بمشاركة المحاسب.');
      alert('✓ تم حفظ قواعد الأسعار والرسوم بنجاح.');
    } catch (err) {
      console.error('API save pricing error:', err);
    }
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const isSubscriptionExpired = companySettings.expirationDate 
    ? (companySettings.expirationDate < todayStr) 
    : false;

  let subscriptionDaysRemaining: number | null = null;
  if (companySettings.expirationDate) {
    const diffTime = new Date(companySettings.expirationDate).getTime() - new Date(todayStr).getTime();
    subscriptionDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  const isSubscriptionNearExpiration = subscriptionDaysRemaining !== null && subscriptionDaysRemaining > 0 && subscriptionDaysRemaining <= 30;

  if (!currentUser) {
    return (
      <PortalAuthView 
        users={users}
        onLoginSuccess={handleLoginSuccess}
        onRegisterSubmit={handleRegisterSubmit}
        companyName={companySettings.name}
        logoBase64={companySettings.logoBase64}
        dbStatusInfo={dbStatusInfo}
        onRefreshDbStatus={fetchDbStatus}
      />
    );
  }

  // Suspended subscription check: developer is immune
  if (isSubscriptionExpired && currentUser.email !== 'shady.nasif@gmail.com') {
    return (
      <div className="min-h-screen bg-[#071329] flex flex-col justify-center items-center p-6 text-center text-white font-sans" id="subscription-suspended-screen">
        <div className="max-w-md bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10 shadow-2xl space-y-6 animate-fade-in">
          <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
            <span className="text-4xl">⚠️</span>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-white">عذراً، تم تعليق الخدمة لانتهاء الاشتراك!</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              انتهت فترة الترخيص والاشتراك السنوي لمساحة العمل الخاصة بكم بتاريخ:
              <span className="font-mono font-bold text-amber-400 block text-sm mt-1">{companySettings.expirationDate}</span>
            </p>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs font-bold leading-relaxed">
            تم تعليق الوصول لبيانات المساحة بشكل مؤقت. يرجى التواصل مع الإدارة أو مطور البرنامج لتجديد الاشتراك السنوي وتفعيل الخدمة دون فقدان أي من بياناتكم أو ملفاتكم.
          </div>

          {companySettings.supportPhone && (
            <div className="space-y-2">
              <span className="text-xs text-slate-400 block font-bold">هاتف التواصل المباشر مع المطور للتجديد:</span>
              <a 
                href={`tel:${companySettings.supportPhone}`} 
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md select-all"
              >
                <span>📞 {companySettings.supportPhone}</span>
              </a>
            </div>
          )}

          <div className="pt-2 border-t border-white/5">
            <button
              onClick={() => {
                localStorage.removeItem('portal_user');
                window.location.reload();
              }}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors underline cursor-pointer"
            >
              تسجيل الخروج أو تبديل الحساب
            </button>
          </div>
        </div>
        <div className="mt-8 text-[10px] text-slate-500">
          بوابة إدارة العمالة والتعاقدات • جميع البيانات محفوظة ومحمية تماماً
        </div>
      </div>
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
        onResetData={handleResetData}
        totalEmployeesCount={employees.filter(e => e.status === 'active').length}
        totalAlertsCount={getAlertTotalsCounts()}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onLogout={handleLogout}
        pendingUsersCount={users.filter(u => u.status === 'pending').length}
        allowLedgerForUsers={companySettings.allowLedgerForUsers}
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
              {activeTab === 'docker' && 'تبويب الدوكر ومعالج اتصال قاعدة البيانات'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {currentUser.email === 'shady.nasif@gmail.com' && (
              dbStatusInfo?.status === 'connected' ? (
                <span className="text-[10px] bg-emerald-50 text-emerald-850 px-2.5 py-1.5 rounded-xl border border-emerald-100/50 font-black flex items-center gap-1 select-none">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  قاعدة البيانات: متصلة ✅
                </span>
              ) : (
                <span className="text-[10px] bg-rose-50 text-rose-850 px-2.5 py-1.5 rounded-xl border border-rose-100/50 font-black flex items-center gap-1 select-none">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  قاعدة البيانات: منفصلة ❌ (ذاكرة مؤقتة)
                </span>
              )
            )}
            <span className="text-[10px] bg-sky-50 text-sky-850 px-2.5 py-1.5 rounded-xl border border-sky-100/50 font-black">
              رتبة التصفّح: {currentUser.role === 'admin' ? 'المدير العام 💻' : (currentUser.role === 'branch' ? `مشرف ${currentUser.branch}` : 'مُشاهد 👁️')}
            </span>
          </div>
        </header>

        {/* 3. Main Central App Area */}
        <main className="flex-grow p-4 md:p-6 lg:p-8 bg-[#f4f7fc]/50">

          {/* Subscription Warning Banner (Warns 30 days before expiration) */}
          {isSubscriptionNearExpiration && currentUser.email !== 'shady.nasif@gmail.com' && (
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200 rounded-2xl shadow-sm text-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 animate-pulse" id="subscription-warning-banner">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">⏳</span>
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-xs text-amber-900">تنبيه بقرب انتهاء ترخيص الخدمة للمنشأة!</h4>
                  <p className="text-[11px] text-amber-850 font-medium leading-relaxed">
                    متبقي على تاريخ انتهاء اشتراك مساحة العمل الخاصة بكم <span className="font-extrabold text-rose-700">{subscriptionDaysRemaining} يوم فقط</span> (ينتهي بتاريخ: <span className="font-mono font-bold text-slate-900">{companySettings.expirationDate}</span>). 
                    يرجى التنسيق والتواصل لتجديد الاشتراك السنوي تجنباً لأي تعليق مؤقت للخدمة.
                  </p>
                </div>
              </div>
              {companySettings.supportPhone && (
                <a 
                  href={`tel:${companySettings.supportPhone}`}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shrink-0 flex items-center gap-1.5"
                >
                  <span>📞 اتصل للتجديد:</span>
                  <span className="font-mono font-bold">{companySettings.supportPhone}</span>
                </a>
              )}
            </div>
          )}

          {/* Local Storage Migration Banner */}
          {hasLocalData && currentUser.role === 'admin' && (
            <div className="mb-6 p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl shadow-sm text-slate-800 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">📌</span>
                <div>
                  <h4 className="font-extrabold text-sm text-amber-900">تم الكشف عن بيانات محلية سابقة مخزنة في متصفحك الحالي!</h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    اكتشف النظام وجود ملفات عمالة وسجلات دفعات مالية قديمة مخزنة محلياً في ذاكرة التخزين المؤقت للمتصفح (LocalStorage). 
                    لضمان عدم ضياع هذه البيانات، يمكنك ترحيلها (رفعها) بضغطة واحدة لتخزينها بشكل دائم في قاعدة البيانات الجديدة على السيرفر.
                  </p>
                </div>
              </div>

              {migrationStatus === 'idle' && (
                <button
                  onClick={runMigration}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  بدء ترحيل ونقل كافة البيانات إلى السيرفر ⚡
                </button>
              )}

              {migrationStatus === 'migrating' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
                    جاري رفع وترحيل السجلات إلى السيرفر الآن... يرجى عدم إغلاق الصفحة.
                  </div>
                  <div className="max-h-28 overflow-y-auto bg-amber-950/5 p-3 rounded-lg border border-amber-950/10 font-mono text-[10px] text-amber-900 space-y-1" dir="ltr">
                    {migrationLog.map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                </div>
              )}

              {migrationStatus === 'success' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold">
                  ✅ تم ترحيل ونقل كافة البيانات بنجاح تام! يرجى إعادة تحميل الشاشة لتحديث الإحصائيات.
                </div>
              )}

              {migrationStatus === 'error' && (
                <div className="space-y-2">
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold">
                    ❌ فشل ترحيل البيانات. يرجى التحقق من اتصال قاعدة البيانات في لوحة الإعدادات والمحاولة لاحقاً.
                  </div>
                  <div className="max-h-24 overflow-y-auto bg-rose-950/5 p-2 rounded-lg border border-rose-950/10 font-mono text-[10px] text-rose-900 space-y-1" dir="ltr">
                    {migrationLog.map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
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
              {activeTab === 'approvals' && currentUser.email === 'shady.nasif@gmail.com' && (
                <PortalApprovalsView 
                  users={users}
                  onUpdateUserStatus={handleUpdateUserStatus}
                  onDeleteUser={handleDeleteUser}
                  onUpdateUserRole={handleUpdateUserRole}
                  branches={branches}
                />
              )}

              {/* Tab: System Developer Panel */}
              {activeTab === 'dev_panel' && currentUser.email === 'shady.nasif@gmail.com' && (
                <PortalDevPanelView
                  currentUser={currentUser}
                  users={users}
                  dbStatusInfo={dbStatusInfo}
                  onRefreshDbStatus={fetchDbStatus}
                  toastNotice={toastNotice}
                />
              )}

              {/* Tab: Subscriber Spaces Management */}
              {activeTab === 'spaces' && currentUser.email === 'shady.nasif@gmail.com' && (
                <PortalSpacesView
                  currentUser={currentUser}
                  users={users}
                  onUpdateUserStatus={handleUpdateUserStatus}
                  onDeleteUser={handleDeleteUser}
                  toastNotice={toastNotice}
                  onRefreshUsers={async () => {
                    const res = await fetch('/api/users');
                    if (res.ok) {
                      const data = await res.json();
                      setUsers(data);
                    }
                  }}
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

              {/* Tab: General Ledger Statement (Receipts and Expenses Ledger) */}
              {activeTab === 'general_ledger' && (currentUser.role === 'admin' || companySettings.allowLedgerForUsers) && (
                <GeneralLedgerView 
                  payments={payments}
                  currentUser={currentUser}
                  companyName={companySettings.name}
                  logoBase64={companySettings.logoBase64}
                />
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

                        <div className="pt-2 pb-2 border-t border-slate-100 flex items-center gap-2 select-none cursor-pointer">
                          <input 
                            type="checkbox"
                            id="allowLedgerForUsers"
                            checked={!!companySettings.allowLedgerForUsers}
                            onChange={(e) => setCompanySettings({ ...companySettings, allowLedgerForUsers: e.target.checked })}
                            className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                          />
                          <label htmlFor="allowLedgerForUsers" className="cursor-pointer text-slate-800 font-bold text-xs select-none">
                            السماح للمستخدمين (مسؤولي الفروع والمشاهدين) بالوصول لكشف الحساب العام للمنشأة
                          </label>
                        </div>

                        <button 
                          onClick={handleSaveCompanySettingsText}
                          className="btn btn-primary text-xs w-full py-2"
                        >
                          حفظ هوية وإعدادات المؤسسة
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
                            {users.filter(u => {
                              if (currentUser.email === 'shady.nasif@gmail.com') {
                                // مطور البرنامج يرى فقط مدراء المساحات (المدراء الرئيسيين) ولا يرى المساعدين أو المشرفين الفرعيين
                                return u.role === 'admin';
                              }
                              if (u.email === 'shady.nasif@gmail.com') return false;
                              return !currentUser.tenantId || u.tenantId === currentUser.tenantId;
                            }).map(u => (
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
              {activeTab === 'docker' && currentUser.email === 'shady.nasif@gmail.com' && (
                <div className="space-y-6">
                  {/* Database Status Diagnostics Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 block mb-1">اتصال السيرفر</h4>
                        <h3 className="font-black text-sm text-slate-800 font-sans">حالة الربط مع قاعدة البيانات (PostgreSQL)</h3>
                      </div>
                      {dbStatusInfo === null ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 text-xs rounded-xl font-black flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                          جاري الاتصال بالسيرفر... 🔄
                        </span>
                      ) : dbStatusInfo.status === 'connected' ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs rounded-xl font-black flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          نشط ومتصل ✅
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-rose-100 text-rose-850 border border-rose-200 text-xs rounded-xl font-black flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                          منفصل (يعمل محلياً) ❌
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                        <span className="text-slate-400 font-extrabold">عنوان السيرفر (Host)</span>
                        <p className="font-black text-slate-800 font-mono select-all">{dbStatusInfo ? dbStatusInfo.host : 'جاري التحميل...'}</p>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                        <span className="text-slate-400 font-extrabold">المنفذ (Port)</span>
                        <p className="font-black text-slate-800 font-mono select-all">{dbStatusInfo ? dbStatusInfo.port : 'جاري التحميل...'}</p>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                        <span className="text-slate-400 font-extrabold">مستخدم القاعدة</span>
                        <p className="font-black text-slate-800 font-mono select-all">{dbStatusInfo ? dbStatusInfo.user : 'جاري التحميل...'}</p>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                        <span className="text-slate-400 font-extrabold">اسم قاعدة البيانات</span>
                        <p className="font-black text-slate-800 font-mono select-all">{dbStatusInfo ? dbStatusInfo.database : 'جاري التحميل...'}</p>
                      </div>
                    </div>

                    {dbStatusInfo === null && (
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-amber-800 leading-relaxed flex items-center gap-2">
                        <span className="text-lg">🔄</span>
                        <span>جاري الاتصال بالسيرفر الخلفي (API) لقراءة معلومات الربط مع قاعدة البيانات... يرجى الانتظار بضع ثوانٍ.</span>
                      </div>
                    )}

                    {dbStatusInfo?.error && (
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-2">
                        <div className="flex items-center gap-1.5 font-bold text-rose-850 text-xs">
                          <span className="text-lg">⚠️</span>
                          تفاصيل خطأ الاتصال المرسل من السيرفر:
                        </div>
                        <p className="font-mono text-[11px] text-rose-800 bg-white/50 p-2.5 rounded border border-rose-100 leading-relaxed overflow-x-auto select-all" dir="ltr">
                          {dbStatusInfo.error}
                        </p>
                        <div className="text-[11px] text-rose-700/80 leading-relaxed">
                          💡 <strong>كيف تصلح هذا الخطأ؟</strong> تأكد من صحة البيانات التي أدخلتها في نافذة المتغيرات (Environment Variables) في لوحة التحكم الجانبية لـ AI Studio. تأكد من أن السيرفر المركزي يعمل، والمنفذ 5432 مفتوح للاتصالات الخارجية، وأن المستخدم لديه كامل الصلاحيات لإنشاء الجداول والاتصال عن بُعد.
                        </div>
                      </div>
                    )}

                    {dbStatusInfo?.status === 'connected' && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-800/90 leading-relaxed flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <span>المنظومة الآن مرتبطة بشكل كامل وآمن بسيرفر PostgreSQL المركزي. جميع الإجراءات، الموظفين، القيود المالية، والدفعات يتم ترحيلها وحفظها بشكل فوري ومستقر في قاعدة البيانات المركزية.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          </div>
        </main>
      </div>

    </div>
  );
}
