import test from 'node:test';
import assert from 'node:assert/strict';
import { getPaymentKind, isCashReceipt, isEmployeeCredit } from '../src/utils/paymentKind.ts';

test('legacy discounts reduce the worker balance without becoming cash receipts', () => {
  const payments = [
    { type: 'من المقبوضات: سداد رسوم كفالة', amount: 1000 },
    { type: 'خصم عمالةพิเศษ', amount: 200 },
    { type: 'تسوية رصيد', amount: 50 },
    { type: 'قيد مديونية: رسوم إقامة', amount: 500 }
  ];
  assert.equal(payments.filter(isCashReceipt).reduce((sum, p) => sum + p.amount, 0), 1000);
  assert.equal(payments.filter(isEmployeeCredit).reduce((sum, p) => sum + p.amount, 0), 1250);
  assert.equal(2000 - payments.filter(isEmployeeCredit).reduce((sum, p) => sum + p.amount, 0), 750);
});

test('explicit kind keeps non-cash treatment when the description changes', () => {
  assert.equal(getPaymentKind({ type: 'إعفاء بموافقة الإدارة', transactionKind: 'discount' }), 'discount');
  assert.equal(isCashReceipt({ type: 'إعفاء بموافقة الإدارة', transactionKind: 'discount' }), false);
  assert.equal(isEmployeeCredit({ transactionKind: 'settlement' }), true);
  assert.equal(isEmployeeCredit({ transactionKind: 'debt' }), false);
});
