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
    env: { ...globalThis.process.env, NODE_ENV: 'production', PORT: String(appPort), DB_HOST: '127.0.0.1', DB_PORT: String(dbPort), DB_DATABASE: 'postgres', DB_USER: 'postgres', DB_PASSWORD: 'test', JWT_SECRET: 'integration-test-secret-only-0123456789', DEV_EMAIL: 'operator@example.test', DEV_DEFAULT_PASSWORD: password },
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
  await t.test('payment deletion persists and does not delete same ID in another tenant', async () => {
    await api('/api/payments/shared-payment', 'DELETE', undefined, viewer.token, 403);
    await api('/api/payments/shared-payment', 'DELETE', undefined, branch.token);
    assert.equal((await api('/api/payments', 'GET', undefined, adminA)).filter(p => p.transactionKind === 'receipt').length, 0);
    assert.equal((await api('/api/payments', 'GET', undefined, adminB)).length, 1);
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
    await api('/api/system/wipe', 'POST', undefined, developer);
    assert.equal((await api('/api/employees', 'GET', undefined, adminA)).length, 2);
    assert.equal((await api('/api/employees', 'GET', undefined, developer)).length, 0);
  });
});

test('production refuses memory fallback when PostgreSQL is unavailable', { timeout: 20000 }, async () => {
  const dbPort = await freePort(); const appPort = await freePort(); let logs = '';
  const child = spawn('node', ['dist/server.cjs'], { env: { ...process.env, NODE_ENV: 'production', ALLOW_MEMORY_FALLBACK: 'true', DB_HOST: '127.0.0.1', DB_PORT: String(dbPort), PORT: String(appPort), DB_PASSWORD: 'test', JWT_SECRET: 'test-only', DEV_EMAIL: 'operator@example.test', DEV_DEFAULT_PASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { logs += data; }); child.stderr.on('data', data => { logs += data; });
  const [code] = await once(child, 'exit'); assert.equal(code, 1); assert.match(logs, /Refusing temporary storage/);
});
