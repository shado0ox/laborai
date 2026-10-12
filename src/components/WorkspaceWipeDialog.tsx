import React, { useState } from 'react';
const PHRASE = 'مسح بيانات مساحة العمل';
export default function WorkspaceWipeDialog({ companyName, onClose, onConfirm }: { companyName: string; onClose: () => void; onConfirm: (body: { password: string; confirmation: string; backupConfirmed: boolean }) => Promise<void> }) {
  const [password,setPassword] = useState(''), [confirmation,setConfirmation] = useState('');
  const [backup,setBackup] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  return <div className="fixed inset-0 z-[100] bg-slate-950/60 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="wipe-title" className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onKeyDown={event => { if(event.key==='Escape' && !busy) onClose(); }}>
    <h2 id="wipe-title" className="text-lg font-bold text-red-800">مسح بيانات مساحة العمل</h2><p className="mt-3 text-sm">المساحة: <strong>{companyName}</strong>. سيحذف هذا الإجراء العمالة النشطة والمؤرشفة، والدفعات، والقيود، وحسابات المحلات والفروع. لا يمكن التراجع عنه من التطبيق. تبقى حسابات المستخدمين وإعدادات الشركة.</p>
    <form className="space-y-4 mt-4" onSubmit={async event => { event.preventDefault(); if(busy || !backup || confirmation!==PHRASE || !password) return; setBusy(true); setError(''); try { await onConfirm({ password, confirmation, backupConfirmed:backup }); } catch(error:any) { setError(error.message); } finally { setBusy(false); } }}>
      <label className="block text-sm">كلمة مرور حسابك الحالي<input autoFocus autoComplete="current-password" aria-label="كلمة المرور لتأكيد المسح" type="password" className="field" required value={password} disabled={busy} onChange={e=>setPassword(e.target.value)} /></label>
      <label className="block text-sm">اكتب: {PHRASE}<input aria-label="عبارة تأكيد مسح مساحة العمل" className="field" autoComplete="off" value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)} /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={backup} disabled={busy} onChange={e=>setBackup(e.target.checked)} />لدي نسخة احتياطية محفوظة ويمكنني استعادتها، وأفهم أن البيانات ستُحذف.</label>
      {error && <p role="alert" className="finance-error">{error}</p>}
      <div className="flex gap-3 justify-end"><button type="button" className="finance-button" disabled={busy} onClick={onClose}>إلغاء المسح</button><button className="finance-button bg-red-700 text-white" disabled={busy || !password || !backup || confirmation!==PHRASE}>{busy ? 'جارٍ مسح مساحة العمل…' : 'مسح البيانات نهائيًا'}</button></div>
    </form>
  </section></div>;
}
