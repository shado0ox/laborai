export interface Employee {
  iqamaNo: string;
  name: string;
  employeeId?: string; // رقم تعريف الموظف
  iqamaExpiry: string; // YYYY-MM-DD
  mobile: string;
  branch: string;
  iqamaBalance: number; // initial iqama debt
  kafalaCount: number; // initial kafala months
  otherDebt: number; // other debts
  otherDebtDesc?: string;
  notes: string;
  status: 'active' | 'archived';
  archiveReason?: string;
  archiveDate?: string;
  addedDate?: string;
  kafalaStartMonth?: string;
  kafalaStartYear?: string;
}

export interface Payment {
  id: string;
  iqamaNo: string;
  name: string;
  branch: string;
  amount: number;
  type: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  hijriMonth?: string; // 1-12 or Arabic name
  hijriYear?: string;
}

export interface IqamaRenewal {
  id: string;
  iqamaNo: string;
  name: string;
  branch: string;
  renewMonths: number;
  renewCost: number;
  newExpiry: string;
  notes?: string;
  renewDate: string; // YYYY-MM-DD
}

export interface KafalaOrder {
  id: string;
  iqamaNo: string;
  name: string;
  branch: string;
  fromMonth?: string;
  fromYear?: string;
  months: number;
  amount: number;
  notes?: string;
  orderDate: string;
}

export interface PricingSettings {
  kafala: number;
  iqama3: number;
  iqama6: number;
  iqama12: number;
  ramadanFree: boolean;
}

export interface CompanySettings {
  name: string;
  logoBase64?: string;
  allowLedgerForUsers?: boolean;
  activationDate?: string;
  expirationDate?: string;
  supportPhone?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'branch' | 'viewer';
  branch?: string;
  createdAt: string;
  password?: string; // لتمكين تسجيل الدخول بالتطبيق
  status?: 'pending' | 'approved' | 'rejected'; // حالة تفعيل المشرف أو المنشأة
  tenantId?: string; // للمساحة الخاصة المعزولة
}

export interface ActivityLog {
  id: string;
  type: 'login' | 'add' | 'pay' | 'arc' | 'del' | 'restore' | 'update';
  text: string;
  user: string;
  time: string;
}

export interface GeneralLedgerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  bayan: string;
  debit: number; // صادر (مصاريف / مدين)
  credit: number; // وارد (مقبوضات / دائن)
  createdAt?: string;
  tenantId?: string;
}

