import test from 'node:test';
import assert from 'node:assert/strict';
import { cashTransactions, employeeDues, hijriPeriodMonths, journalLines, lastPaidKafala, payableHijriMonths, shopStatement, validHijriPeriod } from '../src/utils/accounting.ts';
import type { Employee, Payment, PricingSettings, ShopEntry } from '../src/types.ts';

const pricing: PricingSettings = { kafala: 250, iqama3: 100, iqama6: 200, iqama12: 400, ramadanFree: false };
const employee: Employee = { iqamaNo: '1', name: 'Worker', iqamaExpiry: '2027-01-01', mobile: '', branch: 'East', iqamaBalance: 100, kafalaCount: 2, otherDebt: 0, notes: '', status: 'active' };
const payment = (values: Partial<Payment>): Payment => ({ id: 'p', iqamaNo: '1', name: 'Worker', branch: 'East', type: 'سداد كفالة', amount: 250, date: '2026-01-01', ...values });
const shop = (values: Partial<ShopEntry>): ShopEntry => ({ id: 's', branch: 'East', date: '2026-01-01', year: 2026, kind: 'charge', amount: 500, category: 'زكاة', description: 'Annual cost', paidByCompany: false, cashAccount: 'cash', ...values });

test('Hijri periods cross year boundaries and count inclusive months correctly', () => {
  assert.equal(hijriPeriodMonths(12,1447,2,1448),3);
  assert.equal(hijriPeriodMonths(1,1447,12,1449),36);
  assert.equal(hijriPeriodMonths(6,1448,1,1447),0);
  assert.equal(hijriPeriodMonths(13,1447,1,1448),0);
});

test('exemptions are bounded by the contract and can themselves cross a year', () => {
  const period = { fromMonth: 1, fromYear: 1447, toMonth: 6, toYear: 1448, freeFromMonth: 11, freeFromYear: 1447, freeToMonth: 2, freeToYear: 1448 };
  assert.equal(validHijriPeriod(period),true); assert.equal(payableHijriMonths(period),14);
  assert.equal(validHijriPeriod({ ...period, freeToYear: 1449 }),false);
  assert.equal(validHijriPeriod({ ...period, freeFromMonth: 3 }),true);
  assert.equal(validHijriPeriod({ ...period, freeFromYear: 1448, freeFromMonth: 3 }),false);
});

test('new debt entries affect the worker once while legacy debts remain included in balances', () => {
  const legacy = payment({ type: 'قيد مديونية', transactionKind: 'debt', amount: 300 });
  const additional = payment({ id: 'new', type: 'قيد مديونية', transactionKind: 'debt', amount: 4500, balanceIncluded: false });
  assert.equal(employeeDues(employee,pricing,[legacy]),600);
  assert.equal(employeeDues(employee,pricing,[legacy,additional]),5100);
  assert.equal(employeeDues(employee,pricing,[]),600);
});

test('latest paid kafala uses the covered end month/year and excludes debts and discounts', () => {
  const records = [
    payment({ id: 'old', hijriMonth: 'ذو الحجة', hijriYear: '1447', date: '2027-01-01' }),
    payment({ id: 'new', category: 'kafala', kafalaPeriod: { fromMonth: 1, fromYear: 1448, toMonth: 6, toYear: 1448 }, date: '2026-01-01' }),
    payment({ id: 'debt', transactionKind: 'debt', hijriMonth: '12', hijriYear: '1449' }),
    payment({ id: 'discount', transactionKind: 'discount', hijriMonth: '12', hijriYear: '1450' })
  ];
  assert.equal(lastPaidKafala(records),'جمادى الآخرة 1448');
  assert.equal(lastPaidKafala(records.filter(record => record.transactionKind)), 'لم يُسجل سداد');
});

test('each shop carries forward prior years and excludes other branches', () => {
  const records = [shop({ id: 'opening', date: '2025-12-01', year: 2025, kind: 'opening', amount: 100 }), shop({ id: 'cost' }), shop({ id: 'received', kind: 'receipt', amount: 200 }), shop({ id: 'discount', kind: 'discount', amount: 50 }), shop({ id: 'other', branch: 'West', amount: 9999 })];
  const report = shopStatement(records,'East','2026-01-01','2026-12-31');
  assert.equal(report.opening,100); assert.equal(report.charges,500); assert.equal(report.receipts,200); assert.equal(report.ending,350); assert.equal(report.rows.length,3);
});

test('cashbook contains actual shop receipts and payments only and journal entries balance', () => {
  const records = [shop({ id: 'unpaid' }), shop({ id: 'paid', paidByCompany: true, amount: 300, cashAccount: 'bank' }), shop({ id: 'receipt', kind: 'receipt', amount: 200 }), shop({ id: 'discount', kind: 'discount', amount: 50 })];
  const result = cashTransactions([payment({ transactionKind: 'discount' }), payment({ id: 'cash', amount: 100 })],[],records);
  assert.equal(result.length,3);
  assert.equal(result.reduce((total,entry) => total + entry.receipt,0),300);
  assert.equal(result.reduce((total,entry) => total + entry.payment,0),300);
  const lines = result.flatMap(journalLines);
  assert.equal(lines.reduce((total,line) => total + line.debit-line.credit,0),0);
  assert.equal(result.find(entry => entry.recordId === 'cash')!.account,'unassigned');
  assert.deepEqual(journalLines(result.find(entry => entry.recordId === 'paid')!), [{ account: 'ذمم مسؤولي المحلات', debit: 300, credit: 0 }, { account: 'البنك', debit: 0, credit: 300 }]);
});


test('cashbook reconciles source totals and carryforward using halalas without inventing zero', async () => {
  const { cashbookSummary } = await import('../src/utils/accounting.ts');
  const sample = { id:'a', recordId:'a', reference:'a', branch:'East', description:'test', category:'test', account:'cash' as const, counterpart:'test', source:'manual' as const };
  const summary = cashbookSummary([
    {...sample,date:'2026-01-01',receipt:0.1,payment:0},
    {...sample,id:'b',date:'2026-02-01',receipt:0.2,payment:0.3},
  ],'2026-02-01','2026-02-28');
  assert.equal(summary.opening,0.1); assert.equal(summary.ending,0); assert.equal(summary.rows[0].balance,0);
  assert.equal(summary.sources.find(row=>row.source==='manual')?.net,0);
  assert.equal(cashbookSummary([{...sample,date:'2026-01-01',receipt:0,payment:81503}]).ending,-81503);
});


test('explicit non-cash manual adjustments remain stored but never enter cash or journal', () => {
  const entries = [{ id:'noncash', date:'2026-01-01', bayan:'Approved waiver', debit:25, credit:0, cashEffect:'noncash' as const }, {id:'cash',date:'2026-01-01',bayan:'Actual receipt',debit:0,credit:25}];
  const cash = cashTransactions([],entries,[]);
  assert.equal(cash.length,1); assert.equal(cash[0].receipt,25); assert.equal(entries.length,2);
});
