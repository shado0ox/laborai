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
  status: z.string().nullable().optional(),
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
  kafalaCount: numericSchema("عدد الكفالات"),
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

const paymentSchema = z.object({
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
  id: z.string().min(1, "المعرف مطلوب"),
  date: dateSchema("القيد"),
  bayan: z.string().min(1, "البيان مطلوب"),
  debit: numericSchema("مدين"),
  credit: numericSchema("دائن"),
  createdAt: optionalDateSchema("الإنشاء"),
});

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

const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "يرجى تسجيل الدخول أولاً للوصول إلى هذه البيانات." });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "جلسة الدخول منتهية أو غير صالحة. يرجى تسجيل الدخول مجدداً." });
  }
};

const requireDev = (req: any, res: any, next: any) => {
  if (!req.user || !isDevEmail(req.user.email)) {
    return res.status(403).json({ error: "غير مسموح بالوصول إلا لمطور النظام الرئيسي." });
  }
  next();
};

const getTenantId = (req: any): string => {
  if (req.user && isDevEmail(req.user.email)) {
    return (req.query.tenantId as string) || req.user.tenantId || "";
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
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_DATABASE,
        connectionTimeoutMillis: 2000,
      });
      
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

  if (!pool) {
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
  try {
    const client = await pool.connect();

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
    client.release();
  } catch (err: any) {
    console.error("Database migration error during initialization:", err);
  }
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
  return null;
}

