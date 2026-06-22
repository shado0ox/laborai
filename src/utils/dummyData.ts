import { Employee, Payment, UserProfile, ActivityLog } from '../types';

export const INITIAL_BRANCHES = [
  'فرع الرياض الأساسي',
  'فرع جدة الغربية',
  'فرع الدمام الشرقية',
  'فرع مكة المكرمة'
];

export const INITIAL_USERS: UserProfile[] = [
  {
    uid: 'user-admin',
    name: 'شادي ناصف',
    email: 'shady.nasif@gmail.com',
    role: 'admin',
    createdAt: '2026-01-01T08:00:00.000Z',
    password: 'admin',
    status: 'approved'
  },
  {
    uid: 'user-jeddah',
    name: 'أحمد الغامدي',
    email: 'jeddah.branch@company.com',
    role: 'branch',
    branch: 'فرع جدة الغربية',
    createdAt: '2026-02-15T09:30:00.000Z',
    password: '123',
    status: 'approved'
  },
  {
    uid: 'user-viewer',
    name: 'سلطان المقرن',
    email: 'viewer@company.com',
    role: 'viewer',
    createdAt: '2026-03-10T11:00:00.000Z',
    password: '123',
    status: 'approved'
  }
];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_PAYMENTS: Payment[] = [];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'log-initial',
    type: 'update',
    text: 'تم تهيئة النظام وبدء قاعدة بيانات عمالة جديدة فارغة.',
    user: 'النظام',
    time: '2026-06-21 00:00:00'
  }
];
