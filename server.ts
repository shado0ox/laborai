import { stayStatus, validISODate, saudiToday, tripHijriMonths, approvedExemptMonths, chargeableKafalaMonths } from './src/utils/workerLeave';
import type { WorkerLeave } from './src/types';
import { validHijriPeriod } from './src/utils/accounting';
import { getPaymentKind } from './src/utils/paymentKind';
import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";

// PostgreSQL DATE is a calendar date, not a timezone-dependent instant.
pg.types.setTypeParser(1082, value => value);

dotenv.config();

// Generates a strong random password/secret when no explicit value is provided via env.
// Used for first-run seeding so we never ship a guessable default credential in source code.
const generateRandomSecret = (bytes: number = 24): string => crypto.randomBytes(bytes).toString("base64url");

// Zod Validation Schemas and helper
const formatZodError = (err: any): string => {
  const fieldNames: { [key: string]: string } = {
    iqamaNo: "رقم الإقامة",
    name: "الاسم",
    employeeId: "الرقم الوظيفي",
    iqamaExpiry: "تاريخ انتهاء الإقامة",
    mobile: "رقم الجوال",
    branch: "الفرع",
    iqamaBalance: "رصيد رخصة الإقامة",
    kafalaCount: "عدد الكفالات",
    otherDebt: "ديون أخرى",
    otherDebtDesc: "تفاصيل الديون الأخرى",
    notes: "الملاحظات",
    status: "الحالة",
    archiveReason: "سبب الأرشفة",
    archiveDate: "تاريخ الأرشفة",
    addedDate: "تاريخ الإضافة",
    kafalaStartMonth: "شهر بدء الكفالة",
    kafalaStartYear: "سنة بدء الكفالة",
    
    id: "المعرّف",
    amount: "المبلغ",
    type: "نوع الدفعة",
    date: "التاريخ",
    hijriMonth: "الشهر الهجري",
    hijriYear: "السنة الهجرية",
    
    bayan: "البيان",
    debit: "مدين",
    credit: "دائن",
    createdAt: "تاريخ الإنشاء",
    
    logoBase64: "شعار الشركة",
    allowLedgerForUsers: "السماح بالدفتر العام للمستخدمين",
    
    kafala: "سعر الكفالة",
    iqama3: "رسوم الإقامة (3 أشهر)",
    iqama6: "رسوم الإقامة (6 أشهر)",
    iqama12: "رسوم الإقامة (12 شهر)",
    ramadanFree: "إعفاء رمضان",
    
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    role: "الصلاحية",
    uid: "معرف المستخدم",
    
    adminName: "اسم المدير",
    adminEmail: "البريد الإلكتروني للمدير",
    adminPassword: "كلمة مرور المدير",
    companyName: "اسم الشركة",
    action: "الإجراء",
    activationDate: "تاريخ التفعيل",
    expirationDate: "تاريخ انتهاء الاشتراك",
    supportPhone: "رقم هاتف الدعم",
    tenantId: "معرف الشركة"
  };

  // ملاحظة: في Zod v4 اسم الخاصية بقى "issues" بدل "errors" القديمة. الفحص الاحتياطي هنا
  // يمنع كراش كامل للسيرفر لو اتغيّر شكل الخطأ تاني في نسخة مستقبلية من Zod.
  const issues = err?.issues || err?.errors;
  if (!Array.isArray(issues)) {
    return "بيانات غير صالحة، يرجى التحقق من الحقول المدخلة.";
  }
  const messages = issues.map((e: any) => {
    const field = (e.path || []).join(".");
    const arabicField = fieldNames[field] || field;
    return `${arabicField}: ${e.message}`;
  });
  return messages.join(" | ");
};

const numericSchema = (fieldName: string) => 
  z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : Number(val)), 
    z.number()
      .refine(v => !isNaN(v), { message: `يجب أن يكون ${fieldName} رقماً صالحاً` })
      .refine(v => v >= 0, { message: `قيمة ${fieldName} لا يمكن أن تكون سالبة` })
  );

const positiveNumericSchema = (fieldName: string) => 
  z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : Number(val)), 
    z.number()
      .refine(v => !isNaN(v), { message: `يجب أن يكون ${fieldName} رقماً صالحاً` })
      .refine(v => v > 0, { message: `قيمة ${fieldName} يجب أن تكون أكبر من الصفر` })
  );

const dateSchema = (fieldName: string) => 
  z.string()
    .refine(val => val && !isNaN(Date.parse(val)), { message: `تاريخ ${fieldName} غير صالح` });

const optionalDateSchema = (fieldName: string) => 
  z.string()
    .optional()
    .nullable()
    .refine(val => { 
      if (!val) return true; 
      return !isNaN(Date.parse(val)); 
    }, { message: `تاريخ ${fieldName} غير صالح` });

const integerSchema = (fieldName: string, min?: number, max?: number) => 
  z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : Number(val)), 
    z.number()
      .refine(v => !isNaN(v), { message: `يجب أن يكون ${fieldName} عدداً صالحاً` })
      .refine(v => min === undefined || v >= min, { message: `قيمة ${fieldName} يجب أن تكون على الأقل ${min}` })
      .refine(v => max === undefined || v <= max, { message: `قيمة ${fieldName} يجب أن لا تتجاوز ${max}` })
      .optional()
      .nullable()
  );

const loginSchema = z.object({
  email: z.string()
    .email("البريد الإلكتروني المدخل غير صالح")
    .trim(),
  password: z.string()
    .min(1, "كلمة المرور لا يمكن أن تكون فارغة"),
});

const userPostSchema = z.object({
  uid: z.string().min(1, "معرف المستخدم مطلوب"),
  name: z.string().min(1, "الاسم مطلوب"),
  email: z.string().email("البريد الإلكتروني غير صالح").trim(),
  role: z.enum(["admin", "branch", "viewer"]),
  branch: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});

const userPutSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  role: z.enum(["admin", "branch", "viewer"]).optional(),
  branch: z.string().nullable().optional(),
});

const employeeSchema = z.object({
  iqamaNo: z.string().min(1, "رقم الإقامة مطلوب"),
  name: z.string().min(1, "اسم الموظف مطلوب"),
  employeeId: z.string().optional().nullable(),
  iqamaExpiry: dateSchema("انتهاء الإقامة"),
  mobile: z.string().optional().nullable(),
  branch: z.string().min(1, "الفرع مطلوب"),
  iqamaBalance: numericSchema("رصيد رخصة الإقامة"),
  kafalaCount: numericSchema("عدد الكفالات").refine(value => Number.isInteger(value), "عدد الكفالات يجب أن يكون عدداً صحيحاً"),
  otherDebt: numericSchema("الديون الأخرى"),
  otherDebtDesc: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["active", "archived"]).optional().default("active"),
  archiveReason: z.string().optional().nullable(),
  archiveDate: optionalDateSchema("الأرشفة"),
  addedDate: optionalDateSchema("الإضافة"),
  // ملاحظة: هذان الحقلان نصّيان مقصودًا — الفرونت إند يرسل اسم شهر هجري بالعربي
  // (مثل "شعبان") وسنة هجرية كنص (مثل "1447")، وليسا رقمين ميلاديين.
  kafalaStartMonth: z.string().optional().nullable(),
  kafalaStartYear: z.string().optional().nullable(),
});

const hijriPeriodSchema = z.object({
  fromMonth: z.number().int().min(1).max(12), fromYear: z.number().int().min(1300).max(1700),
  toMonth: z.number().int().min(1).max(12), toYear: z.number().int().min(1300).max(1700),
  freeFromMonth: z.number().int().min(1).max(12).optional(), freeFromYear: z.number().int().min(1300).max(1700).optional(),
  freeToMonth: z.number().int().min(1).max(12).optional(), freeToYear: z.number().int().min(1300).max(1700).optional()
}).refine(validHijriPeriod, { message: "فترة الكفالة غير صحيحة أو فترة الإعفاء خارجها." });

const paymentSchema = z.object({
  kafalaExemptMonths: z.array(z.string().regex(/^1[3-6][0-9]{2}-(0[1-9]|1[0-2])$/)).max(120).optional(),
  category: z.enum(["kafala", "iqama", "insurance", "other"]).optional(),
  balanceIncluded: z.boolean().optional(),
  kafalaPeriod: hijriPeriodSchema.optional(),
  cashAccount: z.enum(["cash", "bank"]).optional(),
  transactionKind: z.enum(["receipt", "debt", "discount", "settlement"]).optional(),
  id: z.string().min(1, "معرف الدفعة مطلوب"),
  iqamaNo: z.string().min(1, "رقم الإقامة مطلوب"),
  name: z.string().min(1, "الاسم مطلوب"),
  branch: z.string().min(1, "الفرع مطلوب"),
  amount: positiveNumericSchema("المبلغ"),
  type: z.string().min(1, "نوع الدفعة مطلوب"),
  date: dateSchema("الدفعة"),
  notes: z.string().optional().nullable(),
  hijriMonth: z.string().optional().nullable(),
  hijriYear: z.string().optional().nullable(),
});

const generalLedgerSchema = z.object({
  cashEffect: z.enum(["cash", "noncash"]).optional(),
  branch: z.string().max(150).optional(), category: z.string().max(150).optional(), reference: z.string().max(100).optional(),
  cashAccount: z.enum(["cash", "bank"]).optional(), counterpartAccount: z.string().max(150).optional(),
  id: z.string().min(1, "المعرف مطلوب"),
  date: dateSchema("القيد"),
  bayan: z.string().min(1, "البيان مطلوب"),
  debit: numericSchema("مدين"),
  credit: numericSchema("دائن"),
  createdAt: optionalDateSchema("الإنشاء"),
}).refine(entry => (entry.debit > 0) !== (entry.credit > 0), { message: "أدخل مبلغاً في المدين أو الدائن فقط." });

const companySettingsSchema = z.object({
  name: z.string().min(1, "اسم الشركة مطلوب"),
  logoBase64: z.string().optional().nullable(),
  allowLedgerForUsers: z.boolean().optional().default(false),
});

const pricingSettingsSchema = z.object({
  kafala: numericSchema("سعر الكفالة"),
  iqama3: numericSchema("رسوم الإقامة (3 أشهر)"),
  iqama6: numericSchema("رسوم الإقامة (6 أشهر)"),
  iqama12: numericSchema("رسوم الإقامة (12 شهر)"),
  ramadanFree: z.boolean().optional().default(true),
});

const singleBranchSchema = z.object({
  name: z.string().min(1, "اسم الفرع مطلوب"),
});

const branchPostSchema = z.union([
  z.array(
    z.union([
      z.string().min(1, "اسم الفرع مطلوب"),
      singleBranchSchema
    ])
  ),
  singleBranchSchema
]);

const activityLogSchema = z.object({
  id: z.string().min(1, "المعرف مطلوب"),
  type: z.string().min(1, "النوع مطلوب"),
  text: z.string().min(1, "نص السجل مطلوب"),
  user: z.string().min(1, "اسم المستخدم مطلوب"),
  time: optionalDateSchema("الوقت"),
});

const adminSpacesSchema = z.object({
  action: z.enum(["edit_company", "renew_subscription", "create_space", "add_user_to_company"]).optional(),
  tenantId: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  activationDate: optionalDateSchema("التفعيل"),
  expirationDate: optionalDateSchema("انتهاء الاشتراك"),
  supportPhone: z.string().optional().nullable(),
  adminName: z.string().optional().nullable(),
  adminEmail: z.string().optional().nullable(),
  adminPassword: z.string().optional().nullable(),
});

// SECURITY: no hardcoded fallback secret. The server refuses to boot without a real JWT_SECRET,
// exactly like the DB_PASSWORD check below. Generate one with: openssl rand -base64 48
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("\n\x1b[31m==========================================================================\x1b[0m");
  console.error("\x1b[31mخطأ حرج: لم يتم تحديد متغير البيئة JWT_SECRET (مفتاح تشفير الجلسات).\x1b[0m");
  console.error("\x1b[31mيرجى تحديد JWT_SECRET في ملف .env (مفتاح عشوائي طويل) لكي يتمكن الخادم من بدء التشغيل.\x1b[0m");
  console.error("\x1b[31mيمكنك توليد مفتاح قوي عبر الأمر: openssl rand -base64 48\x1b[0m");
  console.error("\x1b[31m==========================================================================\n\x1b[0m");
  process.exit(1);
}

// SECURITY: the "developer / super-admin" account is identified by an email configured via
// env, never hardcoded in source. This must match the account seeded in initializeTables().
const DEV_EMAIL = (process.env.DEV_EMAIL || "").trim().toLowerCase();
if (!DEV_EMAIL) {
  console.error("\n\x1b[31m==========================================================================\x1b[0m");
  console.error("\x1b[31mخطأ حرج: لم يتم تحديد متغير البيئة DEV_EMAIL (بريد المطور/المشغّل الرئيسي).\x1b[0m");
  console.error("\x1b[31mيرجى تحديد DEV_EMAIL في ملف .env لكي يتمكن الخادم من بدء التشغيل.\x1b[0m");
  console.error("\x1b[31m==========================================================================\n\x1b[0m");
  process.exit(1);
}
const isDevEmail = (email: any): boolean => typeof email === "string" && email.trim().toLowerCase() === DEV_EMAIL;

// SECURITY: never ship guessable default credentials (e.g. "admin" / "123") in source code.
// If an operator doesn't supply these via .env, we generate strong random ones at boot and
// print them ONCE to the server console so whoever started the server can log in and should
// change the password immediately afterwards.
const DEV_DEFAULT_PASSWORD_FROM_ENV = process.env.DEV_DEFAULT_PASSWORD;
const DEV_DEFAULT_PASSWORD = DEV_DEFAULT_PASSWORD_FROM_ENV || generateRandomSecret(12);
const DEMO_JEDDAH_PASSWORD = generateRandomSecret(9);
const DEMO_VIEWER_PASSWORD = generateRandomSecret(9);