// DB Status diagnostic
app.get("/api/db-status", requireAuth, requireDev, async (req: any, res: any) => {
  if (!pool || dbStatus === "disconnected") {
    console.log("[DB] Attempting dynamic reconnect from /api/db-status...");
    await connectDB();
    if (dbStatus === "connected" && pool) {
      await initializeTables();
    }
  }
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
      return res.status(401).json({ error: "البريد الإلكتروني غير مسجّل بمستودعات النظام." });
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
      return res.status(401).json({ error: "كلمة المرور أو رمز التفويض غير صحيح." });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: "حسابك قيد المراجعة وبانتظار موافقة مدير البرنامج لتفعيله." });
    }

    if (user.status === 'rejected') {
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
  const parseResult = userPostSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const u = parseResult.data;
  const normEmail = String(u.email).toLowerCase().trim();

  // If registering as main developer, reject!
  if (isDevEmail(normEmail) || u.uid === "user-admin") {
    return res.status(403).json({ error: "لا يمكن تعديل أو تسجيل حساب المطور الرئيسي!" });
  }

  // SECURITY: enforce a minimum password strength for any new plaintext password.
  // (Already-hashed bcrypt values, e.g. when an admin re-saves a user, are left untouched.)
  if (u.password && !u.password.startsWith("$2a$") && !u.password.startsWith("$2b$") && u.password.length < 8) {
    return res.status(400).json({ error: "كلمة المرور: يجب ألا تقل عن 8 أحرف." });
  }

  // Get authorization token if present
  let authUser: any = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      authUser = jwt.verify(token, JWT_SECRET);
    } catch (e) {}
  }

  // Enforce pending status if NOT an admin creating/updating the user
  let finalStatus = u.status || "pending";
  if (!authUser || authUser.role !== "admin") {
    finalStatus = "pending";
  }

  try {
    let passwordToSave = u.password || null;
    if (passwordToSave && !passwordToSave.startsWith("$2a$") && !passwordToSave.startsWith("$2b$")) {
      passwordToSave = await bcrypt.hash(passwordToSave, 10);
    }

    if (pool) {
      // Check if email already exists
      const existing: any = await runQuery("SELECT uid FROM users WHERE LOWER(TRIM(email)) = ?", [normEmail]);
      if (existing && existing.length > 0 && existing[0].uid !== u.uid) {
        return res.status(400).json({ error: "البريد الإلكتروني هذا مستخدم بالفعل ومسجّل من قبل." });
      }

      await runQuery(
        "INSERT INTO users (uid, name, email, role, branch, status, tenant_id, password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (uid) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, branch=EXCLUDED.branch, status=EXCLUDED.status, password=EXCLUDED.password",
        [
          u.uid,
          u.name,
          u.email,
          u.role,
          u.branch || null,
          finalStatus,
          u.tenantId || null,
          passwordToSave,
          u.createdAt || new Date().toISOString()
        ]
      );
      const returnedUser = { ...u, status: finalStatus };
      delete returnedUser.password;
      return res.json({ success: true, user: returnedUser });
    } else {
      const existing = fallbackUsers.find(user => user.email.toLowerCase().trim() === normEmail);
      if (existing && existing.uid !== u.uid) {
        return res.status(400).json({ error: "البريد الإلكتروني هذا مستخدم بالفعل ومسجّل من قبل." });
      }

      const existingIdx = fallbackUsers.findIndex((user) => user.uid === u.uid);
      const updatedUser = { ...u, status: finalStatus, password: passwordToSave || undefined };
      if (existingIdx !== -1) {
        fallbackUsers[existingIdx] = { ...fallbackUsers[existingIdx], ...updatedUser };
      } else {
        fallbackUsers.push(updatedUser);
      }
      const returnedUserFallback = { ...updatedUser };
      delete returnedUserFallback.password;
      return res.json({ success: true, user: returnedUserFallback });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.put("/api/users/:uid", requireAuth, async (req: any, res: any) => {
  const { uid } = req.params;
  const parseResult = userPutSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const updates = parseResult.data;
  const callerEmail = req.user?.email || "";
  try {
    if (pool) {
      const dbUsers: any = await runQuery("SELECT email FROM users WHERE uid = ?", [uid]);
      const isDev = (dbUsers && dbUsers.length > 0 && dbUsers[0].email === DEV_EMAIL) || uid === "user-admin";
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
      const isDev = (targetUser && targetUser.email === DEV_EMAIL) || uid === "user-admin";
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

app.delete("/api/users/:uid", requireAuth, async (req: any, res: any) => {
  const { uid } = req.params;
  try {
    if (pool) {
      const dbUsers: any = await runQuery("SELECT email FROM users WHERE uid = ?", [uid]);
      const isDev = (dbUsers && dbUsers.length > 0 && dbUsers[0].email === DEV_EMAIL) || uid === "user-admin";
      if (isDev) {
        return res.status(403).json({ error: "لا يمكن حذف حساب مطور البرنامج الرئيسي نهائياً!" });
      }
      await runQuery("DELETE FROM users WHERE uid = ?", [uid]);
      return res.json({ success: true });
    } else {
      const targetUser = fallbackUsers.find((u) => u.uid === uid);
      const isDev = (targetUser && targetUser.email === DEV_EMAIL) || uid === "user-admin";
      if (isDev) {
        return res.status(403).json({ error: "لا يمكن حذف حساب مطور البرنامج الرئيسي نهائياً!" });
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
        iqamaExpiry: r.iqama_expiry ? r.iqama_expiry.toISOString().slice(0, 10) : "",
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
      return res.json(mapped);
    }
    const filtered = fallbackEmployees.filter((e) => (tenantId ? e.tenantId === tenantId : !e.tenantId));
    return res.json(filtered);
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
    if (pool) {
      // Cleaned PostgreSQL upsert
      await runQuery(
        `INSERT INTO employees (
          iqama_no, name, employee_id, iqama_expiry, mobile, branch, iqama_balance, 
          kafala_count, other_debt, other_debt_desc, notes, status, archive_reason, 
          archive_date, added_date, kafala_start_month, kafala_start_year, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (iqama_no) DO UPDATE SET 
          name=EXCLUDED.name, employee_id=EXCLUDED.employee_id, iqama_expiry=EXCLUDED.iqama_expiry, 
          mobile=EXCLUDED.mobile, branch=EXCLUDED.branch, iqama_balance=EXCLUDED.iqama_balance,
          kafala_count=EXCLUDED.kafala_count, other_debt=EXCLUDED.other_debt, 
          other_debt_desc=EXCLUDED.other_debt_desc, notes=EXCLUDED.notes, status=EXCLUDED.status, 
          archive_reason=EXCLUDED.archive_reason, archive_date=EXCLUDED.archive_date, 
          added_date=EXCLUDED.added_date, kafala_start_month=EXCLUDED.kafala_start_month, 
          kafala_start_year=EXCLUDED.kafala_start_year`,
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
          tenantId || null
        ]
      );
      return res.json({ success: true, employee: e });
    } else {
      const fullEmp = { ...e, tenantId };
      const existingIdx = fallbackEmployees.findIndex((item) => item.iqamaNo === e.iqamaNo);
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
    if (pool) {
      await runQuery("DELETE FROM payments WHERE iqama_no = ? AND tenant_id = ?", [iqamaNo, tenantId]);
      await runQuery("DELETE FROM employees WHERE iqama_no = ? AND tenant_id = ?", [iqamaNo, tenantId]);
      return res.json({ success: true });
    } else {
      fallbackEmployees = fallbackEmployees.filter((e) => !(e.iqamaNo === iqamaNo && e.tenantId === tenantId));
      fallbackPayments = fallbackPayments.filter((p) => !(p.iqamaNo === iqamaNo && p.tenantId === tenantId));
      return res.json({ success: true });
    }
  } catch (err: any) {
    sendServerError(res, err);
  }
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
        date: r.date ? r.date.toISOString().slice(0, 10) : "",
        notes: r.notes || undefined,
        hijriMonth: r.hijri_month || undefined,
        hijriYear: r.hijri_year || undefined,
      }));
      return res.json(mapped);
    }
    const filtered = fallbackPayments.filter((p) => (tenantId ? p.tenantId === tenantId : !p.tenantId));
    return res.json(filtered);
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
  const p = parseResult.data;
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      // Cleaned PostgreSQL upsert
      await runQuery(
        `INSERT INTO payments (id, iqama_no, name, branch, amount, type, date, notes, hijri_month, hijri_year, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET 
           name=EXCLUDED.name, branch=EXCLUDED.branch, amount=EXCLUDED.amount, type=EXCLUDED.type, 
           date=EXCLUDED.date, notes=EXCLUDED.notes, hijri_month=EXCLUDED.hijri_month, hijri_year=EXCLUDED.hijri_year`,
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
          tenantId || null
        ]
      );
      return res.json({ success: true, payment: p });
    } else {
      const fullP = { ...p, tenantId };
      const existingIdx = fallbackPayments.findIndex((item) => item.id === p.id);
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


// 3.5 General Ledger API
app.get("/api/general-ledger", requireAuth, async (req: any, res: any) => {
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
        id: r.id,
        date: r.date ? (r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)) : "",
        bayan: r.bayan,
        debit: Number(r.debit || 0),
        credit: Number(r.credit || 0),
        createdAt: r.created_at,
        tenantId: r.tenant_id
      }));
      return res.json(mapped);
    }
    const filtered = fallbackGeneralLedger.filter((item) => (tenantId ? item.tenantId === tenantId : !item.tenantId));
    return res.json(filtered);
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.post("/api/general-ledger", requireAuth, async (req: any, res: any) => {
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
    if (pool) {
      await runQuery(
        `INSERT INTO general_ledger (id, date, bayan, debit, credit, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET 
           date=EXCLUDED.date, bayan=EXCLUDED.bayan, debit=EXCLUDED.debit, credit=EXCLUDED.credit`,
        [
          item.id,
          item.date,
          item.bayan,
          item.debit || 0,
          item.credit || 0,
          tenantId || null,
          item.createdAt || new Date().toISOString()
        ]
      );
      return res.json({ success: true, entry: item });
    } else {
      const fullItem = { ...item, tenantId };
      const existingIdx = fallbackGeneralLedger.findIndex((g) => g.id === item.id);
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

app.delete("/api/general-ledger/:id", requireAuth, async (req: any, res: any) => {
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
      return res.json(rows.map((r: any) => r.name));
    }
    return res.json(fallbackBranches.get(tenantId) || []);
  } catch (err: any) {
    sendServerError(res, err);
  }
});

app.post("/api/branches", requireAuth, async (req: any, res: any) => {
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

app.delete("/api/branches/:name", requireAuth, async (req: any, res: any) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: "لا تملك صلاحية حذف الفروع." });
  }
  const { name } = req.params;
  const tenantId = getTenantId(req);
  try {
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
app.get("/api/logs", requireAuth, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  try {
    if (pool) {
      let rows: any;
      if (tenantId) {
        rows = await runQuery('SELECT * FROM activity_logs WHERE tenant_id = ? ORDER BY time DESC LIMIT 200', [tenantId]);
      } else {
        rows = await runQuery('SELECT * FROM activity_logs ORDER BY time DESC LIMIT 200');
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
    const filtered = fallbackLogs.filter((l) => (tenantId ? l.tenantId === tenantId : true));
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
  const l = parseResult.data;
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


// 8. General Wipe/Reset database API
app.post("/api/system/wipe", requireAuth, async (req: any, res: any) => {
  const tenantId = getTenantId(req);
  
  // Authorization checks
  if (tenantId) {
    // Only the admin of the specific tenant is allowed to wipe their tenant's data
    if (req.user.role !== "admin" || req.user.tenantId !== tenantId) {
      return res.status(403).json({ error: "غير مسموح بمسح بيانات مساحة العمل هذه إلا لمديرها." });
    }
  } else {
    // Only the main developer is allowed to wipe the entire database
    if (req.user.email !== DEV_EMAIL) {
      return res.status(403).json({ error: "غير مسموح بمسح كامل قاعدة بيانات السيرفر إلا لمطور النظام." });
    }
  }

  try {
    if (pool) {
      if (tenantId) {
        await runQuery("DELETE FROM payments WHERE tenant_id = ?", [tenantId]);
        await runQuery("DELETE FROM employees WHERE tenant_id = ?", [tenantId]);
        await runQuery("DELETE FROM activity_logs WHERE tenant_id = ?", [tenantId]);
        await runQuery("DELETE FROM general_ledger WHERE tenant_id = ?", [tenantId]);
        await runQuery("DELETE FROM branches WHERE tenant_id = ?", [tenantId]);
      } else {
        await runQuery("DELETE FROM payments");
        await runQuery("DELETE FROM employees");
        await runQuery("DELETE FROM activity_logs");
        await runQuery("DELETE FROM general_ledger");
        await runQuery("DELETE FROM branches");
      }
      return res.json({ success: true });
    } else {
      if (tenantId) {
        fallbackEmployees = fallbackEmployees.filter((e) => e.tenantId !== tenantId);
        fallbackPayments = fallbackPayments.filter((p) => p.tenantId !== tenantId);
        fallbackLogs = fallbackLogs.filter((l) => l.tenantId !== tenantId);
        fallbackGeneralLedger = fallbackGeneralLedger.filter((g) => g.tenantId !== tenantId);
        fallbackBranches.delete(tenantId);
      } else {
        fallbackEmployees = [];
        fallbackPayments = [];
        fallbackLogs = [];
        fallbackGeneralLedger = [];
        fallbackBranches.clear();
      }
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

  if (adminPassword && !adminPassword.startsWith("$2a$") && !adminPassword.startsWith("$2b$") && adminPassword.length < 8) {
    return res.status(400).json({ error: "كلمة مرور المدير: يجب ألا تقل عن 8 أحرف." });
  }

  try {
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
        if (currentExp && !isNaN(Date.parse(currentExp))) {
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
        if (addUserPassword && !addUserPassword.startsWith("$2a$") && !addUserPassword.startsWith("$2b$")) {
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
      if (adminPasswordToSave && !adminPasswordToSave.startsWith("$2a$") && !adminPasswordToSave.startsWith("$2b$")) {
        adminPasswordToSave = await bcrypt.hash(adminPasswordToSave, 10);
      }

      await runQuery(
        `INSERT INTO users (uid, name, email, role, branch, status, tenant_id, password, created_at)
         VALUES (?, ?, ?, 'admin', NULL, 'approved', ?, ?, ?)`,
        [newUid, adminName, adminEmail, newTenantId, adminPasswordToSave, new Date().toISOString()]
      );

      await runQuery(
        `INSERT INTO company_settings (tenant_id, name, logo_base64, allow_ledger_for_users, activation_date, expiration_date, support_phone)
         VALUES (?, ?, NULL, FALSE, ?, ?, ?)`,
        [newTenantId, companyName, actDate, expDate, sPhone]
      );
      
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
        if (currentExp && !isNaN(Date.parse(currentExp))) {
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
        if (addUserPassword && !addUserPassword.startsWith("$2a$") && !addUserPassword.startsWith("$2b$")) {
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
      if (adminPasswordToSave && !adminPasswordToSave.startsWith("$2a$") && !adminPasswordToSave.startsWith("$2b$")) {
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
  connectDB()
    .then(() => {
      return initializeTables();
    })
    .catch((err) => {
      console.error("❌ Error in background database initialization:", err);
    });

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();