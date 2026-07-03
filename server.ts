import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
const DB_PASSWORD = process.env.DB_PASSWORD || "StrongLocalPassword2026";
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
    dbStatus = "disconnected";
    dbError = (lastError || "Failed to connect to PostgreSQL database after multiple attempts");
  }
}

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
        await client.query("DROP TABLE IF EXISTS branches CASCADE");
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
        await client.query("DROP TABLE IF EXISTS payments CASCADE");
      }
    } catch (e: any) {
      console.warn("[MIGRATION] Payments table check warning:", e.message);
    }

    // 4. Pricing settings migration: If 'id' column exists, drop and recreate
    try {
      const checkPrcCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'pricing_settings' AND column_name = 'id'");
      if (checkPrcCol.rowCount > 0) {
        console.log("[MIGRATION] Old pricing_settings table structure detected. Upgrading to tenant-based primary key...");
        await client.query("DROP TABLE IF EXISTS pricing_settings CASCADE");
      }
    } catch (e: any) {
      console.warn("[MIGRATION] Pricing settings check warning:", e.message);
    }

    // 5. Company settings migration: If 'id' column exists, drop and recreate
    try {
      const checkCmpCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'id'");
      if (checkCmpCol.rowCount > 0) {
        console.log("[MIGRATION] Old company_settings table structure detected. Upgrading to tenant-based primary key...");
        await client.query("DROP TABLE IF EXISTS company_settings CASCADE");
      }
    } catch (e: any) {
      console.warn("[MIGRATION] Company settings check warning:", e.message);
    }

    // 6. Activity logs migration: If 'id' is integer (old schema), drop and recreate
    try {
      const checkLogCol = await client.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'id'");
      if (checkLogCol.rowCount > 0 && checkLogCol.rows[0].data_type !== 'character varying') {
        console.log("[MIGRATION] Old activity_logs table structure detected. Upgrading activity_logs...");
        await client.query("DROP TABLE IF EXISTS activity_logs CASCADE");
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
    const devCheck = await client.query("SELECT * FROM users WHERE email = $1", ["shady.nasif@gmail.com"]);
    if (devCheck.rowCount === 0) {
      await client.query(`
        INSERT INTO users (uid, name, email, role, branch, status, tenant_id, password, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        "user-admin",
        "شادي ناصف",
        "shady.nasif@gmail.com",
        "admin",
        null,
        "approved",
        "",
        "admin",
        "2026-01-01T08:00:00.000Z"
      ]);
      console.log("✓ Developer main account 'shady.nasif@gmail.com' successfully seeded.");
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
    email: "shady.nasif@gmail.com",
    role: "admin",
    createdAt: "2026-01-01T08:00:00.000Z",
    password: "admin",
    status: "approved",
  },
  {
    uid: "user-jeddah",
    name: "أحمد الغامدي",
    email: "jeddah.branch@company.com",
    role: "branch",
    branch: "فرع جدة الغربية",
    createdAt: "2026-02-15T09:30:00.000Z",
    password: "123",
    status: "approved",
  },
  {
    uid: "user-viewer",
    name: "سلطان المقرن",
    email: "viewer@company.com",
    role: "viewer",
    createdAt: "2026-03-10T11:00:00.000Z",
    password: "123",
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
app.get("/api/db-status", async (req, res) => {
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

// Admin-level diagnostic repair
app.post("/api/admin/repair-db", async (req, res) => {
  const callerEmail = req.query.callerEmail as string;
  if (callerEmail !== "shady.nasif@gmail.com") {
    return res.status(403).json({ error: "غير مسموح بالوصول إلا لمطور النظام الرئيسي." });
  }
  try {
    await initializeTables();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1. Users API
app.get("/api/users", async (req, res) => {
  try {
    if (pool) {
      const rows = await runQuery("SELECT * FROM users ORDER BY name ASC");
      const mapped = rows.map((r: any) => ({
        uid: r.uid,
        name: r.name,
        email: r.email,
        role: r.role,
        branch: r.branch || undefined,
        status: r.status,
        tenantId: r.tenant_id || undefined,
        createdAt: r.created_at,
        password: r.password || undefined,
      }));
      return res.json(mapped);
    }
    return res.json(fallbackUsers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", async (req, res) => {
  const u = req.body;
  const callerEmail = req.query.callerEmail as string || "";
  if (u && (String(u.email).toLowerCase().trim() === "shady.nasif@gmail.com" || u.uid === "user-admin")) {
    if (callerEmail !== "shady.nasif@gmail.com") {
      return res.status(403).json({ error: "لا يمكن تعديل أو تسجيل حساب المطور الرئيسي!" });
    }
  }
  try {
    if (pool) {
      // Cleaned PostgreSQL upsert
      await runQuery(
        "INSERT INTO users (uid, name, email, role, branch, status, tenant_id, password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (uid) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, branch=EXCLUDED.branch, status=EXCLUDED.status, password=EXCLUDED.password",
        [
          u.uid,
          u.name,
          u.email,
          u.role,
          u.branch || null,
          u.status || "approved",
          u.tenantId || null,
          u.password || null,
          u.createdAt || new Date().toISOString()
        ]
      );
      return res.json({ success: true, user: u });
    } else {
      const existingIdx = fallbackUsers.findIndex((user) => user.uid === u.uid);
      if (existingIdx !== -1) {
        fallbackUsers[existingIdx] = { ...fallbackUsers[existingIdx], ...u };
      } else {
        fallbackUsers.push(u);
      }
      return res.json({ success: true, user: u });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/users/:uid", async (req, res) => {
  const { uid } = req.params;
  const updates = req.body;
  const callerEmail = req.query.callerEmail as string || "";
  try {
    if (pool) {
      const users: any = await runQuery("SELECT email FROM users WHERE uid = ?", [uid]);
      const isDev = (users && users.length > 0 && users[0].email === "shady.nasif@gmail.com") || uid === "user-admin";
      if (isDev) {
        if (callerEmail !== "shady.nasif@gmail.com") {
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
      const isDev = (targetUser && targetUser.email === "shady.nasif@gmail.com") || uid === "user-admin";
      if (isDev) {
        if (callerEmail !== "shady.nasif@gmail.com") {
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
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    if (pool) {
      const users: any = await runQuery("SELECT email FROM users WHERE uid = ?", [uid]);
      const isDev = (users && users.length > 0 && users[0].email === "shady.nasif@gmail.com") || uid === "user-admin";
      if (isDev) {
        return res.status(403).json({ error: "لا يمكن حذف حساب مطور البرنامج الرئيسي نهائياً!" });
      }
      await runQuery("DELETE FROM users WHERE uid = ?", [uid]);
      return res.json({ success: true });
    } else {
      const targetUser = fallbackUsers.find((u) => u.uid === uid);
      const isDev = (targetUser && targetUser.email === "shady.nasif@gmail.com") || uid === "user-admin";
      if (isDev) {
        return res.status(403).json({ error: "لا يمكن حذف حساب مطور البرنامج الرئيسي نهائياً!" });
      }
      fallbackUsers = fallbackUsers.filter((u) => u.uid !== uid);
      return res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 2. Employees API
app.get("/api/employees", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/employees", async (req, res) => {
  const e = req.body;
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/employees/:iqamaNo", async (req, res) => {
  const { iqamaNo } = req.params;
  try {
    if (pool) {
      await runQuery("DELETE FROM payments WHERE iqama_no = ?", [iqamaNo]);
      await runQuery("DELETE FROM employees WHERE iqama_no = ?", [iqamaNo]);
      return res.json({ success: true });
    } else {
      fallbackEmployees = fallbackEmployees.filter((e) => e.iqamaNo !== iqamaNo);
      fallbackPayments = fallbackPayments.filter((p) => p.iqamaNo !== iqamaNo);
      return res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 3. Payments API
app.get("/api/payments", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/payments", async (req, res) => {
  const p = req.body;
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});


// 3.5 General Ledger API
app.get("/api/general-ledger", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/general-ledger", async (req, res) => {
  const item = req.body;
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/general-ledger/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (pool) {
      await runQuery("DELETE FROM general_ledger WHERE id = ?", [id]);
      return res.json({ success: true });
    } else {
      fallbackGeneralLedger = fallbackGeneralLedger.filter((g) => g.id !== id);
      return res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 4. Company Settings API
app.get("/api/company-settings", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/company-settings", async (req, res) => {
  const s = req.body;
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});


// 5. Pricing Settings API
app.get("/api/pricing-settings", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/pricing-settings", async (req, res) => {
  const s = req.body;
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});


// 6. Branches API
app.get("/api/branches", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
  try {
    if (pool) {
      const rows = await runQuery("SELECT name FROM branches WHERE tenant_id = ? ORDER BY name ASC", [tenantId]);
      return res.json(rows.map((r: any) => r.name));
    }
    return res.json(fallbackBranches.get(tenantId) || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/branches", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
  try {
    if (Array.isArray(req.body)) {
      const names = req.body.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean);
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
      const { name } = req.body;
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
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/branches/:name", async (req, res) => {
  const { name } = req.params;
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});


// 7. Activity Logs API
app.get("/api/logs", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/logs", async (req, res) => {
  const l = req.body;
  const tenantId = (req.query.tenantId as string) || "";
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
    res.status(500).json({ error: err.message });
  }
});


// 8. General Wipe/Reset database API
app.post("/api/system/wipe", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
  try {
    if (pool) {
      if (tenantId) {
        await runQuery("DELETE FROM payments WHERE tenant_id = ?", [tenantId]);
        await runQuery("DELETE FROM employees WHERE tenant_id = ?", [tenantId]);
        await runQuery("DELETE FROM activity_logs WHERE tenant_id = ?", [tenantId]);
      } else {
        await runQuery("DELETE FROM payments");
        await runQuery("DELETE FROM employees");
        await runQuery("DELETE FROM activity_logs");
      }
      return res.json({ success: true });
    } else {
      if (tenantId) {
        fallbackEmployees = fallbackEmployees.filter((e) => e.tenantId !== tenantId);
        fallbackPayments = fallbackPayments.filter((p) => p.tenantId !== tenantId);
        fallbackLogs = fallbackLogs.filter((l) => l.tenantId !== tenantId);
      } else {
        fallbackEmployees = [];
        fallbackPayments = [];
        fallbackLogs = [];
      }
      return res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 9. Developer/Admin Spaces API
app.get("/api/admin/spaces", async (req, res) => {
  const callerEmail = req.query.callerEmail as string;
  if (callerEmail !== "shady.nasif@gmail.com") {
    return res.status(403).json({ error: "غير مسموح بالوصول إلا لمطور النظام الرئيسي." });
  }
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/spaces", async (req, res) => {
  const callerEmail = req.query.callerEmail as string;
  if (callerEmail !== "shady.nasif@gmail.com") {
    return res.status(403).json({ error: "غير مسموح بالوصول إلا لمطور النظام الرئيسي." });
  }
  const { adminName, adminEmail, adminPassword, companyName, tenantId, action, activationDate, expirationDate, supportPhone } = req.body;
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
      
      const newTenantId = `tenant_${Date.now()}`;
      const newUid = `user_${Date.now()}`;
      const actDate = activationDate || new Date().toISOString().slice(0, 10);
      const expDate = expirationDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10);
      const sPhone = supportPhone || "";
      
      await runQuery(
        `INSERT INTO users (uid, name, email, role, branch, status, tenant_id, password, created_at)
         VALUES (?, ?, ?, 'admin', NULL, 'approved', ?, ?, ?)`,
        [newUid, adminName, adminEmail, newTenantId, adminPassword, new Date().toISOString()]
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
      
      const newTenantId = `tenant_${Date.now()}`;
      const newUid = `user_${Date.now()}`;
      const actDate = activationDate || new Date().toISOString().slice(0, 10);
      const expDate = expirationDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10);
      const sPhone = supportPhone || "";
      
      const newUser = {
        uid: newUid,
        name: adminName,
        email: adminEmail,
        role: 'admin',
        status: 'approved',
        tenantId: newTenantId,
        password: adminPassword,
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
    res.status(500).json({ error: err.message });
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
