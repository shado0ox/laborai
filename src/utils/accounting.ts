import type { Employee, Payment, PricingSettings, GeneralLedgerEntry, ShopEntry } from '../types';
import { HIJRI_MONTH_NAMES } from './hijri';
import { isCashReceipt, isDebt, isEmployeeCredit } from './paymentKind';

export interface HijriPeriod {
  fromMonth: number; fromYear: number; toMonth: number; toYear: number;
  freeFromMonth?: number; freeFromYear?: number; freeToMonth?: number; freeToYear?: number;
}
export function hijriMonthNumber(month: string | number | undefined): number {
  const numeric = Number(month);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 12 ? numeric : HIJRI_MONTH_NAMES.indexOf(String(month)) + 1;
}
export function hijriPeriodMonths(fromMonth: number, fromYear: number, toMonth: number, toYear: number): number {
  if (![fromMonth, fromYear, toMonth, toYear].every(Number.isInteger) || fromMonth < 1 || fromMonth > 12 || toMonth < 1 || toMonth > 12 || fromYear < 1300 || toYear > 1700) return 0;
  return Math.max(0, (toYear - fromYear) * 12 + toMonth - fromMonth + 1);
}
export function validHijriPeriod(period: HijriPeriod): boolean {
  if (hijriPeriodMonths(period.fromMonth, period.fromYear, period.toMonth, period.toYear) < 1) return false;
  const free = [period.freeFromMonth, period.freeFromYear, period.freeToMonth, period.freeToYear];
  if (free.every(value => value === undefined)) return true;
  if (free.some(value => value === undefined)) return false;
  const start = period.fromYear * 12 + period.fromMonth, end = period.toYear * 12 + period.toMonth;
  return hijriPeriodMonths(period.freeFromMonth!, period.freeFromYear!, period.freeToMonth!, period.freeToYear!) > 0 &&
    period.freeFromYear! * 12 + period.freeFromMonth! >= start && period.freeToYear! * 12 + period.freeToMonth! <= end;
}
export function payableHijriMonths(period: HijriPeriod): number {
  if (!validHijriPeriod(period)) return 0;
  const all = hijriPeriodMonths(period.fromMonth, period.fromYear, period.toMonth, period.toYear);
  const free = period.freeFromMonth ? hijriPeriodMonths(period.freeFromMonth, period.freeFromYear!, period.freeToMonth!, period.freeToYear!) : 0;
  return all - free;
}
export function formatHijriPeriod(period: HijriPeriod): string {
  return `${HIJRI_MONTH_NAMES[period.fromMonth - 1]} ${period.fromYear} إلى ${HIJRI_MONTH_NAMES[period.toMonth - 1]} ${period.toYear}`;
}
export function employeeDues(employee: Employee, pricing: PricingSettings, payments: Payment[]): number {
  const opening = (employee.iqamaBalance || 0) + (employee.kafalaCount || 0) * pricing.kafala + (employee.otherDebt || 0);
  const additional = payments.filter(payment => payment.iqamaNo === employee.iqamaNo && isDebt(payment) && payment.balanceIncluded === false).reduce((total, payment) => total + payment.amount, 0);
  return opening + additional;
}
export function employeeCredits(employee: Employee, payments: Payment[]): number {
  return payments.filter(payment => payment.iqamaNo === employee.iqamaNo && isEmployeeCredit(payment)).reduce((total, payment) => total + payment.amount, 0);
}
export function lastPaidKafala(payments: Payment[]): string {
  const paid = payments.filter(payment => isCashReceipt(payment) && (payment.category === 'kafala' || payment.type?.includes('كفالة')));
  const periods = paid.map(payment => ({ payment, month: payment.kafalaPeriod?.toMonth || hijriMonthNumber(payment.hijriMonth), year: payment.kafalaPeriod?.toYear || Number(payment.hijriYear) })).filter(item => item.month >= 1 && item.month <= 12 && item.year >= 1300 && item.year <= 1700).sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month));
  if (periods.length) return `${HIJRI_MONTH_NAMES[periods[0].month - 1]} ${periods[0].year}`;
  return paid.sort((a, b) => b.date.localeCompare(a.date))[0]?.date || 'لم يُسجل سداد';
}

