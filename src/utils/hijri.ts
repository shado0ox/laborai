export const HIJRI_MONTH_NAMES = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة'
];

export interface HijriDate {
  y: number;
  m: number;
  d: number;
}

export function g2hObj(dt: Date): HijriDate | null {
  try {
    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = fmt.formatToParts(dt);
    const getPart = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
    const y = getPart('year');
    const m = getPart('month');
    const d = getPart('day');
    if (!isNaN(y) && y > 1300) {
      return { y, m, d };
    }
  } catch (e) {}

  try {
    const s = dt.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const latin = s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    const nums = latin.match(/\d+/g);
    if (!nums || nums.length < 3) return null;
    const sorted = nums.map(Number).sort((a, b) => b - a);
    return { y: sorted[0], m: sorted[1], d: sorted[2] };
  } catch (e2) {
    return null;
  }
}

export function g2h(gs: string): string {
  try {
    if (!gs) return '';
    const d = new Date(gs + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const o = g2hObj(d);
    return o ? `${o.y}/${String(o.m).padStart(2, '0')}/${String(o.d).padStart(2, '0')}` : '';
  } catch (e) {
    return '';
  }
}

export function h2gDate(hy: number, hm: number, hd: number): Date {
  try {
    const jd = Math.trunc((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.trunc((hm - 1) / 2) + hd + 1948440 - 385;
    let l = jd + 68569;
    const n = Math.trunc((4 * l) / 146097);
    l = l - Math.trunc((146097 * n + 3) / 4);
    const i = Math.trunc((4000 * (l + 1)) / 1461001);
    l = l - Math.trunc((1461 * i) / 4) + 31;
    const j = Math.trunc((80 * l) / 2447);
    const day = l - Math.trunc((2447 * j) / 80);
    l = Math.trunc(j / 11);
    const month = j + 2 - 12 * l;
    const year = 100 * (n - 49) + i + l;
    return new Date(year, month - 1, day);
  } catch (e) {
    return new Date();
  }
}

export function h2g(hs: string): string {
  try {
    const p = String(hs).trim().split('/');
    if (p.length < 3) return '';
    const gd = h2gDate(parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10));
    if (!gd || isNaN(gd.getTime())) return '';
    return gd.toISOString().slice(0, 10);
  } catch (e) {
    return '';
  }
}

export function hMonthDays(hy: number, hm: number): number {
  try {
    const next_m = hm + 1 > 12 ? 1 : hm + 1;
    const next_y = hm + 1 > 12 ? hy + 1 : hy;
    const s = h2gDate(hy, hm, 1);
    const e = h2gDate(next_y, next_m, 1);
    return Math.round((e.getTime() - s.getTime()) / 86400000) || 29;
  } catch (e) {
    return 29;
  }
}
