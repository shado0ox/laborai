export type PaymentKind = 'receipt' | 'debt' | 'discount' | 'settlement';

type ClassifiedPayment = { type?: string; transactionKind?: PaymentKind | null };

/** Legacy records lack a kind; preserve their account effect without inventing cash. */
export function getPaymentKind(payment: ClassifiedPayment): PaymentKind {
  if (payment.transactionKind) return payment.transactionKind;
  const description = payment.type || '';
  if (description.includes('مديونية')) return 'debt';
  if (description.includes('خصم')) return 'discount';
  if (description.includes('تسوية')) return 'settlement';
  return 'receipt';
}
export const isCashReceipt = (payment: ClassifiedPayment) => getPaymentKind(payment) === 'receipt';
export const isEmployeeCredit = (payment: ClassifiedPayment) => getPaymentKind(payment) !== 'debt';
export const isDebt = (payment: ClassifiedPayment) => getPaymentKind(payment) === 'debt';
export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  receipt: 'تحصيل نقدي', debt: 'إثبات مديونية', discount: 'خصم بدون تحصيل', settlement: 'تسوية غير نقدية'
};
