<div align="center">

# LaborAI | نظام إدارة العمالة

**نظام متكامل لإدارة العمالة والفروع والكفالة والإقامات والمدفوعات — واجهة عربية بالكامل**
**A full-stack labor / workforce management system for multi-branch companies — fully Arabic-language interface**

</div>

---

## 🇸🇦 نظرة عامة

**LaborAI** برنامج متكامل لإدارة عمالة الشركات، مبني بواجهة عربية بالكامل، ويسمح لأي شركة توظيف أو استقدام بإدارة:

- بيانات العمال (الكفالة، الإقامة، الفروع، الرواتب)
- المدفوعات والدفتر العام (القيود المحاسبية)
- المستخدمين والأدوار (مدير الشركة / مسؤول فرع / مشاهد فقط)
- إعدادات الشركة والفروع
- سجلات النظام (Audit Logs)

النظام مصمم بمبدأ **تعدد المساحات (Multi-Tenant)**: كل شركة/منشأة تسجّل تحصل على **مساحة خاصة ومعزولة تماماً** عن باقي الشركات المشتركة في نفس التطبيق، ولا تظهر بيانات أي شركة لشركة أخرى.

### ✨ أبرز المزايا
- 🌐 واجهة عربية بالكامل (RTL) مع دعم التقويم الهجري والميلادي
- 🏢 دعم عدة فروع لكل شركة، مع صلاحيات مستقلة لكل فرع
- 👥 نظام أدوار: مدير شركة (Admin) / مسؤول فرع (Branch) / مشاهد (Viewer)
- 🔒 تسجيل عام مقتصر على تسجيل **شركة جديدة (مساحة خاصة مستقلة)**؛ أما إضافة أعضاء/مسؤولي الفروع فتتم **فقط** من داخل لوحة تحكم مدير الشركة
- 💰 دفتر أستاذ عام (General Ledger) وتتبع مدفوعات العمالة
- 📊 لوحة موافقات ومساحات اشتراك خاصة بمطور النظام
- 🐘 قاعدة بيانات PostgreSQL (مع نسخة احتياطية داخل الذاكرة كـ fallback عند تعذر الاتصال)
- 🐳 جاهز للتشغيل بالكامل عبر Docker / Docker Compose

---

## 🇬🇧 Overview

**LaborAI** is a full-stack, Arabic-first workforce management system built for recruitment / labor-supply companies operating across multiple branches. It manages:

- Worker records (kafala sponsorship, iqama/residency, branch assignment, payroll)
- Payments and a general accounting ledger
- Users and roles (company admin / branch manager / viewer)
- Company and branch settings
- System audit logs

The system is **multi-tenant** by design: every company that signs up gets its own **fully isolated private space**. No company can see another company's data.

### ✨ Key Features
- 🌐 Fully Arabic (RTL) interface with Hijri/Gregorian calendar support
- 🏢 Multi-branch support per company, with per-branch access control
- 👥 Role-based access: Company Admin / Branch Manager / Viewer
- 🔒 Public self-registration is limited to **new company sign-up (a fresh private tenant space)**; branch members/managers can **only** be added by the company admin from inside the dashboard
- 💰 General ledger and worker payment tracking
- 📊 Developer approvals panel and subscriber-space management
- 🐘 PostgreSQL-backed (with an in-memory fallback store if the DB is unreachable)
- 🐳 Fully containerized with Docker / Docker Compose

---

## 🧱 التقنيات المستخدمة | Tech Stack

| الطبقة / Layer | التقنية / Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (`pg`), MySQL driver available (`mysql2`) |
| Auth | JWT (`jsonwebtoken`), bcrypt password hashing (`bcryptjs`) |
| Security | Helmet, `express-rate-limit`, Zod schema validation |
| AI | Google Gemini (`@google/genai`) |
| Other | XLSX export (`xlsx`), Framer Motion (`motion`) |

---

## ⚙️ متطلبات التشغيل | Prerequisites

- Node.js 20+
- Docker & Docker Compose (للتشغيل الموصى به / recommended way to run)
- قاعدة بيانات PostgreSQL 15 (يوفرها `docker-compose.yml` تلقائياً / provided automatically by `docker-compose.yml`)

---

## 🔑 متغيرات البيئة | Environment Variables

أنشئ ملف `.env` في جذر المشروع (بجانب `docker-compose.yml`) يحتوي على:
Create a `.env` file at the project root (next to `docker-compose.yml`) containing:

