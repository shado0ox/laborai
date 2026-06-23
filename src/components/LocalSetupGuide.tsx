import React from 'react';
import { Server, Database, Container, Shield, Terminal, Settings2, Code, FileCode2, Cpu, Info } from 'lucide-react';

export default function LocalSetupGuide() {
  return (
    <div className="space-y-6">
      {/* Visual Recommendation Box */}
      <div className="bg-gradient-to-br from-[#0c3154] via-[#0d5189] to-[#1a72b8] text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-12 -translate-y-12 blur-2xl"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary-light/10 rounded-full translate-x-20 translate-y-20 blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-yellow-400">
              <Cpu className="w-6 h-6 animate-pulse" />
            </span>
            <span className="text-sm font-semibold tracking-wider text-primary-bg/90 uppercase">استشارة من مطور ومصمم جرافيك محترف</span>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-extrabold mb-4 leading-tight">
            نعم، ننصح بقوة باستخدام Docker مع MariaDB و phpMyAdmin لبناء هذا النظام محلياً!
          </h2>
          
          <p className="text-primary-bg/90 text-sm md:text-base leading-relaxed mb-6 max-w-4xl">
            كرؤية هندسية وتصميمية متكاملة، يمثّل هذا الثنائي أفضل بنية تحتية برمجية عملية وسهلة لتشغيل نظام مالي وإداري محلي. فالتصميم الواعي لا يقتصر على جماليات الشاشات بل يمتد إلى سهولة الإدارة عبر لوحة تحكم phpMyAdmin الشهيرة.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-yellow-300 font-bold mb-1.5">
                <Container className="w-5 h-5 flex-shrink-0" />
                <span>سهولة Docker الاستثنائية</span>
              </div>
              <span className="text-xs text-slate-200">
                يضمن تشغيل قاعدة البيانات ولوحة phpMyAdmin محلياً بضغط زر واحدة (Docker Compose) دون الحاجة لمعالجة تضارب إصدارات النظام أو مشاكل التعريفات.
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-emerald-300 font-bold mb-1.5">
                <Database className="w-5 h-5 flex-shrink-0" />
                <span>قوة وسهولة MariaDB</span>
              </div>
              <span className="text-xs text-slate-200">
                قاعدة بيانات علائقية سريعة وخفيفة جداً، تدعم المعاملات المالية ومتوافقة تماماً مع معمارية ARM64 للـ Orange Pi وتوفر أداءً باهراً للبيانات المحلية.
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-sky-300 font-bold mb-1.5">
                <Shield className="w-5 h-5 flex-shrink-0" />
                <span>سهولة الإدارة بـ phpMyAdmin</span>
              </div>
              <span className="text-xs text-slate-200">
                لوحة تحكم مرئية شهيرة باللغة العربية تتيح لك متابعة الجداول، إضافة البيانات، والنسخ الاحتياطي بكل سلاسة دون الحاجة لكتابة أوامر برمجية معقدة.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Deployment System Architecture blueprint */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" />
          <span>المخطط الهندسي لتوزيع السيرفر المحلي (Local Infrastructure Map)</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2 font-bold">1</div>
            <h4 className="font-bold text-sm text-slate-800 mb-1">واجهة المستخدم (React + Tailwind)</h4>
            <span className="text-xs text-slate-500">منظومة شاشات سريعة جداً وتفاعلية مبنية على نظام Vite لتقدم للمستخدم تجربة كلاسيكية باهرة.</span>
          </div>
          
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2 font-bold">2</div>
            <h4 className="font-bold text-sm text-slate-800 mb-1">الخلفية البرمجية API (NodeJS / Express)</h4>
            <span className="text-xs text-slate-500">خادم ويب محلي يستقبل طلبات الواجهة (المدفوعات، التحديثات) ويقوم بالتحقق من الصلاحيات والتحويل الهجري.</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2 font-bold">3</div>
            <h4 className="font-bold text-sm text-slate-800 mb-1">حاوية Docker للبيانات (MariaDB / MySQL)</h4>
            <span className="text-xs text-slate-500">حاوية معزولة تماماً تضمن تشغيل وتخزين كافة جداول النظام مع إتاحة الاتصال من السيرفر المحلي فقط.</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2 font-bold">4</div>
            <h4 className="font-bold text-sm text-slate-800 mb-1">نظام الحفظ والنسخ الآلي (Cron Backup)</h4>
            <span className="text-xs text-slate-500">سكريبت بسيط يقرأ في خلفية السيرفر ويحفظ نسخة احتياطية مشفرة لملفات الـ database يومياً على قرص صلب خارجي.</span>
          </div>
        </div>
      </div>

      {/* Code Blueprints Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Container 1: Docker Compose file */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-indigo-600" />
              <span>ملف التكوين: docker-compose.yml</span>
            </h3>
            <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-mono">YAML Config</span>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            قم بإنشاء هذا الملف لتشغيل خادم قاعدة بيانات MariaDB مع أداة phpMyAdmin بضغطة زر واحدة عبر مركب الدوكر <code>docker compose up -d</code>.
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-x-auto flex-grow" dir="ltr">
{`services:
  mariadb_db:
    image: mariadb:10.11
    container_name: labor_mariadb_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: StrongLocalRootPassword2026
      MYSQL_USER: labor_admin
      MYSQL_PASSWORD: StrongLocalPassword2026
      MYSQL_DATABASE: labor_management_db
    ports:
      - "3306:3306"
    volumes:
      - mariadb_data:/var/lib/mysql

  phpmyadmin:
    image: phpmyadmin:latest
    container_name: labor_phpmyadmin
    restart: always
    environment:
      PMA_HOST: mariadb_db
      PMA_PORT: 3306
    ports:
      - "8085:80" # تم تشغيله على بورت 8085 لتفادي تعارض بورت 80 و 8080 المحجوزة
    depends_on:
      - mariadb_db

volumes:
  mariadb_data:`}
          </pre>
        </div>

        {/* Container 2: MySQL / MariaDB Tables Blueprint */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              <span>سكريبت بناء الجداول: schema.sql</span>
            </h3>
            <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-mono">SQL Schema</span>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            السكريبت الأمثل لبناء الجداول الأساسية مع تفعيل العلاقات المتبادلة والتحويلات وتخزين السجلات المالية بدقة متناهية متوافقة مع MariaDB / MySQL.
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-x-auto flex-grow" dir="ltr">
{`-- schema.sql
-- جدول الموظفين العمالة
CREATE TABLE IF NOT EXISTS employees (
    iqama_no VARCHAR(15) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    iqama_expiry DATE NOT NULL,
    mobile VARCHAR(20),
    branch VARCHAR(100),
    iqama_balance DECIMAL(12, 2) DEFAULT 0.00,
    kafala_count INT DEFAULT 0,
    other_debt DECIMAL(12, 2) DEFAULT 0.00,
    other_debt_desc TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active', -- active, archived
    archive_reason VARCHAR(255),
    archive_date DATETIME,
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    kafala_start_month VARCHAR(50),
    kafala_start_year VARCHAR(10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول مقبوضات الدفع والتدفق المالي
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iqama_no VARCHAR(15),
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    hijri_month INT,
    hijri_year INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (iqama_no) REFERENCES employees(iqama_no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`}
          </pre>
        </div>

      </div>

      {/* Pro Tips from Visual Designer viewpoint */}
      <div className="bg-[#f0f9ff] border border-sky-100 rounded-2xl p-5">
        <h4 className="font-bold text-slate-950 flex items-center gap-2 mb-2 text-sm text-[#0369a1]">
          <Info className="w-4 h-4 flex-shrink-0 text-[#0284c7]" />
          <span>نصائح إضافية لتجربة مستخدم مذهلة (Professional UX & Styling Tips)</span>
        </h4>
        <ul className="list-disc list-inside space-y-2 text-xs text-[#0c4a6e] leading-relaxed">
          <li>
            <strong>استخدم خط Tajawal للواجهات و JetBrains Mono للأرقام:</strong> تفعيل خطوط متباينة يسهم في تسهيل قراءة تفاصيل الأرصدة والهوويات وأرقام الجوال بشكل رائع وجذاب.
          </li>
          <li>
            <strong>الألوان الرمزية لتواريخ الانتهاء:</strong> صمم واجهتك لتقوم بتسليط الضوء سريعاً وبصرياً عبر مستويات التحذير لكي يدرك موظف الإدارة بلمحة واحدة أين يتطلب التدخل (الأحمر للنهاية الحرجة، البرتقالي للمهلة، والأخضر للأمان).
          </li>
          <li>
            <strong>حفظ تفاصيل السدادت في متصفح العميل عند الطوارئ:</strong> قم ببناء آلية تخزين احتياطي في LocalStorage للعميل كمنفذ طوارئ إضافي ريثما يعود اتصال السيرفر المحلي للعمل بنجاح.
          </li>
        </ul>
      </div>
    </div>
  );
}
