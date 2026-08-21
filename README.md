<div align="center">

# BeautyFit AI 🪞

### محرك الجمال الذكي القائم على الذكاء الاصطناعي · Privacy-First AI Beauty Engine

**تحليل ملامح الوجه بـ 478 نقطة داخل المتصفح · توصيات علمية للألوان · دروس احترافية مخصصة بالذكاء الاصطناعي**

[![Python](https://img.shields.io/badge/Python-3.13%2B-3776AB?logo=python&logoColor=white)](App/backend)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688?logo=fastapi&logoColor=white)](App/backend)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](App/frontend)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](App/frontend)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](App/frontend)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white)](https://stripe.com)
[![Tests](https://img.shields.io/badge/Tests-42%2F42%20passing-brightgreen)](App/backend/tests)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)](App/docker-compose.yml)

</div>

---

## 📖 نظرة عامة | Overview

**BeautyFit** منصة جمال ذكية تحلل ملامح الوجه وتوصي بمكياج وألوان أحمر شفاه مخصصة. ما يميزها عن أدوات AR المنافسة (ModiFace، Perfect Corp) هو قرارها المعماري الجوهري: **الصورة لا تغادر جهاز المستخدم**. يتم اكتشاف 478 نقطة وجه عبر MediaPipe WASM داخل المتصفح، ويُرسل إلى الخادم إحداثيات رياضية نقية فقط، ليحولها الخادم إلى قياسات هندسية وسكور نمطي سداسي الأبعاد.

BeautyFit is a privacy-first AI beauty platform that analyzes facial features and recommends personalized makeup and lipstick shades. Its core architectural advantage is that **the user's selfie never leaves the device** — 478 face landmarks are detected in-browser via MediaPipe WASM, and only pure mathematical coordinates are sent to the backend, which converts them into geometric measurements and a six-dimensional style score.

### الميزات الجوهرية | Core Capabilities

- 🔒 **الخصوصية بالتصميم** — تحليل الوجه يعمل بالكامل داخل المتصفح عبر WASM؛ الصورة لا تُرفع للخادم
- 🎯 **محرك ألوان علمي** — تطبيق كامل لخوارزمية **CIEDE2000** فوق فضاء **CIELAB** على 6190 منتج أحمر شفاه
- 🎨 **بحث دلالي متعدد اللغات** — عربي/إنجليزي/صيني بقواعد NLP للبحث عن المنتجات بالوصف لا بالكود
- 🤖 **دروس Pro مخصصة بالذكاء الاصطناعي** — توليد عبر DeepSeek مع نظام صور ثلاثي الطبقات (Gemini → OpenRouter → Pollinations)
- 💳 **بوابة دفع Stripe** — دفع لمرة واحدة + اشتراك شهري مع التحقق عبر Webhook
- 🔐 **مصادقة Supabase Auth** — OIDC + JWT في HttpOnly Cookie + تحكم وصول من الخادم (Entitlement)
- 📈 **SEO احترافي** — prerender للمقالات + sitemap + robots.txt

---

## 🏗️ البنية المعمارية | Architecture

```
BeautyFit-AI/
├── App/
│   ├── backend/                 # FastAPI · Python 3.11+ (المحرك المعرفي + الدفع + المصادقة)
│   │   ├── core/                # config · database · auth · enums · crypto
│   │   ├── models/              # SQLAlchemy ORM: User · OIDCState · Entitlement
│   │   ├── schemas/             # Pydantic request/response contracts
│   │   ├── routers/             # REST endpoints (auto-discovered)
│   │   ├── services/            # Business logic (face analysis · color engine · AI · payments)
│   │   ├── dependencies/        # FastAPI DI: auth · database
│   │   ├── middlewares/         # rate_limit.py — تحديد المعدل (60 req/min/IP)
│   │   ├── alembic/             # DB migrations
│   │   ├── tests/               # pytest suite (42 tests)
│   │   ├── data/                # lipstick_enriched.json — 6190 records (LAB colors)
│   │   ├── Dockerfile           # صورة إنتاج متعددة المراحل (non-root + healthcheck)
│   │   └── lambda_handler.py    # AWS Lambda entrypoint (mangum)
│   │
│   ├── frontend/                # React 18 · TypeScript · Vite 5 (الواجهة + تحليل الوجه)
│   │   ├── src/
│   │   │   ├── pages/           # Route components (analyze · results · checkout · auth · pro)
│   │   │   ├── components/      # Navbar · PageLayout · shadcn/ui kit
│   │   │   ├── lib/             # httpClient (العميل الموحد) · faceLandmarker · auth · stylize
│   │   │   ├── contexts/        # AuthContext (session management)
│   │   │   ├── api/             # payments · lipsticks · settings clients
│   │   │   └── hooks/           # react-query hooks (useEntitlement · useProEntitlement)
│   │   ├── e2e/                 # Playwright specs
│   │   ├── prerender/           # Static blog prerendering + sitemap
│   │   ├── Dockerfile           # dev (Vite) + prod (nginx) targets
│   │   ├── nginx.conf           # reverse proxy للإنتاج
│   │   └── seo/                 # SEO assets
│   │
│   ├── docker-compose.yml       # stack محلي كامل: postgres + backend + frontend
│   ├── docs/                    # تقارير المراحل + التوثيق المعماري
│   └── start_app_v2.sh          # سكريبت تشغيل الواجهتين معاً
│
├── assets/                      # أصول بصرية للمشروع
├── PITCH_DECK.md                # عرض تقديمي للمستثمرين
└── .github/workflows/ci.yml     # CI: اختبارات الخلفية + lint/typecheck/build للواجهة
```

### مخطط تدفق البيانات | Data Flow

```
┌─────────────────┐     MediaPipe WASM (in-browser)     ┌──────────────────┐
│   User Selfie   │ ──────────────────────────────────▶ │  478 landmarks   │
│  (never leaves  │            (478 points)             │  (x, y, z)       │
│   the device)   │ ◀────────────────────────────────── │  normalized     │
└─────────────────┘     renders analysis UI             └────────┬─────────┘
                                                                  │ POST /api/v1/face-analysis/analyze-landmarks
                                                                  ▼
                                                        ┌──────────────────┐
                                                        │  FastAPI Backend │
                                                        │  14 metrics +   │
                                                        │  6D style score  │
                                                        └────────┬─────────┘
                                                                  │
                                              ┌───────────────────┼───────────────────┐
                                              ▼                   ▼                   ▼
                                    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                                    │ Lipstick Engine │ │  Pro Tutorial   │ │   Stripe Pay    │
                                    │ CIEDE2000 + LAB │ │  DeepSeek + 3-   │ │  Webhook +       │
                                    │ 6190 products   │ │  layer image gen │ │  Entitlement     │
                                    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 🧠 المحرك المعرفي للوجه | The Cognitive Face Engine

هذا هو الخندق التنافسي الأساسي للمنتج. يتم بناء التحليل على أربع طبقات معرفية:

### 1. اكتشاف المعالم (في المتصفح)
- **478 نقطة** MediaPipe FaceMesh ثلاثية الأبعاد (`frontend/src/lib/faceLandmarker.ts`)
- يعمل بالكامل عبر **WebAssembly** — لا تُرفع الصورة للخادم إطلاقاً
- يتم تحويل الإحداثيات الطبيعية إلى فضاء البكسل قبل الحسابات الهندسية

### 2. القياسات الهندسية (في الخادم)
- **14 قياساً** هندسياً: نسبة الوجه، زاوية الفك، تمايل العين، ملامح الأنف، الخ.
- (`backend/services/face_analysis.py`)

### 3. التصنيف متعدد الوسوم
- شكل الوجه، نوع العين، بنية الأنف، شكل الشفاه — تصنيف علمي موثّق

### 4. السكور النمطي السداسي الأبعاد
- درجات لكل نمط جمالي (Natural، Sweet، Smokey، إلخ) لمطابقة أفضل توصية مع المستخدم

---

## 🎨 محرك ألوان أحمر الشفاه | Lipstick Color Engine

قاعدة بيانات **6190 منتج** بألوان موثّقة في فضاء **CIELAB**، مع محرك مطابقة علمي:

- **CIEDE2000** — تطبيق كامل لخوارزمية الفرق اللوني المعياري الدولي (`backend/routers/lipsticks.py`)
- **Dupe Search** — إيجاد البدائل الأرخص لمنتج معين حسب التشابه اللوني
- **Search by Color** — البحث بـ hex code أو إحداثيات LAB
- **Semantic Search** — بحث وصفي متعدد اللغات (عربي/إنجليزي/صيني)
- **Recommend by Skin** — توصية حسب لون البشرة
- **Color Universe** — تصفح حسب عائلات الألوان

---

## 🤖 الذكاء الاصطناعي التوليدي | Generative AI

### الدروس الاحترافية (Pro Tutorials)
يولّد الخادم دروس مكياج خطوة بخطوة مخصصة لتحليل وجه المستخدم عبر **DeepSeek**.

### نظام توليد الصور ثلاثي الطبقات (Three-Layer Cascade)
نظام احتياطي متقن يضمن توفر الصور حتى عند تجاوز حدود المعدل:

```
Layer 1: Google Gemini (Imagen 3.0)  ──▶  on 429 → rotate key ──▶  on failure ↓
Layer 2: OpenRouter                                              ──▶  on failure ↓
Layer 3: Pollinations (free fallback)                            ──▶  guaranteed output
```

- **GeminiKeyManager** — تدوير تلقائي للمفاتيح عند حد 429 (`backend/services/pro_tutorial.py`)
- **Style-specific prompts** — مطالبات مصممة لكل نمط جمالي وكل نمط فرعي

---

## 🔐 الأمان والمصادقة | Security & Authentication

> تم تنفيذ إصلاحات المرحلة 0 (بوابة الدفع + الأمن + المصادقة) **والمرحلة 1 (الأمن والنزاهة)** والتحقق منها فعلياً (42/42 اختباراً ناجحاً).

### تحصينات المرحلة 1 | Phase 1 Hardening
- **Rate Limiting** — middleware بنافذة ثابتة لكل IP (`MAX_REQUESTS_PER_IP_PER_MIN=60`)، مسارات صحية معفاة، استجابة `429` مع `Retry-After`، ودعم اختياري لرؤوس البروكسي (`RATE_LIMIT_TRUST_PROXY`)
- **عميل HTTP موحّد** — `src/lib/httpClient.ts`: مثيل axios وحيد للواجهة كاملة (auth · payments · lipsticks · settings · stylize) مع ربط التوكن تلقائياً، تجديد جلسة Supabase عند 401 وإعادة المحاولة مرة واحدة، وتوحيد الأخطاء عبر `ApiError`
- **react-query مفعّل** — QueryClient بإعدادات افتراضية (retry · staleTime)، hooks للصلاحيات (`useEntitlement`) وفلترات أحمر الشفاه، و`useMutation` للتحقق من الدفع مع إبطال الكاش فوراً
- **CI/CD** — GitHub Actions: اختبارات الخلفية + lint + typecheck + build للواجهة + فحص بناء Docker
- **Docker** — صور إنتاج متعددة المراحل (backend non-root + healthcheck · frontend nginx) + `docker-compose.yml` stack محلي كامل

### نموذج الصلاحيات (Entitlement) — مصدر الحقيقة من الخادم
جدول `entitlements` في قاعدة البيانات يحل محل العلم المحلي القابل للتزوير:
- `grant_entitlement` — منح Idempotent بالـ Stripe session ID
- `has_active_entitlement` / `get_active_entitlement` — فحص الصلاحية الحية
- `revoke_entitlement` — الإلغاء عند انتهاء الاشتراك

### المصادقة
- **Supabase Auth** — تسجيل دخول OIDC + البحث الاجتماعي
- **JWT** — توكن تطبيقي + دعم توكنات Supabase (تحقق مزدوج بـ `JWT_SECRET_KEY` و `SUPABASE_JWT_SECRET`)
- **HttpOnly Cookie** — التوكن يُخزّن في `bf_access_token` (لا يُسرب في query string)
- **RBAC** — أدوار `user` / `admin`

### بوابات الوصول
| المورد | بدون مصادقة | مُصادق بدون صلاحية |
|---|---|---|
| إنشاء جلسة دفع | 401 | — |
| Pro tutorial / stylize | 401 | 403 |
| فحص الصلاحية | 401 | — |

### الدفع (Stripe)
- `POST /create_payment_session` — one_time ($1.80) أو monthly ($7.99/شهر اشتراك)
- `POST /webhook` — التحقق من توقيع Stripe + منح/تمديد/إلغاء الصلاحية (idempotent)
- `POST /verify_payment` — التحقق المتزامن (fallback لصفحة النجاح)
- `GET /entitlement` — حالة الصلاحية الحالية

### CORS
مقيد بنطاقات محددة (`CORS_ORIGINS`) + regex للنطاقات الفرعية المؤقتة (Vercel/preview). النطاقات الضارة لا تحصل على أي رأس CORS.

---

## 📡 واجهة برمجة التطبيقات | API Reference

جميع المسارات تحت البادئة `/api/v1/`.

### تحليل الوجه
| Method | Endpoint | الوصف |
|---|---|---|
| POST | `/face-analysis/analyze-landmarks` | تحليل 478 نقطة وجه → قياسات + سكور |

### أحمر الشفاه
| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/lipsticks` | قائمة المنتجات مع التصفية والترقيم |
| GET | `/lipsticks/filters` | خيارات التصفية المتاحة |
| GET | `/lipsticks/{id}/dupes` | البدائل المتشابهة لونياً (CIEDE2000) |
| GET | `/lipsticks/search-by-color` | بحث لوني (hex/LAB) |
| GET | `/lipsticks/semantic-search` | بحث دلالي متعدد اللغات |
| POST | `/lipsticks/recommend-by-skin` | توصية حسب لون البشرة |
| GET | `/lipsticks/color-universe/{family}` | تصفح عائلات الألوان |
| POST | `/lipsticks/find-from-image` | استخراج لون من صورة |

### المصادقة
| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/auth/login` | بدء تدفق OIDC (PKCE) |
| GET | `/auth/callback` | استقبال توكن بعد OIDC |
| POST | `/auth/token/exchange` | استبدال كود بتوكن |
| GET | `/auth/me` | بيانات المستخدم الحالي |
| GET | `/auth/logout` | تسجيل الخروج |

### المحتوى الاحترافي (يتطلب صلاحية Pro)
| Method | Endpoint | الوصف |
|---|---|---|
| POST | `/pro/tutorial` | توليد درس مكياج مخصص (DeepSeek) |
| POST | `/pro/stylize` | توليد صورة مكياح (3-layer cascade) |

### المدفوعات
| Method | Endpoint | الوصف |
|---|---|---|
| POST | `/payments/create_payment_session` | إنشاء جلسة Stripe (يتطلب مصادقة) |
| POST | `/payments/verify_payment` | التحقق المتزامن + منح صلاحية |
| GET | `/payments/entitlement` | حالة الصلاحية الحالية |
| POST | `/payments/webhook` | استقبال أحداث Stripe |

### الخدمات المساندة
| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/health` | فحص الصحة |
| GET/PUT | `/user/profile` | ملف المستخدم |
| * | `/aihub/*` | توليد نص/صورة/فيديو/صوت (admin) |
| * | `/storage/*` | إدارة تخزين Supabase |
| * | `/settings/*` | إعدادات البيئة (admin) |

---

## 🗄️ نموذج البيانات | Data Model

### الجداول (Supabase PostgreSQL)

```
users
├── id (PK, string)        # platform sub
├── email (string)
├── name (string, nullable)
├── role (user | admin)
├── created_at, last_login

oidc_states
├── id (PK)
├── state (unique)         # OIDC state param
├── nonce, code_verifier   # PKCE
├── expires_at

entitlements                # مصدر الحقيقة لصلاحيات Pro
├── id (PK)
├── user_id (index)
├── plan (one_time | monthly)
├── status (active | cancelled | expired)
├── stripe_session_id (unique)   # Idempotency key
├── stripe_customer_id
├── stripe_subscription_id
└── expires_at (null ⇒ lifetime)

profiles                    # بيانات المستخدم الموسعة
```

---

## 🚀 التشغيل | Getting Started

### المتطلبات الأساسية | Prerequisites

- **Node.js** ≥ 18 + **pnpm**
- **Python** ≥ 3.11
- قاعدة بيانات **Supabase** (PostgreSQL) أو SQLite للتطوير المحلي
- حساب **Stripe** (test keys للبدء)

### 1) إعداد متغيرات البيئة | Environment

**الواجهة الخلفية** — `App/backend/.env`:

```bash
# Application
ENVIRONMENT=dev
DEBUG=true

# Database (Supabase pooler — note: statement_cache_size=0 for PgBouncer)
DATABASE_URL=postgresql://<user>:<pass>@aws-0-<region>.pooler.supabase.com:6543/postgres

# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_JWT_SECRET=<jwt-secret>

# JWT (application tokens)
JWT_SECRET_KEY=<strong-random-secret>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# CORS allowlist
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://beautyfit.app

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI
GEMINI_API_KEY=...
DEEPSEEK_API_KEY=...
OPENROUTER_API_KEY=...
```

> ⚠️ **ملاحظة PgBouncer:** عند استخدام Supabase pooler (المنفذ 6543)، يجب تعيين `statement_cache_size=0` في `connect_args` لتفادي `DuplicatePreparedStatementError`.

**الواجهة الأمامية** — `App/frontend/.env`:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_BASE_URL=           # فارغ في dev (proxy مفعّل)
VITE_SITE_URL=https://beautyfit.app
```

### 2) تشغيل الواجهة الخلفية | Backend

```bash
cd App/backend

# تثبيت التبعيات
pip install -r requirements.txt

# التشغيل (تطوير)
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# أو عبر Lambda handler
# IS_LAMBDA=true python -c "from lambda_handler import handler"
```

### 3) تشغيل الواجهة الأمامية | Frontend

```bash
cd App/frontend

# تثبيت التبعيات
pnpm install

# التشغيل (تطوير) — يعمل على المنفذ 3000 مع proxy /api → :8000
pnpm run dev

# البناء للإنتاج
pnpm run build

# المعاينة
pnpm run preview

# فحص الكود
pnpm run lint
```

### 4) التشغيل المختصر للواجهتين | Run Both

```bash
cd App
bash start_app_v2.sh
```

### 5) التشغيل عبر Docker | Docker Compose

```bash
cd App
docker compose up --build
```

- Postgres محلي (منفذ 5433) + الخلفية (8000) + الواجهة (5173)
- `DATABASE_URL` يُوجَّه تلقائياً لقاعدة البيانات المحلية داخل الشبكة

- الواجهة الأمامية: `http://localhost:3000`
- الواجهة الخلفية: `http://localhost:8000`
- توثيق API: `http://localhost:8000/docs`

---

## 🧪 الاختبارات | Testing

### الواجهة الخلفية (pytest)

```bash
cd App/backend
pytest tests/ -v
```

```
tests/test_entitlement.py                            (5 tests)   PASSED
tests/test_payment_entitlement_integration.py        (1 test)    PASSED
tests/test_pro_entitlement_gate.py                   (2 tests)   PASSED
tests/test_pro_tutorial_stylize.py                   (1 test)    PASSED
tests/test_rate_limit.py                             (5 tests)   PASSED
tests/test_security_and_health.py                    (7 tests)   PASSED
tests/test_lipsticks_engine.py                       (21 tests)  PASSED
========================= 42 passed =========================
```

تغطي الاختبارات: نموذج الصلاحيات، Idempotency، انتهاء الاشتراك، الإلغاء، بوابة Pro، تكامل الدفع الكامل، **محدد المعدل (429/الإعفاءات/التعطيل)، قفل CORS (لا wildcard)، اكتشاف الراوترز، ومحرك الألوان (CIEDE2000 مُتحقق منه ضد مكتبة colormath المرجعية + سلامة بيانات 6190 سجلاً + نقاط النهاية)**.

### الواجهة الأمامية

```bash
cd App/frontend
pnpm run lint                    # ESLint (صفر أخطاء)
pnpm run typecheck               # tsc --noEmit (صفر أخطاء)
pnpm run build                   # Vite build + prerender + sitemap
```

### اختبارات شاملة (Playwright)

```bash
cd App/frontend
npx playwright test              # E2E browser tests
```

---

## 🌐 النشر | Deployment

### خيارات النشر المدعومة

| المنصة | الحالة | التكوين |
|---|---|---|
| **AWS Lambda** | مدعوم | `lambda_handler.py` + mangum (نظام موحّد للواجهتين) |
| **Render** | نشط | `vercel.json` rewrite لـ `/api/*` |
| **Vercel** | للواجهة | rewrites → Render backend |

### قائمة التحقق قبل الإطلاق | Pre-Launch Checklist

- [ ] استبدال مفاتيح Stripe test بـ **live keys**
- [ ] توجيه Stripe webhook إلى `/api/v1/payments/webhook`
- [ ] ضبط `OIDC_ISSUER_URL` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` من المنصة
- [ ] تصحيح `vercel.json` (إزالة الخطأ الإملائي "progect")
- [x] تفعيل Rate Limiting (المرحلة 1 — مكتمل)
- [ ] تنظيف بيانات الاختبار من Supabase

---

## 📁 التقنيات المستخدمة | Tech Stack

### الواجهة الخلفية | Backend
| التقنية | الإصدار | الاستخدام |
|---|---|---|
| Python | 3.11+ | لغة الخادم |
| FastAPI | 0.141 | إطار الـ API |
| SQLAlchemy | 2.0 (async) | ORM |
| asyncpg / aiosqlite | — | برامج تشغيل قاعدة البيانات |
| Alembic | 1.19 | الترحيلات |
| python-jose | — | JWT |
| Stripe SDK | 15.5 | المدفوعات |
| google-genai | — | توليد الصور (Imagen) |
| mangum | 0.19 | مكيّف AWS Lambda |

### الواجهة الأمامية | Frontend
| التقنية | الإصدار | الاستخدام |
|---|---|---|
| React | 18 | مكتبة الواجهة |
| TypeScript | 5 | الأمان النوعي |
| Vite | 5 | حزمة البناء + خادم التطوير |
| Tailwind CSS | 3.4 | التنسيق |
| shadcn/ui + Radix | — | مكوّنات الواجهة |
| @mediapipe/tasks-vision | 0.10 | تحليل الوجه (WASM) |
| @supabase/supabase-js | 2.35 | المصادقة |
| @tanstack/react-query | 5 | إدارة حالة الخادم (queries/mutations) |
| axios | 1.6 | عميل HTTP موحّد (httpClient.ts) |
| react-router-dom | 6.30 | التوجيه |
| recharts | 2.12 | الرسوم البيانية |
| Playwright | 1.55 | E2E testing |

### البنية التحتية | Infrastructure
| الخدمة | الاستخدام |
|---|---|
| Docker + docker-compose | بناء ونشر موحّد (dev + prod) |
| GitHub Actions | CI: tests · lint · typecheck · build |
| Supabase | PostgreSQL + Auth |
| Stripe | المدفوعات + الاشتراكات |
| Google Gemini (Imagen) | توليد الصور (الطبقة 1) |
| DeepSeek | توليد النصوص/الدروس |
| OpenRouter | توليد الصور (الطبقة 2) |
| Pollinations | توليد الصور (الطبقة 3 - fallback) |

---

## 🗺️ خارطة الطريق | Roadmap

### ✅ المرحلة 0 — إصلاحات الإطلاق الحرجة (مكتملة)
- [x] إغلاق تجاوز الدفع + بوابة Pro من الخادم
- [x] نموذج Entitlement في قاعدة البيانات
- [x] تفعيل Stripe webhook + التحقق من التوقيع
- [x] تقييد CORS + نقل JWT لـ HttpOnly cookie
- [x] توحيد تدفق المصادقة + إصلاح مسار logout
- [x] إصلاح انهيار Supabase عند الإقلاع
- [x] إزالة XSS عبر dangerouslySetInnerHTML

### ✅ المرحلة 1 — الأمن والنزاهة (مكتملة)
- [x] Rate Limiting (middleware + اختبارات + إعدادات بيئة)
- [x] توحيد عميل HTTP واحد (httpClient.ts) + إعادة تفعيل react-query
- [x] اختبارات موسّعة (42 اختباراً) + CI (GitHub Actions) + Docker (backend + frontend + compose)
- [x] تجديد الجلسة + اعتراض مركزي لـ 401 في العميل الموحد
- [x] إصلاح بناء prerender (AuthProvider في SSR) + typecheck (tsconfig)
- [ ] إزالة السيلفي من localStorage (Blob/ObjectURL)

### 🚀 المرحلة 2 — المنتج الجوهري
- [ ] Beauty Genome — البصمة الجمالية الدائمة
- [ ] i18n (عربي/صيني)
- [ ] تقسيم الكود على مستوى المسارات + lazy loading للصور
- [ ] تحسين SEO لصفحات SPA

### 🌟 المرحلة 3 — النمو
- [ ] التجارة الاجتماعية (Affiliate + Storefront)
- [ ] الوضع الحي AR (Live Camera Try-On)
- [ ] B2B White-label API للعلامات
- [ ] الذكاء الاتجاهي (Trend Intelligence)
- [ ] تطبيق الجوال (PWA → React Native)

---

## 📚 التوثيق | Documentation

- [`App/docs/PHASE0_REPORT.md`](App/docs/PHASE0_REPORT.md) — تقرير تسليم المرحلة 0
- [`App/docs/PHASE0_VERIFICATION_REPORT.md`](App/docs/PHASE0_VERIFICATION_REPORT.md) — تقرير التحقق المؤسسي
- [`App/docs/PHASE0_FINAL_VERIFICATION_2026-08-14.md`](App/docs/PHASE0_FINAL_VERIFICATION_2026-08-14.md) — التحقق الحيّ النهائي
- [`App/backend/beautyfit_mediapipe_478_spec.md`](App/backend/beautyfit_mediapipe_478_spec.md) — مواصفات نقاط MediaPipe 478
- توثيق API التفاعلي: `http://localhost:8000/docs` (Swagger UI)

---

## 📜 الترخيص | License

هذا المشروع ملكية خاصة. جميع الحقوق محفوظة.

---

## 🤝 المساهمة | Contributing

هذا مشروع ملكية. للمساهمة أو الإبلاغ عن مشكلات أو الاستفسارات التجارية، يرجى التواصل مع فريق التطوير:

📧 **mohamadalhothaify@gmail.com**

---

<div align="center">

**BeautyFit AI** — حُلّلت 478 نقطة وجه. صُمّمت توصية واحدة لك.

Built with privacy by design · Powered by science · Delivered with care

📧 mohamadalhothaify@gmail.com

</div>