```env
# --- Database ---
DB_HOST=postgres_db
DB_PORT=5432
DB_USER=labor_admin
DB_PASSWORD=your_strong_db_password
DB_DATABASE=labor_management_db

# --- pgAdmin (optional web UI for the DB) ---
PGADMIN_DEFAULT_EMAIL=admin@yourcompany.com
PGADMIN_DEFAULT_PASSWORD=your_pgadmin_password

# --- App / Auth ---
PORT=3150
JWT_SECRET=a_long_random_secret_string
DEV_EMAIL=your.developer.email@example.com
DEV_DEFAULT_PASSWORD=set_a_strong_dev_password

# --- Optional ---
NODE_ENV=production
ALLOW_DESTRUCTIVE_SCHEMA_MIGRATION=false
```

> ⚠️ **لا ترفع ملف `.env` الحقيقي إلى GitHub أبداً** — ضِف `.env` إلى `.gitignore` واحتفظ بالقيم الحقيقية على السيرفر فقط.
> ⚠️ **Never commit your real `.env` file to GitHub** — keep it in `.gitignore` and store real secrets only on the server.

---

## 🚀 التشغيل عبر Docker (الطريقة الموصى بها) | Running with Docker (recommended)

```bash
# 1. استنساخ المشروع | clone the repo
git clone https://github.com/shado0ox/laborai.git
cd laborai

# 2. إنشاء ملف .env كما هو موضح أعلاه | create your .env as shown above

# 3. بناء وتشغيل كل الخدمات | build and start everything
docker compose up -d --build

# متابعة اللوج | follow logs
docker compose logs -f labor_app
```

الخدمات التي سيتم تشغيلها:
Services started:

| الخدمة / Service | Container Name | Port |
|---|---|---|
| التطبيق / App | `labor_app_container` | `3150` |
| قاعدة البيانات / Database | `labor_postgres_db` | `5432` |
| pgAdmin (اختياري) | `labor_pgadmin` | `8085` |

**لتحديث الكود بعد أي تعديل / Redeploying after a code update:**
```bash
git pull
docker compose up -d --build
```
> ملحوظة: بيانات قاعدة البيانات محفوظة في Docker volume منفصل (`postgres_data`) ولا تتأثر بإعادة البناء طالما لم تُستخدم `-v` مع أوامر الحذف.
> Note: database data lives in a separate Docker volume (`postgres_data`) and is not affected by rebuilds, as long as you never run destructive commands with `-v`.

---

## 🧑‍💻 التشغيل محلياً بدون Docker | Running locally without Docker

```bash
npm install
npm run dev      # يشغل الخادم عبر tsx مع الاتصال بقاعدة بيانات محلية
```

للبناء الإنتاجي:
For a production build:
```bash
npm run build    # يبني الواجهة (vite) ويجمّع الخادم (esbuild) في dist/
npm run lint     # فحص الأنواع (TypeScript) بدون تصدير ملفات
```

---

## 🗂️ نظرة على المشروع | Project Structure

```
laborai/
├── server.ts               # Express API + auth + PostgreSQL access layer
├── src/
│   ├── App.tsx             # Main app shell, tabs, and role-based routing
│   ├── types.ts            # Shared TypeScript types (UserProfile, Employee, etc.)
│   └── components/
│       ├── PortalAuthView.tsx        # Login / new-company registration screen
│       ├── PortalApprovalsView.tsx   # Pending user approvals (developer-only)
│       ├── PortalDevPanelView.tsx    # System developer panel
│       ├── PortalSpacesView.tsx      # Subscriber tenant spaces management
│       ├── EmployeeListView.tsx      # Worker records
│       └── GeneralLedgerView.tsx     # Accounting ledger
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## 🔐 الأدوار والصلاحيات | Roles & Access Control

| الدور / Role | الوصف بالعربي | English |
|---|---|---|
| `admin` | مدير الشركة/المساحة — تحكم كامل في شركته فقط | Company/tenant admin — full control scoped to their own company |
| `branch` | مسؤول فرع — صلاحيات محدودة بفرعه، ويُضاف فقط بواسطة مدير الشركة | Branch manager — scoped to their branch, added only by the company admin |
| `viewer` | مشاهدة فقط | Read-only access |

> 🔒 **قاعدة أمان مهمة:** التسجيل العام (بدون تسجيل دخول) متاح فقط لإنشاء شركة/مساحة جديدة (`admin` جديد بتينانت جديد يولّده الخادم). إضافة أعضاء أو مسؤولي فروع لشركة قائمة لا تتم إلا من داخل لوحة تحكم مدير تلك الشركة بعد تسجيل الدخول، ولا يمكن لأي مستخدم اختيار تينانت أو فرع تابع لشركة أخرى.
>
> 🔒 **Important security rule:** Public (unauthenticated) sign-up only creates a brand-new company/tenant (a fresh `admin`, with the tenant ID generated server-side). Adding branch members/managers to an existing company can only be done from inside that company's admin dashboard after login — no user can select a tenant or branch belonging to another company.

---

## 📄 الرخصة | License

مشروع خاص بشادي ناصف.
Private project — owned by Shady Nassef.