if (!DEV_DEFAULT_PASSWORD_FROM_ENV) {
  console.log("\n\x1b[33m==========================================================================\x1b[0m");
  console.log(`\x1b[33mلم يتم تحديد DEV_DEFAULT_PASSWORD في .env — تم توليد كلمة مرور عشوائية لحساب المطور (${DEV_EMAIL}) عند أول إنشاء له فقط:\x1b[0m`);
  console.log(`\x1b[33m${DEV_DEFAULT_PASSWORD}\x1b[0m`);
  console.log("\x1b[33mاحتفظ بها الآن وغيّرها فوراً بعد أول تسجيل دخول. لن تُطبع مرة أخرى.\x1b[0m");
  console.log("\x1b[33m==========================================================================\n\x1b[0m");
}

const requireAuth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "يرجى تسجيل الدخول أولاً." });
  let decoded: any;
  try {
    decoded = jwt.verify(authHeader.slice(7), JWT_SECRET as string, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ error: "جلسة الدخول منتهية أو غير صالحة. يرجى تسجيل الدخول مجدداً." });
  }
  try {
    const user = pool
      ? (await runQuery("SELECT * FROM users WHERE uid = ?", [decoded.uid]))[0]
      : fallbackUsers.find(u => u.uid === decoded.uid);
    if (!user || user.status !== "approved" || user.email !== decoded.email ||
        user.role !== decoded.role || (user.tenant_id || user.tenantId || "") !== (decoded.tenantId || "")) {
      return res.status(401).json({ error: "تغيّرت صلاحيات الحساب أو حالته. يرجى تسجيل الدخول مجدداً." });
    }
    req.user = { uid: user.uid, name: user.name, email: user.email, role: user.role,
      branch: user.branch, tenantId: user.tenant_id || user.tenantId || "" };
    if (!isDevEmail(user.email)) {
      const company = pool
        ? (await runQuery("SELECT * FROM company_settings WHERE tenant_id = ?", [req.user.tenantId]))[0]
        : fallbackCompany.get(req.user.tenantId);
      req.company = company;
      const expiry = company?.expiration_date || company?.expirationDate;
      if (expiry && expiry < new Date().toISOString().slice(0, 10) && req.path !== "/api/company-settings" && req.path !== "/api/auth/me") {
        return res.status(403).json({ error: "انتهى اشتراك المنشأة. تواصل مع الإدارة لتجديده." });
      }
    }
    next();
  } catch (err) { return sendServerError(res, err); }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "هذا الإجراء متاح لمدير الشركة فقط." });
  next();
};

const requireLedger = (req: any, res: any, next: any) => {
  if (req.user.role !== "admin" && !(req.company?.allow_ledger_for_users || req.company?.allowLedgerForUsers)) {
    return res.status(403).json({ error: "لم يسمح مدير الشركة بالوصول إلى الدفتر العام." });
  }
  next();
};

const inBranch = (req: any, branch: string) => req.user.role !== "branch" || (!!req.user.branch && req.user.branch === branch);

async function findEmployee(tenantId: string, iqamaNo: string) {
  return pool ? (await runQuery("SELECT * FROM employees WHERE COALESCE(tenant_id, '') = ? AND iqama_no = ?", [tenantId, iqamaNo]))[0]
    : fallbackEmployees.find(e => (e.tenantId || "") === tenantId && e.iqamaNo === iqamaNo);
}

const requireDev = (req: any, res: any, next: any) => {
  if (!req.user || !isDevEmail(req.user.email)) {
    return res.status(403).json({ error: "غير مسموح بالوصول إلا لمطور النظام الرئيسي." });
  }
  next();
};

const getTenantId = (req: any): string => {
  if (req.user && isDevEmail(req.user.email)) {
    return (typeof req.query.tenantId === "string" ? req.query.tenantId : "") || req.user.tenantId || "";
  }
  return req.user ? (req.user.tenantId || "") : "";
};

// SECURITY: don't leak internal error details (stack traces, SQL errors, file paths, driver
// messages) to API clients. Log the full error server-side and return a generic Arabic
// message; in development, still surface err.message to make debugging easier locally.
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const sendServerError = (res: any, err: any, context?: string) => {
  console.error(`[ERROR]${context ? " " + context : ""}:`, err);
  const message = IS_PRODUCTION
    ? "حدث خطأ غير متوقع في الخادم. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني."
    : (err?.message || "حدث خطأ غير متوقع في الخادم.");
  res.status(500).json({ error: message });
};

const { Pool } = pg;
const app = express();

// السيرفر شغال خلف بروكسي عكسي (cloudflared / Cloudflare Tunnel)، فلازم نثق في هيدر
// X-Forwarded-For القادم منه عشان express-rate-limit يقدر يميّز عناوين IP الحقيقية للعملاء
// بدل ما يرميهم كلهم في سلة واحدة أو يرمي استثناء يوقف السيرفر بالكامل.
// القيمة "1" تعني: نثق في أول بروكسي بس (cloudflared نفسه)، مش أي بروكسي إضافي وراه.
app.set('trust proxy', 1);
let databaseReady = false;
const allowMemoryFallback = process.env.NODE_ENV !== "production" && process.env.ALLOW_MEMORY_FALLBACK === "true";
const PORT = parseInt(process.env.PORT || "3000");

// Security headers
app.use(helmet({
  // The app serves its own HTML/JS via Vite/static build, so we keep CSP relaxed to avoid
  // breaking the SPA bundle rather than shipping a broken app; tighten this once asset
  // hashes/nonces are wired up in the build.
  contentSecurityPolicy: false,
}));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

// General API rate limiting to slow down abuse/scraping
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "عدد كبير جداً من الطلبات من هذا العنوان. حاول مرة أخرى بعد قليل." },
});
app.use("/api", apiLimiter);
app.get("/api/health", async (_req, res) => {
  let ready = databaseReady;
  if (ready && pool) {
    try { await pool.query("SELECT 1"); dbStatus = "connected"; }
    catch { ready = false; dbStatus = "disconnected"; }
  }
  res.status(ready ? 200 : 503).json({ ready, storage: pool ? "postgres" : "memory" });
});
app.use("/api", (_req, res, next) => {
  if (!databaseReady || (!pool && !allowMemoryFallback)) return res.status(503).json({ error: "قاعدة البيانات غير متاحة. لم يتم حفظ أي تغييرات؛ حاول لاحقاً." });
  next();
});
app.get("/api/auth/me", requireAuth, (req: any, res) => res.json({ ...req.user, isDeveloper: isDevEmail(req.user.email) }));

// Strict rate limiting on login and self-registration to block brute-force/spam
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "عدد كبير جداً من محاولات الدخول. حاول مرة أخرى بعد 15 دقيقة." },
  skipSuccessfulRequests: true,
});

// Database credentials
const rawDbHost = (process.env.DB_HOST || "127.0.0.1").trim();
let cleanedDbHost = rawDbHost;
let detectedPort: number | null = null;

if (rawDbHost.toLowerCase().startsWith("http://") || rawDbHost.toLowerCase().startsWith("https://")) {
  try {
    const url = new URL(rawDbHost);
    cleanedDbHost = url.hostname;
    if (url.port) {
      detectedPort = parseInt(url.port);
    }
  } catch (e) {
    let temp = rawDbHost.replace(/^(https?:\/\/)/i, "").split("/")[0];
    const parts = temp.split(":");
    cleanedDbHost = parts[0];
    if (parts[1]) {
      detectedPort = parseInt(parts[1]);
    }
  }
} else {
  const parts = rawDbHost.split("/");
  const hostAndPort = parts[0];
  const hpParts = hostAndPort.split(":");
  cleanedDbHost = hpParts[0];
  if (hpParts[1]) {
    detectedPort = parseInt(hpParts[1]);
  }
}

const DB_HOST = cleanedDbHost;
const DB_PORT = detectedPort || parseInt(process.env.DB_PORT || "5432");
const DB_USER = process.env.DB_USER || "labor_admin";
const DB_PASSWORD = process.env.DB_PASSWORD;
if (!DB_PASSWORD) {
  console.error("\n\x1b[31m==========================================================================\x1b[0m");
  console.error("\x1b[31mخطأ حرج: لم يتم تحديد متغير البيئة DB_PASSWORD (كلمة مرور قاعدة البيانات).\x1b[0m");
  console.error("\x1b[31mيرجى تحديد DB_PASSWORD في ملف .env لكي يتمكن الخادم من بدء التشغيل.\x1b[0m");
  console.error("\x1b[31m==========================================================================\n\x1b[0m");
  process.exit(1);
}
const DB_DATABASE = process.env.DB_DATABASE || "labor_management_db";

let pool: pg.Pool | null = null;
let dbStatus: "connected" | "disconnected" = "disconnected";
let dbError: string | null = null;

