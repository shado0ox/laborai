import React, { useEffect, useMemo, useState } from 'react';
import { ShopEntry, UserProfile } from '../types';
import { shopStatement } from '../utils/accounting';
import { exportCSV, financeFetch, money, printFinance } from '../utils/financeIO';

const KIND_LABELS = { charge: 'مصروف محمل على المسؤول', receipt: 'تحصيل من المسؤول', opening: 'رصيد افتتاحي مستحق', discount: 'خصم أو إعفاء' };
const CATEGORIES = ['زكاة', 'إيجار', 'رخص وتجديدات', 'كهرباء ومياه', 'صيانة', 'رسوم حكومية', 'أخرى'];

export default function ShopAccountsView({ branches, currentUser, companyName, logoBase64, onManageBranches }: { branches: string[]; currentUser: UserProfile; companyName: string; logoBase64?: string; onManageBranches: () => void }) {
  const [entries, setEntries] = useState<ShopEntry[]>([]);
  const [branch, setBranch] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<ShopEntry['kind']>('charge');
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [year, setYear] = useState(new Date().getFullYear()); const [category, setCategory] = useState('زكاة');
  const [description, setDescription] = useState(''); const [reference, setReference] = useState('');
  const [responsible, setResponsible] = useState(''); const [notes, setNotes] = useState('');
  const [paid, setPaid] = useState(false); const [account, setAccount] = useState<'cash' | 'bank'>('cash');
  const [saved, setSaved] = useState(''); const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const admin = currentUser.role === 'admin';
  const load = async () => {
    setLoading(true);
    try { setEntries(await financeFetch('/api/shop-entries')); setError(''); }
    catch (error: any) { setError(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [currentUser.tenantId]);
  useEffect(() => { if (!branches.includes(branch)) setBranch(branches[0] || ''); }, [branches]);
  const statement = useMemo(() => shopStatement(entries, branch, from, to), [entries, branch, from, to]);
  const reportHeaders = ['التاريخ', 'سنة المصروف', 'المرجع', 'الحركة', 'التصنيف', 'البيان', 'المسؤول', 'مدين: محمل', 'دائن: تحصيل/خصم', 'الرصيد المستحق'];
  const reportRows = statement.rows.map(entry => [entry.date, entry.year, entry.reference || `SHOP-${entry.id}`, KIND_LABELS[entry.kind], entry.category, entry.description, entry.responsible || '', money(entry.debit), money(entry.credit), money(entry.balance)]);
  const summary: [string, number][] = [['رصيد افتتاحي', statement.opening], ['مبالغ محملة', statement.charges], ['تحصيل نقدي', statement.receipts], ['خصومات وتسويات', statement.credits - statement.receipts], ['رصيد ختامي', statement.ending]];
  const startEntry = () => { setKind('charge'); setAmount(''); setDescription(''); setReference(''); setNotes(''); setPaid(false); setDraftId(crypto.randomUUID()); setFormOpen(true); setError(''); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await financeFetch('/api/shop-entries', { method: 'POST', body: JSON.stringify({ id: draftId, branch, date, year: Number(year), kind, amount: Number(amount), category, description, reference: reference.trim(), responsible, notes, paidByCompany: kind === 'charge' && paid, cashAccount: account }) });
      setEntries(previous => [...previous.filter(entry => entry.id !== data.entry.id), data.entry]); setFormOpen(false); setSaved('تم حفظ حركة المحل.');
    } catch (error: any) { setError(error.message); }
    finally { setBusy(false); }
  };
  const remove = async (entry: ShopEntry) => {
    if (!confirm(`حذف حركة ${KIND_LABELS[entry.kind]} بقيمة ${money(entry.amount)} ريال من فرع ${entry.branch}؟ سيؤثر ذلك في الرصيد وكشف النقدية.`)) return;
    try { await financeFetch(`/api/shop-entries/${encodeURIComponent(entry.id)}`, { method: 'DELETE' }); setEntries(previous => previous.filter(item => item.id !== entry.id)); setSaved('تم حذف الحركة.'); }
    catch (error: any) { setError(error.message); }
  };
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-800">حسابات المحلات والفروع</h2><p className="text-sm text-slate-600 mt-2">المصاريف السنوية المحملة على المسؤول، والتحصيل منها، ورصيد مستقل لكل فرع.</p></div><div className="flex gap-2">{admin && <button className="finance-button" onClick={onManageBranches}>إدارة الفروع</button>}<button className="finance-button" onClick={load}>تحديث الكشف</button></div></div>
    {error && <p role="alert" className="finance-error">{error}</p>}{saved && <p role="status" className="text-sm text-emerald-700">{saved}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">{branches.map(name => {
      const balance = shopStatement(entries, name).ending;
      return <button key={name} aria-pressed={branch === name} onClick={() => { setBranch(name); setFormOpen(false); setSaved(''); }} className={`accounting-panel text-right ${branch === name ? 'border-primary ring-1 ring-primary' : 'hover:border-slate-400'}`}><span className="block font-bold text-slate-800">{name}</span><span className="block mt-2 text-xl font-bold text-primary">{money(Math.abs(balance))} ريال</span><span className="text-xs text-slate-500">{balance >= 0 ? 'مستحق على مسؤول المحل' : 'رصيد دائن للمسؤول'}</span></button>;
    })}</div>
    {!branches.length && <p className="accounting-panel text-slate-600">أضف الفروع من إعدادات الشركة لبدء حسابات المحلات. لا يوجد حد ثابت لعدد الفروع.</p>}
    {branch && <>
      <div className="accounting-panel flex flex-wrap items-end gap-3"><label className="text-sm min-w-36">الفرع<select className="field" aria-label="فرع كشف المحل" value={branch} onChange={event => setBranch(event.target.value)}>{branches.map(name => <option key={name}>{name}</option>)}</select></label><label className="text-sm">من تاريخ<input className="field" type="date" aria-label="بداية كشف المحل" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label><label className="text-sm">إلى تاريخ<input className="field" type="date" aria-label="نهاية كشف المحل" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label><button className="finance-button" onClick={() => { setFrom(''); setTo(''); }}>كل السنوات</button>{admin && <button className="finance-button primary" onClick={startEntry}>إضافة حركة للمحل</button>}</div>
      {formOpen && <form onSubmit={save} className="accounting-panel space-y-4" aria-busy={busy}>
        <h3 className="font-bold text-lg">حركة جديدة لفرع {branch}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="text-sm">نوع الحركة<select className="field" aria-label="نوع حركة المحل" value={kind} onChange={event => { setKind(event.target.value as ShopEntry['kind']); setPaid(false); }}>{Object.entries(KIND_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm">تاريخ الحركة<input className="field" type="date" aria-label="تاريخ حركة المحل" required value={date} onChange={event => setDate(event.target.value)} /></label>
          <label className="text-sm">السنة المرتبطة بالمصروف<input className="field" type="number" min="1900" max="2200" aria-label="سنة مصروف المحل" required value={year} onChange={event => setYear(Number(event.target.value))} /></label>
          <label className="text-sm">المبلغ (ريال)<input className="field" type="number" min="0.01" step="0.01" aria-label="مبلغ حركة المحل" required value={amount} onChange={event => setAmount(event.target.value)} /></label>
          <label className="text-sm">التصنيف<select className="field" aria-label="تصنيف مصروف المحل" value={category} onChange={event => setCategory(event.target.value)}>{CATEGORIES.map(name => <option key={name}>{name}</option>)}</select></label>
          <label className="text-sm">مرجع الفاتورة أو السند<input className="field" aria-label="مرجع حركة المحل" value={reference} onChange={event => setReference(event.target.value)} placeholder="مثال: ZAKAT-2026-01" /></label>
          <label className="text-sm">مسؤول المحل<input className="field" aria-label="مسؤول المحل" value={responsible} onChange={event => setResponsible(event.target.value)} /></label>
          <label className="text-sm sm:col-span-2">البيان<input className="field" aria-label="بيان حركة المحل" required value={description} onChange={event => setDescription(event.target.value)} placeholder="مثال: زكاة المحل عن السنة" /></label>
        </div>
        {kind === 'charge' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={paid} onChange={event => setPaid(event.target.checked)} />دفعت الشركة المصروف فعليًا من الصندوق أو البنك</label>}
        {(kind === 'receipt' || paid) && <label className="block text-sm max-w-xs">حساب النقدية<select aria-label="حساب نقدية المحل" className="field" value={account} onChange={event => setAccount(event.target.value as 'cash'|'bank')}><option value="cash">الصندوق</option><option value="bank">البنك</option></select></label>}
        <p className="text-sm bg-slate-50 text-slate-600 p-3 rounded-lg">{kind === 'charge' ? paid ? 'يزيد المستحق على المسؤول ويظهر دفع الشركة مرة واحدة في الصادر النقدي.' : 'يزيد المستحق على المسؤول فقط. لا يسجل صرفًا نقديًا قبل دفع الشركة فعليًا.' : kind === 'receipt' ? 'يقل المستحق على المسؤول ويظهر التحصيل مرة واحدة في الوارد النقدي.' : 'يغيّر رصيد مسؤول المحل ولا يُسجل حركة نقدية.'}</p>
        <label className="block text-sm">ملاحظات<textarea aria-label="ملاحظات حركة المحل" className="field" value={notes} onChange={event => setNotes(event.target.value)} /></label>
        <div className="flex gap-3 justify-end"><button type="button" disabled={busy} className="finance-button" onClick={() => setFormOpen(false)}>إلغاء</button><button type="submit" disabled={busy} className="finance-button primary">{busy ? 'جارٍ حفظ حركة المحل…' : 'حفظ حركة المحل'}</button></div>
      </form>}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">{summary.map(([label,value]) => <div key={label} className="accounting-panel"><span className="text-xs text-slate-500">{label}</span><strong className="block text-lg text-slate-800 mt-2">{money(value)} ريال</strong></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">كشف مسؤول المحل: {branch}</h3><div className="flex gap-2"><button className="finance-button" onClick={() => exportCSV(`shop-statement-${new Date().toISOString().slice(0,10)}.csv`, reportHeaders, reportRows)}>تصدير Excel CSV</button><button className="finance-button" onClick={() => printFinance(`كشف مسؤول محل ${branch}`, companyName, `الفترة: ${from || 'البداية'} إلى ${to || 'آخر حركة'}`, reportHeaders, reportRows, summary, logoBase64)}>طباعة كشف المحل</button></div></div>
      <div className="overflow-x-auto"><table className="accounting-table"><thead><tr>{['التاريخ','سنة المصروف','المرجع','الحركة','البيان','محمل على المسؤول','تحصيل / خصم','الرصيد المستحق', ...(admin ? ['إجراء'] : [])].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody><tr className="bg-slate-50"><td colSpan={7}>رصيد افتتاحي قبل بداية الفترة</td><td>{money(statement.opening)}</td>{admin && <td />}</tr>{statement.rows.map(entry => <tr key={entry.id}><td>{entry.date}</td><td>{entry.year}</td><td title={entry.id}>{entry.reference || entry.id.slice(0,8)}</td><td>{KIND_LABELS[entry.kind]}</td><td className="description"><strong>{entry.category}</strong><p>{entry.description}</p>{entry.responsible && <small>{entry.responsible}</small>}</td><td className="text-rose-700">{entry.debit ? money(entry.debit) : '—'}</td><td className="text-emerald-700">{entry.credit ? money(entry.credit) : '—'}</td><td>{money(entry.balance)}</td>{admin && <td><button aria-label={`حذف حركة ${entry.description}`} className="text-red-700" onClick={() => remove(entry)}>حذف</button></td>}</tr>)}</tbody></table></div>
      {!statement.rows.length && <p className="text-sm text-slate-500 p-5">{loading ? 'جارٍ تحميل حسابات المحلات…' : 'لا توجد حركات في هذه الفترة. يمكن إضافة المصروف السنوي ثم تسجيل التحصيل عند استلامه.'}</p>}
    </>}
  </section>;
}
