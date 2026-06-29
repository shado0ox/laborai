import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

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
    // Simple fallback parsing if URL constructor fails
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
const DB_PORT = detectedPort || parseInt(process.env.DB_PORT || "3306");
const DB_USER = process.env.DB_USER || "labor_admin";
const DB_PASSWORD = process.env.DB_PASSWORD || "StrongLocalPassword2026";
const DB_DATABASE = process.env.DB_DATABASE || "labor_management_db";

let pool: mysql.Pool | null = null;
let dbStatus: "connected" | "disconnected" = "disconnected";
let dbError: string | null = null;

// Connect to MariaDB with retry logic
async function connectDB() {
  let attempts = 3;
  let lastError = "";
  while (attempts > 0) {
    try {
      console.log(`Connecting to database at ${DB_HOST}:${DB_PORT}...`);
      pool = mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: "utf8mb4",
        connectTimeout: 2000, // Fail fast on unreachable servers
      });
      
      // Test the connection
      const conn = await pool.getConnection();
      console.log("✓ Successfully connected to MariaDB database!");
      dbStatus = "connected";
      dbError = null;
      conn.release();
      break;
    } catch (err: any) {
      console.log(`[DB INFO] Database connection status: offline (${err.message}). Retrying in 1.5 seconds...`);
      lastError = err.message || String(err);
      dbStatus = "disconnected";
      dbError = lastError;
      pool = null;
      attempts--;
      if (attempts > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  if (!pool) {
    console.warn("⚠️ Warning: Could not connect to the MariaDB server. Falling back to dynamic mock state in-memory.");
    console.warn(`💡 Tip: If you are running this app manually outside Docker (e.g. npm start / npm run dev),`);
    console.warn(`   make sure your .env file has DB_HOST set to '127.0.0.1' or your server's IP '192.168.1.84' instead of 'mariadb_db'!`);
    dbStatus = "disconnected";
    dbError = (lastError || "Failed to connect to database after 5 attempts") + 
              "\n(Tip: If running outside Docker, set DB_HOST to 127.0.0.1 or 192.168.1.84)";
  }
}

// Auto-migration helper to setup tables in MariaDB matching schema.sql
async function initializeTables() {
  if (!pool) return;
  try {
    const conn = await pool.getConnection();
    
    // 1. Users table
    await conn.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Employees table
    await conn.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Payments table
    await conn.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Pricing Settings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS pricing_settings (
        tenant_id VARCHAR(128) PRIMARY KEY,
        kafala DECIMAL(10, 2) NOT NULL DEFAULT 250.00,
        iqama_3 DECIMAL(10, 2) NOT NULL DEFAULT 3550.00,
        iqama_6 DECIMAL(10, 2) NOT NULL DEFAULT 7100.00,
        iqama_12 DECIMAL(10, 2) NOT NULL DEFAULT 14200.00,
        ramadan_free TINYINT(1) DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Company Settings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        tenant_id VARCHAR(128) PRIMARY KEY,
        name VARCHAR(255) NOT NULL DEFAULT 'مؤسسة الرواد لإدارة العمالة والتشغيل',
        logo_base64 LONGTEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Activity Logs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(128) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        text TEXT NOT NULL,
        user VARCHAR(255) NOT NULL,
        time VARCHAR(100),
        tenant_id VARCHAR(128)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Branches table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS branches (
        name VARCHAR(150) NOT NULL,
        tenant_id VARCHAR(128) NOT NULL DEFAULT '',
        PRIMARY KEY (name, tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Add index if not exists
    console.log("✓ All MariaDB database tables verified and initialized successfully.");
    conn.release();
  } catch (err: any) {
    console.error("Database migration error during initialization:", err);
  }
}

// In-Memory fallback databases (replaces browser cache when MariaDB is unavailable, but prioritizes MariaDB)
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
  ["", { name: "مؤسسة الرواد لإدارة العمالة والتشغيل" }]
]);
let fallbackPricing: Map<string, any> = new Map([
  ["", { kafala: 250, iqama3: 3550, iqama6: 7100, iqama12: 14200, ramadanFree: true }]
]);


// --- API ROUTES ---

// Helper function to safe run SQL queries
async function runQuery(sql: string, params: any[] = []): Promise<any> {
  if (pool) {
    const [rows] = await pool.execute(sql, params);
    return rows;
  }
  return null;
}

// 0. Database Connection Status & Diagnostics
app.get("/api/db-status", (req, res) => {
  res.json({
    status: dbStatus,
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    database: DB_DATABASE,
    error: dbError
  });
});

// 1. Authentication & Users
app.get("/api/users", async (req, res) => {
  try {
    if (pool) {
      const rows: any = await runQuery("SELECT * FROM users ORDER BY created_at DESC");
      const mapped = rows.map((r: any) => ({
        uid: r.uid,
        name: r.name,
        email: r.email,
        role: r.role,
        branch: r.branch || undefined,
        createdAt: r.created_at,
        password: r.password || undefined,
        status: r.status || "approved",
        tenantId: r.tenant_id || undefined,
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
  try {
    if (pool) {
      await runQuery(
        "INSERT INTO users (uid, name, email, role, branch, status, tenant_id, password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=?, role=?, branch=?, status=?, password=?",
        [
          u.uid,
          u.name,
          u.email,
          u.role,
          u.branch || null,
          u.status || "approved",
          u.tenantId || null,
          u.password || null,
          u.createdAt || new Date().toISOString(),
          // Updates
          u.name,
          u.role,
          u.branch || null,
          u.status || "approved",
          u.password || null,
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
  const updates = req.body; // e.g. status, role, branch
  try {
    if (pool) {
      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(updates)) {
        if (k === "status") { fields.push("status = ?"); values.push(v); }
        if (k === "role") { fields.push("role = ?"); values.push(v); }
        if (k === "branch") { fields.push("branch = ?"); values.push(v || null); }
      }
      if (fields.length > 0) {
        values.push(uid);
        await runQuery(`UPDATE users SET ${fields.join(", ")} WHERE uid = ?`, values);
      }
      return res.json({ success: true });
    } else {
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
      await runQuery("DELETE FROM users WHERE uid = ?", [uid]);
      return res.json({ success: true });
    } else {
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
        otherDebtDesc: r.other_debt_desc || undefined,
        notes: r.notes || "",
        status: r.status || "active",
        archiveReason: r.archive_reason || undefined,
        archiveDate: r.archive_date || undefined,
        addedDate: r.added_date || undefined,
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
      await runQuery(
        `INSERT INTO employees (
          iqama_no, name, employee_id, iqama_expiry, mobile, branch, iqama_balance, 
          kafala_count, other_debt, other_debt_desc, notes, status, archive_reason, 
          archive_date, added_date, kafala_start_month, kafala_start_year, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          name=?, employee_id=?, iqama_expiry=?, mobile=?, branch=?, iqama_balance=?,
          kafala_count=?, other_debt=?, other_debt_desc=?, notes=?, status=?, archive_reason=?,
          archive_date=?, added_date=?, kafala_start_month=?, kafala_start_year=?`,
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
          tenantId || null,
          // Update columns
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
      await runQuery(
        `INSERT INTO payments (id, iqama_no, name, branch, amount, type, date, notes, hijri_month, hijri_year, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=?, branch=?, amount=?, type=?, date=?, notes=?, hijri_month=?, hijri_year=?`,
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
          tenantId || null,
          // Update
          p.name,
          p.branch,
          p.amount,
          p.type,
          p.date,
          p.notes || null,
          p.hijriMonth || null,
          p.hijriYear || null,
        ]
      );
      return res.json({ success: true, payment: p });
    } else {
      const fullPay = { ...p, tenantId };
      const existingIdx = fallbackPayments.findIndex((item) => item.id === p.id);
      if (existingIdx !== -1) {
        fallbackPayments[existingIdx] = fullPay;
      } else {
        fallbackPayments.unshift(fullPay);
      }
      return res.json({ success: true, payment: fullPay });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 4. Settings APIs (Company / Pricing / Branches)
app.get("/api/company-settings", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
  try {
    if (pool) {
      const rows: any = await runQuery("SELECT * FROM company_settings WHERE tenant_id = ?", [tenantId]);
      if (rows.length > 0) {
        return res.json({
          name: rows[0].name,
          logoBase64: rows[0].logo_base64 || undefined,
        });
      }
      return res.json({ name: tenantId ? `لوحة حسابات ومساحة` : "مؤسسة الرواد لإدارة العمالة والتشغيل" });
    }
    return res.json(fallbackCompany.get(tenantId) || { name: "مؤسسة الرواد لإدارة العمالة والتشغيل" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/company-settings", async (req, res) => {
  const s = req.body;
  const tenantId = (req.query.tenantId as string) || "";
  try {
    if (pool) {
      await runQuery(
        "INSERT INTO company_settings (tenant_id, name, logo_base64) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, logo_base64 = ?",
        [tenantId, s.name, s.logoBase64 || null, s.name, s.logoBase64 || null]
      );
      return res.json({ success: true });
    } else {
      fallbackCompany.set(tenantId, s);
      return res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
      await runQuery(
        `INSERT INTO pricing_settings (tenant_id, kafala, iqama_3, iqama_6, iqama_12, ramadan_free)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE kafala=?, iqama_3=?, iqama_6=?, iqama_12=?, ramadan_free=?`,
        [tenantId, s.kafala, s.iqama3, s.iqama6, s.iqama12, s.ramadanFree ? 1 : 0, s.kafala, s.iqama3, s.iqama6, s.iqama12, s.ramadanFree ? 1 : 0]
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

// 5. Branches API
app.get("/api/branches", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
  try {
    if (pool) {
      const rows: any = await runQuery("SELECT name FROM branches WHERE tenant_id = ? ORDER BY name ASC", [tenantId]);
      return res.json(rows.map((r: any) => r.name));
    }
    return res.json(fallbackBranches.get(tenantId) || (tenantId ? [] : ["فرع الرياض الأساسي", "فرع جدة الغربية", "فرع الدمام الشرقية", "فرع مكة المكرمة"]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/branches", async (req, res) => {
  const list = req.body; // Array of strings
  const tenantId = (req.query.tenantId as string) || "";
  try {
    if (pool) {
      await runQuery("DELETE FROM branches WHERE tenant_id = ?", [tenantId]);
      for (const b of list) {
        await runQuery("INSERT INTO branches (name, tenant_id) VALUES (?, ?)", [b, tenantId]);
      }
      return res.json({ success: true });
    } else {
      fallbackBranches.set(tenantId, list);
      return res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 6. Activity Logs API
app.get("/api/logs", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
  try {
    if (pool) {
      let rows: any;
      if (tenantId) {
        rows = await runQuery("SELECT * FROM activity_logs WHERE tenant_id = ? ORDER BY time DESC LIMIT 200", [tenantId]);
      } else {
        rows = await runQuery("SELECT * FROM activity_logs WHERE tenant_id IS NULL OR tenant_id = '' ORDER BY time DESC LIMIT 200");
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/logs", async (req, res) => {
  const l = req.body;
  const tenantId = (req.query.tenantId as string) || "";
  try {
    if (pool) {
      await runQuery(
        "INSERT INTO activity_logs (id, type, text, user, time, tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
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

app.delete("/api/logs", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "";
  try {
    if (pool) {
      await runQuery("DELETE FROM activity_logs WHERE tenant_id = ?", [tenantId]);
      return res.json({ success: true });
    } else {
      fallbackLogs = fallbackLogs.filter((l) => l.tenantId !== tenantId);
      return res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 7. General Wipe/Reset database API (Deletes all except basic user setup or defaults)
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


// Initialize database and start server
async function startServer() {
  // Start database connection and table initialization in the background
  // to prevent blocking server start on unreachable databases.
  connectDB()
    .then(() => {
      return initializeTables();
    })
    .catch((err) => {
      console.error("❌ Error in background database initialization:", err);
    });

  // Vite Integration for full-stack dev/production asset delivery
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