// Connect to PostgreSQL with retry logic
async function connectDB() {
  let attempts = 3;
  let lastError = "";
  
  if (pool) {
    try {
      await pool.end();
    } catch (e) {}
    pool = null;
  }

  while (attempts > 0) {
    try {
      console.log(`Connecting to PostgreSQL database at ${DB_HOST}:${DB_PORT}...`);
      pool = new Pool({
        max: 5,
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_DATABASE,
        connectionTimeoutMillis: 2000,
      });
      
      pool.on("error", (error) => { dbStatus = "disconnected"; dbError = error.message; console.error("PostgreSQL pool error:", error.message); });
      // Test connection
      const client = await pool.connect();
      console.log("✓ Successfully connected to PostgreSQL database!");
      dbStatus = "connected";
      dbError = null;
      client.release();
      break;
    } catch (err: any) {
      console.log(`[DB INFO] Database connection status: offline (${err.message}). Retrying in 1.5 seconds...`);
      lastError = err.message || String(err);
      dbStatus = "disconnected";
      dbError = lastError;
      if (pool) {
        try {
          await pool.end();
        } catch (e) {}
      }
      pool = null;
      attempts--;
      if (attempts > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  if (!pool && allowMemoryFallback) {
    console.warn("⚠️ Warning: Could not connect to the PostgreSQL server. Falling back to dynamic mock state in-memory.");
    console.warn("⚠️ تنبيه: كل البيانات في هذا الوضع مؤقتة في الذاكرة فقط وستُفقد عند إعادة تشغيل الخادم — لا تستخدم هذا الوضع لتخزين بيانات حقيقية.");
    console.log("\x1b[33mبيانات دخول تجريبية (وضع الذاكرة المؤقت فقط):\x1b[0m");
    console.log(`\x1b[33m  jeddah.branch@company.com / ${DEMO_JEDDAH_PASSWORD}\x1b[0m`);
    console.log(`\x1b[33m  viewer@company.com / ${DEMO_VIEWER_PASSWORD}\x1b[0m`);
    dbStatus = "disconnected";
    dbError = (lastError || "Failed to connect to PostgreSQL database after multiple attempts");
  }
}

// SECURITY/SAFETY: these auto-migrations DROP TABLE ... CASCADE on old schemas, which
// permanently deletes real data if this ever runs against a production database that hasn't
// been backed up. They now only run when the operator explicitly opts in via .env — otherwise
// we log a clear warning and skip the destructive step so the app keeps working on the old
// schema until someone consciously runs the migration.
const ALLOW_DESTRUCTIVE_SCHEMA_MIGRATION = (process.env.ALLOW_DESTRUCTIVE_SCHEMA_MIGRATION || "").toLowerCase() === "true";

const dropTableIfAllowed = async (client: any, tableName: string): Promise<boolean> => {
  if (!ALLOW_DESTRUCTIVE_SCHEMA_MIGRATION) {
    console.warn(`[MIGRATION] ⚠️ تم اكتشاف جدول "${tableName}" بهيكل قديم لكن الحذف التلقائي معطّل (ALLOW_DESTRUCTIVE_SCHEMA_MIGRATION != true). خذ نسخة احتياطية ثم فعّل المتغير مؤقتاً لتنفيذ الترقية.`);
    return false;
  }
  await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
  return true;
};

// Auto-migration helper to setup tables in PostgreSQL
async function initializeTables() {
  if (!pool) return;
  const client = await pool.connect();
  try {

    console.log("[MIGRATION] Verifying and applying automated schema structure migrations...");

    // 1. Branches migration: If old branches table has 'id' column, drop and recreate
    try {
      const checkCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'id'");
      if (checkCol.rowCount > 0) {
        console.log("[MIGRATION] Old branches table structure detected. Migrating to composite primary key structure...");
        await dropTableIfAllowed(client, "branches");
      }
    } catch (e: any) {
      console.warn("[MIGRATION] Branches table check warning:", e.message);
    }

    // 2. Employees migration: If old employees table has 'id' column, alter it safely
    try {
      const checkEmpCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'id'");
      if (checkEmpCol.rowCount > 0) {
        console.log("[MIGRATION] Old employees table structure detected. Upgrading to primary key (iqama_no)...");
        try {
          await client.query("ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_iqama_no_fkey");
        } catch(e){}
        try {
          await client.query("ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_pkey");
        } catch(e){}
        try {
          await client.query("ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_iqama_no_key");
        } catch(e){}
        try {
          await client.query("ALTER TABLE employees DROP COLUMN IF EXISTS id");
        } catch(e){}
        try {
          await client.query("ALTER TABLE employees ADD PRIMARY KEY (iqama_no)");
        } catch(e){}
      }
    } catch (e: any) {
      console.warn("[MIGRATION] Employees table migration warning:", e.message);
    }

    // 3. Payments migration: If 'id' is integer (old schema), drop and recreate
    try {
      const checkPmtCol = await client.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'id'");
      if (checkPmtCol.rowCount > 0 && checkPmtCol.rows[0].data_type !== 'character varying') {
        console.log("[MIGRATION] Old payments table structure detected. Upgrading payments table...");
        await dropTableIfAllowed(client, "payments");
      }
    } catch (e: any) {
      console.warn("[MIGRATION] Payments table check warning:", e.message);
    }

    // 4. Pricing settings migration: If 'id' column exists, drop and recreate
    try {
      const checkPrcCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'pricing_settings' AND column_name = 'id'");
      if (checkPrcCol.rowCount > 0) {
        console.log("[MIGRATION] Old pricing_settings table structure detected. Upgrading to tenant-based primary key...");
        await dropTableIfAllowed(client, "pricing_settings");
      }
    } catch (e: any) {
      console.warn("[MIGRATION] Pricing settings check warning:", e.message);
    }

    // 5. Company settings migration: If 'id' column exists, drop and recreate
    try {
      const checkCmpCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'id'");
      if (checkCmpCol.rowCount > 0) {
        console.log("[MIGRATION] Old company_settings table structure detected. Upgrading to tenant-based primary key...");
        await dropTableIfAllowed(client, "company_settings");
      }
    } catch (e: any) {
      console.warn("[MIGRATION] Company settings check warning:", e.message);
    }

    // 6. Activity logs migration: If 'id' is integer (old schema), drop and recreate
    try {
      const checkLogCol = await client.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'id'");
      if (checkLogCol.rowCount > 0 && checkLogCol.rows[0].data_type !== 'character varying') {
        console.log("[MIGRATION] Old activity_logs table structure detected. Upgrading activity_logs...");
        await dropTableIfAllowed(client, "activity_logs");
      }
    } catch (e: any) {
      console.warn("[MIGRATION] Activity logs check warning:", e.message);
    }
    
    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid VARCHAR(128) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'viewer',
        branch VARCHAR(150),
        status VARCHAR(50) DEFAULT 'approved',
        tenant_id VARCHAR(128),
        password VARCHAR(255),
        created_at VARCHAR(100)
      );
    `);

    // 2. Employees table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        iqama_no VARCHAR(15) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        employee_id VARCHAR(50),
        iqama_expiry DATE NOT NULL,
        mobile VARCHAR(20),
        branch VARCHAR(150) NOT NULL,
        iqama_balance DECIMAL(10, 2) DEFAULT 0.00,
        kafala_count INT DEFAULT 0,
        other_debt DECIMAL(10, 2) DEFAULT 0.00,
        other_debt_desc TEXT,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'active',
        archive_reason VARCHAR(255),
        archive_date VARCHAR(100),
        added_date VARCHAR(100),
        kafala_start_month VARCHAR(50),
        kafala_start_year VARCHAR(10),
        tenant_id VARCHAR(128)
      );
    `);

    // 3. Payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(128) PRIMARY KEY,
        iqama_no VARCHAR(15) NOT NULL,
        name VARCHAR(255) NOT NULL,
        branch VARCHAR(150) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        type VARCHAR(150) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        hijri_month VARCHAR(50),
        hijri_year VARCHAR(10),
        tenant_id VARCHAR(128)
      );
    `);

    await client.query(`ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS transaction_kind VARCHAR(20),
      ADD COLUMN IF NOT EXISTS category VARCHAR(20),
      ADD COLUMN IF NOT EXISTS balance_included BOOLEAN,
      ADD COLUMN IF NOT EXISTS kafala_period JSONB,
      ADD COLUMN IF NOT EXISTS cash_account VARCHAR(10)`);

    // 4. Pricing Settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pricing_settings (
        tenant_id VARCHAR(128) PRIMARY KEY,
        kafala DECIMAL(10, 2) NOT NULL DEFAULT 250.00,
        iqama_3 DECIMAL(10, 2) NOT NULL DEFAULT 3550.00,
        iqama_6 DECIMAL(10, 2) NOT NULL DEFAULT 7100.00,
        iqama_12 DECIMAL(10, 2) NOT NULL DEFAULT 14200.00,
        ramadan_free BOOLEAN DEFAULT TRUE
      );
    `);

    // 5. Company Settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        tenant_id VARCHAR(128) PRIMARY KEY,
        name VARCHAR(255) NOT NULL DEFAULT 'برنامج إدارة العمالة المهنية',
        logo_base64 TEXT,
        allow_ledger_for_users BOOLEAN DEFAULT FALSE,
        activation_date VARCHAR(100),
        expiration_date VARCHAR(100),
        support_phone VARCHAR(100)
      );
    `);

    // Migration: ensure the columns exist
    try {
      await client.query(`
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS allow_ledger_for_users BOOLEAN DEFAULT FALSE;
      `);
      await client.query(`
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS activation_date VARCHAR(100);
      `);
      await client.query(`
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS expiration_date VARCHAR(100);
      `);
      await client.query(`
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS support_phone VARCHAR(100);
      `);
    } catch (e: any) {
      console.warn("[MIGRATION] company_settings subscription columns already exist or warning:", e.message);
    }

    // 6. Activity Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(128) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        text TEXT NOT NULL,
        "user" VARCHAR(255) NOT NULL,
        time VARCHAR(100),
        tenant_id VARCHAR(128)
      );
    `);

    // 7. Branches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS branches (
        name VARCHAR(150) NOT NULL,
        tenant_id VARCHAR(128) NOT NULL DEFAULT '',
        PRIMARY KEY (name, tenant_id)
      );
    `);

    // 8. General Ledger table
    await client.query(`
      CREATE TABLE IF NOT EXISTS general_ledger (
        id VARCHAR(128) PRIMARY KEY,
        date DATE NOT NULL,
        bayan TEXT NOT NULL,
        debit DECIMAL(12, 2) DEFAULT 0.00,
        credit DECIMAL(12, 2) DEFAULT 0.00,
        tenant_id VARCHAR(128),
        created_at VARCHAR(100)
      );
    `);

    await client.query(`ALTER TABLE general_ledger
      ADD COLUMN IF NOT EXISTS branch VARCHAR(150), ADD COLUMN IF NOT EXISTS category VARCHAR(150),
      ADD COLUMN IF NOT EXISTS reference VARCHAR(100), ADD COLUMN IF NOT EXISTS cash_account VARCHAR(10),
      ADD COLUMN IF NOT EXISTS counterpart_account VARCHAR(150), ADD COLUMN IF NOT EXISTS cash_effect VARCHAR(10)`);
    await client.query(`CREATE TABLE IF NOT EXISTS shop_entries (
      tenant_id VARCHAR(128) NOT NULL DEFAULT '', id VARCHAR(128) NOT NULL,
      branch VARCHAR(150) NOT NULL, date DATE NOT NULL, year INTEGER NOT NULL,
      kind VARCHAR(20) NOT NULL, amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      category VARCHAR(150) NOT NULL, description TEXT NOT NULL, reference VARCHAR(100),
      responsible VARCHAR(255), notes TEXT, paid_by_company BOOLEAN NOT NULL DEFAULT FALSE,
      cash_account VARCHAR(10) NOT NULL DEFAULT 'cash', created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (tenant_id, id)
    )`);

    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS shop_reference_unique ON shop_entries (tenant_id, branch, reference) WHERE reference IS NOT NULL AND reference <> ''");

    await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS saudi_entry_date DATE');
    await client.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS kafala_exempt_months JSONB');
    await client.query(`CREATE TABLE IF NOT EXISTS worker_leaves (
      tenant_id VARCHAR(128) NOT NULL DEFAULT '', id VARCHAR(128) NOT NULL, iqama_no VARCHAR(15) NOT NULL,
      departure_date DATE NOT NULL, expected_return_date DATE NOT NULL, actual_return_date DATE,
      policy VARCHAR(20) NOT NULL, exempt_months JSONB NOT NULL DEFAULT '[]', exception_reason TEXT,
      cancelled BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), approved_by VARCHAR(128) NOT NULL,
      PRIMARY KEY (tenant_id,id)
    )`);

    // Non-destructive upgrade: tenant + record ID is the ownership boundary.
    await client.query("BEGIN");
    try {
      await client.query("ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_iqama_no_fkey");
      for (const [table, key] of [["employees", "iqama_no"], ["payments", "id"], ["general_ledger", "id"]]) {
        const pk = await client.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'p'", [table]);
        if (!pk.rows[0]?.definition.includes("tenant_id")) {
          await client.query(`UPDATE ${table} SET tenant_id = '' WHERE tenant_id IS NULL`);
          await client.query(`ALTER TABLE ${table} ALTER COLUMN tenant_id SET DEFAULT '', ALTER COLUMN tenant_id SET NOT NULL`);
          await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_pkey`);
          if (table === "employees") await client.query("ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_iqama_no_key");
          await client.query(`ALTER TABLE ${table} ADD PRIMARY KEY (tenant_id, ${key})`);
        }
      }
      await client.query("CREATE UNIQUE INDEX IF NOT EXISTS users_normalized_email ON users (LOWER(TRIM(email)))");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='worker_leaves'::regclass AND conname='worker_leaves_employee_fk') THEN
        ALTER TABLE worker_leaves ADD CONSTRAINT worker_leaves_employee_fk FOREIGN KEY (tenant_id,iqama_no) REFERENCES employees(tenant_id,iqama_no) ON DELETE CASCADE;
      END IF;
    END $$`);
    await client.query('CREATE INDEX IF NOT EXISTS worker_leaves_employee_date ON worker_leaves (tenant_id,iqama_no,departure_date)');

    // Ensure Developer Account exists in the users table
    const devCheck = await client.query("SELECT * FROM users WHERE email = $1", [DEV_EMAIL]);
    if (devCheck.rowCount === 0) {
      await client.query(`
        INSERT INTO users (uid, name, email, role, branch, status, tenant_id, password, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        "user-admin",
        "شادي ناصف",
        DEV_EMAIL,
        "admin",
        null,
        "approved",
        "",
        bcrypt.hashSync(DEV_DEFAULT_PASSWORD, 10),
        "2026-01-01T08:00:00.000Z"
      ]);
      console.log(`✓ Developer main account '${DEV_EMAIL}' successfully seeded.`);
    }

    console.log("✓ All PostgreSQL database tables verified and initialized successfully.");
  } catch (err: any) {
    console.error("Database migration error during initialization:", err);
    throw err;
  } finally { client.release(); }
}

// In-Memory fallback databases
let fallbackUsers: any[] = [
  {
    uid: "user-admin",
    name: "شادي ناصف",
    email: DEV_EMAIL,
    role: "admin",
    createdAt: "2026-01-01T08:00:00.000Z",
    password: bcrypt.hashSync(DEV_DEFAULT_PASSWORD, 10),
    status: "approved",
  },
  {
    uid: "user-jeddah",
    name: "أحمد الغامدي",
    email: "jeddah.branch@company.com",
    role: "branch",
    branch: "فرع جدة الغربية",
    createdAt: "2026-02-15T09:30:00.000Z",
    password: bcrypt.hashSync(DEMO_JEDDAH_PASSWORD, 10),
    status: "approved",
  },
  {
    uid: "user-viewer",
    name: "سلطان المقرن",
    email: "viewer@company.com",
    role: "viewer",
    createdAt: "2026-03-10T11:00:00.000Z",
    password: bcrypt.hashSync(DEMO_VIEWER_PASSWORD, 10),
    status: "approved",
  }
];
let fallbackEmployees: any[] = [];
let fallbackPayments: any[] = [];
let fallbackLogs: any[] = [
  {
    id: "log-initial",
    type: "update",
    text: "تم تهيئة النظام وبدء قاعدة بيانات عمالة جديدة فارغة.",
    user: "النظام",
    time: "2026-06-21 00:00:00",
  }
];
let fallbackBranches: Map<string, string[]> = new Map([
  ["", ["فرع الرياض الأساسي", "فرع جدة الغربية", "فرع الدمام الشرقية", "فرع مكة المكرمة"]]
]);
let fallbackCompany: Map<string, any> = new Map([
  ["", { name: "برنامج إدارة العمالة المهنية" }]
]);
let fallbackPricing: Map<string, any> = new Map([
  ["", { kafala: 250, iqama3: 3550, iqama6: 7100, iqama12: 14200, ramadanFree: true }]
]);
let fallbackGeneralLedger: any[] = [];
let fallbackShopEntries: any[] = [];
let fallbackWorkerLeaves: any[] = [];


// --- API ROUTES ---

