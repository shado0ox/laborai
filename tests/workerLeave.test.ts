import test from 'node:test';
import assert from 'node:assert/strict';
import { addHijriMonths, hijriToISO, hijriParts, hijriMonthLength, formatLeaveDate, approvedExemptMonths, chargeableKafalaMonths, stayStatus, tripHijriMonths, validISODate } from '../src/utils/workerLeave.ts';
import type { WorkerLeave } from '../src/types.ts';
const worker={iqamaNo:'1',saudiEntryDate:'2024-01-15'};
const leave:WorkerLeave={id:'l',iqamaNo:'1',departureDate:'2026-01-15',expectedReturnDate:'2026-03-15',policy:'eligible',exemptMonths:[],cancelled:false};
test('stay eligibility reaches exactly 24 Umm al-Qura months, before two Gregorian years',()=>{
  const start=hijriToISO(1445,7,3),due=hijriToISO(1447,7,3),w={iqamaNo:'1',saudiEntryDate:start};
  const dayBefore=new Date(Date.parse(due+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  assert.equal(stayStatus(w,[],dayBefore).eligible,false);
  assert.equal(stayStatus(w,[],due).eligible,true);
  assert.equal(stayStatus(w,[],due).months,24);
  assert.equal(stayStatus(w,[],hijriToISO(1447,4,3)).months,21);
  assert.equal(stayStatus(w,[],due).due,due);
  assert.ok(due<'2026-01-15');
  assert.equal(validISODate('2026-02-30'),false);
  assert.equal(stayStatus({iqamaNo:'1'},[],'2026-01-01').known,false);
});
test('Hijri conversion round-trips Umm al-Qura days, year rollovers and clamps short months',()=>{
  for(let year=1440;year<=1450;year++)for(let month=1;month<=12;month++) {
    const length=hijriMonthLength(year,month);
    assert.ok(length===29||length===30);
    for(const day of [1,length]) assert.deepEqual(hijriParts(hijriToISO(year,month,day)),{year,month,day});
    if(length===30) {
      const next=addHijriMonths(hijriToISO(year,month,30),1),parts=hijriParts(next);
      assert.equal(parts.day,Math.min(30,hijriMonthLength(parts.year,parts.month)));
    }
  }
  assert.equal(formatLeaveDate(hijriToISO(1447,1,1)),'1447/01/01 هـ');
  assert.equal(addHijriMonths(hijriToISO(1446,12,1),1),hijriToISO(1447,1,1));
  assert.throws(()=>hijriToISO(1447,1,31));
});
test('travel freezes inside-Saudi duration and actual return starts the next cycle, not expected return',()=>{
  assert.equal(stayStatus(worker,[leave],'2026-04-01').abroad,true);
  assert.equal(stayStatus(worker,[leave],'2026-04-01').months,stayStatus(worker,[],leave.departureDate).months);
  const returned={...leave,actualReturnDate:'2026-03-20'};
  assert.equal(stayStatus(worker,[returned],'2026-04-01').due,addHijriMonths('2026-03-20',24));
  assert.equal(stayStatus(worker,[returned],'2026-04-01').months,0);
  assert.equal(stayStatus(worker,[{...returned,cancelled:true}],'2026-04-01').start,worker.saudiEntryDate);
  assert.equal(stayStatus(worker,[{...returned,iqamaNo:'another'}],'2026-04-01').start,worker.saudiEntryDate);
});
test('manual Hijri leave exemptions intersect travel, respect returns, and never double-count other free months',()=>{
  const months=tripHijriMonths('2026-01-15','2026-03-15');assert.ok(months.length>=2);
  const [fy,fm]=months[0].split('-').map(Number),[ty,tm]=months.at(-1)!.split('-').map(Number);
  const period={fromYear:fy,fromMonth:fm,toYear:ty,toMonth:tm};
  const approved={...leave,exemptMonths:[months[0],months[0],'1499-01']};
  assert.deepEqual(approvedExemptMonths([approved],worker.iqamaNo,period),[months[0]]);
  assert.equal(chargeableKafalaMonths(period,[months[0]]),months.length-1);
  assert.equal(chargeableKafalaMonths({...period,freeFromYear:fy,freeFromMonth:fm,freeToYear:fy,freeToMonth:fm},[months[0]]),months.length-1);
  assert.deepEqual(approvedExemptMonths([{...approved,cancelled:true}],worker.iqamaNo,period),[]);
  assert.deepEqual(approvedExemptMonths([{...approved,policy:'normal'}],worker.iqamaNo,period),[]);
  const earlyReturn={...approved,actualReturnDate:'2026-01-16',exemptMonths:[months.at(-1)!]};
  assert.deepEqual(approvedExemptMonths([earlyReturn],worker.iqamaNo,period),[]);
});
