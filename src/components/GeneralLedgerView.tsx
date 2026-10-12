import React, { useEffect, useMemo, useState } from 'react';
import { Payment, UserProfile, GeneralLedgerEntry, ShopEntry } from '../types';
import { cashTransactions, journalLines, CashTransaction } from '../utils/accounting';
import { exportCSV, financeFetch, money, printFinance } from '../utils/financeIO';

interface Props { payments: Payment[]; currentUser: UserProfile; companyName: string; logoBase64?: string; branches: string[] }
const RECEIPT_ACCOUNTS = ['إيرادات أخرى', 'ذمم العمالة', 'ذمم مسؤولي المحلات', 'رأس المال', 'أرصدة افتتاحية', 'حسابات أخرى'];
const PAYMENT_ACCOUNTS = ['مصروفات عامة', 'الإيجار', 'الصيانة', 'الرسوم الحكومية', 'الزكاة', 'ذمم الموردين', 'ذمم مسؤولي المحلات', 'حسابات أخرى'];

export default function GeneralLedgerView({ payments, currentUser, companyName, logoBase64, branches }: Props) {
  const today = new Date().toISOString().slice(0,10);
  const [manual, setManual] = useState<GeneralLedgerEntry[]>([]); const [shops, setShops] = useState<ShopEntry[]>([]);
  const [from, setFrom] = useState(today.slice(0,7) + '-01'); const [to, setTo] = useState(today);
  const [branch, setBranch] = useState(currentUser.role === 'branch' ? currentUser.branch || '' : '');
  const [account, setAccount] = useState(''); const [source, setSource] = useState(''); const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'cashbook' | 'journal'>('cashbook');
  const [error, setError] = useState(''); const [saved, setSaved] = useState(''); const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [formType, setFormType] = useState<'receipt'|'payment'>('receipt'); const [formDate, setFormDate] = useState(today);
  const [formAccount, setFormAccount] = useState<'cash'|'bank'>('cash'); const [formBranch, setFormBranch] = useState('');
  const [formAmount, setFormAmount] = useState(''); const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('وارد آخر'); const [formReference, setFormReference] = useState('');
  const [counterpart, setCounterpart] = useState('إيرادات أخرى'); const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const admin = currentUser.role === 'admin';
  const load = async () => {
    setLoading(true);
    try {
      const [ledger, shopEntries] = await Promise.all([financeFetch('/api/general-ledger'), financeFetch('/api/shop-entries')]);
      setManual(ledger); setShops(shopEntries); setError('');
    } catch (error: any) { setError(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [currentUser.tenantId]);
  const all = useMemo(() => cashTransactions(payments, manual, shops), [payments, manual, shops]);
  const base = all.filter(transaction => (!branch || transaction.branch === branch) && (!account || transaction.account === account) && (!source || transaction.source === source) && (!search || `${transaction.reference} ${transaction.description} ${transaction.category}`.toLowerCase().includes(search.toLowerCase())));
  const opening = base.filter(transaction => from && transaction.date < from).reduce((total, transaction) => total + transaction.receipt - transaction.payment, 0);
  let balance = opening;
  const rows = base.filter(transaction => (!from || transaction.date >= from) && (!to || transaction.date <= to)).map(transaction => { balance += transaction.receipt - transaction.payment; return { ...transaction, balance }; });
  const totalReceived = rows.reduce((sum, transaction) => sum + transaction.receipt, 0), totalPaid = rows.reduce((sum, transaction) => sum + transaction.payment, 0);
  const summaries: [string,number][] = [['رصيد افتتاحي', opening], ['مقبوضات الفترة', totalReceived], ['مدفوعات الفترة', totalPaid], ['صافي الحركة', totalReceived-totalPaid], ['رصيد ختامي', balance]];
  const journal = rows.flatMap(transaction => journalLines(transaction).map(line => ({ ...line, transaction })));
  const journalDebit = journal.reduce((sum,line) => sum + line.debit,0), journalCredit = journal.reduce((sum,line) => sum + line.credit,0);
  const cashHeaders = ['التاريخ','المرجع','الفرع','الحساب النقدي','البيان','الحساب المقابل','قبض (مدين النقدية)','صرف (دائن النقدية)','الرصيد'];
  const accountLabel = (value: string) => value === 'bank' ? 'البنك' : value === 'cash' ? 'الصندوق' : 'نقدية غير مصنفة';
  const cashRows = rows.map(transaction => [transaction.date, transaction.reference, transaction.branch || 'غير محدد', accountLabel(transaction.account), transaction.description, transaction.counterpart, money(transaction.receipt), money(transaction.payment), money(transaction.balance)]);
  const reportHeaders = mode === 'journal' ? ['التاريخ','المرجع','الفرع','البيان','الحساب','مدين','دائن'] : cashHeaders;
  const reportRows = mode === 'journal' ? journal.map(line => [line.transaction.date, line.transaction.reference, line.transaction.branch || 'غير محدد', line.transaction.description, line.account, money(line.debit), money(line.credit)]) : cashRows;
  const reportSummary: [string,number][] = mode === 'journal' ? [['إجمالي المدين', journalDebit], ['إجمالي الدائن', journalCredit], ['فرق القيد', journalDebit-journalCredit]] : summaries;
  const subtitle = `الفترة ${from || 'البداية'} إلى ${to || 'آخر حركة'} | الفرع ${branch || 'كل الفروع'} | الحساب ${account ? accountLabel(account) : 'الكل'}${search ? ` | البحث: ${search}` : ''}`;
  const newEntry = () => { setDraftId(crypto.randomUUID()); setFormAmount(''); setFormDescription(''); setFormReference(''); setFormOpen(true); setSaved(''); setError(''); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    const entry: GeneralLedgerEntry = { id: draftId, date: formDate, bayan: formDescription, debit: formType === 'payment' ? Number(formAmount) : 0, credit: formType === 'receipt' ? Number(formAmount) : 0, branch: formBranch, category: formCategory, reference: formReference.trim() || `GL-${draftId}`, cashAccount: formAccount, counterpartAccount: counterpart };
    try { const data = await financeFetch('/api/general-ledger', { method: 'POST', body: JSON.stringify(entry) }); setManual(previous => [...previous.filter(item => item.id !== entry.id), data.entry || entry]); setFormOpen(false); setSaved('تم حفظ سند النقدية.'); }
    catch (error: any) { setError(error.message); }
    finally { setBusy(false); }
  };
  const remove = async (transaction: CashTransaction) => {
    if (!confirm(`حذف السند ${transaction.reference} بقيمة ${money(transaction.receipt || transaction.payment)} ريال؟`)) return;
    try { await financeFetch(`/api/general-ledger/${encodeURIComponent(transaction.recordId)}`, { method: 'DELETE' }); setManual(previous => previous.filter(entry => entry.id !== transaction.recordId)); setSaved('تم حذف سند النقدية.'); }
    catch (error: any) { setError(error.message); }
  };
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-800">دفتر الصندوق والبنك</h2><p className="text-sm text-slate-600 mt-2">رصيد افتتاحي، مقبوضات ومدفوعات، وحساب مقابل لكل حركة.</p></div><div className="flex gap-2"><button className="finance-button" onClick={load}>تحديث دفتر النقدية</button>{admin && <button className="finance-button primary" onClick={newEntry}>إضافة سند قبض أو صرف</button>}</div></div>
    <p className="text-sm text-slate-600 leading-relaxed border-r-4 border-primary bg-slate-50 p-3">تظهر التحصيلات النقدية فقط. خصومات العمالة ومصاريف المحلات التي لم تدفعها الشركة تبقى في كشوف الذمم. عرض القيد المقابل هنا يشرح الحركة النقدية ولا يشمل دفتر الأستاذ لجميع الحسابات.</p>
    {error && <p className="finance-error" role="alert">{error}</p>}{saved && <p role="status" className="text-emerald-700 text-sm">{saved}</p>}
    <div className="accounting-panel grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <label className="text-sm">من تاريخ<input aria-label="بداية دفتر النقدية" className="field" type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label>
      <label className="text-sm">إلى تاريخ<input aria-label="نهاية دفتر النقدية" className="field" type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
      <label className="text-sm">الفرع<select aria-label="فرع دفتر النقدية" className="field" value={branch} onChange={event => setBranch(event.target.value)}><option value="">كل الفروع</option>{branches.map(name => <option key={name}>{name}</option>)}</select></label>
      <label className="text-sm">حساب النقدية<select aria-label="حساب دفتر النقدية" className="field" value={account} onChange={event => setAccount(event.target.value)}><option value="">كل الحسابات</option><option value="cash">الصندوق</option><option value="bank">البنك</option><option value="unassigned">قيود قديمة غير مصنفة</option></select></label>
      <label className="text-sm">المصدر<select aria-label="مصدر حركة النقدية" className="field" value={source} onChange={event => setSource(event.target.value)}><option value="">كل المصادر</option><option value="employee">تحصيلات العمالة</option><option value="shop">حسابات المحلات</option><option value="manual">السندات اليدوية</option></select></label>
      <label className="text-sm sm:col-span-2">بحث بالمرجع أو البيان<input aria-label="البحث في دفتر النقدية" className="field" type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <button className="finance-button self-end" onClick={() => { setFrom(''); setTo(''); setSearch(''); }}>كل الفترات</button>
    </div>
    {formOpen && <form onSubmit={save} className="accounting-panel space-y-4" aria-busy={busy}>
      <h3 className="font-bold text-lg">سند نقدية جديد</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="text-sm">نوع السند<select className="field" aria-label="نوع سند النقدية" value={formType} onChange={event => { const value = event.target.value as 'receipt'|'payment'; setFormType(value); setCounterpart(value === 'receipt' ? 'إيرادات أخرى' : 'مصروفات عامة'); setFormCategory(value === 'receipt' ? 'وارد آخر' : 'مصروفات عامة'); }}><option value="receipt">سند قبض</option><option value="payment">سند صرف</option></select></label>
        <label className="text-sm">التاريخ<input aria-label="تاريخ سند النقدية" className="field" type="date" required value={formDate} onChange={event => setFormDate(event.target.value)} /></label>
        <label className="text-sm">المبلغ<input aria-label="مبلغ سند النقدية" className="field" type="number" min="0.01" step="0.01" required value={formAmount} onChange={event => setFormAmount(event.target.value)} /></label>
        <label className="text-sm">الحساب النقدي<select aria-label="حساب سند النقدية" className="field" value={formAccount} onChange={event => setFormAccount(event.target.value as 'cash'|'bank')}><option value="cash">الصندوق</option><option value="bank">البنك</option></select></label>
        <label className="text-sm">الحساب المقابل<select aria-label="الحساب المقابل" className="field" value={counterpart} onChange={event => setCounterpart(event.target.value)}>{(formType === 'receipt' ? RECEIPT_ACCOUNTS : PAYMENT_ACCOUNTS).map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="text-sm">الفرع<select aria-label="فرع سند النقدية" className="field" value={formBranch} onChange={event => setFormBranch(event.target.value)}><option value="">عام غير مرتبط بفرع</option>{branches.map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="text-sm">التصنيف<input aria-label="تصنيف سند النقدية" className="field" required value={formCategory} onChange={event => setFormCategory(event.target.value)} /></label>
        <label className="text-sm">مرجع المستند<input aria-label="مرجع سند النقدية" className="field" value={formReference} onChange={event => setFormReference(event.target.value)} placeholder="يولد مرجع تلقائيًا عند تركه فارغًا" /></label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">البيان<input aria-label="بيان سند النقدية" className="field" required value={formDescription} onChange={event => setFormDescription(event.target.value)} /></label>
      </div>
      <p className="text-sm text-slate-600">{formType === 'receipt' ? `مدين: ${formAccount === 'bank' ? 'البنك' : 'الصندوق'} · دائن: ${counterpart}` : `مدين: ${counterpart} · دائن: ${formAccount === 'bank' ? 'البنك' : 'الصندوق'}`}</p>
      <div className="flex justify-end gap-3"><button className="finance-button" type="button" disabled={busy} onClick={() => setFormOpen(false)}>إلغاء</button><button className="finance-button primary" type="submit" disabled={busy}>{busy ? 'جارٍ حفظ السند…' : 'حفظ سند النقدية'}</button></div>
    </form>}
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">{summaries.map(([label,value]) => <div key={label} className="accounting-panel"><span className="text-xs text-slate-500">{label}</span><strong className="block text-lg mt-2">{money(value)} ريال</strong></div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button aria-pressed={mode === 'cashbook'} className={`finance-button ${mode === 'cashbook' ? 'primary' : ''}`} onClick={() => setMode('cashbook')}>كشف النقدية</button><button aria-pressed={mode === 'journal'} className={`finance-button ${mode === 'journal' ? 'primary' : ''}`} onClick={() => setMode('journal')}>القيود المقابلة</button></div><div className="flex gap-2"><button className="finance-button" onClick={() => exportCSV(`cashbook-${today}.csv`, reportHeaders, reportRows)}>تصدير Excel CSV</button><button className="finance-button" onClick={() => printFinance(mode === 'journal' ? 'القيود المقابلة للنقدية' : 'دفتر الصندوق والبنك', companyName, subtitle, reportHeaders, reportRows, reportSummary, logoBase64)}>طباعة دفتر النقدية</button></div></div>
    {mode === 'cashbook' ? <div className="overflow-x-auto"><table className="accounting-table"><thead><tr>{['التاريخ','المرجع','الفرع','الحساب','البيان','قبض: مدين النقدية','صرف: دائن النقدية','الرصيد', ...(admin ? ['إجراء'] : [])].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody><tr className="bg-slate-50"><td colSpan={7}>رصيد افتتاحي قبل بداية الفترة</td><td>{money(opening)}</td>{admin && <td />}</tr>{rows.map(transaction => <tr key={transaction.id}><td>{transaction.date}</td><td title={transaction.reference}>{transaction.reference.length > 23 ? transaction.reference.slice(0,23) + '…' : transaction.reference}</td><td>{transaction.branch || 'غير محدد'}</td><td>{accountLabel(transaction.account)}</td><td className="description"><p>{transaction.description}</p><small className="text-slate-500">{transaction.category} · {transaction.counterpart}</small></td><td className="text-emerald-700">{transaction.receipt ? money(transaction.receipt) : '—'}</td><td className="text-rose-700">{transaction.payment ? money(transaction.payment) : '—'}</td><td className="font-bold">{money(transaction.balance)}</td>{admin && <td>{transaction.source === 'manual' ? <button className="text-red-700" onClick={() => remove(transaction)}>حذف السند</button> : <span className="text-xs text-slate-500">{transaction.source === 'employee' ? 'من كشف العامل' : 'من حساب المحل'}</span>}</td>}</tr>)}</tbody></table></div> : <div className="space-y-3"><div className="overflow-x-auto"><table className="accounting-table"><thead><tr>{['التاريخ','المرجع','البيان','الحساب','مدين','دائن'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{journal.map((line,index) => <tr key={`${line.transaction.id}:${index}`}><td>{line.transaction.date}</td><td title={line.transaction.reference}>{line.transaction.reference.slice(0,23)}</td><td className="description">{line.transaction.description}</td><td>{line.account}</td><td>{line.debit ? money(line.debit) : '—'}</td><td>{line.credit ? money(line.credit) : '—'}</td></tr>)}</tbody><tfoot><tr><td colSpan={4}>إجمالي القيود المقابلة</td><td>{money(journalDebit)}</td><td>{money(journalCredit)}</td></tr></tfoot></table></div><p role="status" className="text-sm text-emerald-700">فرق المدين والدائن: {money(journalDebit-journalCredit)} ريال</p></div>}
    {!rows.length && <p className="text-sm text-slate-500 p-5">{loading ? 'جارٍ تحميل الحركات النقدية…' : 'لا توجد حركات مطابقة للفترة والفلاتر.'}</p>}
  </section>;
}
