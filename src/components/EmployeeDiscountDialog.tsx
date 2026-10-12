import React, { useEffect, useRef, useState } from 'react';
import { Employee } from '../types';

export default function EmployeeDiscountDialog({ employee, onClose, onSave }: {
  employee: Employee; onClose: () => void; onSave: (amount: number, notes: string) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  return <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center p-4" onKeyDown={event => { if (event.key === 'Escape' && !busy) onClose(); }}>
    <form role="dialog" aria-modal="true" aria-labelledby="discount-title" className="bg-white rounded-xl max-w-md w-full p-6 space-y-5 shadow-xl" aria-busy={busy} onSubmit={async event => {
      event.preventDefault(); setBusy(true);
      try { if (await onSave(Number(amount), notes.trim())) onClose(); }
      finally { setBusy(false); }
    }}>
      <div><h2 id="discount-title" className="text-lg font-bold text-slate-800">خصم بدون تحصيل</h2><p className="text-sm text-slate-600 mt-1">{employee.name} · {employee.iqamaNo}</p></div>
      <p className="text-sm leading-relaxed bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg">يقلّل هذا الخصم المبلغ المطلوب من العامل. يظهر في كشف حسابه ولا يُسجّل قبضًا في الخزينة أو كشف الوارد والصادر.</p>
      <div><label htmlFor="employee-discount-amount" className="block text-sm font-bold mb-2">مبلغ الخصم (ريال)</label><input ref={input} id="employee-discount-amount" name="discount-amount" type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-base" /></div>
      <div><label htmlFor="employee-discount-notes" className="block text-sm font-bold mb-2">سبب الخصم</label><textarea id="employee-discount-notes" name="discount-reason" required value={notes} onChange={event => setNotes(event.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-20" /></div>
      <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="border border-slate-300 rounded-lg px-4 py-2 text-sm">إلغاء</button><button type="submit" disabled={busy} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60">{busy ? 'جارٍ حفظ الخصم…' : 'حفظ الخصم'}</button></div>
    </form>
  </div>;
}
