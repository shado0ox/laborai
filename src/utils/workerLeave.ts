import type { Employee, WorkerLeave } from '../types';
import type { HijriPeriod } from './accounting';

const saudiDateFormatter=new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Riyadh', year:'numeric',month:'2-digit',day:'2-digit' });
const hijriMonthFormatter=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn',{timeZone:'UTC',year:'numeric',month:'numeric'});
export const saudiToday = () => {
  const parts=saudiDateFormatter.formatToParts(new Date());
  const part=(type:string)=>parts.find(value=>value.type===type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
export function validISODate(value: string): boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===value && Number(value.slice(0,4))>=1900 && Number(value.slice(0,4))<=2200;
}
// Use the same Umm al-Qura calendar in browser and server; ISO dates identify stored days only.
const hijriDayFormatter=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});
function calendarParts(value: string) {
  const parts=hijriDayFormatter.formatToParts(new Date(value+'T12:00:00Z'));
  const part=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
  return {year:part('year'),month:part('month'),day:part('day')};
}
export function hijriParts(value:string) {
  if(!validISODate(value)) throw new RangeError('Invalid date');
  return calendarParts(value);
}
const monthStarts=new Map<string,number>();
function hijriMonthStart(year:number,month:number):number {
  if(!Number.isInteger(year)||year<1317||year>1700||!Number.isInteger(month)||month<1||month>12) throw new RangeError('Invalid Hijri month');
  const key=`${year}-${month}`;
  if(monthStarts.has(key)) return monthStarts.get(key)!;
  let lo=Math.floor(Date.UTC(1899,0,1)/86400000),hi=Math.ceil(Date.UTC(2275,0,1)/86400000);
  const target=year*12+month-1;
  while(lo<hi) {
    const mid=Math.floor((lo+hi)/2),p=calendarParts(new Date(mid*86400000).toISOString().slice(0,10));
    if(p.year*12+p.month-1<target)lo=mid+1;else hi=mid;
  }
  monthStarts.set(key,lo);return lo;
}
export function hijriMonthLength(year:number,month:number) {
  return hijriMonthStart(month===12?year+1:year,month===12?1:month+1)-hijriMonthStart(year,month);
}
export function hijriToISO(year:number,month:number,day:number):string {
  if(!Number.isInteger(day)||day<1||day>hijriMonthLength(year,month)) throw new RangeError('Invalid Hijri day');
  return new Date((hijriMonthStart(year,month)+day-1)*86400000).toISOString().slice(0,10);
}
export function formatLeaveDate(value:string):string {
  if(!value||!validISODate(value)) return '—';
  const p=hijriParts(value);return `${p.year}/${String(p.month).padStart(2,'0')}/${String(p.day).padStart(2,'0')} هـ`;
}
export function addHijriMonths(value:string,months:number):string {
  const p=hijriParts(value),index=p.year*12+p.month-1+months,year=Math.floor(index/12),month=index%12+1;
  return hijriToISO(year,month,Math.min(p.day,hijriMonthLength(year,month)));
}
export function stayStatus(employee: Pick<Employee,'iqamaNo'|'saudiEntryDate'>, leaves: WorkerLeave[], asOf = saudiToday()) {
  if(!validISODate(asOf)) asOf=saudiToday();
  const own=leaves.filter(leave=>leave.iqamaNo===employee.iqamaNo && !leave.cancelled);
  const returns=own.filter(leave=>leave.actualReturnDate && leave.actualReturnDate<=asOf).map(leave=>leave.actualReturnDate!).sort();
  const start=returns.at(-1) || employee.saudiEntryDate;
  const abroad=own.find(leave=>leave.departureDate<=asOf && (!leave.actualReturnDate || leave.actualReturnDate>asOf));
  if(!start || !validISODate(start)) return { start:'', due:'',months:0,daysRemaining:0,eligible:false,abroad:!!abroad,known:false };
  const end=abroad?.departureDate || asOf;
  const startHijri=hijriParts(start),endHijri=hijriParts(end);
  let months=Math.max(0,(endHijri.year-startHijri.year)*12+endHijri.month-startHijri.month);
  if(addHijriMonths(start,months)>end) months=Math.max(0,months-1);
  const due=addHijriMonths(start,24), daysRemaining=Math.max(0,Math.ceil((Date.parse(due+'T12:00:00Z')-Date.parse(end+'T12:00:00Z'))/86400000));
  return {start,due,months,daysRemaining,eligible:end>=due,abroad:!!abroad,known:true};
}
export function tripHijriMonths(from: string, to: string): string[] {
  if(!validISODate(from)||!validISODate(to)||from>to) return [];
  const index=(date:string)=>{
    const parts=hijriMonthFormatter.formatToParts(new Date(date+'T12:00:00Z'));
    return Number(parts.find(p=>p.type==='year')?.value)*12+Number(parts.find(p=>p.type==='month')?.value)-1;
  };
  const start=index(from),end=index(to);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end-start>120) return [];
  return Array.from({length:end-start+1},(_,i)=>`${Math.floor((start+i)/12)}-${String((start+i)%12+1).padStart(2,'0')}`);
}
export function approvedExemptMonths(leaves: WorkerLeave[], iqamaNo: string, period: HijriPeriod): string[] {
  const start=period.fromYear*12+period.fromMonth-1,end=period.toYear*12+period.toMonth-1;
  return [...new Set(leaves.filter(l=>l.iqamaNo===iqamaNo && !l.cancelled && l.policy!=='normal').flatMap(l=>{const actualMonths=new Set(tripHijriMonths(l.departureDate,l.actualReturnDate || l.expectedReturnDate));return l.exemptMonths.filter(month=>actualMonths.has(month));}))].filter(key=>{const [y,m]=key.split('-').map(Number),value=y*12+m-1;return value>=start&&value<=end;}).sort();
}
export function chargeableKafalaMonths(period: HijriPeriod, approved: string[] = []): number {
  const start=period.fromYear*12+period.fromMonth-1,end=period.toYear*12+period.toMonth-1;
  if(end<start || end-start>4800) return 0;
  let count=0;
  for(let i=start;i<=end;i++) {
    const key=`${Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`;
    const freeStart=period.freeFromYear! *12+period.freeFromMonth!-1,freeEnd=period.freeToYear!*12+period.freeToMonth!-1;
    if(!approved.includes(key) && !(period.freeFromMonth!==undefined && i>=freeStart && i<=freeEnd)) count++;
  }
  return count;
}
