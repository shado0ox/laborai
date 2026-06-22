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
            نعم، ننصح بقوة باستخدام Docker مع PostgreSQL لبناء هذا النظام محلياً!
          </h2>
          
          <p className="text-primary-bg/90 text-sm md:text-base leading-relaxed mb-6 max-w-4xl">
            كرؤية هندسية وتصميمية متكاملة، يمثّل هذا الثنائي أفضل بنية تحتية برمجية ممكنة لتشغيل نظام مالي وإداري محلي. فالتصميم الواعي لا يقتصر على جماليات الشاشات بل يمتد إلى متانة وجمال معالجة البيانات وأمانها.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-yellow-300 font-bold mb-1.5">
                <Container className="w-5 h-5 flex-shrink-0" />
                <span>سهولة Docker الاستثنائية</span>
              </div>
              <span className="text-xs text-slate-200">
                يضمن تشغيل قاعدة البيانات والسيرفر محلياً بضغط زر واحدة (Docker Compose) دون الحاجة لمعالجة تضارب إصدارات النظام أو مشاكل التعريفات.
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-emerald-300 font-bold mb-1.5">
                <Database className="w-5 h-5 flex-shrink-0" />
                <span>قوة PostgreSQL الرهيبة</span>
              </div>
              <span className="text-xs text-slate-200">
                قاعدة بيانات علائقية جبارة تدعم المعاملات المالية الصارمة (ACID)، وتوفر تخزين صيغ JSON الديناميكية لسجلات الحركات، وتعمل بسرعة خارقة عند تنامي سجلات العمالة.
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-sky-300 font-bold mb-1.5">
                <Shield className="w-5 h-5 flex-shrink-0" />
                <span>الأمان والنسخ الاحتياطي</span>
              </div>
              <span className="text-xs text-slate-200">
                عزل تام ومقاومة للأعطال مع إمكانيات أتمتة ممتازة للنسخ الاحتياطي اليومي (Scheduled PostgreSQL Backups) لتفادي أي عطل فني في السيرفر المحلي.
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
            <h4 className="font-bold text-sm text-slate-800 mb-1">حاوية Docker للبيانات (PostgreSQL)</h4>
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
            قم بإنشاء هذا الملف لتشغيل خادم قاعدة بيانات PostgreSQL مع أداة PgAdmin بضغطة زر واحدة عبر مركب الدوكر <code>docker compose up -d</code>.
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-x-auto flex-grow" dir="ltr">
{`# docker-compose.yml
version: '3.8'

services:
  postgres_db:
    image: postgres:15-alpine
    container_name: labor_postgres_db
    restart: always
    environment:
      POSTGRES_USER: labor_admin
      POSTGRES_PASSWORD: StrongLocalPassword2026
      POSTGRES_DB: labor_management_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  pgadmin:
    image: dpage/pgadmin4
    container_name: labor_pgadmin
    restart: always
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@labor.local
      PGADMIN_DEFAULT_PASSWORD: PgAdminPassword2026
    ports:
      - "8080:80"
    depends_on:
      - postgres_db

volumes:
  postgres_data:`}
          </pre>
        </div>

        {/* Container 2: PostgreSQL Tables Blueprint */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              <span>سكريبت بناء الجداول: schema.sql</span>
            </h3>
            <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-mono">SQL Schema</span>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            السكريبت الأمثل لبناء الجداول الأساسية مع تفعيل العلاقات المتبادلة والتحويلات وتخزين السجلات المالية بدقة متناهية.
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
    archive_date TIMESTAMP,
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    kafala_start_month VARCHAR(50),
    kafala_start_year VARCHAR(10)
);

-- جدول مقبوضات الدفع والتدفق المالي
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    iqama_no VARCHAR(15) REFERENCES employees(iqama_no) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(150) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    hijri_month INT,
    hijri_year INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`}
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
