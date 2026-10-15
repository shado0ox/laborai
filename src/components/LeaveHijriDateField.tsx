import React from 'react';
import { HIJRI_MONTH_NAMES } from '../utils/hijri';
import { hijriParts, hijriToISO, hijriMonthLength, saudiToday } from '../utils/workerLeave';

// Stored ISO dates keep existing records stable; every user-facing part is Hijri.
export default function LeaveHijriDateField({value,onChange,label,required=false,min,max}:{value:string;onChange:(value:string)=>void;label:string;required?:boolean;min?:string;max?:string}) {
  const current=hijriParts(value || saudiToday());
  const change=(part:'year'|'month'|'day',value:number)=>{
    const next={...current,[part]:value};
    onChange(hijriToISO(next.year,next.month,Math.min(next.day,hijriMonthLength(next.year,next.month))));
  };
  const invalid=!!value&&((!!min&&value<min)||(!!max&&value>max));
  return <fieldset className="text-sm min-w-0"><legend>{label} (هجري)</legend><div className="flex gap-1">
    <select className="field min-w-0" aria-label={`${label} اليوم`} ref={node=>node?.setCustomValidity(invalid?'التاريخ خارج الفترة المسموحة.':'')} required={required} value={value?current.day:''} onChange={e=>change('day',Number(e.target.value))}><option value="" disabled>اليوم</option>{Array.from({length:hijriMonthLength(current.year,current.month)},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select>
    <select className="field min-w-0" aria-label={`${label} الشهر`} required={required} value={value?current.month:''} onChange={e=>change('month',Number(e.target.value))}><option value="" disabled>الشهر</option>{HIJRI_MONTH_NAMES.map((name,i)=><option key={name} value={i+1}>{name}</option>)}</select>
    <select className="field min-w-0" aria-label={`${label} السنة`} required={required} value={value?current.year:''} onChange={e=>change('year',Number(e.target.value))}><option value="" disabled>السنة</option>{Array.from({length:1600-1318},(_,i)=>1318+i).map(year=><option key={year} value={year}>{year}</option>)}</select>
    {!required&&value&&<button type="button" aria-label={`مسح ${label}`} onClick={()=>onChange('')}>×</button>}
  </div>{invalid&&<p role="alert" className="text-red-700">التاريخ خارج الفترة المسموحة.</p>}
  </fieldset>;
}
