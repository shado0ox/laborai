import { tripHijriMonths, chargeableKafalaMonths } from '../src/utils/workerLeave.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}

const password = 'test-password-only';
const employee = (name, branch, iqamaNo = '2000000001') => ({ iqamaNo, name, branch, iqamaExpiry: '2027-12-01', iqamaBalance: 100, kafalaCount: 2, otherDebt: 0 });

test('PostgreSQL-backed ownership, authentication and persistence', { timeout: 90000 }, async t => {
  const db = await PGlite.create();
  await db.exec(await readFile(new URL('./fixtures/legacy.sql', import.meta.url), 'utf8'));
  await db.exec("INSERT INTO employees (iqama_no,name,iqama_expiry,branch) VALUES ('2999999999','Legacy record','2027-01-01','Legacy branch'); INSERT INTO payments (id,iqama_no,name,branch,amount,type,date) VALUES ('legacy-payment','2999999999','Legacy record','Legacy branch',25,'سداد','2026-01-01'); INSERT INTO general_ledger (id,date,bayan,debit) VALUES ('legacy-entry','2026-01-01','Legacy entry',25)");
  const dbPort = await freePort(); const appPort = await freePort();
  const server = new PGLiteSocketServer({ db, port: dbPort, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  let logs = '';
  const process = spawn('node', ['dist/server.cjs'], {
    env: { ...globalThis.process.env, TZ: 'Asia/Riyadh', NODE_ENV: 'production', PORT: String(appPort), DB_HOST: '127.0.0.1', DB_PORT: String(dbPort), DB_DATABASE: 'postgres', DB_USER: 'postgres', DB_PASSWORD: 'test', JWT_SECRET: 'integration-test-secret-only-0123456789', DEV_EMAIL: 'operator@example.test', DEV_DEFAULT_PASSWORD: password },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  process.stdout.on('data', data => { logs += data; }); process.stderr.on('data', data => { logs += data; });
  t.after(async () => {
    process.kill('SIGTERM'); if (process.exitCode === null) await once(process, 'exit');
    await server.stop();
    // Socket handlers finish asynchronous detach/transaction cleanup after close.
    await new Promise(resolve => setTimeout(resolve, 100));
    await db.close();
  });
  const base = `http://127.0.0.1:${appPort}`;
  async function api(path, method = 'GET', body, token, status = 200) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json(); assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}\n${logs}`); return data;
  }
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (process.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, logs);
  const login = async email => api('/api/auth/login', 'POST', { email, password });
  const developer = (await login('operator@example.test')).token;
  let a, b, adminA, adminB, viewer, branch;

  await t.test('legacy upgrade preserves data and uses tenant composite keys', async () => {
    assert.equal((await api('/api/employees', 'GET', undefined, developer))[0].name, 'Legacy record');
    assert.equal((await api('/api/payments', 'GET', undefined, developer))[0].amount, 25);
    assert.equal((await api('/api/general-ledger', 'GET', undefined, developer))[0].bayan, 'Legacy entry');
    for (const table of ['employees', 'payments', 'general_ledger']) {
      const result = await db.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'p'", [table]);
      assert.match(result.rows[0].definition, /tenant_id/);
    }
  });
  await t.test('public registration cannot overwrite a known user ID or choose tenant/status', async () => {
    const registered = await api('/api/users', 'POST', { uid: 'user-admin', name: 'Applicant', email: 'applicant@example.test', password, role: 'admin', status: 'approved', tenantId: 'forged' }, undefined, 201);
    assert.notEqual(registered.user.uid, 'user-admin'); assert.notEqual(registered.user.tenantId, 'forged'); assert.equal(registered.user.status, 'pending');
    await api('/api/auth/login', 'POST', { email: 'applicant@example.test', password }, undefined, 403);
    await api('/api/users', 'POST', { uid: 'known', name: 'Duplicate', email: 'APPLICANT@example.test', password, role: 'admin' }, undefined, 409);
    assert.equal((await login('operator@example.test')).user.isDeveloper, true);
  });
  await t.test('create isolated companies and branch-scoped accounts', async () => {
    a = await api('/api/admin/spaces', 'POST', { action: 'create_space', companyName: 'Company A', adminName: 'A', adminEmail: 'a@example.test', adminPassword: password }, developer);
    b = await api('/api/admin/spaces', 'POST', { action: 'create_space', companyName: 'Company B', adminName: 'B', adminEmail: 'b@example.test', adminPassword: password }, developer);
    adminA = (await login('a@example.test')).token; adminB = (await login('b@example.test')).token;
    await api('/api/branches', 'POST', ['East', 'West'], adminA);
    viewer = (await api('/api/users', 'POST', { uid: 'ignored', name: 'Viewer', email: 'viewer-test@example.test', password, role: 'viewer' }, adminA, 201)).user;
    branch = (await api('/api/users', 'POST', { uid: 'ignored', name: 'Branch', email: 'branch-test@example.test', password, role: 'branch', branch: 'East' }, adminA, 201)).user;
    viewer.token = (await login(viewer.email)).token; branch.token = (await login(branch.email)).token;
  });
  await t.test('viewer cannot escalate, delete users or write through registration', async () => {
    await api(`/api/users/${viewer.uid}`, 'PUT', { role: 'admin' }, viewer.token, 403);
    await api(`/api/users/${branch.uid}`, 'DELETE', undefined, viewer.token, 403);
    await api('/api/users', 'POST', { uid: 'ignored', name: 'Intruder', email: 'intruder@example.test', password, role: 'admin' }, viewer.token, 403);
    await api('/api/users', 'GET', undefined, branch.token, 403);
  });
  await t.test('same record IDs and iqama numbers remain isolated across companies', async () => {
    await api('/api/employees', 'POST', employee('Worker A', 'East'), adminA);
    await api('/api/employees', 'POST', employee('Worker B', 'East'), adminB);
    await api('/api/employees', 'POST', employee('West worker', 'West', '2000000002'), adminA);
    assert.equal((await api(`/api/employees?tenantId=${b.tenantId}`, 'GET', undefined, adminA)).find(employee => employee.iqamaNo === '2000000001').name, 'Worker A');
    assert.equal((await api('/api/employees', 'GET', undefined, adminB))[0].name, 'Worker B');
    const payment = { id: 'shared-payment', iqamaNo: '2000000001', name: 'Forged name', branch: 'Forged branch', amount: 75, type: 'سداد', date: '2026-10-01' };
    await api('/api/payments', 'POST', payment, adminA); await api('/api/payments', 'POST', { ...payment, amount: 90 }, adminB);
    assert.equal((await api('/api/payments', 'GET', undefined, adminA))[0].name, 'Worker A');
    assert.equal((await api('/api/payments', 'GET', undefined, adminB))[0].amount, 90);
    const entry = { id: 'shared-entry', date: '2026-10-01', bayan: 'A entry', debit: 10, credit: 0 };
    await api('/api/general-ledger', 'POST', entry, adminA); await api('/api/general-ledger', 'POST', { ...entry, bayan: 'B entry' }, adminB);
    assert.equal((await api('/api/general-ledger', 'GET', undefined, adminA))[0].bayan, 'A entry');
  });
  await t.test('discount and settlement kinds persist independently from cash receipts', async () => {
    const payment = { iqamaNo: '2000000001', name: 'Ignored', branch: 'East', amount: 25, date: '2026-10-01' };
    await api('/api/payments', 'POST', { ...payment, id: 'legacy-discount', type: 'خصم عمالةพิเศษ' }, adminA);
    await api('/api/payments', 'POST', { ...payment, id: 'explicit-discount', type: 'إعفاء بموافقة الإدارة', transactionKind: 'discount' }, adminA);
    await api('/api/payments', 'POST', { ...payment, id: 'settlement', type: 'تسوية رصيد' }, adminA);
    const payments = await api('/api/payments', 'GET', undefined, adminA);
    assert.equal(payments.find(p => p.id === 'legacy-discount').transactionKind, 'discount');
    assert.equal(payments.find(p => p.id === 'explicit-discount').transactionKind, 'discount');
    assert.equal(payments.find(p => p.id === 'settlement').transactionKind, 'settlement');
    assert.equal(payments.find(p => p.id === 'shared-payment').transactionKind, 'receipt');
  });
  await t.test('branch reads and writes cannot escape assigned branch', async () => {
    const employees = await api('/api/employees', 'GET', undefined, branch.token); assert.equal(employees.length, 1); assert.equal(employees[0].branch, 'East');
    assert.deepEqual(await api('/api/branches', 'GET', undefined, branch.token), ['East']);
    await api('/api/employees', 'POST', employee('West takeover', 'East', '2000000002'), branch.token, 403);
    await api('/api/employees/2000000002', 'DELETE', undefined, branch.token, 403);
    await api('/api/branches', 'POST', ['Other'], branch.token, 403);
    await api('/api/payments', 'POST', { id: 'west-payment', iqamaNo: '2000000002', name: 'x', branch: 'East', amount: 5, type: 'سداد', date: '2026-10-01' }, branch.token, 403);
    await api('/api/logs', 'GET', undefined, branch.token, 403);
  });
  await t.test('ledger permission and subscription expiry are enforced by server', async () => {
    await api('/api/general-ledger', 'GET', undefined, viewer.token, 403);
    await api('/api/company-settings', 'POST', { name: 'A', allowLedgerForUsers: true }, adminA);
    assert.equal((await api('/api/general-ledger', 'GET', undefined, viewer.token)).length, 1);
    await api('/api/general-ledger', 'POST', { id: 'branch-write', date: '2026-10-01', bayan: 'Forbidden', debit: 1, credit: 0 }, branch.token, 403);
    await api('/api/admin/spaces', 'POST', { action: 'edit_company', tenantId: b.tenantId, companyName: 'B', expirationDate: '2020-01-01' }, developer);
    await api('/api/employees', 'GET', undefined, adminB, 403);
    await api('/api/company-settings', 'GET', undefined, adminB);
    await api('/api/admin/spaces', 'POST', { action: 'renew_subscription', tenantId: b.tenantId }, developer);
    await api('/api/employees', 'GET', undefined, adminB);
  });
  await t.test('multi-year kafala metadata persists and invalid periods are rejected', async () => {
    const period = { fromMonth: 1, fromYear: 1447, toMonth: 6, toYear: 1448 };
    const entry = { id: 'multi-year-debt', iqamaNo: '2000000001', name: 'Worker', branch: 'East', amount: 4500, type: 'قيد مديونية: كفالة', transactionKind: 'debt', category: 'kafala', balanceIncluded: false, kafalaPeriod: period, date: '2026-10-01' };
    await api('/api/payments', 'POST', entry, adminA);
    const saved = (await api('/api/payments', 'GET', undefined, adminA)).find(payment => payment.id === entry.id);
    assert.deepEqual(saved.kafalaPeriod, period); assert.equal(saved.balanceIncluded, false); assert.equal(saved.category, 'kafala');
    assert.equal((await api('/api/employees', 'GET', undefined, adminA)).find(employee => employee.iqamaNo === entry.iqamaNo).kafalaCount, 2);
    await api('/api/payments', 'POST', { ...entry, id: 'invalid-period', kafalaPeriod: { ...period, toYear: 1446 } }, adminA, 400);
  });
  await t.test('shop statements are tenant and branch isolated, retried writes are idempotent', async () => {
    await api('/api/branches', 'POST', ['East'], adminB);
    const entry = { id: 'annual-cost', branch: 'East', date: '2026-10-01', year: 2026, kind: 'charge', amount: 500, category: 'زكاة', description: 'Annual zakat', reference: 'ZAKAT-2026', paidByCompany: true, cashAccount: 'bank' };
    await api('/api/shop-entries', 'POST', entry, adminA, 201);
    await api('/api/shop-entries', 'POST', entry, adminA);
    await api('/api/shop-entries', 'POST', { ...entry, id: 'duplicate-ref' }, adminA, 409);
    await api('/api/shop-entries', 'POST', { ...entry, id: 'annual-cost', amount: 999 }, adminA, 409);
    await api('/api/shop-entries', 'POST', { ...entry, amount: 700 }, adminB, 201);
    const aEntries = await api('/api/shop-entries', 'GET', undefined, adminA);
    const bEntries = await api('/api/shop-entries', 'GET', undefined, adminB);
    assert.equal(aEntries.length,1); assert.equal(aEntries[0].amount,500); assert.equal(bEntries[0].amount,700);
    await api('/api/shop-entries', 'POST', { ...entry, id: 'west', branch: 'West', reference: 'WEST-2026', paidByCompany: false }, adminA, 201);
    const branchRead = await login('branch-test@example.test');
    // branch account is still East at this point
    assert.equal((await api('/api/shop-entries', 'GET', undefined, branchRead.token)).length,1);
    await api('/api/shop-entries', 'POST', { ...entry, id: 'forbidden' }, branchRead.token, 403);
    await api('/api/shop-entries/annual-cost', 'DELETE', undefined, viewer.token, 403);
    await api('/api/shop-entries/not-owned', 'DELETE', undefined, adminB, 404);
    await api('/api/shop-entries', 'POST', { ...entry, id: 'unowned-branch', branch: 'Outside' }, adminA, 400);
  });
  await t.test('manual cashbook account, branch, reference and counterpart persist', async () => {
    await api('/api/branches/East', 'DELETE', undefined, adminA, 409);
    await api('/api/branches', 'POST', ['West'], adminA, 409);
    const entry = { id: 'bank-supplier', date: '2026-10-01', bayan: 'Supplier payment', debit: 50, credit: 0, branch: 'West', category: 'مورد', reference: 'PAY-2026-001', cashAccount: 'bank', counterpartAccount: 'ذمم الموردين' };
    await api('/api/general-ledger', 'POST', entry, adminA);
    const saved = (await api('/api/general-ledger', 'GET', undefined, adminA)).find(item => item.id === entry.id);
    assert.equal(saved.cashAccount,'bank'); assert.equal(saved.counterpartAccount,'ذمم الموردين'); assert.equal(saved.reference,entry.reference);
    assert.equal((await api('/api/general-ledger', 'GET', undefined, branch.token)).some(item => item.id === entry.id),false);
    await api('/api/general-ledger', 'POST', { ...entry, id: 'invalid-branch', branch: 'Outside' }, adminA, 400);
  });
  await t.test('manual non-cash metadata persists without altering its historical amounts', async () => {
    const entry = { id:'waiver-ledger', date:'2026-10-01', bayan:'Approved non-cash adjustment', debit:25, credit:0, cashEffect:'noncash' };
    await api('/api/general-ledger','POST',entry,adminA);
    const saved = (await api('/api/general-ledger','GET',undefined,adminA)).find(row=>row.id===entry.id);
    assert.equal(saved.cashEffect,'noncash'); assert.equal(saved.debit,25);
    const {cashEffect,...legacyUpdate}=entry;
    await api('/api/general-ledger','POST',legacyUpdate,adminA);
    assert.equal((await api('/api/general-ledger','GET',undefined,adminA)).find(row=>row.id===entry.id).cashEffect,'noncash');
  });
  await t.test('worker leave eligibility, exception approval, ownership and exemption accounting are enforced', async () => {
    const iqama='2000000001';
    await api(`/api/employees/${iqama}/saudi-entry`,'POST',{date:'2020-01-01'},branch.token,403);
    await api(`/api/employees/${iqama}/saudi-entry`,'POST',{date:'2020-01-01'},viewer.token,403);
    await api(`/api/employees/${iqama}/saudi-entry`,'POST',{date:'2020-02-30'},adminA,400);
    await api(`/api/employees/${iqama}/saudi-entry`,'POST',{date:'2020-01-01'},adminA);
    assert.equal((await api('/api/employees','GET',undefined,adminA)).find(e=>e.iqamaNo===iqama).saudiEntryDate,'2020-01-01');
    const months=tripHijriMonths('2022-01-01','2022-03-01');
    const leave={id:'eligible-trip',iqamaNo:iqama,departureDate:'2022-01-01',expectedReturnDate:'2022-03-01',actualReturnDate:'2022-03-01',policy:'eligible',exemptMonths:[months[1]]};
    await api('/api/worker-leaves','POST',leave,branch.token,403);
    const retries=await Promise.all([1,2].map(()=>fetch(base+'/api/worker-leaves',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+adminA},body:JSON.stringify(leave)})));
    assert.deepEqual(retries.map(response=>response.status).sort(),[200,201]);
    await api('/api/worker-leaves','POST',leave,adminA);
    assert.equal((await api('/api/worker-leaves','GET',undefined,adminB)).length,0);
    await api(`/api/employees/${iqama}/saudi-entry`,'POST',{date:'2020-01-01'},adminB);
    await api('/api/worker-leaves','POST',leave,adminB,201);
    assert.equal((await api('/api/worker-leaves','GET',undefined,branch.token)).length,1);
    await api('/api/worker-leaves/eligible-trip/return','POST',{date:'2022-03-01'},adminB,409);
    await api(`/api/employees/${iqama}/saudi-entry`,'POST',{date:'2010-01-01'},adminA,409);
    const early={id:'early-trip',iqamaNo:iqama,departureDate:'2023-12-01',expectedReturnDate:'2024-02-01',policy:'eligible',exemptMonths:[tripHijriMonths('2023-12-01','2024-02-01')[0]]};
    await api('/api/worker-leaves','POST',early,adminA,400);
    await api('/api/worker-leaves','POST',{...early,policy:'exception'},adminA,400);
    await api('/api/worker-leaves','POST',{...early,policy:'normal'},adminA,400);
    await api('/api/worker-leaves','POST',{...early,policy:'exception',exceptionReason:'Manager approved three months early',exemptMonths:['1499-01']},adminA,400);
    await api('/api/worker-leaves','POST',{...early,policy:'exception',exceptionReason:'Manager approved three months early'},adminA,201);
    await api('/api/worker-leaves/early-trip/return','POST',{date:'2024-02-01'},adminB,404);
    await api('/api/worker-leaves','POST',{...early,id:'overlap'},adminA,409);
    await api('/api/worker-leaves/early-trip/return','POST',{date:'2024-02-01'},branch.token,403);
    await api('/api/worker-leaves/early-trip/return','POST',{date:'2023-11-30'},adminA,409);
    await api('/api/worker-leaves/early-trip/return','POST',{date:'2024-02-01'},adminA);
    await api('/api/worker-leaves/early-trip/return','POST',{date:'2024-02-02'},adminA,409);
    const [fy,fm]=months[0].split('-').map(Number),[ty,tm]=months.at(-1).split('-').map(Number);
    const period={fromYear:fy,fromMonth:fm,toYear:ty,toMonth:tm};
    const debt={id:'travel-debt',iqamaNo:iqama,name:'ignored',branch:'East',amount:chargeableKafalaMonths(period,[months[1]])*250,type:'قيد مديونية: كفالة',transactionKind:'debt',category:'kafala',balanceIncluded:false,kafalaPeriod:period,date:'2022-01-01'};
    await api('/api/payments','POST',{...debt,amount:months.length*250},adminA,400);
    await api('/api/payments','POST',debt,adminA);
    const stored=(await api('/api/payments','GET',undefined,adminA)).find(row=>row.id===debt.id);
    assert.deepEqual(stored.kafalaExemptMonths,[months[1]]);
    const [ey,em]=months[1].split('-').map(Number);
    await api('/api/payments','POST',{...debt,id:'fully-free',amount:1,kafalaPeriod:{fromMonth:em,fromYear:ey,toMonth:em,toYear:ey}},adminA,400);
    await api('/api/worker-leaves/eligible-trip/cancel','POST',{reason:'Mistaken travel record'},viewer.token,403);
    await api('/api/worker-leaves/eligible-trip/cancel','POST',{reason:'Mistaken travel record'},adminA);
    assert.equal((await api('/api/worker-leaves','GET',undefined,adminA)).find(l=>l.id===leave.id).cancelled,true);
    assert.deepEqual((await api('/api/payments','GET',undefined,adminA)).find(row=>row.id===debt.id).kafalaExemptMonths,[months[1]]);
    await api('/api/payments','POST',{...debt,notes:'Annotation only'},adminA);
    assert.deepEqual((await api('/api/payments','GET',undefined,adminA)).find(row=>row.id===debt.id).kafalaExemptMonths,[months[1]]);
  });
  await t.test('payment deletion persists and does not delete same ID in another tenant', async () => {
    await api('/api/payments/shared-payment', 'DELETE', undefined, viewer.token, 403);
    await api('/api/payments/shared-payment', 'DELETE', undefined, branch.token);
    assert.equal((await api('/api/payments', 'GET', undefined, adminA)).filter(p => p.transactionKind === 'receipt').length, 0);
    assert.ok((await api('/api/payments', 'GET', undefined, adminB)).some(payment => payment.id === 'shared-payment'));
  });
  await t.test('workspace reset requires owner role and fresh password confirmation', async () => {
    const wipe = { password, confirmation: 'مسح بيانات مساحة العمل', backupConfirmed: true, targetTenantId: a.tenantId };
    await api('/api/system/wipe', 'POST', wipe, branch.token, 403);
    await api('/api/system/wipe', 'POST', wipe, viewer.token, 403);
    await api('/api/system/wipe', 'POST', { ...wipe, password: 'wrong' }, adminA, 403);
    assert.equal((await api('/api/employees', 'GET', undefined, adminA)).length, 2);
  });
  await t.test('role/status/deletion changes invalidate existing sessions', async () => {
    await api(`/api/users/${branch.uid}`, 'PUT', { role: 'viewer' }, adminA);
    await api('/api/employees', 'GET', undefined, branch.token, 401);
    await api(`/api/users/${viewer.uid}`, 'PUT', { status: 'rejected' }, adminA);
    await api('/api/employees', 'GET', undefined, viewer.token, 401);
    await api(`/api/users/${viewer.uid}`, 'DELETE', undefined, adminA);
    await api('/api/auth/me', 'GET', undefined, viewer.token, 401);
    const me = await api('/api/auth/me', 'GET', undefined, adminA);
    await api(`/api/users/${me.uid}`, 'DELETE', undefined, adminA, 403);
  });
  await t.test('default-space wipe and log reads cannot affect unrelated companies', async () => {
    await api('/api/logs', 'POST', { id: 'a-log', type: 'update', text: 'A activity', user: 'Forged author' }, adminA);
    assert.equal((await api('/api/logs', 'GET', undefined, adminA))[0].user, 'A');
    assert.equal((await api('/api/logs', 'GET', undefined, developer)).length, 0);
    await api('/api/system/wipe', 'POST', undefined, developer, 400);
    const wipe = { password, confirmation: 'مسح بيانات مساحة العمل', backupConfirmed: true, targetTenantId: '' };
    await api('/api/system/wipe', 'POST', { ...wipe, password: 'wrong' }, developer, 403);
    await api('/api/system/wipe', 'POST', { ...wipe, targetTenantId: 'another-company' }, developer, 400);
    await api('/api/system/wipe', 'POST', { ...wipe, backupConfirmed: false }, developer, 400);
    await api('/api/system/wipe', 'POST', wipe, developer);
    assert.equal((await api('/api/logs', 'GET', undefined, developer)).length, 1);
    assert.equal((await api('/api/employees', 'GET', undefined, adminA)).length, 2);
    assert.equal((await api('/api/employees', 'GET', undefined, developer)).length, 0);
    await api('/api/system/wipe','POST',{password,confirmation:'مسح بيانات مساحة العمل',backupConfirmed:true,targetTenantId:b.tenantId},adminB);
    assert.equal((await api('/api/worker-leaves','GET',undefined,adminB)).length,0);
    assert.equal((await api('/api/worker-leaves','GET',undefined,adminA)).length,2);
  });
});

test('production refuses memory fallback when PostgreSQL is unavailable', { timeout: 20000 }, async () => {
  const dbPort = await freePort(); const appPort = await freePort(); let logs = '';
  const child = spawn('node', ['dist/server.cjs'], { env: { ...process.env, NODE_ENV: 'production', ALLOW_MEMORY_FALLBACK: 'true', DB_HOST: '127.0.0.1', DB_PORT: String(dbPort), PORT: String(appPort), DB_PASSWORD: 'test', JWT_SECRET: 'test-only', DEV_EMAIL: 'operator@example.test', DEV_DEFAULT_PASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { logs += data; }); child.stderr.on('data', data => { logs += data; });
  const [code] = await once(child, 'exit'); assert.equal(code, 1); assert.match(logs, /Refusing temporary storage/);
});
