import { chargeableKafalaMonths } from '../utils/workerLeave';
import React from 'react';
import { HIJRI_MONTH_NAMES } from '../utils/hijri';
import { HijriPeriod, hijriPeriodMonths, payableHijriMonths, validHijriPeriod } from '../utils/accounting';

export default function HijriPeriodFields({ value, onChange, allowFree = false, travelExemptMonths = [] }: { value: HijriPeriod; onChange: (value: HijriPeriod) => void; allowFree?: boolean; travelExemptMonths?: string[] }) {
  const field = (key: keyof HijriPeriod, label: string, month = false) => <label className="block text-sm text-slate-700 space-y-1" key={key}><span>{label}</span>{month ? <select aria-label={label} value={value[key] || 1} onChange={event => onChange({ ...value, [key]: Number(event.target.value) })} className="field">{HIJRI_MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select> : <input aria-label={label} type="number" min="1300" max="1700" step="1" value={value[key] ?? ''} onChange={event => onChange({ ...value, [key]: Number(event.target.value) })} className="field" />}</label>;
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">{field('fromMonth', 'من شهر هجري', true)}{field('fromYear', 'سنة البداية الهجرية')}{field('toMonth', 'إلى شهر هجري', true)}{field('toYear', 'سنة النهاية الهجرية')}</div>
    {allowFree && <label className="flex items-center gap-2 text-sm text-amber-900"><input type="checkbox" checked={value.freeFromMonth !== undefined} onChange={event => onChange(event.target.checked ? { ...value, freeFromMonth: value.fromMonth, freeFromYear: value.fromYear, freeToMonth: value.fromMonth, freeToYear: value.fromYear } : { fromMonth: value.fromMonth, fromYear: value.fromYear, toMonth: value.toMonth, toYear: value.toYear })} />تحديد فترة إعفاء داخل فترة الكفالة</label>}
    {value.freeFromMonth !== undefined && <div className="grid grid-cols-2 gap-3 border border-amber-200 bg-amber-50 p-3 rounded-lg">{field('freeFromMonth', 'الإعفاء من شهر', true)}{field('freeFromYear', 'سنة بداية الإعفاء')}{field('freeToMonth', 'الإعفاء إلى شهر', true)}{field('freeToYear', 'سنة نهاية الإعفاء')}</div>}
    <p aria-live="polite" className={validHijriPeriod(value) ? 'text-sm text-slate-600' : 'text-sm text-red-700'}>{validHijriPeriod(value) ? `إجمالي الفترة ${hijriPeriodMonths(value.fromMonth, value.fromYear, value.toMonth, value.toYear)} شهر · المستحق ${chargeableKafalaMonths(value, travelExemptMonths)} شهر${travelExemptMonths.length ? ` · إعفاء إجازة معتمد: ${travelExemptMonths.length} شهر` : ''}` : 'تحقق من ترتيب البداية والنهاية؛ فترة الإعفاء يجب أن تكون داخل فترة الكفالة.'}</p>
  </div>;
}
