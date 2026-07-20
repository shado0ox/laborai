import pg from "pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const { Pool } = pg;

// Parse Host and Port
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
const DB_DATABASE = process.env.DB_DATABASE || "labor_management_db";

async function runMigration() {
  if (!DB_PASSWORD) {
    console.error("\x1b[31m%s\x1b[0m", "خطأ حرج: لم يتم العثور على متغير البيئة DB_PASSWORD.");
    console.error("\x1b[31m%s\x1b[0m", "يرجى تعيين DB_PASSWORD في ملف .env ثم تشغيل السكربت مجدداً.");
    process.exit(1);
  }

  console.log("\x1b[36m%s\x1b[0m", "جاري الاتصال بقاعدة البيانات لتشفير كلمات المرور الحالية...");
  console.log(`المضيف: ${DB_HOST}:${DB_PORT}, المستخدم: ${DB_USER}, قاعدة البيانات: ${DB_DATABASE}`);

  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    connectionTimeoutMillis: 5000,
  });

  let client;
  try {
    client = await pool.connect();
    console.log("\x1b[32m%s\x1b[0m", "✓ تم الاتصال بقاعدة البيانات بنجاح.");

    // Check if users table exists
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.warn("\x1b[33m%s\x1b[0m", "تنبيه: جدول المستخدمين 'users' غير موجود حالياً في قاعدة البيانات. لم يتم إجراء أي تغييرات.");
      return;
    }

    // Retrieve all users
    const result = await client.query("SELECT uid, name, email, password FROM users");
    const users = result.rows;

    console.log(`تم العثور على ${users.length} مستخدم في قاعدة البيانات.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const { uid, name, email, password } = user;

      if (!password) {
        console.log(`المستخدم [${name} - ${email}]: لا توجد كلمة مرور مسجلة. (تخطي)`);
        skippedCount++;
        continue;
      }

      const isBcrypt = password.startsWith("$2a$") || password.startsWith("$2b$");
      if (isBcrypt) {
        console.log(`المستخدم [${name} - ${email}]: كلمة المرور مشفرة بالفعل (bcrypt). (تخطي)`);
        skippedCount++;
        continue;
      }

      console.log(`جاري تشفير كلمة مرور المستخدم [${name} - ${email}]...`);
      const hashedPassword = await bcrypt.hash(password, 10);

      await client.query("UPDATE users SET password = $1 WHERE uid = $2", [hashedPassword, uid]);
      console.log(`\x1b[32m✓ تم تحديث وتشفير كلمة مرور [${name}] بنجاح.\x1b[0m`);
      migratedCount++;
    }

    console.log("\n\x1b[32m==========================================================================\x1b[0m");
    console.log(`\x1b[32m✓ اكتملت عملية الهجرة والترقية بنجاح!\x1b[0m`);
    console.log(`- إجمالي المستخدمين الذين تم تشفير كلمات مرورهم: ${migratedCount}`);
    console.log(`- إجمالي المستخدمين الذين تم تخطيهم (مشفرة بالفعل أو فارغة): ${skippedCount}`);
    console.log("\x1b[33mتنبيه هام: يرجى إبلاغ جميع المستخدمين الحاليين بضرورة تغيير كلمات مرورهم الافتراضية فوراً.\x1b[0m");
    console.log("\x1b[32m==========================================================================\n\x1b[0m");

  } catch (err: any) {
    console.error("\x1b[31m%s\x1b[0m", `❌ خطأ أثناء تشغيل الهجرة: ${err.message}`);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runMigration();