// Helper function to safe run SQL queries in PostgreSQL
async function runQuery(sql: string, params: any[] = []): Promise<any> {
  if (pool) {
    let index = 1;
    let pgSql = sql;
    
    // Replace mysql style '?' placeholders with postgres style '$1', '$2', etc.
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${index++}`);
    }
    
    // Slice params to match actual placeholders count
    const placeholderCount = index - 1;
    const slicedParams = params.slice(0, placeholderCount);
    
    const result = await pool.query(pgSql, slicedParams);
    return result.rows;
  }
  throw new Error("Database unavailable");
}

// DB Status diagnostic
app.get("/api/db-status", requireAuth, requireDev, async (req: any, res: any) => {
  res.json({
    status: dbStatus,
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    database: DB_DATABASE,
    error: dbError,
  });
});

// Auth and Session management APIs
app.post("/api/auth/login", authLimiter, async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const { email, password } = parseResult.data;
  const normEmail = email.trim().toLowerCase();
  try {
    let user: any = null;
    if (pool) {
      const rows = await runQuery("SELECT * FROM users WHERE LOWER(TRIM(email)) = ?", [normEmail]);
      if (rows && rows.length > 0) {
        user = rows[0];
      }
    } else {
      user = fallbackUsers.find(u => u.email.trim().toLowerCase() === normEmail);
    }

    if (!user) {
      return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
    }

    const isBcrypt = user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$"));
    if (!isBcrypt) {
      // SECURITY: no plaintext password comparison anymore. An account still holding a
      // plaintext password must be migrated (npm run migrate) or reset before it can log in.
      console.warn(`[AUTH] رفض تسجيل دخول لحساب بكلمة مرور غير مشفّرة: ${user.email}. يجب تشغيل "npm run migrate" أو إعادة تعيين كلمة المرور.`);
      return res.status(401).json({ error: "حسابك يحتاج إلى إعادة تعيين كلمة المرور قبل تسجيل الدخول. تواصل مع مدير النظام." });
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: "حسابك قيد المراجعة وبانتظار موافقة مدير البرنامج لتفعيله." });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({ error: "تم رفض طلب تسجيلك في البوابة. تواصل مع الإدارة للدعم." });
    }

    // Generate token
    const token = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id || user.tenantId || "",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userProfile = {
      uid: user.uid,
      name: user.name,
      email: user.email,
      isDeveloper: isDevEmail(user.email),
      role: user.role,
      branch: user.branch || undefined,
      status: user.status,
      tenantId: user.tenant_id || user.tenantId || undefined,
      createdAt: user.created_at || user.createdAt,
    };

    return res.json({ success: true, token, user: userProfile });
  } catch (err: any) {
    return sendServerError(res, err);
  }
});

// Admin-level diagnostic repair
app.post("/api/admin/repair-db", requireAuth, requireDev, async (req, res) => {
  try {
    await initializeTables();
    res.json({ success: true });
  } catch (err: any) {
    sendServerError(res, err);
  }
});

// 1. Users API
app.get("/api/users", requireAuth, async (req: any, res: any) => {
  try {
    const isDev = req.user && req.user.email === DEV_EMAIL;
    const isAdmin = req.user && req.user.role === "admin";

    if (!isDev && !isAdmin) {
      return res.status(403).json({ error: "غير مسموح بالوصول إلا لمسؤولي النظام أو مطور البرنامج." });
    }

    const callerTenantId = req.user.tenantId || "";

    if (pool) {
      let rows = await runQuery("SELECT * FROM users ORDER BY name ASC");
      
      // Filter by tenant if NOT main developer
      if (!isDev) {
        rows = rows.filter((r: any) => {
          const uTenant = r.tenant_id || "";
          return uTenant === callerTenantId;
        });
      }

      const mapped = rows.map((r: any) => ({
        uid: r.uid,
        isDeveloper: isDevEmail(r.email),
        name: r.name,
        email: r.email,
        role: r.role,
        branch: r.branch || undefined,
        status: r.status,
        tenantId: r.tenant_id || undefined,
        createdAt: r.created_at,
      }));
      return res.json(mapped);
    }

    // Fallback in-memory
    let filteredFallback = fallbackUsers;
    if (!isDev) {
      filteredFallback = fallbackUsers.filter((u: any) => {
        const uTenant = u.tenantId || "";
        return uTenant === callerTenantId;
      });
    }

    const mappedFallback = filteredFallback.map((u: any) => ({
      uid: u.uid,
      isDeveloper: isDevEmail(u.email),
      name: u.name,
      email: u.email,
      role: u.role,
      branch: u.branch || undefined,
      status: u.status,
      tenantId: u.tenantId || undefined,
      createdAt: u.createdAt,
    }));
    return res.json(mappedFallback);
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.post("/api/users", authLimiter, async (req: any, res: any) => {
  if (req.headers.authorization) {
    return requireAuth(req, res, () => requireAdmin(req, res, () => createUser(req, res)));
  }
  return createUser(req, res);
});

async function createUser(req: any, res: any) {
  const parsed = userPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: formatZodError(parsed.error) });
  const u = parsed.data;
  const email = u.email.trim().toLowerCase();
  if (isDevEmail(email)) return res.status(403).json({ error: "لا يمكن تسجيل حساب المطور الرئيسي." });
  if (!u.password || u.password.length < 8 || Buffer.byteLength(u.password, "utf8") > 72 || /^\$2[aby]\$/.test(u.password)) {
    return res.status(400).json({ error: "أدخل كلمة مرور من 8 أحرف على الأقل وبحد أقصى 72 بايت." });
  }
  if (!req.user && u.role !== "admin") return res.status(403).json({ error: "إضافة أعضاء الشركة متاحة لمديرها فقط." });
  const tenantId = req.user ? req.user.tenantId : `tenant_${crypto.randomUUID()}`;
  const branch = req.user && u.role === "branch" ? u.branch : null;
  try {
    if (u.role === "branch") {
      const branches = pool ? (await runQuery("SELECT name FROM branches WHERE tenant_id = ?", [tenantId])).map((b: any) => b.name) : fallbackBranches.get(tenantId) || [];
      if (!branch || !branches.includes(branch)) return res.status(400).json({ error: "اختر فرعاً موجوداً في الشركة." });
    }
    const exists = pool ? (await runQuery("SELECT uid FROM users WHERE LOWER(TRIM(email)) = ?", [email])).length > 0
      : fallbackUsers.some(user => user.email.trim().toLowerCase() === email);
    if (exists) return res.status(409).json({ error: "البريد الإلكتروني مسجّل بالفعل." });
    const password = await bcrypt.hash(u.password, 10);
    const user = { uid: `user_${crypto.randomUUID()}`, name: u.name, email, role: u.role,
      branch, status: req.user ? "approved" : "pending", tenantId, createdAt: new Date().toISOString() };
    if (pool) {
      await runQuery("INSERT INTO users (uid, name, email, role, branch, status, tenant_id, password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [user.uid, user.name, email, user.role, branch, user.status, tenantId || null, password, user.createdAt]);
    } else fallbackUsers.push({ ...user, password });
    return res.status(201).json({ success: true, user });
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "البريد الإلكتروني مسجّل بالفعل." });
    return sendServerError(res, err);
  }
}

app.put("/api/users/:uid", requireAuth, requireAdmin, async (req: any, res: any) => {
  const { uid } = req.params;
  const parseResult = userPutSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const updates = parseResult.data;
  if (uid === req.user.uid && ((updates.role && updates.role !== "admin") || (updates.status && updates.status !== "approved"))) return res.status(403).json({ error: "لا يمكنك تعطيل حسابك أو خفض صلاحياته." });
  const callerEmail = req.user?.email || "";
  const callerIsDev = isDevEmail(callerEmail);
  const callerTenantId = req.user?.tenantId || "";
  try {
    if (pool) {
      const dbUsers: any = await runQuery("SELECT email, tenant_id, status FROM users WHERE uid = ?", [uid]);
      const isDev = (dbUsers && dbUsers.length > 0 && dbUsers[0].email === DEV_EMAIL) || uid === "user-admin";

      if (!dbUsers.length) return res.status(404).json({ error: "المستخدم غير موجود." });
      if (!callerIsDev && dbUsers[0].status === "pending") return res.status(403).json({ error: "اعتماد التسجيل متاح لمطور النظام فقط." });
      if (updates.role === "branch" || updates.branch) {
        const branch = updates.branch;
        const owned = branch && await runQuery("SELECT name FROM branches WHERE tenant_id = ? AND name = ?", [dbUsers[0].tenant_id || "", branch]);
        if (!owned?.length) return res.status(400).json({ error: "اختر فرعاً موجوداً في الشركة." });
      }
      // SECURITY: مدير الشركة لا يجوز أن يعدّل صلاحيات أو فروع مستخدمين من مساحة/شركة أخرى.
      if (!callerIsDev && dbUsers && dbUsers.length > 0 && (dbUsers[0].tenant_id || "") !== callerTenantId) {
        return res.status(403).json({ error: "لا تملك صلاحية تعديل مستخدم خارج نطاق مساحتك (شركتك) الخاصة." });
      }

      if (isDev) {
        if (callerEmail !== DEV_EMAIL) {
          return res.status(403).json({ error: "لا يمكن تعديل حساب المطور الرئيسي إلا للمطور نفسه!" });
        }
        if (updates.status && updates.status !== "approved") {
          return res.status(403).json({ error: "لا يمكن تعديل حالة حساب المطور الرئيسي!" });
        }
        if (updates.role && updates.role !== "admin") {
          return res.status(403).json({ error: "لا يمكن تغيير رتبة حساب المطور الرئيسي!" });
        }
      }

      const fields = [];
      const values = [];
      let index = 1;
      for (const [k, v] of Object.entries(updates)) {
        if (k === "status") { fields.push(`status = $${index++}`); values.push(v); }
        if (k === "role") { fields.push(`role = $${index++}`); values.push(v); }
        if (k === "branch") { fields.push(`branch = $${index++}`); values.push(v || null); }
      }
      if (fields.length > 0) {
        values.push(uid);
        const queryStr = `UPDATE users SET ${fields.join(", ")} WHERE uid = $${index}`;
        await pool.query(queryStr, values);
      }
      return res.json({ success: true });
    } else {
      const targetUser = fallbackUsers.find((u) => u.uid === uid);
      if (!targetUser) return res.status(404).json({ error: "المستخدم غير موجود." });
      if (req.method === "PUT") {
        if (!callerIsDev && targetUser.status === "pending") return res.status(403).json({ error: "اعتماد التسجيل متاح لمطور النظام فقط." });
        const updates = req.body;
        if ((updates.role === "branch" || updates.branch) && !(fallbackBranches.get(targetUser.tenantId || "") || []).includes(updates.branch)) return res.status(400).json({ error: "اختر فرعاً موجوداً في الشركة." });
      }
      const isDev = (targetUser && targetUser.email === DEV_EMAIL) || uid === "user-admin";

      if (!callerIsDev && targetUser && (targetUser.tenantId || "") !== callerTenantId) {
        return res.status(403).json({ error: "لا تملك صلاحية تعديل مستخدم خارج نطاق مساحتك (شركتك) الخاصة." });
      }

      if (isDev) {
        if (callerEmail !== DEV_EMAIL) {
          return res.status(403).json({ error: "لا يمكن تعديل حساب المطور الرئيسي إلا للمطور نفسه!" });
        }
        if (updates.status && updates.status !== "approved") {
          return res.status(403).json({ error: "لا يمكن تعديل حالة حساب المطور الرئيسي!" });
        }
        if (updates.role && updates.role !== "admin") {
          return res.status(403).json({ error: "لا يمكن تغيير رتبة حساب المطور الرئيسي!" });
        }
      }
      fallbackUsers = fallbackUsers.map((u) => {
        if (u.uid === uid) {
          return { ...u, ...updates };
        }
        return u;
      });
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.delete("/api/users/:uid", requireAuth, requireAdmin, async (req: any, res: any) => {
  const { uid } = req.params;
  if (uid === req.user.uid) return res.status(403).json({ error: "لا يمكنك حذف حسابك الحالي." });
  const callerIsDev = isDevEmail(req.user?.email || "");
  const callerTenantId = req.user?.tenantId || "";
  try {
    if (pool) {
      const dbUsers: any = await runQuery("SELECT email, tenant_id, status FROM users WHERE uid = ?", [uid]);
      const isDev = (dbUsers && dbUsers.length > 0 && dbUsers[0].email === DEV_EMAIL) || uid === "user-admin";
      if (isDev) {
        return res.status(403).json({ error: "لا يمكن حذف حساب مطور البرنامج الرئيسي نهائياً!" });
      }
      if (!callerIsDev && dbUsers && dbUsers.length > 0 && (dbUsers[0].tenant_id || "") !== callerTenantId) {
        return res.status(403).json({ error: "لا تملك صلاحية حذف مستخدم خارج نطاق مساحتك (شركتك) الخاصة." });
      }
      await runQuery("DELETE FROM users WHERE uid = ?", [uid]);
      return res.json({ success: true });
    } else {
      const targetUser = fallbackUsers.find((u) => u.uid === uid);
      if (!targetUser) return res.status(404).json({ error: "المستخدم غير موجود." });
      if (req.method === "PUT") {
        if (!callerIsDev && targetUser.status === "pending") return res.status(403).json({ error: "اعتماد التسجيل متاح لمطور النظام فقط." });
        const updates = req.body;
        if ((updates.role === "branch" || updates.branch) && !(fallbackBranches.get(targetUser.tenantId || "") || []).includes(updates.branch)) return res.status(400).json({ error: "اختر فرعاً موجوداً في الشركة." });
      }
      const isDev = (targetUser && targetUser.email === DEV_EMAIL) || uid === "user-admin";
      if (isDev) {
        return res.status(403).json({ error: "لا يمكن حذف حساب مطور البرنامج الرئيسي نهائياً!" });
      }
      if (!callerIsDev && targetUser && (targetUser.tenantId || "") !== callerTenantId) {
        return res.status(403).json({ error: "لا تملك صلاحية حذف مستخدم خارج نطاق مساحتك (شركتك) الخاصة." });
      }
      fallbackUsers = fallbackUsers.filter((u) => u.uid !== uid);
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});


// 2. Employees API
app.get("/api/employees", requireAuth, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      let rows: any;
      if (tenantId) {
        rows = await runQuery("SELECT * FROM employees WHERE tenant_id = ? ORDER BY name ASC", [tenantId]);
      } else {
        rows = await runQuery("SELECT * FROM employees WHERE tenant_id IS NULL OR tenant_id = '' ORDER BY name ASC");
      }
      const mapped = rows.map((r: any) => ({
        iqamaNo: r.iqama_no,
        name: r.name,
        employeeId: r.employee_id || undefined,
        saudiEntryDate: r.saudi_entry_date || undefined,
        iqamaExpiry: r.iqama_expiry ? String(r.iqama_expiry).slice(0, 10) : "",
        mobile: r.mobile || "",
        branch: r.branch,
        iqamaBalance: Number(r.iqama_balance || 0),
        kafalaCount: Number(r.kafala_count || 0),
        otherDebt: Number(r.other_debt || 0),
        otherDebtDesc: r.other_debt_desc || "",
        notes: r.notes || "",
        status: r.status,
        archiveReason: r.archive_reason || "",
        archiveDate: r.archive_date || "",
        addedDate: r.added_date,
        kafalaStartMonth: r.kafala_start_month || undefined,
        kafalaStartYear: r.kafala_start_year || undefined,
      }));
      return res.json(mapped.filter((row: any) => inBranch(req, row.branch)));
    }
    const filtered = fallbackEmployees.filter((e) => (tenantId ? e.tenantId === tenantId : !e.tenantId));
    return res.json(filtered.filter((row: any) => inBranch(req, row.branch)));
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.post("/api/employees", requireAuth, async (req: any, res: any) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: "لا تملك صلاحية تعديل أو إضافة موظفين." });
  }
  const parseResult = employeeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const e = parseResult.data;
  const tenantId = getTenantId(req);
  try {
    const existing = await findEmployee(tenantId, e.iqamaNo);
    if (!inBranch(req, e.branch) || (existing && !inBranch(req, existing.branch))) return res.status(403).json({ error: "الموظف خارج نطاق فرعك." });
    if (pool) {
      // Cleaned PostgreSQL upsert
      const saved = await runQuery(
        `INSERT INTO employees (
          iqama_no, name, employee_id, iqama_expiry, mobile, branch, iqama_balance, 
          kafala_count, other_debt, other_debt_desc, notes, status, archive_reason, 
          archive_date, added_date, kafala_start_month, kafala_start_year, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (tenant_id, iqama_no) DO UPDATE SET
          name=EXCLUDED.name, employee_id=EXCLUDED.employee_id, iqama_expiry=EXCLUDED.iqama_expiry, 
          mobile=EXCLUDED.mobile, branch=EXCLUDED.branch, iqama_balance=EXCLUDED.iqama_balance,
          kafala_count=EXCLUDED.kafala_count, other_debt=EXCLUDED.other_debt, 
          other_debt_desc=EXCLUDED.other_debt_desc, notes=EXCLUDED.notes, status=EXCLUDED.status, 
          archive_reason=EXCLUDED.archive_reason, archive_date=EXCLUDED.archive_date, 
          added_date=EXCLUDED.added_date, kafala_start_month=EXCLUDED.kafala_start_month, 
          kafala_start_year=EXCLUDED.kafala_start_year
          WHERE (? = 'admin' OR employees.branch = ?) RETURNING iqama_no`,
        [
          e.iqamaNo,
          e.name,
          e.employeeId || null,
          e.iqamaExpiry,
          e.mobile || null,
          e.branch,
          e.iqamaBalance || 0.00,
          e.kafalaCount || 0,
          e.otherDebt || 0.00,
          e.otherDebtDesc || null,
          e.notes || null,
          e.status || "active",
          e.archiveReason || null,
          e.archiveDate || null,
          e.addedDate || new Date().toISOString(),
          e.kafalaStartMonth || null,
          e.kafalaStartYear || null,
          tenantId, req.user.role, req.user.branch || ""
        ]
      );
      if (!saved.length) return res.status(403).json({ error: "الموظف خارج نطاق فرعك." });
      return res.json({ success: true, employee: e });
    } else {
      const fullEmp = { ...e, saudiEntryDate: existing?.saudiEntryDate, tenantId };
      const existingIdx = fallbackEmployees.findIndex((item) => item.iqamaNo === e.iqamaNo && (item.tenantId || "") === tenantId);
      if (existingIdx !== -1) {
        fallbackEmployees[existingIdx] = fullEmp;
      } else {
        fallbackEmployees.unshift(fullEmp);
      }
      return res.json({ success: true, employee: fullEmp });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.delete("/api/employees/:iqamaNo", requireAuth, async (req: any, res: any) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: "لا تملك صلاحية حذف الموظفين." });
  }
  const { iqamaNo } = req.params;
  const tenantId = getTenantId(req);
  try {
    const employee = await findEmployee(tenantId, iqamaNo);
    if (!employee) return res.status(404).json({ error: "الموظف غير موجود." });
    if (!inBranch(req, employee.branch)) return res.status(403).json({ error: "الموظف خارج نطاق فرعك." });
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM worker_leaves WHERE iqama_no = $1 AND tenant_id = $2", [iqamaNo, tenantId]);
        await client.query("DELETE FROM payments WHERE iqama_no = $1 AND tenant_id = $2", [iqamaNo, tenantId]);
        await client.query("DELETE FROM employees WHERE iqama_no = $1 AND tenant_id = $2", [iqamaNo, tenantId]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
      return res.json({ success: true });
    } else {
      fallbackEmployees = fallbackEmployees.filter((e) => !(e.iqamaNo === iqamaNo && e.tenantId === tenantId));
      fallbackPayments = fallbackPayments.filter((p) => !(p.iqamaNo === iqamaNo && p.tenantId === tenantId));
      fallbackWorkerLeaves = fallbackWorkerLeaves.filter(l=>!(l.iqamaNo===iqamaNo && l.tenantId===tenantId));
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});


// Worker travel and discretionary kafala exemption policy (not an immigration permission service).
const leaveDate = z.string().refine(validISODate, 'اختر تاريخًا ميلاديًا صحيحًا.');
const leaveSchema = z.object({ id:z.string().min(1).max(128), iqamaNo:z.string().min(1), departureDate:leaveDate,
  expectedReturnDate:leaveDate, actualReturnDate:leaveDate.optional(), policy:z.enum(['normal','eligible','exception']),
  exemptMonths:z.array(z.string().regex(/^1[3-6][0-9]{2}-(0[1-9]|1[0-2])$/)).max(120), exceptionReason:z.string().max(2000).optional() });
const mapLeave = (row:any):WorkerLeave => ({id:row.id,iqamaNo:row.iqama_no,departureDate:row.departure_date,
  expectedReturnDate:row.expected_return_date,actualReturnDate:row.actual_return_date || undefined,policy:row.policy,
  exemptMonths:row.exempt_months || [],exceptionReason:row.exception_reason || '',cancelled:row.cancelled,createdAt:row.created_at,approvedBy:row.approved_by});
async function loadWorkerLeaves(tenantId:string,iqamaNo?:string,client?:any):Promise<WorkerLeave[]> {
  if(!pool) return fallbackWorkerLeaves.filter(l=>l.tenantId===tenantId && (!iqamaNo || l.iqamaNo===iqamaNo));
  const sql='SELECT * FROM worker_leaves WHERE tenant_id=$1'+(iqamaNo?' AND iqama_no=$2':'')+' ORDER BY departure_date,id';
  const result=await (client || pool).query(sql,iqamaNo?[tenantId,iqamaNo]:[tenantId]);
  return result.rows.map(mapLeave);
}
async function leaveAudit(req:any,tenantId:string,text:string,client?:any) {
  const log={id:crypto.randomUUID(),type:'update',text,user:req.user.name,time:new Date().toISOString(),tenantId};
  if(pool) await (client || pool).query('INSERT INTO activity_logs (id,type,text,"user",time,tenant_id) VALUES ($1,$2,$3,$4,$5,$6)',[log.id,log.type,log.text,log.user,log.time,tenantId]);
  else fallbackLogs.unshift(log);
}
app.get('/api/worker-leaves',requireAuth,async(req:any,res)=>{
  try {
    const tenantId=getTenantId(req),leaves=await loadWorkerLeaves(tenantId);
    if(req.user.role!=='branch') return res.json(leaves);
    const workers=pool?(await runQuery('SELECT iqama_no FROM employees WHERE tenant_id=? AND branch=?',[tenantId,req.user.branch])).map((e:any)=>e.iqama_no):fallbackEmployees.filter(e=>e.tenantId===tenantId && e.branch===req.user.branch).map(e=>e.iqamaNo);
    return res.json(leaves.filter(l=>workers.includes(l.iqamaNo)));
  } catch(error){sendServerError(res,error);}
});
app.post('/api/employees/:iqamaNo/saudi-entry',requireAuth,requireAdmin,async(req:any,res)=>{
  const parsed=z.object({date:leaveDate}).safeParse(req.body);
  if(!parsed.success || parsed.data.date>saudiToday()) return res.status(400).json({error:'اختر تاريخ دخول فعليًا لا يتجاوز اليوم.'});
  const tenantId=getTenantId(req); let client:any;
  try {
    const employee=await findEmployee(tenantId,req.params.iqamaNo);
    if(!employee || !inBranch(req,employee.branch)) return res.status(404).json({error:'العامل غير موجود في نطاقك.'});
    if(pool){client=await pool.connect();await client.query('BEGIN');await client.query('SELECT iqama_no FROM employees WHERE tenant_id=$1 AND iqama_no=$2 FOR UPDATE',[tenantId,req.params.iqamaNo]);}
    if((await loadWorkerLeaves(tenantId,req.params.iqamaNo,client)).some(l=>!l.cancelled)) {if(client)await client.query('ROLLBACK');return res.status(409).json({error:'لا يمكن تغيير تاريخ الأساس بعد تسجيل إجازات معتمدة. راجع السجل أولًا.'});}
    if(client)await client.query('UPDATE employees SET saudi_entry_date=$1 WHERE tenant_id=$2 AND iqama_no=$3',[parsed.data.date,tenantId,req.params.iqamaNo]);
    else employee.saudiEntryDate=parsed.data.date;
    await leaveAudit(req,tenantId,`تحديد بداية متابعة الإجازة للعامل ${req.params.iqamaNo}: ${parsed.data.date}`,client);
    if(client)await client.query('COMMIT');return res.json({success:true});
  } catch(error){if(client)await client.query('ROLLBACK');sendServerError(res,error);}finally{client?.release();}
});
app.post('/api/worker-leaves',requireAuth,requireAdmin,async(req:any,res)=>{
  const parsed=leaveSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:formatZodError(parsed.error)});
  const entry=parsed.data,tenantId=getTenantId(req);let client:any;
  const reject=async(message:string,status=400)=>{if(client)await client.query('ROLLBACK');return res.status(status).json({error:message});};
  try {
    const employee=await findEmployee(tenantId,entry.iqamaNo);
    if(!employee || !inBranch(req,employee.branch))return res.status(404).json({error:'العامل غير موجود في نطاقك.'});
    if(pool){client=await pool.connect();await client.query('BEGIN');const locked=await client.query('SELECT * FROM employees WHERE tenant_id=$1 AND iqama_no=$2 FOR UPDATE',[tenantId,entry.iqamaNo]);if(!locked.rows.length)return await reject('العامل غير موجود.',404);employee.saudi_entry_date=locked.rows[0].saudi_entry_date;}
    const all=await loadWorkerLeaves(tenantId,undefined,client),sameId=all.find(l=>l.id===entry.id);
    if(sameId) {
      const same=sameId.iqamaNo===entry.iqamaNo && sameId.departureDate===entry.departureDate && sameId.expectedReturnDate===entry.expectedReturnDate && (sameId.actualReturnDate||'')===(entry.actualReturnDate||'') && sameId.policy===entry.policy && JSON.stringify([...sameId.exemptMonths].sort())===JSON.stringify([...new Set(entry.exemptMonths)].sort()) && (sameId.exceptionReason||'')===(entry.exceptionReason||'') && !sameId.cancelled;
      if(!same)return await reject('معرف الإجازة مستخدم بالفعل.',409);if(client)await client.query('COMMIT');return res.json({success:true,leave:sameId});
    }
    if(employee.status==='archived')return await reject('العامل مؤرشف؛ لا يمكن اعتماد إجازة جديدة له.',409);
    const own=all.filter(l=>l.iqamaNo===entry.iqamaNo && !l.cancelled);
    const baseline=employee.saudi_entry_date || employee.saudiEntryDate;
    if(!baseline)return await reject('حدد تاريخ أول دخول أو آخر عودة قبل تسجيل الإجازة.');
    if(own.some(l=>!l.actualReturnDate))return await reject('توجد إجازة مخططة أو سفر لم تسجل عودته بعد.',409);
    const latest=own.map(l=>l.actualReturnDate!).sort().at(-1) || baseline;
    if(entry.departureDate<latest || entry.expectedReturnDate<entry.departureDate || (entry.actualReturnDate && (entry.actualReturnDate<entry.departureDate || entry.actualReturnDate>saudiToday())))return await reject('راجع ترتيب تواريخ الدخول والسفر والعودة؛ العودة الفعلية لا تتجاوز اليوم.');
    const status=stayStatus({iqamaNo:entry.iqamaNo,saudiEntryDate:baseline},own,entry.departureDate);
    if(entry.policy==='eligible' && !status.eligible)return await reject(`لم يكمل العامل سنتين. موعد الاستحقاق ${status.due}. استخدم استثناءً مسببًا عند الموافقة المبكرة.`);
    if(entry.policy==='exception' && (!entry.exceptionReason || entry.exceptionReason.trim().length<5))return await reject('اكتب سبب الموافقة الاستثنائية قبل السنتين.');
    const allowed=tripHijriMonths(entry.departureDate,entry.actualReturnDate || entry.expectedReturnDate);
    if(!allowed.length || entry.exemptMonths.some(month=>!allowed.includes(month)))return await reject('الأشهر المعفاة يجب أن تتداخل مع فترة السفر المحددة.');
    if(entry.policy!=='normal' && !entry.exemptMonths.length)return await reject('حدد الأشهر المعفاة يدويًا أو اختر كفالة عادية.');
    if(entry.policy==='normal' && entry.exemptMonths.length)return await reject('الإجازة بالكفالة العادية لا تسمح بأشهر معفاة.');
    const saved={...entry,exemptMonths:[...new Set(entry.exemptMonths)].sort(),cancelled:false,approvedBy:req.user.uid,createdAt:new Date().toISOString()};
    if(client)await client.query('INSERT INTO worker_leaves (tenant_id,id,iqama_no,departure_date,expected_return_date,actual_return_date,policy,exempt_months,exception_reason,approved_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[tenantId,saved.id,saved.iqamaNo,saved.departureDate,saved.expectedReturnDate,saved.actualReturnDate||null,saved.policy,JSON.stringify(saved.exemptMonths),saved.exceptionReason||null,req.user.uid]);
    else fallbackWorkerLeaves.push({...saved,tenantId});
    await leaveAudit(req,tenantId,`تسجيل إجازة ${entry.id} للعامل ${entry.iqamaNo}؛ السياسة ${entry.policy}؛ الأشهر المعفاة ${saved.exemptMonths.join(', ') || 'لا يوجد'}؛ ${entry.exceptionReason || ''}`,client);
    if(client)await client.query('COMMIT');return res.status(201).json({success:true,leave:saved});
  } catch(error){if(client)await client.query('ROLLBACK');sendServerError(res,error);}finally{client?.release();}
});
app.post('/api/worker-leaves/:id/:action',requireAuth,requireAdmin,async(req:any,res)=>{
  const tenantId=getTenantId(req),action=req.params.action;if(!['return','cancel'].includes(action))return res.status(404).json({error:'الإجراء غير موجود.'});
  let client:any;
  try {
    const leave=(await loadWorkerLeaves(tenantId)).find(l=>l.id===req.params.id);if(!leave)return res.status(404).json({error:'الإجازة غير موجودة في شركتك.'});
    const employee=await findEmployee(tenantId,leave.iqamaNo);if(!employee || !inBranch(req,employee.branch))return res.status(404).json({error:'العامل غير موجود.'});
    if(pool){client=await pool.connect();await client.query('BEGIN');await client.query('SELECT iqama_no FROM employees WHERE tenant_id=$1 AND iqama_no=$2 FOR UPDATE',[tenantId,leave.iqamaNo]);}
    const fresh=(await loadWorkerLeaves(tenantId,leave.iqamaNo,client)).find(l=>l.id===leave.id)!;
    if(action==='return') {
      const date=req.body?.date;
      if(fresh.cancelled || !date || !validISODate(date) || date<fresh.departureDate || date>saudiToday() || fresh.actualReturnDate){if(client)await client.query('ROLLBACK');return res.status(409).json({error:'راجع تاريخ العودة؛ لا يمكن تعديل إجازة ملغاة أو عودة سبق تسجيلها.'});}
      if(client)await client.query('UPDATE worker_leaves SET actual_return_date=$1 WHERE tenant_id=$2 AND id=$3',[date,tenantId,leave.id]);
      else Object.assign(fallbackWorkerLeaves.find(l=>l.tenantId===tenantId&&l.id===leave.id),{actualReturnDate:date});
    } else {
      if(typeof req.body?.reason!=='string' || req.body.reason.trim().length<5 || req.body.reason.length>2000){if(client)await client.query('ROLLBACK');return res.status(400).json({error:'اكتب سبب إلغاء الإجازة. الإلغاء لا يعدّل قيودًا مالية سابقة.'});}
      if(client)await client.query('UPDATE worker_leaves SET cancelled=TRUE WHERE tenant_id=$1 AND id=$2',[tenantId,leave.id]);
      else Object.assign(fallbackWorkerLeaves.find(l=>l.tenantId===tenantId&&l.id===leave.id),{cancelled:true});
    }
    await leaveAudit(req,tenantId,`${action==='return'?'تسجيل العودة':'إلغاء الإجازة'} ${leave.id}: ${req.body?.date || req.body?.reason}`,client);
    if(client)await client.query('COMMIT');return res.json({success:true});
  }catch(error){if(client)await client.query('ROLLBACK');sendServerError(res,error);}finally{client?.release();}
});

// 3. Payments API
app.get("/api/payments", requireAuth, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      let rows: any;
      if (tenantId) {
        rows = await runQuery("SELECT * FROM payments WHERE tenant_id = ? ORDER BY date DESC, id DESC", [tenantId]);
      } else {
        rows = await runQuery("SELECT * FROM payments WHERE tenant_id IS NULL OR tenant_id = '' ORDER BY date DESC, id DESC");
      }
      const mapped = rows.map((r: any) => ({
        id: r.id,
        iqamaNo: r.iqama_no,
        name: r.name,
        branch: r.branch,
        amount: Number(r.amount || 0),
        type: r.type,
        transactionKind: getPaymentKind({ type: r.type, transactionKind: r.transaction_kind }),
        category: r.category || undefined, balanceIncluded: r.balance_included ?? true,
        kafalaExemptMonths: r.kafala_exempt_months || [], kafalaPeriod: r.kafala_period || undefined, cashAccount: r.cash_account || undefined,
        date: r.date ? String(r.date).slice(0, 10) : "",
        notes: r.notes || undefined,
        hijriMonth: r.hijri_month || undefined,
        hijriYear: r.hijri_year || undefined,
      }));
      return res.json(mapped.filter((row: any) => inBranch(req, row.branch)));
    }
    const filtered = fallbackPayments.filter((p) => (tenantId ? p.tenantId === tenantId : !p.tenantId));
    return res.json(filtered.filter((row: any) => inBranch(req, row.branch)));
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.post("/api/payments", requireAuth, async (req: any, res: any) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: "لا تملك صلاحية إضافة مدفوعات." });
  }
  const parseResult = paymentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const p = { ...parseResult.data, transactionKind: getPaymentKind(parseResult.data) };
  const tenantId = getTenantId(req);
  try {
    const employee = await findEmployee(tenantId, p.iqamaNo);
    if (!employee) return res.status(404).json({ error: "الموظف غير موجود في الشركة." });
    if (!inBranch(req, employee.branch)) return res.status(403).json({ error: "الموظف خارج نطاق فرعك." });
    const existing = pool ? (await runQuery("SELECT * FROM payments WHERE tenant_id = ? AND id = ?", [tenantId, p.id]))[0]
      : fallbackPayments.find(item => item.id === p.id && (item.tenantId || "") === tenantId);
    if (existing && !inBranch(req, existing.branch)) return res.status(403).json({ error: "الدفعة خارج نطاق فرعك." });
    if (existing && (existing.iqama_no || existing.iqamaNo) !== p.iqamaNo) return res.status(409).json({ error: "لا يمكن نقل الدفعة إلى موظف آخر." });
    p.kafalaExemptMonths=existing?.kafala_exempt_months || existing?.kafalaExemptMonths || [];
    if(!existing && (p.category==='kafala' || p.type.includes('كفالة')) && p.kafalaPeriod) {
      const approved=approvedExemptMonths(await loadWorkerLeaves(tenantId,p.iqamaNo),p.iqamaNo,p.kafalaPeriod);
      p.kafalaExemptMonths=approved;
      if(approved.length && p.transactionKind==='debt') {
        const settings=pool?(await runQuery('SELECT kafala FROM pricing_settings WHERE tenant_id=?',[tenantId]))[0]:fallbackPricing.get(tenantId);
        const maximum=chargeableKafalaMonths(p.kafalaPeriod,approved)*Number(settings?.kafala ?? 250);
        if(p.amount>maximum+0.005)return res.status(400).json({error:'المبلغ يتجاوز المستحق بعد أشهر الإجازة المعفاة. حدّث الفترة والمبلغ؛ الفترة المعفاة بالكامل لا تحتاج قيد مديونية.'});
      }
    }
    p.branch = employee.branch;
    p.name = employee.name;
    if (pool) {
      // Cleaned PostgreSQL upsert
      const saved = await runQuery(
        `INSERT INTO payments (id, iqama_no, name, branch, amount, type, date, notes, hijri_month, hijri_year, tenant_id, transaction_kind, category, balance_included, kafala_period, cash_account, kafala_exempt_months)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (tenant_id, id) DO UPDATE SET
           name=EXCLUDED.name, branch=EXCLUDED.branch, amount=EXCLUDED.amount, type=EXCLUDED.type, 
           date=EXCLUDED.date, notes=EXCLUDED.notes, hijri_month=EXCLUDED.hijri_month, hijri_year=EXCLUDED.hijri_year, transaction_kind=EXCLUDED.transaction_kind, category=EXCLUDED.category, balance_included=EXCLUDED.balance_included, kafala_period=EXCLUDED.kafala_period, cash_account=EXCLUDED.cash_account, kafala_exempt_months=EXCLUDED.kafala_exempt_months
           WHERE (? = 'admin' OR payments.branch = ?) AND payments.iqama_no = EXCLUDED.iqama_no RETURNING id`,
        [
          p.id,
          p.iqamaNo,
          p.name,
          p.branch,
          p.amount,
          p.type,
          p.date,
          p.notes || null,
          p.hijriMonth || null,
          p.hijriYear || null,
          tenantId, p.transactionKind, p.category || null, p.balanceIncluded ?? true, p.kafalaPeriod ? JSON.stringify(p.kafalaPeriod) : null, p.cashAccount || 'cash', JSON.stringify(p.kafalaExemptMonths || []), req.user.role, req.user.branch || ""
        ]
      );
      if (!saved.length) return res.status(403).json({ error: "الدفعة خارج نطاق فرعك أو تخص موظفاً آخر." });
      return res.json({ success: true, payment: p });
    } else {
      const fullP = { ...p, tenantId };
      const existingIdx = fallbackPayments.findIndex((item) => item.id === p.id && (item.tenantId || "") === tenantId);
      if (existingIdx !== -1) {
        fallbackPayments[existingIdx] = fullP;
      } else {
        fallbackPayments.unshift(fullP);
      }
      return res.json({ success: true, payment: fullP });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});


app.delete("/api/payments/:id", requireAuth, async (req: any, res: any) => {
  if (req.user.role === "viewer") return res.status(403).json({ error: "لا تملك صلاحية حذف المدفوعات." });
  const tenantId = getTenantId(req);
  try {
    const payment = pool ? (await runQuery("SELECT * FROM payments WHERE tenant_id = ? AND id = ?", [tenantId, req.params.id]))[0]
      : fallbackPayments.find(p => (p.tenantId || "") === tenantId && p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: "الدفعة غير موجودة." });
    if (!inBranch(req, payment.branch)) return res.status(403).json({ error: "الدفعة خارج نطاق فرعك." });
    if (pool) await runQuery("DELETE FROM payments WHERE tenant_id = ? AND id = ?", [tenantId, req.params.id]);
    else fallbackPayments = fallbackPayments.filter(p => !((p.tenantId || "") === tenantId && p.id === req.params.id));
    return res.json({ success: true });
  } catch (err) { return sendServerError(res, err); }
});

const shopEntrySchema = z.object({
  id: z.string().min(1).max(128), branch: z.string().min(1).max(150), date: dateSchema('الحركة'),
  year: z.number().int().min(1900).max(2200), kind: z.enum(['charge', 'receipt', 'opening', 'discount']),
  amount: positiveNumericSchema('المبلغ').refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'المبلغ يقبل منزلتين عشريتين فقط'),
  category: z.string().min(1).max(150), description: z.string().min(1).max(4000),
  reference: z.string().max(100).optional(), responsible: z.string().max(255).optional(), notes: z.string().max(4000).optional(),
  paidByCompany: z.boolean().optional().default(false), cashAccount: z.enum(['cash', 'bank']).optional().default('cash')
}).refine(entry => !entry.paidByCompany || entry.kind === 'charge', { message: 'الدفع من الشركة يخص المصروف المحمل على المسؤول فقط.' });

const mapShopEntry = (row: any) => ({ id: row.id, branch: row.branch, date: row.date instanceof Date ? row.date.toISOString().slice(0,10) : String(row.date).slice(0,10), year: row.year, kind: row.kind, amount: Number(row.amount), category: row.category, description: row.description, reference: row.reference || '', responsible: row.responsible || '', notes: row.notes || '', paidByCompany: row.paid_by_company, cashAccount: row.cash_account, createdAt: row.created_at });

app.get('/api/shop-entries', requireAuth, async (req: any, res) => {
  if (req.user.role === 'viewer' && !(req.company?.allow_ledger_for_users || req.company?.allowLedgerForUsers)) return res.status(403).json({ error: 'الوصول لحسابات المحلات غير مسموح.' });
  const tenantId = getTenantId(req);
  try {
    const entries = pool ? (await runQuery("SELECT * FROM shop_entries WHERE tenant_id = ? ORDER BY date, created_at, id", [tenantId])).map(mapShopEntry) : fallbackShopEntries.filter(entry => entry.tenantId === tenantId);
    return res.json(entries.filter((entry: any) => inBranch(req, entry.branch)));
  } catch (error) { return sendServerError(res, error); }
});

app.post('/api/shop-entries', requireAuth, requireAdmin, async (req: any, res) => {
  const parsed = shopEntrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: formatZodError(parsed.error) });
  const entry = parsed.data, tenantId = getTenantId(req);
  try {
    const branches = pool ? (await runQuery('SELECT name FROM branches WHERE tenant_id = ? AND name = ?', [tenantId, entry.branch])).length > 0 : (fallbackBranches.get(tenantId) || []).includes(entry.branch);
    if (!branches) return res.status(400).json({ error: 'اختر فرعاً تابعاً لشركتك.' });
    if (pool) {
      const rows = await runQuery(`INSERT INTO shop_entries (tenant_id, id, branch, date, year, kind, amount, category, description, reference, responsible, notes, paid_by_company, cash_account)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (tenant_id, id) DO NOTHING RETURNING *`,
        [tenantId, entry.id, entry.branch, entry.date, entry.year, entry.kind, entry.amount, entry.category, entry.description, entry.reference || null, entry.responsible || null, entry.notes || null, entry.paidByCompany, entry.cashAccount]);
      if (!rows.length) {
        const existing = mapShopEntry((await runQuery('SELECT * FROM shop_entries WHERE tenant_id = ? AND id = ?', [tenantId, entry.id]))[0]);
        if (existing.branch !== entry.branch || existing.amount !== entry.amount || existing.kind !== entry.kind || existing.date !== entry.date || existing.description !== entry.description || existing.category !== entry.category || existing.year !== entry.year || existing.reference !== (entry.reference || '') || existing.notes !== (entry.notes || '') || existing.responsible !== (entry.responsible || '') || existing.paidByCompany !== entry.paidByCompany || existing.cashAccount !== entry.cashAccount) return res.status(409).json({ error: 'رقم الحركة مستخدم بحركة مختلفة.' });
        return res.json({ success: true, entry: existing });
      }
      return res.status(201).json({ success: true, entry: mapShopEntry(rows[0]) });
    }
    const existing = fallbackShopEntries.find(item => item.tenantId === tenantId && item.id === entry.id);
    if (existing) {
      if (Object.keys(entry).some(key => existing[key] !== entry[key])) return res.status(409).json({ error: 'رقم الحركة مستخدم بحركة مختلفة.' });
      return res.json({ success: true, entry: existing });
    }
    if (entry.reference && fallbackShopEntries.some(item => item.tenantId === tenantId && item.branch === entry.branch && item.reference === entry.reference)) return res.status(409).json({ error: 'مرجع المستند موجود لهذا الفرع بالفعل.' });
    const saved = { ...entry, tenantId, createdAt: new Date().toISOString() };
    fallbackShopEntries.push(saved);
    return res.status(201).json({ success: true, entry: saved });
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ error: 'مرجع المستند موجود لهذا الفرع بالفعل.' });
    return sendServerError(res, error);
  }
});

app.delete('/api/shop-entries/:id', requireAuth, requireAdmin, async (req: any, res) => {
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      const deleted = await runQuery('DELETE FROM shop_entries WHERE tenant_id = ? AND id = ? RETURNING id', [tenantId, req.params.id]);
      if (!deleted.length) return res.status(404).json({ error: 'الحركة غير موجودة في الشركة.' });
    } else {
      const entry = fallbackShopEntries.find(item => item.tenantId === tenantId && item.id === req.params.id);
      if (!entry) return res.status(404).json({ error: 'الحركة غير موجودة في الشركة.' });
      fallbackShopEntries = fallbackShopEntries.filter(item => !(item.tenantId === tenantId && item.id === req.params.id));
    }
    return res.json({ success: true });
  } catch (error) { return sendServerError(res, error); }
});

// 3.5 General Ledger API
app.get("/api/general-ledger", requireAuth, requireLedger, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      let rows: any;
      if (tenantId) {
        rows = await runQuery("SELECT * FROM general_ledger WHERE tenant_id = ? ORDER BY date DESC, created_at DESC", [tenantId]);
      } else {
        rows = await runQuery("SELECT * FROM general_ledger WHERE tenant_id IS NULL OR tenant_id = '' ORDER BY date DESC, created_at DESC");
      }
      const mapped = rows.map((r: any) => ({
        id: r.id, branch: r.branch || '', category: r.category || '', reference: r.reference || '',
        cashAccount: r.cash_account || undefined, counterpartAccount: r.counterpart_account || '', cashEffect: r.cash_effect || undefined,
        date: r.date ? (r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)) : "",
        bayan: r.bayan,
        debit: Number(r.debit || 0),
        credit: Number(r.credit || 0),
        createdAt: r.created_at,
        tenantId: r.tenant_id
      }));
      return res.json(mapped.filter((entry: any) => inBranch(req, entry.branch)));
    }
    const filtered = fallbackGeneralLedger.filter((item) => (tenantId ? item.tenantId === tenantId : !item.tenantId));
    return res.json(filtered.filter((entry: any) => inBranch(req, entry.branch)));
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.post("/api/general-ledger", requireAuth, requireLedger, requireAdmin, async (req: any, res: any) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: "لا تملك صلاحية تعديل أو إضافة قيود عامة." });
  }
  const parseResult = generalLedgerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const item = parseResult.data;
  const tenantId = getTenantId(req);
  try {
    if (item.branch) {
      const owned = pool ? (await runQuery("SELECT name FROM branches WHERE tenant_id = ? AND name = ?", [tenantId, item.branch])).length > 0 : (fallbackBranches.get(tenantId) || []).includes(item.branch);
      if (!owned) return res.status(400).json({ error: "الفرع غير موجود في الشركة." });
    }
    if (pool) {
      await runQuery(
        `INSERT INTO general_ledger (id, date, bayan, debit, credit, tenant_id, created_at, branch, category, reference, cash_account, counterpart_account, cash_effect)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (tenant_id, id) DO UPDATE SET
           date=EXCLUDED.date, bayan=EXCLUDED.bayan, debit=EXCLUDED.debit, credit=EXCLUDED.credit, branch=EXCLUDED.branch, category=EXCLUDED.category, reference=EXCLUDED.reference, cash_account=EXCLUDED.cash_account, counterpart_account=EXCLUDED.counterpart_account, cash_effect=COALESCE(EXCLUDED.cash_effect, general_ledger.cash_effect)`,
        [
          item.id,
          item.date,
          item.bayan,
          item.debit || 0,
          item.credit || 0,
          tenantId,
          item.createdAt || new Date().toISOString(), item.branch || null, item.category || null, item.reference || null, item.cashAccount || "cash", item.counterpartAccount || null, item.cashEffect || null
        ]
      );
      return res.json({ success: true, entry: item });
    } else {
      const fullItem = { ...item, tenantId };
      const existingIdx = fallbackGeneralLedger.findIndex((g) => g.id === item.id && (g.tenantId || "") === tenantId);
      if (existingIdx !== -1) {
        fallbackGeneralLedger[existingIdx] = fullItem;
      } else {
        fallbackGeneralLedger.unshift(fullItem);
      }
      return res.json({ success: true, entry: fullItem });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.delete("/api/general-ledger/:id", requireAuth, requireLedger, requireAdmin, async (req: any, res: any) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: "لا تملك صلاحية حذف القيود العامة." });
  }
  const { id } = req.params;
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      await runQuery("DELETE FROM general_ledger WHERE id = ? AND tenant_id = ?", [id, tenantId]);
      return res.json({ success: true });
    } else {
      fallbackGeneralLedger = fallbackGeneralLedger.filter((g) => !(g.id === id && g.tenantId === tenantId));
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});


// 4. Company Settings API
app.get("/api/company-settings", requireAuth, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      const rows: any = await runQuery("SELECT * FROM company_settings WHERE tenant_id = ?", [tenantId]);
      if (rows.length > 0) {
        return res.json({
          name: rows[0].name,
          logoBase64: rows[0].logo_base64 || undefined,
          allowLedgerForUsers: !!rows[0].allow_ledger_for_users,
          activationDate: rows[0].activation_date || "",
          expirationDate: rows[0].expiration_date || "",
          supportPhone: rows[0].support_phone || "",
        });
      }
      return res.json({ name: "برنامج إدارة العمالة المهنية", allowLedgerForUsers: false, activationDate: "", expirationDate: "", supportPhone: "" });
    }
    const local = fallbackCompany.get(tenantId) || { name: "برنامج إدارة العمالة المهنية", allowLedgerForUsers: false };
    return res.json({
      name: local.name,
      logoBase64: local.logoBase64,
      allowLedgerForUsers: !!local.allowLedgerForUsers,
      activationDate: local.activationDate || "",
      expirationDate: local.expirationDate || "",
      supportPhone: local.supportPhone || "",
    });
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.post("/api/company-settings", requireAuth, async (req: any, res: any) => {
  if (req.user.role !== 'admin' && req.user.email !== DEV_EMAIL) {
    return res.status(403).json({ error: "غير مسموح بتعديل إعدادات الشركة إلا لمدير النظام." });
  }
  const parseResult = companySettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const s = parseResult.data;
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      // Cleaned PostgreSQL upsert
      await runQuery(
        "INSERT INTO company_settings (tenant_id, name, logo_base64, allow_ledger_for_users) VALUES (?, ?, ?, ?) ON CONFLICT (tenant_id) DO UPDATE SET name = EXCLUDED.name, logo_base64 = EXCLUDED.logo_base64, allow_ledger_for_users = EXCLUDED.allow_ledger_for_users",
        [tenantId, s.name, s.logoBase64 || null, !!s.allowLedgerForUsers]
      );
      return res.json({ success: true });
    } else {
      const existing = fallbackCompany.get(tenantId) || {};
      fallbackCompany.set(tenantId, {
        ...existing,
        name: s.name,
        logoBase64: s.logoBase64,
        allowLedgerForUsers: s.allowLedgerForUsers
      });
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});


// 5. Pricing Settings API
app.get("/api/pricing-settings", requireAuth, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      const rows: any = await runQuery("SELECT * FROM pricing_settings WHERE tenant_id = ?", [tenantId]);
      if (rows.length > 0) {
        return res.json({
          kafala: Number(rows[0].kafala),
          iqama3: Number(rows[0].iqama_3),
          iqama6: Number(rows[0].iqama_6),
          iqama12: Number(rows[0].iqama_12),
          ramadanFree: !!rows[0].ramadan_free,
        });
      }
      return res.json({ kafala: 250, iqama3: 3550, iqama6: 7100, iqama12: 14200, ramadanFree: true });
    }
    return res.json(fallbackPricing.get(tenantId) || { kafala: 250, iqama3: 3550, iqama6: 7100, iqama12: 14200, ramadanFree: true });
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.post("/api/pricing-settings", requireAuth, async (req: any, res: any) => {
  if (req.user.role !== 'admin' && req.user.email !== DEV_EMAIL) {
    return res.status(403).json({ error: "غير مسموح بتعديل إعدادات التسعير إلا لمدير النظام." });
  }
  const parseResult = pricingSettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const s = parseResult.data;
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      // Cleaned PostgreSQL upsert
      await runQuery(
        `INSERT INTO pricing_settings (tenant_id, kafala, iqama_3, iqama_6, iqama_12, ramadan_free)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (tenant_id) DO UPDATE SET kafala=EXCLUDED.kafala, iqama_3=EXCLUDED.iqama_3, iqama_6=EXCLUDED.iqama_6, iqama_12=EXCLUDED.iqama_12, ramadan_free=EXCLUDED.ramadan_free`,
        [tenantId, s.kafala, s.iqama3, s.iqama6, s.iqama12, s.ramadanFree]
      );
      return res.json({ success: true });
    } else {
      fallbackPricing.set(tenantId, s);
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});


// 6. Branches API
app.get("/api/branches", requireAuth, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      const rows = await runQuery("SELECT name FROM branches WHERE tenant_id = ? ORDER BY name ASC", [tenantId]);
      return res.json(rows.map((r: any) => r.name).filter((branch: string) => inBranch(req, branch)));
    }
    return res.json((fallbackBranches.get(tenantId) || []).filter(branch => inBranch(req, branch)));
  } catch (err: any) {
    sendServerError(res, err);
  }
});

async function branchesWithRecords(tenantId: string): Promise<Set<string>> {
  if (pool) {
    const rows = await runQuery(`SELECT branch FROM employees WHERE tenant_id = ?
      UNION SELECT branch FROM payments WHERE tenant_id = ?
      UNION SELECT branch FROM shop_entries WHERE tenant_id = ?
      UNION SELECT branch FROM general_ledger WHERE tenant_id = ?`, [tenantId, tenantId, tenantId, tenantId]);
    return new Set(rows.map((row: any) => row.branch).filter(Boolean));
  }
  return new Set([...fallbackEmployees, ...fallbackPayments, ...fallbackShopEntries, ...fallbackGeneralLedger]
    .filter(item => (item.tenantId || '') === tenantId).map(item => item.branch).filter(Boolean));
}

app.post("/api/branches", requireAuth, requireAdmin, async (req: any, res: any) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: "لا تملك صلاحية تعديل الفروع." });
  }
  const parseResult = branchPostSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const bodyData = parseResult.data;
  const tenantId = getTenantId(req);
  try {
    if (Array.isArray(bodyData)) {
      const names = bodyData.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean);
      const protectedBranches = await branchesWithRecords(tenantId);
      if ([...protectedBranches].some(name => !names.includes(name))) return res.status(409).json({ error: 'لا يمكن حذف فرع له عمالة أو حركات مالية. احتفظ به لحماية كشف الحساب.' });
      if (pool) {
        if (names.length > 0) {
          const placeholders = names.map(() => '?').join(', ');
          const sqlDelete = `DELETE FROM branches WHERE tenant_id = ? AND name NOT IN (${placeholders})`;
          await runQuery(sqlDelete, [tenantId, ...names]);
          for (const name of names) {
            await runQuery("INSERT INTO branches (name, tenant_id) VALUES (?, ?) ON CONFLICT (name, tenant_id) DO NOTHING", [name, tenantId]);
          }
        } else {
          await runQuery("DELETE FROM branches WHERE tenant_id = ?", [tenantId]);
        }
      } else {
        fallbackBranches.set(tenantId, names);
      }
      return res.json({ success: true });
    } else {
      const { name } = bodyData as any;
      if (pool) {
        if (name) {
          await runQuery("INSERT INTO branches (name, tenant_id) VALUES (?, ?) ON CONFLICT (name, tenant_id) DO NOTHING", [name, tenantId]);
        }
      } else {
        const list = fallbackBranches.get(tenantId) || [];
        if (name && !list.includes(name)) {
          list.push(name);
        }
        fallbackBranches.set(tenantId, list);
      }
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.delete("/api/branches/:name", requireAuth, requireAdmin, async (req: any, res: any) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: "لا تملك صلاحية حذف الفروع." });
  }
  const { name } = req.params;
  const tenantId = getTenantId(req);
  try {
    if ((await branchesWithRecords(tenantId)).has(name)) return res.status(409).json({ error: "لا يمكن حذف فرع له عمالة أو حركات مالية." });
    if (pool) {
      await runQuery("DELETE FROM branches WHERE name = ? AND tenant_id = ?", [name, tenantId]);
      return res.json({ success: true });
    } else {
      const list = fallbackBranches.get(tenantId) || [];
      fallbackBranches.set(tenantId, list.filter((b) => b !== name));
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});


// 7. Activity Logs API
app.get("/api/logs", requireAuth, requireAdmin, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      let rows: any;
      if (tenantId) {
        rows = await runQuery('SELECT * FROM activity_logs WHERE tenant_id = ? ORDER BY time DESC LIMIT 200', [tenantId]);
      } else {
        rows = await runQuery("SELECT * FROM activity_logs WHERE COALESCE(tenant_id, '') = '' ORDER BY time DESC LIMIT 200");
      }
      const mapped = rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        text: r.text,
        user: r.user,
        time: r.time,
      }));
      return res.json(mapped);
    }
    const filtered = fallbackLogs.filter((l) => (tenantId ? l.tenantId === tenantId : !l.tenantId));
    return res.json(filtered);
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.post("/api/logs", requireAuth, async (req: any, res: any) => {
  const parseResult = activityLogSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const l = { ...parseResult.data, user: req.user.name, time: new Date().toISOString() };
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      await runQuery(
        'INSERT INTO activity_logs (id, type, text, "user", time, tenant_id) VALUES (?, ?, ?, ?, ?, ?)',
        [l.id, l.type, l.text, l.user, l.time || new Date().toISOString(), tenantId || null]
      );
      return res.json({ success: true });
    } else {
      fallbackLogs.unshift({ ...l, tenantId });
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});


app.delete("/api/logs", requireAuth, requireAdmin, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  try {
    if (pool) await runQuery("DELETE FROM activity_logs WHERE COALESCE(tenant_id, '') = ?", [tenantId]);
    else fallbackLogs = fallbackLogs.filter(log => (log.tenantId || "") !== tenantId);
    return res.json({ success: true });
  } catch (err) { return sendServerError(res, err); }
});

// 8. General Wipe/Reset database API
const wipeLimiter = rateLimit({ keyGenerator: (req: any) => `wipe:${req.user.uid}`, windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'تجاوزت محاولات تأكيد المسح. أعد المحاولة بعد 15 دقيقة.' } });
app.post("/api/system/wipe", requireAuth, wipeLimiter, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  
  // Authorization checks
  if (tenantId) {
    // Only the admin of the specific tenant is allowed to wipe their tenant's data
    if (req.user.role !== "admin" || req.user.tenantId !== tenantId) {
      return res.status(403).json({ error: "غير مسموح بمسح بيانات مساحة العمل هذه إلا لمديرها." });
    }
  } else {
    // Only the developer may wipe the default workspace; other tenants remain intact.
    if (req.user.email !== DEV_EMAIL) {
      return res.status(403).json({ error: "غير مسموح بمسح المساحة الافتراضية إلا لمطور النظام." });
    }
  }

  const confirmation = z.object({ password: z.string().min(1).max(200),
    confirmation: z.literal('مسح بيانات مساحة العمل'), backupConfirmed: z.literal(true), targetTenantId: z.string() }).safeParse(req.body);
  if (!confirmation.success || confirmation.data.targetTenantId !== tenantId) return res.status(400).json({ error: 'أكمل تأكيد اسم العملية والنسخة الاحتياطية ومساحة العمل.' });
  try {
    const actor = pool ? (await runQuery('SELECT password FROM users WHERE uid = ?', [req.user.uid]))[0] : fallbackUsers.find(u => u.uid === req.user.uid);
    if (!actor?.password || !await bcrypt.compare(confirmation.data.password, actor.password)) return res.status(403).json({ error: 'كلمة مرور حسابك الحالي غير صحيحة. لم تُمسح البيانات.' });
    const wipeLog = { id: crypto.randomUUID(), type: 'update', text: 'تم مسح بيانات مساحة العمل بعد تأكيد المدير وكلمة مروره.', user: req.user.name, time: new Date().toISOString(), tenantId };
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const table of ["payments", "employees", "activity_logs", "general_ledger", "shop_entries", "worker_leaves", "branches"]) {
          await client.query(`DELETE FROM ${table} WHERE COALESCE(tenant_id, '') = $1`, [tenantId]);
        }
        await client.query('INSERT INTO activity_logs (id, type, text, "user", time, tenant_id) VALUES ($1,$2,$3,$4,$5,$6)', [wipeLog.id, wipeLog.type, wipeLog.text, wipeLog.user, wipeLog.time, tenantId]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
      return res.json({ success: true });
    } else {
      if (tenantId) {
        fallbackEmployees = fallbackEmployees.filter((e) => e.tenantId !== tenantId);
        fallbackPayments = fallbackPayments.filter((p) => p.tenantId !== tenantId);
        fallbackLogs = fallbackLogs.filter((l) => l.tenantId !== tenantId);
        fallbackGeneralLedger = fallbackGeneralLedger.filter((g) => g.tenantId !== tenantId);
        fallbackShopEntries = fallbackShopEntries.filter(e => e.tenantId !== tenantId);
        fallbackWorkerLeaves = fallbackWorkerLeaves.filter(e=>e.tenantId!==tenantId);
        fallbackBranches.delete(tenantId);
      } else {
        fallbackEmployees = fallbackEmployees.filter(e => !!e.tenantId);
        fallbackPayments = fallbackPayments.filter(p => !!p.tenantId);
        fallbackLogs = fallbackLogs.filter(l => !!l.tenantId);
        fallbackGeneralLedger = fallbackGeneralLedger.filter(g => !!g.tenantId);
        fallbackShopEntries = fallbackShopEntries.filter(e => !!e.tenantId);
        fallbackWorkerLeaves = fallbackWorkerLeaves.filter(e=>!!e.tenantId);
        fallbackBranches.delete("");
      }
      fallbackLogs.push(wipeLog);
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});


// 9. Developer/Admin Spaces API
app.get("/api/admin/spaces", requireAuth, requireDev, async (req: any, res: any) => {
  try {
    if (pool) {
      const admins: any = await runQuery("SELECT * FROM users WHERE role = 'admin'");
      const companies: any = await runQuery("SELECT * FROM company_settings");
      
      const spaces = admins.map((adm: any) => {
        const comp = companies.find((c: any) => c.tenant_id === adm.tenant_id);
        return {
          tenantId: adm.tenant_id,
          adminName: adm.name,
          adminEmail: adm.email,
          adminUid: adm.uid,
          status: adm.status,
          createdAt: adm.created_at,
          companyName: comp ? comp.name : "مساحة عمل بدون اسم",
          activationDate: comp ? (comp.activation_date || "") : "",
          expirationDate: comp ? (comp.expiration_date || "") : "",
          supportPhone: comp ? (comp.support_phone || "") : "",
        };
      });
      return res.json(spaces);
    } else {
      const admins = fallbackUsers.filter(u => u.role === 'admin');
      const spaces = admins.map(adm => {
        const comp = fallbackCompany.get(adm.tenantId || "");
        const compName = comp?.name || "مساحة عمل بدون اسم";
        return {
          tenantId: adm.tenantId,
          adminName: adm.name,
          adminEmail: adm.email,
          adminUid: adm.uid,
          status: adm.status || "approved",
          createdAt: adm.createdAt,
          companyName: compName,
          activationDate: comp?.activationDate || "",
          expirationDate: comp?.expirationDate || "",
          supportPhone: comp?.supportPhone || "",
        };
      });
      return res.json(spaces);
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.post("/api/admin/spaces", requireAuth, requireDev, async (req: any, res: any) => {
  const parseResult = adminSpacesSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const { adminName, adminEmail, adminPassword, companyName, tenantId, action, activationDate, expirationDate, supportPhone } = parseResult.data;

  if (adminPassword && (adminPassword.length < 8 || Buffer.byteLength(adminPassword, "utf8") > 72 || /^\$2[aby]\$/.test(adminPassword))) {
    return res.status(400).json({ error: "كلمة مرور المدير: يجب ألا تقل عن 8 أحرف." });
  }

  try {
  if (action === "create_space" || action === "add_user_to_company" || !action) {
    if (!adminName?.trim() || !adminEmail || !z.string().email().safeParse(adminEmail).success || !adminPassword || (!companyName?.trim() && action !== "add_user_to_company") || isDevEmail(adminEmail)) {
      return res.status(400).json({ error: "أدخل اسم المدير وبريده وكلمة مروره واسم الشركة." });
    }
    const exists = pool ? (await runQuery("SELECT uid FROM users WHERE LOWER(TRIM(email)) = ?", [adminEmail.toLowerCase().trim()])).length > 0 : fallbackUsers.some(u => u.email.toLowerCase().trim() === adminEmail.toLowerCase().trim());
    if (exists) return res.status(409).json({ error: "البريد الإلكتروني مسجّل بالفعل." });
  } else if (!tenantId) return res.status(400).json({ error: "حدد الشركة أولاً." });

    if (pool) {
      if (action === "edit_company") {
        await runQuery(
          `INSERT INTO company_settings (tenant_id, name, activation_date, expiration_date, support_phone)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (tenant_id) DO UPDATE SET 
             name = EXCLUDED.name,
             activation_date = EXCLUDED.activation_date,
             expiration_date = EXCLUDED.expiration_date,
             support_phone = EXCLUDED.support_phone`,
          [tenantId, companyName, activationDate || null, expirationDate || null, supportPhone || null]
        );
        return res.json({ success: true });
      }

      if (action === "renew_subscription") {
        const compRows: any = await runQuery("SELECT expiration_date FROM company_settings WHERE tenant_id = ?", [tenantId]);
        let currentExp = "";
        if (compRows.length > 0) {
          currentExp = compRows[0].expiration_date || "";
        }

        let baseDate = new Date();
        if (currentExp && !isNaN(Date.parse(currentExp)) && new Date(currentExp) > baseDate) {
          baseDate = new Date(currentExp);
        }
        baseDate.setFullYear(baseDate.getFullYear() + 1);
        const newExpDate = baseDate.toISOString().slice(0, 10);

        await runQuery(
          "UPDATE company_settings SET expiration_date = ? WHERE tenant_id = ?",
          [newExpDate, tenantId]
        );
        return res.json({ success: true, newExpirationDate: newExpDate });
      }
      
      // Adds a new user to an EXISTING company. tenantId must already exist in
      // company_settings — it is never generated here, only looked up and reused.
      if (action === "add_user_to_company") {
        if (!tenantId) {
          return res.status(400).json({ error: "يجب تحديد الشركة (tenantId) لإضافة مستخدم لها." });
        }
        const companyRows: any = await runQuery("SELECT tenant_id FROM company_settings WHERE tenant_id = ?", [tenantId]);
        if (!companyRows || companyRows.length === 0) {
          return res.status(404).json({ error: "الشركة المحددة غير موجودة." });
        }
        const newUid = `user_${crypto.randomUUID()}`;
        let addUserPassword = adminPassword || null;
        if (addUserPassword) {
          addUserPassword = await bcrypt.hash(addUserPassword, 10);
        }
        await runQuery(
          `INSERT INTO users (uid, name, email, role, branch, status, tenant_id, password, created_at)
           VALUES (?, ?, ?, 'admin', NULL, 'approved', ?, ?, ?)`,
          [newUid, adminName, adminEmail, tenantId, addUserPassword, new Date().toISOString()]
        );
        return res.json({ success: true, tenantId });
      }

      const newTenantId = `tenant_${crypto.randomUUID()}`;
      const newUid = `user_${crypto.randomUUID()}`;
      const actDate = activationDate || new Date().toISOString().slice(0, 10);
      const expDate = expirationDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10);
      const sPhone = supportPhone || "";

      let adminPasswordToSave = adminPassword || null;
      if (adminPasswordToSave) {
        adminPasswordToSave = await bcrypt.hash(adminPasswordToSave, 10);
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO users (uid, name, email, role, branch, status, tenant_id, password, created_at)
           VALUES ($1, $2, $3, 'admin', NULL, 'approved', $4, $5, $6)`,
          [newUid, adminName, adminEmail.trim().toLowerCase(), newTenantId, adminPasswordToSave, new Date().toISOString()]
        );
        await client.query(
          `INSERT INTO company_settings (tenant_id, name, logo_base64, allow_ledger_for_users, activation_date, expiration_date, support_phone)
           VALUES ($1, $2, NULL, FALSE, $3, $4, $5)`,
          [newTenantId, companyName, actDate, expDate, sPhone]
        );
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
      
      return res.json({ success: true, tenantId: newTenantId });
    } else {
      if (action === "edit_company") {
        const existing = fallbackCompany.get(tenantId) || {};
        fallbackCompany.set(tenantId, { 
          ...existing, 
          name: companyName,
          activationDate: activationDate || existing.activationDate,
          expirationDate: expirationDate || existing.expirationDate,
          supportPhone: supportPhone || existing.supportPhone,
        });
        return res.json({ success: true });
      }

      if (action === "renew_subscription") {
        const existing = fallbackCompany.get(tenantId) || {};
        let currentExp = existing.expirationDate || "";

        let baseDate = new Date();
        if (currentExp && !isNaN(Date.parse(currentExp)) && new Date(currentExp) > baseDate) {
          baseDate = new Date(currentExp);
        }
        baseDate.setFullYear(baseDate.getFullYear() + 1);
        const newExpDate = baseDate.toISOString().slice(0, 10);

        fallbackCompany.set(tenantId, {
          ...existing,
          expirationDate: newExpDate
        });
        return res.json({ success: true, newExpirationDate: newExpDate });
      }
      
      if (action === "add_user_to_company") {
        if (!tenantId) {
          return res.status(400).json({ error: "يجب تحديد الشركة (tenantId) لإضافة مستخدم لها." });
        }
        if (!fallbackCompany.has(tenantId)) {
          return res.status(404).json({ error: "الشركة المحددة غير موجودة." });
        }
        const newUid = `user_${crypto.randomUUID()}`;
        let addUserPassword = adminPassword || null;
        if (addUserPassword) {
          addUserPassword = await bcrypt.hash(addUserPassword, 10);
        }
        fallbackUsers.push({
          uid: newUid,
          name: adminName,
          email: adminEmail,
          role: 'admin',
          status: 'approved',
          tenantId,
          password: addUserPassword || undefined,
          createdAt: new Date().toISOString(),
        });
        return res.json({ success: true, tenantId });
      }

      const newTenantId = `tenant_${crypto.randomUUID()}`;
      const newUid = `user_${crypto.randomUUID()}`;
      const actDate = activationDate || new Date().toISOString().slice(0, 10);
      const expDate = expirationDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10);
      const sPhone = supportPhone || "";
      
      let adminPasswordToSave = adminPassword || null;
      if (adminPasswordToSave) {
        adminPasswordToSave = await bcrypt.hash(adminPasswordToSave, 10);
      }

      const newUser = {
        uid: newUid,
        name: adminName,
        email: adminEmail,
        role: 'admin',
        status: 'approved',
        tenantId: newTenantId,
        password: adminPasswordToSave || undefined,
        createdAt: new Date().toISOString(),
      };
      
      fallbackUsers.push(newUser);
      fallbackCompany.set(newTenantId, { 
        name: companyName,
        activationDate: actDate,
        expirationDate: expDate,
        supportPhone: sPhone
      });
      
      return res.json({ success: true, tenantId: newTenantId });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});


// Initialize database and start server
async function startServer() {
  await connectDB();
  if (!pool && !allowMemoryFallback) throw new Error("PostgreSQL is required. Refusing temporary storage.");
  await initializeTables();
  databaseReady = true;

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = app.listen(PORT, process.env.BIND_HOST || "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    databaseReady = false;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
    if (pool) await pool.end();
    clearTimeout(timeout);
    process.exit(0);
  };
  process.on("SIGTERM", () => { void shutdown(); });
  process.on("SIGINT", () => { void shutdown(); });
}

startServer().catch(error => { console.error("Startup failed:", error.message); process.exit(1); });
