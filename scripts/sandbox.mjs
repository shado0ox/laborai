// Disposable PostgreSQL sandbox. Never reads or writes the production database.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';

const db = await PGlite.create();
const socket = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 10 });
await socket.start();
const dbPort = socket.getServerConn().split(':').at(-1);
const port = process.env.SANDBOX_PORT || '3151';
const operatorPassword = randomBytes(20).toString('hex');
const password = 'Sandbox-only-2026';
const child = spawn('node', ['dist/server.cjs'], { env: { ...process.env, NODE_ENV: 'production', BIND_HOST: '127.0.0.1', PORT: port, DB_HOST: '127.0.0.1', DB_PORT: dbPort, DB_USER: 'postgres', DB_DATABASE: 'postgres', DB_PASSWORD: 'sandbox', JWT_SECRET: randomBytes(32).toString('hex'), DEV_EMAIL: 'operator@laborai.test', DEV_DEFAULT_PASSWORD: operatorPassword }, stdio: 'inherit' });
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  child.kill(); if (child.exitCode === null && child.signalCode === null) await once(child, 'exit');
  await socket.stop();
  await new Promise(resolve => setTimeout(resolve, 100));
  await db.close();
}
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
const base = `http://127.0.0.1:${port}`;
async function api(path, body, token) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(JSON.stringify(data)); return data;
}
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error('Sandbox startup failed');
    try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Sandbox did not become ready');
  const operator = await api('/api/auth/login', { email: 'operator@laborai.test', password: operatorPassword });
  await api('/api/admin/spaces', { action: 'create_space', companyName: 'منشأة التجربة لإدارة العمالة', adminName: 'مدير التجربة', adminEmail: 'admin@laborai.test', adminPassword: password }, operator.token);
  const admin = await api('/api/auth/login', { email: 'admin@laborai.test', password });
  await api('/api/branches', ['الدمام', 'الخبر'], admin.token);
  const people = ['عامل تجريبي 1', 'عامل تجريبي 2', 'عامل تجريبي 3', 'عامل تجريبي 4'];
  for (const [index, name] of people.entries()) {
    const expiry = new Date(Date.now() + (index * 25 - 5) * 86400000).toISOString().slice(0, 10);
    await api('/api/employees', { iqamaNo: String(2000000001 + index), name, branch: index % 2 ? 'الخبر' : 'الدمام', iqamaExpiry: expiry, iqamaBalance: 3550, kafalaCount: index + 1, otherDebt: 0 }, admin.token);
  }
  await api('/api/payments', { id: 'sandbox-payment', iqamaNo: '2000000001', name: people[0], branch: 'الدمام', amount: 1500, type: 'سداد', date: new Date().toISOString().slice(0,10) }, admin.token);
  await api('/api/logs', { id: 'sandbox-log', type: 'add', text: 'بيانات تجريبية لفحص الواجهة', user: 'مدير التجربة' }, admin.token);
  console.log(`\nSandbox ready: ${base}\nLogin: admin@laborai.test\nPassword: ${password}\nAll data is disposable and removed on exit.\n`);
  await once(child, 'exit');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await stop(); }
