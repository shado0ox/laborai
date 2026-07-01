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

-- 3. جدول الدفعات (payments)
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
    logo_base64 TEXT
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