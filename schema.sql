-- schema.sql
-- سكريبت إنشاء قاعدة البيانات وإعداد الجداول متوافق تماماً مع MySQL / MariaDB

-- 1. جدول المشرفين والمستخدمين (UserProfile)
CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'viewer', -- admin, branch, viewer
    branch VARCHAR(150),
    status VARCHAR(50) DEFAULT 'approved', -- pending, approved, rejected
    tenant_id VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. جدول الموظفين / العمالة (Employee)
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iqama_no VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50), -- رقم الموظف/رقم تعريف الموظف
    iqama_expiry DATE NOT NULL, -- تاريخ انتهاء الإقامة YYYY-MM-DD
    mobile VARCHAR(20),
    branch VARCHAR(150) NOT NULL,
    iqama_balance DECIMAL(10, 2) DEFAULT 0.00, -- الرصيد المالي المتبقي للإقامة
    kafala_count INT DEFAULT 0, -- عدد الشهور المتبقية للكفالة
    other_debt DECIMAL(10, 2) DEFAULT 0.00, -- ديون أخرى
    other_debt_desc TEXT, -- وصف الديون الأخرى
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active', -- active, archived
    archive_reason VARCHAR(255),
    archive_date DATETIME,
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    kafala_start_month VARCHAR(50),
    kafala_start_year VARCHAR(10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. جدول المقبوضات والدفع (Payment)
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iqama_no VARCHAR(15) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(150) NOT NULL, -- كفالة، إقامة، دفعة، إلخ
    date DATE NOT NULL, -- تاريخ الدفعة YYYY-MM-DD
    notes TEXT,
    hijri_month INT,
    hijri_year INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (iqama_no) REFERENCES employees(iqama_no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. جدول تجديد الإقامات (IqamaRenewal)
CREATE TABLE IF NOT EXISTS iqama_renewals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iqama_no VARCHAR(15) NOT NULL,
    renew_months INT NOT NULL,
    renew_cost DECIMAL(10, 2) NOT NULL,
    new_expiry DATE NOT NULL,
    notes TEXT,
    renew_date DATE NOT NULL, -- تاريخ حركة التجديد YYYY-MM-DD
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (iqama_no) REFERENCES employees(iqama_no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. جدول حركات احتساب الكفالة (KafalaOrder)
CREATE TABLE IF NOT EXISTS kafala_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iqama_no VARCHAR(15) NOT NULL,
    from_month VARCHAR(50),
    from_year VARCHAR(10),
    months INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    order_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (iqama_no) REFERENCES employees(iqama_no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. جدول إعدادات التسعير (PricingSettings)
CREATE TABLE IF NOT EXISTS pricing_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kafala DECIMAL(10, 2) NOT NULL DEFAULT 850.00,
    iqama_3 DECIMAL(10, 2) NOT NULL DEFAULT 650.00,
    iqama_6 DECIMAL(10, 2) NOT NULL DEFAULT 1100.00,
    iqama_12 DECIMAL(10, 2) NOT NULL DEFAULT 1800.00,
    ramadan_free TINYINT(1) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. جدول إعدادات الشركة (CompanySettings)
CREATE TABLE IF NOT EXISTS company_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT 'مؤسسة العمالة لإدارة الموارد البشرية',
    logo_base64 LONGTEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. سجل الحركات والأنشطة (ActivityLog)
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- login, add, pay, arc, del, restore, update
    text TEXT NOT NULL,
    user VARCHAR(255) NOT NULL,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- إدراج بيانات الإعدادات الافتراضية
INSERT INTO pricing_settings (kafala, iqama_3, iqama_6, iqama_12, ramadan_free) 
VALUES (850.00, 650.00, 1100.00, 1800.00, 0)
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO company_settings (name) 
VALUES ('مؤسسة العمالة لإدارة الموارد البشرية')
ON DUPLICATE KEY UPDATE id=id;
