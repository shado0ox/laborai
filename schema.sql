-- 1. جدول المستخدمين (users)
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

-- 2. جدول الموظفين (employees)
CREATE TABLE IF NOT EXISTS employees (
    iqama_no VARCHAR(15) NOT NULL,
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
    saudi_entry_date DATE,
    tenant_id VARCHAR(128) NOT NULL DEFAULT '',
    PRIMARY KEY (tenant_id, iqama_no)
);

-- 3. جدول الدفعات (payments)
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(128) NOT NULL,
    iqama_no VARCHAR(15) NOT NULL,
    name VARCHAR(255) NOT NULL,
    branch VARCHAR(150) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(150) NOT NULL,
    transaction_kind VARCHAR(20),
    category VARCHAR(20),
    balance_included BOOLEAN,
    kafala_period JSONB,
    kafala_exempt_months JSONB,
    cash_account VARCHAR(10),
    date DATE NOT NULL,
    notes TEXT,
    hijri_month VARCHAR(50),
    hijri_year VARCHAR(10),
    tenant_id VARCHAR(128) NOT NULL DEFAULT '',
    PRIMARY KEY (tenant_id, id)
);

-- 4. جدول إعدادات التسعير (pricing_settings)
CREATE TABLE IF NOT EXISTS pricing_settings (
    tenant_id VARCHAR(128) PRIMARY KEY,
    kafala DECIMAL(10, 2) NOT NULL DEFAULT 250.00,
    iqama_3 DECIMAL(10, 2) NOT NULL DEFAULT 3550.00,
    iqama_6 DECIMAL(10, 2) NOT NULL DEFAULT 7100.00,
    iqama_12 DECIMAL(10, 2) NOT NULL DEFAULT 14200.00,
    ramadan_free BOOLEAN DEFAULT TRUE
);

-- 5. جدول إعدادات المؤسسة (company_settings)
CREATE TABLE IF NOT EXISTS company_settings (
    tenant_id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT 'برنامج إدارة العمالة المهنية',
    logo_base64 TEXT,
    allow_ledger_for_users BOOLEAN DEFAULT FALSE,
    activation_date VARCHAR(100),
    expiration_date VARCHAR(100),
    support_phone VARCHAR(100)
);

-- 6. جدول سجلات العمليات (activity_logs)
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(128) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    "user" VARCHAR(255) NOT NULL,
    time VARCHAR(100),
    tenant_id VARCHAR(128)
);

-- 7. جدول الفروع (branches)
CREATE TABLE IF NOT EXISTS branches (
    name VARCHAR(150) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL DEFAULT '',
    PRIMARY KEY (name, tenant_id)
);

-- 8. جدول دفتر الأستاذ العام (general_ledger)
CREATE TABLE IF NOT EXISTS general_ledger (
    id VARCHAR(128) NOT NULL,
    date DATE NOT NULL,
    bayan TEXT NOT NULL,
    branch VARCHAR(150),
    category VARCHAR(150),
    reference VARCHAR(100),
    cash_account VARCHAR(10),
    counterpart_account VARCHAR(150),
    cash_effect VARCHAR(10),
    debit DECIMAL(12, 2) DEFAULT 0.00,
    credit DECIMAL(12, 2) DEFAULT 0.00,
    tenant_id VARCHAR(128) NOT NULL DEFAULT '',
    created_at VARCHAR(100),
    PRIMARY KEY (tenant_id, id)
);

-- ملاحظة أمان: عمود password يجب أن يحتوي دائماً على قيمة مُشفّرة بـ bcrypt (تبدأ بـ $2a$ أو $2b$).
-- الخادم (server.ts) لا يقبل تسجيل الدخول بكلمات مرور نصية (plaintext) بعد الآن.

-- حسابات مسؤولي المحلات: المديونية مستقلة عن الدفع النقدي الفعلي.
CREATE TABLE IF NOT EXISTS shop_entries (
    tenant_id VARCHAR(128) NOT NULL DEFAULT '', id VARCHAR(128) NOT NULL,
    branch VARCHAR(150) NOT NULL, date DATE NOT NULL, year INTEGER NOT NULL,
    kind VARCHAR(20) NOT NULL, amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    category VARCHAR(150) NOT NULL, description TEXT NOT NULL, reference VARCHAR(100),
    responsible VARCHAR(255), notes TEXT, paid_by_company BOOLEAN NOT NULL DEFAULT FALSE,
    cash_account VARCHAR(10) NOT NULL DEFAULT 'cash', created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_reference_unique ON shop_entries (tenant_id, branch, reference)
WHERE reference IS NOT NULL AND reference <> '';


CREATE TABLE IF NOT EXISTS worker_leaves (
    tenant_id VARCHAR(128) NOT NULL DEFAULT '', id VARCHAR(128) NOT NULL,
    iqama_no VARCHAR(15) NOT NULL, departure_date DATE NOT NULL,
    expected_return_date DATE NOT NULL, actual_return_date DATE,
    policy VARCHAR(20) NOT NULL, exempt_months JSONB NOT NULL DEFAULT '[]', exception_reason TEXT,
    cancelled BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by VARCHAR(128) NOT NULL, PRIMARY KEY (tenant_id,id),
    CONSTRAINT worker_leaves_employee_fk FOREIGN KEY (tenant_id,iqama_no) REFERENCES employees(tenant_id,iqama_no) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS worker_leaves_employee_date ON worker_leaves (tenant_id,iqama_no,departure_date);
