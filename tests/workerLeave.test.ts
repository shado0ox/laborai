import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarMonths, approvedExemptMonths, chargeableKafalaMonths, stayStatus, tripHijriMonths, validISODate } from '../src/utils/workerLeave.ts';
import type { WorkerLeave } from '../src/types.ts';
const worker={iqamaNo:'1',saudiEntryDate:'2024-01-15'};
const leave:WorkerLeave={id:'l',iqamaNo:'1',departureDate:'2026-01-15',expectedReturnDate:'2026-03-15',policy:'eligible',exemptMonths:[],cancelled:false};
test('stay eligibility reaches exactly 24 Gregorian months, with safe month-end and leap dates',()=>{
  assert.equal(stayStatus(worker,[],'2026-01-14').eligible,false);
  assert.equal(stayStatus(worker,[],'2026-01-15').eligible,true);
  assert.equal(stayStatus(worker,[],'2025-10-15').months,21);
  assert.equal(stayStatus(worker,[],'2025-10-15').due,'2026-01-15');
  assert.equal(addCalendarMonths('2024-02-29',24),'2026-02-28');
  assert.equal(addCalendarMonths('2025-01-31',1),'2025-02-28');
  assert.equal(validISODate('2026-02-30'),false);
  assert.equal(stayStatus({iqamaNo:'1'},[],'2026-01-01').known,false);
});
test('travel freezes inside-Saudi duration and actual return starts the next cycle, not expected return',()=>{
  assert.equal(stayStatus(worker,[leave],'2026-04-01').abroad,true);
  assert.equal(stayStatus(worker,[leave],'2026-04-01').months,24);
  const returned={...leave,actualReturnDate:'2026-03-20'};
  assert.equal(stayStatus(worker,[returned],'2026-04-01').due,'2028-03-20');
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
