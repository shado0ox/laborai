import React, { useState, useEffect } from 'react';
import { 
  Database, RefreshCw, Activity, Terminal, ShieldAlert, CheckCircle, 
  AlertTriangle, Settings, HardDrive, Cpu, TerminalSquare, Layers, Users 
} from 'lucide-react';
import { UserProfile, ActivityLog } from '../types';

interface PortalDevPanelViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  dbStatusInfo: {
    status: 'connected' | 'disconnected';
    host: string;
    port: number;
    user: string;
    database: string;
    error: string | null;
  } | null;
  onRefreshDbStatus: () => Promise<void>;
  toastNotice: (msg: string) => void;
}

export default function PortalDevPanelView({
  currentUser,
  users,
  dbStatusInfo,
  onRefreshDbStatus,
  toastNotice
}: PortalDevPanelViewProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbDiagnosticResult, setDbDiagnosticResult] = useState<any>(null);

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = sessionStorage.getItem('authToken');
    const headers = {
      ...(options.headers || {}),
    } as Record<string, string>;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, {
      ...options,
      headers
    });
  };

  const fetchGlobalLogs = async () => {
    setIsRefreshing(true);
    try {
      const res = await authFetch('/api/logs'); // Fetches system logs
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error loading global system logs:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const runDbDiagnostics = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshDbStatus();
      const res = await authFetch('/api/db-status');
      if (res.ok) {
        const data = await res.json();
        setDbDiagnosticResult(data);
        toastNotice('✓ تم إنهاء فحص واختبار الاتصال بنجاح.');
      }
    } catch (err) {
      toastNotice('⚠️ فشل في إتمام تشخيص قاعدة البيانات.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRepairTables = async () => {
    if (confirm('⚠️ هل تريد إعادة تشغيل تهيئة وتحديث جداول قاعدة بيانات PostgreSQL؟')) {
      setIsRefreshing(true);
      try {
        const res = await authFetch('/api/admin/repair-db', { method: 'POST' });
        if (res.ok) {
          toastNotice('✓ تم تنشيط وفحص هيكلة الجداول بنجاح.');
        } else {
          toastNotice('❌ فشل في تهيئة الجداول بالسيرفر.');
        }
      } catch (err) {
        toastNotice('❌ خطأ غير متوقع أثناء الفحص.');
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchGlobalLogs();
  }, [users]);

  return (
    <div className="space-y-6" id="portal-dev-panel-view">
      
      {/* Upper system details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="bg-[#0f1d30] border border-slate-800 text-white p-5 rounded-2xl shadow-md flex items-center justify-between col-span-1 lg:col-span-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] text-emerald-450 uppercase font-extrabold tracking-widest">خادم البرنامج نشط</span>
            </div>
            <h3 className="text-sm font-black text-slate-100">بوابة الإشراف والمطور الرئيسي</h3>
            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
              مرحباً بك يا مهندس شادي. أنت تعمل حالياً على نظام التحليل الفوري لبيانات PostgreSQL المشتركة مع عزل كامل لكل مساحة مستقلة.
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 font-mono text-3xl select-none">
            💻
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block">مشتركي المساحات المعتمدين</span>
            <span className="text-2xl font-black text-[#002f56]">
              {users.filter(u => u.role === 'admin' && u.status === 'approved').length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#002f56]/10 text-[#002f56] flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block">حالة الاتصال بـ PostgreSQL</span>
            <span className={`text-xs font-black block mt-1 ${dbStatusInfo?.status === 'connected' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {dbStatusInfo?.status === 'connected' ? '● متصلة تماماً' : '● غير متصلة'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PostgreSQL Database Server Diagnostics and Maintenance */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black text-[#002f56]">تشخيص خادم PostgreSQL</h3>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 font-mono text-[11px] text-slate-700 space-y-1.5">
                <div><span className="text-slate-400 font-bold">Engine:</span> PostgreSQL Client (pg)</div>
                <div><span className="text-slate-400 font-bold">Host:</span> {dbStatusInfo?.host || '127.0.0.1'}</div>
                <div><span className="text-slate-400 font-bold">Port:</span> {dbStatusInfo?.port || 5432}</div>
                <div><span className="text-slate-400 font-bold">DB Name:</span> {dbStatusInfo?.database || 'labor_management_db'}</div>
                <div><span className="text-slate-400 font-bold">User:</span> {dbStatusInfo?.user || 'labor_admin'}</div>
              </div>

              {dbStatusInfo?.error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 font-bold text-[10px] leading-relaxed">
                  <div className="flex items-center gap-1 mb-1 text-rose-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>تفاصيل الخطأ المسجل:</span>
                  </div>
                  {dbStatusInfo.error}
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={runDbDiagnostics}
                  disabled={isRefreshing}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Activity className="w-4 h-4" />
                  <span>اختبار وفحص الاتصال بالخادم</span>
                </button>

                <button
                  onClick={handleRepairTables}
                  disabled={isRefreshing}
                  className="w-full py-2 bg-[#002f56] hover:bg-[#0c406b] text-white font-black rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>تهيئة وتثبيت جداول الـ Schema</span>
                </button>
              </div>
            </div>
          </div>

          {/* System Environment */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-[#002f56] border-b border-slate-100 pb-2">تفاصيل البيئة المحلية</h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-50 p-2 rounded-lg text-slate-600 font-semibold text-center">
                <div className="text-slate-450 font-medium">نظام التشغيل</div>
                <div className="font-bold text-slate-800 mt-0.5">Alpine Container</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg text-slate-600 font-semibold text-center">
                <div className="text-slate-450 font-medium">منفذ التشغيل</div>
                <div className="font-bold text-slate-800 mt-0.5">PORT 3000</div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Activity Logs Console */}
        <div className="lg:col-span-2 bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col h-[500px]">
          <div className="border-b border-slate-800 pb-3 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-2 text-amber-500">
              <Terminal className="w-5 h-5" />
              <h3 className="text-sm font-black text-slate-100">سجل الأحداث والمراقبة البرمجية الموحدة</h3>
            </div>
            <button
              onClick={fetchGlobalLogs}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-450 hover:text-white transition-colors cursor-pointer"
              title="تحديث فوري للسجلات"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto font-mono text-[10.5px] text-slate-300 space-y-1.5 pt-4 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {logs.length === 0 ? (
              <div className="text-center text-slate-600 font-bold py-12">
                ~ console empty: no logs recorded yet in PostgreSQL
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="border-b border-slate-900 pb-1.5 hover:bg-slate-900/40 px-1 rounded">
                  <span className="text-amber-500 font-semibold">[{log.time}]</span>{' '}
                  <span className={`px-1 rounded text-[9.5px] font-bold ${
                    log.type === 'login' ? 'bg-indigo-900/55 text-indigo-300' :
                    log.type === 'add' ? 'bg-emerald-900/55 text-emerald-300' :
                    log.type === 'pay' ? 'bg-yellow-900/55 text-yellow-300' :
                    log.type === 'del' ? 'bg-rose-900/55 text-rose-300' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {log.type.toUpperCase()}
                  </span>{' '}
                  <span className="text-slate-400 font-bold">({log.user})</span>:{' '}
                  <span className="text-white font-medium">{log.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}