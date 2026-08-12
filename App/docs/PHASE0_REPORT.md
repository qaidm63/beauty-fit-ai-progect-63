# المرحلة 0 — قفل الدفع والصلاحيات: تقرير التسليم النهائي

> أُعدّ في 2026-08-12 وفق قرارات الرئيس التنفيذي (إلزامية المصادقة قبل الشراء، Webhook Stripe مصدر الحقيقة).

## 1) الملخص التنفيذي

نُفّذت المرحلة 0 بالكامل: نموذج Entitlement في قاعدة البيانات يحل محل العلم المحلي في المتصفح،
الدفع عبر Stripe مقفول بالمصادقة (لا شراء مجهول)، CORS/XSS مقيدان، والمصادقة انتقلت إلى HttpOnly cookie.
جميع اختبارات الخلفية (9/9) والواجهة (lint + build) ناجحة، والتطبيق يُقلع بإعداد الإنتاج الحقيقي.

## 2) ما نُفّذ

### 2.1 نموذج Entitlement (الصلاحية) — جديد كليًا
- `backend/models/entitlement.py`: جدول `entitlements`
  (user_id، plan، status، stripe_session_id فريد، stripe_customer_id، stripe_subscription_id، expires_at)
  + `is_active()` مع تطبيع timezone (إصلاح خطأ naive/aware).
- `backend/services/entitlement.py`:
  - `grant_entitlement` — منح Idempotent بالـ session_id، يرفض الخطط المجهولة.
  - `has_active_entitlement` / `get_active_entitlement` — فحص الصلاحية الحية (مصدر الحقيقة).
  - `revoke_entitlement` — بالإلغاء عند انتهاء الاشتراك.
  - الاشتراك الشهري يُمَدَّد من `current_period_end` (30 يومًا افتراضيًا للحالة المتزامنة).

### 2.2 الدفع (Stripe) — إعادة كتابة `routers/payments.py`
- `POST /api/v1/payments/create-session`: يتطلب `get_current_user`؛ خطتان:
  - `monthly` = اشتراك متكرر 799¢/شهر (Stripe subscription).
  - `one_time` = دفعة لمرة واحدة $1.80.
  - الـ metadata تحمل user_id + email + plan + style_id لربط النتيجة.
- `GET /api/v1/payments/entitlement`: حالة المستخدم الحالية (has_pro, plan, expires_at).
- `GET /api/v1/payments/verify`: يتحقق من الجلسة ويمنح الصلاحية (fallback متزامن لصفحة النجاح).
- `POST /api/v1/payments/webhook`: يتحقق من توقيع Stripe بـ `STRIPE_WEBHOOK_SECRET`، ويعالج
  `checkout.session.completed` و`invoice.paid` (تمديد الاشتراك) و`customer.subscription.deleted` (إلغاء).

### 2.3 حماية الواجهة Pro
- `backend/routers/pro_tutorial.py`: `require_pro_entitlement`
  (401 بلا توكن، 403 بلا صلاحية، 503 عند فشل الفحص) مفعّل على `/tutorial` و`/stylize`.
  أُلغي "testing mode".

### 2.4 الأمان
- CORS مقيد: `CORS_ORIGINS` env يتجاوز، والافتراضي النطاقان + localhost،
  مع regex تلقائي لـ `*.vercel.app` و`*.monkeycode-ai.live` (أُلغي `*`).
- JWT إلى HttpOnly cookie (`bf_access_token`): `core/auth.py` + `dependencies/auth.py`
  (قراءة Authorization ثم الكوكيز) + `routers/auth.py` (login يرجع JSON، callback يضع الكوكيز، logout يمسحها).
- `ResultsPage.tsx`: أُغلقت نقطتا تجاوز الدفع (`handleStyleCardClick` + `handleGoToCheckout`)،
  وأُزيل `dangerouslySetInnerHTML` الوحيد.
- `supabaseClient.ts`: لم يعد يكسر الإقلاع عند غياب المتغيرات.

### 2.5 الواجهة الأمامية
- `lib/auth.ts`: interceptor يضيف Bearer token من fallback توكن الجلسة ويطهره عند 401.
- `lib/proTutorial.ts`: حُذف علم localStorage نهائيًا؛ `getProEntitlement()` يفحص الخادم.
- `api/payments.ts`: `credentials:'include'` + `authHeaders()` + حالة `LOGIN_REQUIRED`.
- `AuthCallback.tsx`: يستخدم `?token=` ويعيد التوجيه.
- `CheckoutSuccessPage.tsx`: عند `LOGIN_REQUIRED` يعرض زر "Sign in to claim access".
- `App.tsx`: `/logout-callback`، حذف `/test-supabase`.