export interface CashTransaction {
  id: string; reference: string; date: string; branch: string; description: string; category: string;
  account: 'cash' | 'bank' | 'unassigned'; counterpart: string; receipt: number; payment: number;
  source: 'employee' | 'manual' | 'shop'; recordId: string;
}
export function cashTransactions(payments: Payment[], manual: GeneralLedgerEntry[], shops: ShopEntry[]): CashTransaction[] {
  const result: CashTransaction[] = [];
  for (const item of payments.filter(isCashReceipt)) result.push({ id: `employee:${item.id}`, recordId: item.id, reference: `EMP-${item.id}`, date: item.date, branch: item.branch, description: `تحصيل من العامل ${item.name}: ${item.type}`, category: 'تحصيل العمالة', account: item.cashAccount || 'unassigned', counterpart: 'ذمم العمالة', receipt: item.amount, payment: 0, source: 'employee' });
  for (const item of manual.filter(entry => entry.cashEffect !== 'noncash')) result.push({ id: `manual:${item.id}`, recordId: item.id, reference: item.reference || `GL-${item.id}`, date: item.date, branch: item.branch || '', description: item.bayan, category: item.category || (item.credit > 0 ? 'وارد آخر' : 'مصروفات عامة'), account: item.cashAccount || 'unassigned', counterpart: item.counterpartAccount || (item.credit > 0 ? 'إيرادات أخرى' : 'مصروفات عامة'), receipt: item.credit, payment: item.debit, source: 'manual' });
  for (const item of shops) {
    if (item.kind !== 'receipt' && !(item.kind === 'charge' && item.paidByCompany)) continue;
    result.push({ id: `shop:${item.id}`, recordId: item.id, reference: item.reference || `SHOP-${item.id}`, date: item.date, branch: item.branch, description: `${item.kind === 'receipt' ? 'تحصيل من مسؤول المحل' : 'دفع مصروف عن المحل'} ${item.branch}: ${item.description}`, category: item.category, account: item.cashAccount, counterpart: 'ذمم مسؤولي المحلات', receipt: item.kind === 'receipt' ? item.amount : 0, payment: item.kind === 'charge' ? item.amount : 0, source: 'shop' });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function journalLines(transaction: CashTransaction) {
  const money = transaction.account === 'bank' ? 'البنك' : transaction.account === 'cash' ? 'الصندوق' : 'نقدية غير مصنفة';
  return transaction.receipt > 0 ? [{ account: money, debit: transaction.receipt, credit: 0 }, { account: transaction.counterpart, debit: 0, credit: transaction.receipt }]
    : [{ account: transaction.counterpart, debit: transaction.payment, credit: 0 }, { account: money, debit: 0, credit: transaction.payment }];
}
export function shopStatement(entries: ShopEntry[], branch: string, from = '', to = '') {
  const source = entries.filter(entry => entry.branch === branch).sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id));
  const effect = (entry: ShopEntry) => entry.kind === 'charge' || entry.kind === 'opening' ? entry.amount : -entry.amount;
  const opening = source.filter(entry => from && entry.date < from).reduce((sum, entry) => sum + effect(entry), 0);
  let balance = opening;
  const rows = source.filter(entry => (!from || entry.date >= from) && (!to || entry.date <= to)).map(entry => {
    balance += effect(entry);
    return { ...entry, debit: effect(entry) > 0 ? entry.amount : 0, credit: effect(entry) < 0 ? entry.amount : 0, balance };
  });
  return { opening, rows, ending: balance, charges: rows.reduce((sum, entry) => sum + entry.debit, 0), receipts: rows.filter(entry => entry.kind === 'receipt').reduce((sum, entry) => sum + entry.amount, 0), credits: rows.reduce((sum, entry) => sum + entry.credit, 0) };
}

/** Integer halalas keep carryforward and per-source reconciliation consistent. */
export function cashbookSummary(transactions: CashTransaction[], from = '', to = '') {
  const cents = (value: number) => Math.round(Number(value || 0) * 100);
  const previous = transactions.filter(row => from && row.date < from && (!to || row.date <= to));
  const period = transactions.filter(row => (!from || row.date >= from) && (!to || row.date <= to));
  const net = (rows: CashTransaction[]) => rows.reduce((sum,row) => sum + cents(row.receipt) - cents(row.payment),0);
  const openingCents = net(previous);
  let running = openingCents;
  const rows = period.map(row => { running += cents(row.receipt)-cents(row.payment); return { ...row, balance: running/100 }; });
  const received = period.reduce((sum,row)=>sum+cents(row.receipt),0)/100;
  const paid = period.reduce((sum,row)=>sum+cents(row.payment),0)/100;
  const sources = (['employee','manual','shop'] as const).map(source => {
    const sourceRows = [...previous,...period].filter(row=>row.source===source);
    return { source, count: sourceRows.length, received: sourceRows.reduce((sum,row)=>sum+cents(row.receipt),0)/100,
      paid: sourceRows.reduce((sum,row)=>sum+cents(row.payment),0)/100, net: net(sourceRows)/100 };
  });
  return { opening:openingCents/100, rows, received, paid, net:net(period)/100, ending:running/100, sources };
}

export function lastCalculatedKafala(payments: Payment[]): string {
  const normalize = (value: string) => value.replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/[\u064b-\u065f]/g,'').replace(/[٠-٩]/g,digit=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  const aliases = HIJRI_MONTH_NAMES.map((name,index)=>({name:normalize(name),month:index+1}));
  aliases.push({name:'ربيع الثاني',month:4},{name:'ربيع ثاني',month:4},{name:'ربيع اخر',month:4},{name:'جمادي الثانيه',month:6},{name:'جمادي الثانية',month:6});
  const candidates: {month:number;year:number}[] = [];
  for (const payment of payments.filter(payment=>isDebt(payment) && (payment.category==='kafala' || payment.type?.includes('كفالة')))) {
    if (payment.kafalaPeriod && validHijriPeriod(payment.kafalaPeriod)) {
      candidates.push({month:payment.kafalaPeriod.toMonth,year:payment.kafalaPeriod.toYear}); continue;
    }
    // Legacy start metadata is not an end date. Only accept a written, explicit endpoint.
    const text = normalize(`${payment.type || ''} ${payment.notes || ''}`);
    for (const alias of aliases) {
      const expression = new RegExp(`(?:الي|الى|حتي|حتى)\\s*(?:شهر\\s*)?${alias.name}\\s*(?:(?:عام|سنة)\\s*)?(1[3-6][0-9]{2}|1700)(?![0-9])`,'g');
      for (const match of text.matchAll(expression)) candidates.push({month:alias.month,year:Number(match[1])});
    }
  }
  candidates.sort((a,b)=>b.year*12+b.month-(a.year*12+a.month));
  return candidates.length ? `${HIJRI_MONTH_NAMES[candidates[0].month-1]} ${candidates[0].year}` : 'لم تُحدد فترة كفالة محسوبة';
}
