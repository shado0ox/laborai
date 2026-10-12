import { escapeHtml, printLogo } from './printSafety';

export const money = (value: number) => new Intl.NumberFormat('ar-SA-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
export async function financeFetch(url: string, options: RequestInit = {}) {
  const token = sessionStorage.getItem('authToken');
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'تعذر تنفيذ العملية. أعد المحاولة.');
  return data;
}
function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) && typeof value !== 'number') text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
export function exportCSV(filename: string, headers: string[], rows: unknown[][]) {
  const blob = new Blob(['\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a'); const url = URL.createObjectURL(blob);
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
export function printFinance(title: string, company: string, subtitle: string, headers: string[], rows: unknown[][], summary: [string, number][], logo?: string) {
  const win = window.open('', '_blank');
  if (!win) { alert('اسمح بالنوافذ المنبثقة لطباعة الكشف.'); return; }
  win.document.open();
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Tahoma,Arial,sans-serif;color:#172e45;font-size:12px}header{display:flex;justify-content:space-between;border-bottom:3px solid #176b72;padding-bottom:12px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:8px;border:1px solid #d8e1e7;text-align:right}th{background:#e8f1f3}thead{display:table-header-group}tr{break-inside:avoid}.summary{display:flex;gap:20px;flex-wrap:wrap;margin-top:18px}.controls{display:flex;gap:12px;margin:15px 0}@media print{.controls{display:none}}</style></head><body><div class="controls"><button id="print">طباعة</button><button id="close">إغلاق</button></div><header><div>${printLogo(logo)}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(company)}</p><p>${escapeHtml(subtitle)}</p></div><p>تاريخ الطباعة: ${escapeHtml(new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn').format(new Date()))}</p></header><div class="summary">${summary.map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><p>${escapeHtml(money(value))} ريال</p></div>`).join('')}</div><table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
  win.document.close();
  win.opener = null;
  win.document.getElementById('print')?.addEventListener('click', () => win.print());
  win.document.getElementById('close')?.addEventListener('click', () => win.close());
  win.print();
}