### 2.6 البيئة والإعداد
- `backend/.env`: Stripe test keys + JWT_SECRET_KEY مولّد + CORS_ORIGINS + ENVIRONMENT=dev + DATABASE_URL (Supabase pooler).
- `frontend/.env`: VITE_SUPABASE_URL + ANON_KEY.
- `core/config.py`: `load_dotenv` قبل pydantic-settings.
- `vite.config.ts`: `allowedHosts: ['.monkeycode-ai.live']`.

## 3) نتائج التحقق
- `pytest tests/` — **9/9 ناجحة** (وحدة، بوابة الصلاحية، تكامل كامل مع boot حقيقي للتطبيق على SQLite).
- `npx eslint --quiet ./src` — نظيف (صفر أخطاء).
- `npm run build` — نجح (1965 module، prerender 6 صفحات).
- الإقلاع بإعداد الإنتاج: 16 router، CORS_ORIGINS صحيحة، مفاتيح Stripe محمّلة.

## 4) قرارات تأجلت بموافقة الرئيس التنفيذي
- **السيلفي في localStorage** (`AnalyzePage.tsx` + `tutorialCache.ts`): ثغرة محتملة (التقاط صور خاصة
  عبر XSS). أُجّل خارج المرحلة 0 — سيُنفَّذ لاحقًا بالتحويل إلى Blob/URL داخل الجلسة.

## 5) ملاحظات تشغيلية للنشر
- `vercel.json` ما زال يوجّه إلى `beauty-fit-ai-progect.onrender.com` (خطأ "progect" إملائي قديم) —
  يحتاج تصحيح قبل الإطلاق الرسمي.
- قبل التفعيل: استبدال `STRIPE_WEBHOOK_SECRET` بمفتاح الـ live webhook،
  وتوجيه webhook Stripe إلى `/api/v1/payments/webhook`.
- إنشاء جدول `entitlements` في Supabase يتم عبر تشغيل `create_tables` مرة واحدة عند الترحيل
  (لا alembic جديد).

## 6) إصلاحات اكتُشفت أثناء نشر المعاينة
- **كلمة مرور Supabase خاطئة في `backend/.env`**: كانت محاطة بأقواس `[...]` أدّت إلى
  `InvalidPasswordError` عند كل اتصال (عطل كامن يمنع التطبيق من العمل). أُزيلت الأقواس.
- **asyncpg + PgBouncer**: الاتصال عبر pooler (منفذ 6543) كان يفشل بـ
  `DuplicatePreparedStatementError`. أُضيف `connect_args={"statement_cache_size": 0}`
  في `core/database.py` (إصلاح قياسي لـ Supabase pooler).
- **جدول `entitlements`**: أُنشئ في Supabase (إلى جانب `users`/`oidc_states`/`profiles` الموجودة)
  عبر `Base.metadata.create_all` — idempotent، لم يُمس أي جدول قائم.
- **معاينة مباشرة**: الخادم الخلفي (8000) والواجهة (3000) يعملان معًا،
  الـ proxy `/api` مفعّل، و`allowedHosts` يقبل نطاق المعاينة.

---

# اقتراح استراتيجية الدفع المتقدمة (للدراسة)

## الهدف
تجاوز الخطة الواحدة (799¢/شهر) نحو تسعير متدرج يدعم النمو ويزيد قيمة العميل.

## النموذج المقترح

| الطبقة | السعر | المزايا |
|--------|-------|---------|
| Free | 0 | تحليل أساسي + 3 أنماط لون |
| Pro (شهري) | $7.99/شهر | غير محدود + توصيات الألوان المتقدمة |
| Pro (سنوي) | $79/سنة (خصم 17%) | كل ما في الشهري + تمييز "الأفضل قيمة" |
| Beauty+ (اشتراك أعلى) | $19.99/شهر | استشارة ذكية + دليل مخصص + أولوية الدعم |

## آلية التنفيذ (تمهيد مبني على بنية المرحلة 0)
- نموذج Entitlement الحالي يدعم التوسعة: يُضاف عمود `tier` (monthly/annual/plus) ويبقى
  منطق `grant/verify/webhook` نفسه — امتداد لا إعادة كتابة.
- Stripe Price لكل tier؛ الـ metadata يحمل `plan`، والـ webhook يحدّث الصلاحية دون تغيير المسار.
- نقطة ترقية: `POST /upgrade` يستخدم Portal للتبديل بين الخطط، والـ webhook `subscription.updated`
  يطبّق التغيير فورًا.

## نقاط القرار المفتوحة لك
1. هل نبدأ بالسنوي (أسرع تنفيذ، أعلى ربح لكل عميل) قبل إضافة Beauty+؟
2. سعر Beauty+: هل يبقى $19.99 أم نضعه عند $14.99 للمخترِقين؟
3. هل نقدم فترة تجربة مجانية 7 أيام للشهري (يتطلب قرار الاشتراك المتكرر من البداية)؟
4. تقرير كامل للتسعير المنافس (مقابل أدوات beauty-tech) عند بدء المرحلة 1.
