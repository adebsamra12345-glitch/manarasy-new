# تقرير أمني – منصة منارة (Manara Platform)

> تقرير دفاعي استباقي. لم يُنفَّذ أي هجوم. التقييم مبني على قراءة `backend/config/settings.py`، `core_system/middleware.py`، مسارات المستخدمين، وحدة `agent`، `docker-compose*.yml`، وتخزين الجلسات في الواجهة.
> المكدس: Django + PostgreSQL (multi-tenant، قاعدة لكل مسجد) + React/Vite + Traefik + Redis/Celery.

---

## 1) تقييم الثغرات وخطة التحسين

### ما هو جيد حالياً
- `DEBUG` افتراضه False، و`SECRET_KEY` عشوائي إن لم يُضبط، وHSTS/SSL redirect/Secure cookies مفعلة في الإنتاج.
- `jwt.decode` يحدد `algorithms=['HS256']` صراحةً (لا ثغرة `alg=none`).
- إيصالات الدفع خارج `MEDIA_ROOT`، حدود حجم الرفع، قفل محاولات الدخول وThrottle لأدمن المنصة.
- `X_FRAME_OPTIONS=DENY`، `NOSNIFF`، تعليمات `NUM_PROXIES` خلف Traefik.

### الثغرات والمخاطر (مرتبة بالأولوية)

| # | الخطورة | الملاحظة | الدليل | الحل |
|---|---|---|---|---|
| 1 | **حرجة** | التوكنات (access + refresh) في `localStorage` → أي XSS = سرقة الحساب كاملاً | `AuthContext.jsx:35-36,78` | نقل refresh إلى كوكي `HttpOnly; Secure; SameSite=Strict`، وإبقاء access في الذاكرة فقط. مع الكوكي تحتاج حماية CSRF (انظر #3). |
| 2 | **متوسطة (تصحيح)** | *تصحيح:* تسجيل دخول المساجد **فيه** قفل (5 محاولات/15 دقيقة لكل IP+مسجد+مستخدم، `tenant_login_view`). النقصان: المفتاح يتضمن الـIP فيمكن لمهاجم موزّع تخمين حساب واحد، والتخزين `LocMemCache` لكل عملية إن لم يُضبط `REDIS_URL` فيتجاوزه تعدد الـworkers | `core_system/tenants/views.py:284-294` | إلزام Redis في الإنتاج، وإضافة عدّاد إضافي لكل (مسجد+مستخدم) بلا IP، وCAPTCHA. |
| 3 | **عالية** | `@csrf_exempt` على ~60 View. آمن فقط ما دام التوثيق عبر `Authorization: Bearer` حصراً. عند الانتقال لكوكي (#1) يصبح CSRF حقيقياً | `grep csrf_exempt` | إما إبقاء Bearer فقط، أو عند استخدام الكوكي: إزالة الاستثناء + `X-CSRFToken` + `SameSite=Strict`. |
| 4 | **عالية** | سر JWT واحد لكل المستأجرين (`JWT_SECRET_KEY` يرجع إلى `SECRET_KEY`). تسريبه = تزوير توكن لأي مسجد/دور (TENANT_ADMIN). كذلك `SECRET_KEY` عشوائي عند كل إقلاع إذا لم يُضبط → كل التوكنات تنهار عند إعادة التشغيل أو عند تعدد العمّال (workers) | `settings.py:27-33,268` | أسرار منفصلة (`JWT_SECRET_KEY` ≠ `SECRET_KEY` ≠ `PLATFORM_JWT_SECRET`) من Secrets Manager، مع `kid` وتدوير دوري. فشل الإقلاع إن لم تُضبط في الإنتاج. |
| 5 | **عالية** | كود فحص التوكن مكرر في 6+ ملفات (`users`, `centers`, `dashboard_views`, `settings_views`, `middleware`...) → خطر اختلاف المنطق وتجاوز الفحص، لا إبطال (revocation) للتوكن، لا `jti` | `jwt.decode` متناثر | دالة مصادقة واحدة + decorator للأدوار (`@require_role`)، إضافة `jti` وقائمة سوداء في Redis، تقصير access إلى 10–15 دقيقة مع تدوير refresh. |
| 6 | **عالية** | `user_impersonate_view` تُصدر توكن لأي مستخدم بلا كلمة سر. التوكن يحمل `impersonated_by` لكن لا يظهر وجود سجل تدقيق ولا قيود | `users/views.py:744-803` | سجل تدقيق غير قابل للتعديل (من/من/متى/IP)، مدة قصيرة (≤15 دقيقة)، منع الانتحال على TENANT_ADMIN آخر، إعادة مصادقة (كلمة سر/2FA) قبل التنفيذ، وحظر العمليات الحساسة أثناء الانتحال. ملاحظة: شرط `CENTER_MANAGER` في السطر 774 كود ميت لأن الدالة ترفض كل دور غير TENANT_ADMIN في 763. |
| 7 | **متوسطة** | CORS: `CORS_ALLOW_CREDENTIALS=True` مع regex يسمح بـ`http://localhost` و`127.0.0.1` في الإنتاج. و`CORS_ALLOW_ALL_ORIGINS` قابل للتفعيل بمتغير بيئة | `settings.py:47-63` | في الإنتاج: قائمة نطاقات `https://*.manarasy.io` فقط، حذف regex المحلي، وفشل الإقلاع إن كان `ALLOW_ALL` مع `DEBUG=False`. |
| 8 | **منخفضة (تصحيح)** | *تصحيح:* لا مشكلة في توقيع `get_tenant_db` داخل وحدة `agent` (`core_system/auth.py` تُعيد قيمة واحدة؛ الـtuple في `users/views.py` من دالة محلية مختلفة). المتبقي: لا Throttle على مسار الأوامر (تكلفة CPU للنموذج). | `agent/views.py:65` | أضف Throttle لكل مستخدم (مثلاً 30/دقيقة). `MAX_TEXT` موجود (جيد). |
| 9 | **متوسطة** | Traefik: لا middlewares (rate limit, headers, redirect HTTP→HTTPS على مستوى الحافة)، لوحة `api.dashboard=true` بدون `--api.insecure` لكن بلا تعريف حماية واضح، وتركيب `docker.sock` (حتى read-only) = مسار تصعيد امتيازات عند اختراق الحاوية | `docker-compose.traefik.yml` | `docker-socket-proxy` بدل التركيب المباشر، تعطيل الداشبورد أو حمايته بـBasicAuth+IP allowlist، إضافة middlewares (انظر القسم 3). `traefik:v2.10` قديم → حدّث. |
| 10 | **متوسطة (نُفِّذ جزئياً: CSP بوضع Report-Only + HSTS في `frontend/nginx/default.conf`؛ بقي التفعيل بعد المراقبة)** | لا Content-Security-Policy ولا Permissions-Policy/Referrer-Policy؛ `SECURE_BROWSER_XSS_FILTER` متقادم (يُهمَل في Django ≥4) | `settings.py:299` | أضف `django-csp` (انظر القسم 3-ب). |
| 11 | **متوسطة** | Postgres مربوط بـ`127.0.0.1` (جيد)، لكن مستخدم واحد لقواعد كل المستأجرين على الأرجح؛ كلمة سر افتراضية فارغة `''` | `settings.py:153` | دور DB بأقل صلاحيات، فصل مستخدم المهاجرات (DDL) عن مستخدم التشغيل، فشل الإقلاع بكلمة سر فارغة. |
| 12 | **منخفضة** | `FILE_UPLOAD_MAX_MEMORY_SIZE` 6MB ولا يوجد فحص نوع الملف الفعلي (magic bytes) ولا مسح فيروسات للإيصالات | `settings.py:257-260` | فحص magic bytes، إعادة ترميز الصور (Pillow) لإزالة الحمولات، ClamAV، أسماء ملفات عشوائية (UUID). |
| 13 | **منخفضة** | تسريب `str(e)` للعميل في استثناءات `get_tenant_db` | `agent/views.py:67` | رسائل عامة + تسجيل داخلي. |
| 14 | **منخفضة** | تبعيات بلا تثبيت أو فحص دوري | `requirements.txt` معدّل | `pip-audit`، `npm audit`، Dependabot، تثبيت hashes. |

**ملاحظة صدق:** لم أراجع كل View فردياً (>60 مساراً) فحص IDOR/عزل المستأجر يحتاج مراجعة يدوية/اختبارات تلقائية لكل مسار (انظر خطة الاختبار أدناه). لم أرَ ملفات `.env` ولا إعداد Nginx/Compose للإنتاج الفعلي.

### خطة التنفيذ المقترحة
- **أسبوع 1 (حرجة):** #4 أسرار منفصلة وفشل إقلاع، #2 Throttle/قفل الدخول، #7 تنظيف CORS، #6 تدقيق الانتحال.
- **أسبوع 2–3:** #1+#3 نقل التوكن إلى HttpOnly + CSRF، #5 توحيد المصادقة، #10 CSP.
- **أسبوع 4:** #9 تقوية Traefik، #11، #12، #14 + CI أمني.

### إعدادات جاهزة للتطبيق

```python
# settings.py – فشل الإقلاع على إعدادات غير آمنة في الإنتاج
if not DEBUG:
    from django.core.exceptions import ImproperlyConfigured
    for k in ("SECRET_KEY", "JWT_SECRET_KEY", "PLATFORM_JWT_SECRET", "POSTGRES_PASSWORD"):
        if not os.getenv(k):
            raise ImproperlyConfigured(f"{k} must be set in production")
    assert not CORS_ALLOW_ALL_ORIGINS
    CORS_ALLOWED_ORIGIN_REGEXES = [r"^https://([a-zA-Z0-9-]+\.)?manarasy\.(io|com)$"]

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_SAMESITE = "Strict"
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.Argon2PasswordHasher", "django.contrib.auth.hashers.PBKDF2PasswordHasher"]
MinimumLengthValidator_OPTIONS = {"min_length": 10}
```

```python
# Throttle دخول المستأجرين (Redis)
from django.core.cache import cache
def login_guard(request, username):
    ip = request.META.get("REMOTE_ADDR")
    for key, limit in ((f"lg:ip:{ip}", 20), (f"lg:u:{username.lower()}", 5)):
        if cache.get(key, 0) >= limit:
            return False
    return True
def login_failed(request, username):
    for key in (f"lg:ip:{request.META.get('REMOTE_ADDR')}", f"lg:u:{username.lower()}"):
        try: cache.incr(key)
        except ValueError: cache.set(key, 1, 900)
```

---

## 2) مصفوفة دفاعية لأشهر 50 هجوماً

الرمز: ✅ مغطى جزئياً/كلياً في الكود الحالي · ⚠️ يحتاج تحسيناً · ➕ غير موجود.

### أ) تطبيقات الويب (OWASP Top 10:2021 وما حولها)
| # | الهجوم | آلية الدفاع | حالة المنصة |
|---|---|---|---|
| 1 | Broken Access Control / IDOR | فحص ملكية الكائن + tenant في كل استعلام، اختبارات تلقائية لكل مسار، UUID بدل أرقام متسلسلة | ⚠️ فحوص يدوية متناثرة؛ وحّد بـdecorator |
| 2 | Cryptographic Failures | TLS1.2+، HSTS، Argon2، أسرار من Secrets Manager، تشفير النسخ الاحتياطية | ⚠️ سر JWT مشترك |
| 3 | SQL Injection | ORM فقط، منع `.raw/.extra` غير المُعامَلة (البحث لم يجد استخداماً) | ✅ |
| 4 | NoSQL/ORM Injection | تحقق مخطط للمدخلات، منع تمرير `**request.GET` إلى `filter()` | ⚠️ راجع المرشحات الديناميكية |
| 5 | Command Injection | لا `subprocess/os.system` بمدخلات مستخدم (لم يوجد) | ✅ |
| 6 | Insecure Design | نمذجة تهديدات، حدود نسب الأعمال (مثل الانتحال) | ⚠️ |
| 7 | Security Misconfiguration | DEBUG=False، ترويسات، إغلاق المنافذ، فشل الإقلاع | ⚠️ |
| 8 | Vulnerable Components | pip-audit/npm audit/Dependabot، تثبيت الإصدارات | ➕ |
| 9 | Auth Failures | قفل، MFA، سياسة كلمات سر، إبطال توكن | ⚠️ |
| 10 | Software/Data Integrity | SRI، تواقيع الصور (cosign)، CI محمي | ➕ |
| 11 | Logging & Monitoring Failures | سجل مركزي، تنبيهات، تدقيق إداري | ⚠️ |
| 12 | SSRF | قائمة سماح للوجهات، حظر نطاقات 169.254/10./127. في أي جلب خارجي (Webhook، تنزيل) | ⚠️ راجع Sham Cash/الجلب الخارجي |
| 13 | XSS (Stored/Reflected/DOM) | ترميز المخرجات، CSP، تعقيم HTML (DOMPurify) | ⚠️ انظر القسم 3-ب |
| 14 | CSRF | SameSite=Strict، رمز CSRF، أو Bearer فقط | ⚠️ استثناء شامل |
| 15 | XXE | `defusedxml`، تعطيل DTD | ✅ لا XML ظاهر |
| 16 | Insecure Deserialization | لا `pickle`/`yaml.load` (لم يوجد) | ✅ |
| 17 | Path Traversal / LFI | `Path.resolve()` + فحص الجذر، أسماء UUID | ⚠️ راجع تقديم الإيصالات |
| 18 | Unrestricted File Upload | magic bytes، إعادة ترميز، ClamAV، تخزين خارج الجذر | ⚠️ الجذر خارجي ✅، الفحص ➕ |
| 19 | Open Redirect | قائمة سماح لـ`next`/`redirect` | ⚠️ |
| 20 | Mass Assignment | Serializer بحقول صريحة، لا `**request.data` | ⚠️ راجع تحديث الملف الشخصي (role!) |
| 21 | HTTP Parameter Pollution | أخذ أول قيمة صراحةً، التحقق بنوع | ⚠️ |
| 22 | Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | ✅ |
| 23 | Host Header Injection | `ALLOWED_HOSTS` صارمة | ✅ |
| 24 | CORS Misconfiguration | قائمة نطاقات دقيقة | ⚠️ |
| 25 | Business Logic Abuse | حدود المعدل، التحقق من الحالة، idempotency للدفع | ⚠️ |
| 26 | Race Conditions / TOCTOU | `select_for_update`، قيود فريدة، idempotency keys | ⚠️ النقاط/المدفوعات |
| 27 | GraphQL/Batch abuse | غير مستخدم | — |
| 28 | Server-Side Template Injection | لا تُصيّر قوالب من مدخلات | ✅ |
| 29 | Prototype Pollution (JS) | تحديث المكتبات، `Object.create(null)`، لا دمج عميق لمدخلات | ⚠️ |
| 30 | Subdomain Takeover | مراقبة DNS، حذف سجلات يتيمة (نظام subdomain لكل مسجد) | ⚠️ مهم لمنصتكم |

### ب) الجلسات والهوية
| # | الهجوم | الدفاع | الحالة |
|---|---|---|---|
| 31 | Session Hijacking | HttpOnly+Secure، ربط الجلسة بـUA، توكن قصير | ⚠️ localStorage |
| 32 | Session Fixation | تدوير الرمز عند الدخول/الصلاحية | ⚠️ |
| 33 | JWT Forgery / alg confusion | تحديد الخوارزمية، `kid`، أسرار منفصلة | ✅ جزئياً |
| 34 | Token Replay / Theft | `jti`، قائمة سوداء، ربط بالجهاز، تدوير refresh | ➕ |
| 35 | Brute Force | قفل + CAPTCHA | ⚠️ المنصة فقط |
| 36 | Credential Stuffing | Throttle، HIBP، MFA، كشف الشذوذ | ➕ |
| 37 | Password Spraying | Throttle لكل IP عبر مستخدمين | ➕ |
| 38 | Privilege Escalation (عمودي/أفقي) | RBAC مركزي، اختبار مصفوفة الأدوار | ⚠️ |
| 39 | Account Enumeration | رسائل موحدة وأزمنة متساوية | ⚠️ |
| 40 | MFA Fatigue / Account Takeover عبر الاسترداد | TOTP/WebAuthn، تحقق مزدوج للاسترداد | ➕ |

### ج) الشبكة والبنية
| # | الهجوم | الدفاع | الحالة |
|---|---|---|---|
| 41 | DDoS L3/L4 (SYN/UDP flood) | شبكة تنقية (Cloudflare/AWS Shield)، SYN cookies | ➕ انظر القسم 3-أ |
| 42 | DDoS L7 (HTTP flood) | Rate limit حافة + WAF + كاش | ➕ |
| 43 | Slowloris / Slow POST | مهلات Traefik/Gunicorn، حد اتصالات لكل IP | ⚠️ |
| 44 | Credential/API Scraping | حد معدل + كشف بوتات | ➕ |
| 45 | MITM / SSL Strip | TLS، HSTS+preload | ✅ |
| 46 | DNS Spoofing / Hijacking | DNSSEC، قفل المسجّل، MFA للمسجّل | ⚠️ |
| 47 | Port Scanning / Exposed Services | جدار ناري، DB/Redis داخلية فقط | ✅ DB على loopback؛ تحقق من Redis |
| 48 | Container Escape / Docker Socket | docker-socket-proxy، non-root، read-only FS، seccomp | ⚠️ |
| 49 | Supply-chain (npm/pip) | قفل التبعيات، SBOM، `npm ci`، فحص | ➕ |
| 50 | Ransomware / Data Exfiltration / Insider | نسخ غير قابلة للتعديل (offsite)، أقل صلاحيات، تدقيق، DLP | ⚠️ لديكم وحدة `backups`: انقلوا نسخة خارج الخادم |

---

## 3) استراتيجية منع الانهيار وحماية السيرفرات

> الفصل التقني: **(أ) هجمات الموارد (DDoS/DoS)** تُعالَج على الحافة والشبكة؛ **(ب) ثغرات الكود (XSS)** تُعالَج داخل التطبيق والمتصفح. لا يغني أحدهما عن الآخر.

### أ) حجب الخدمة DDoS/DoS (طبقة الموارد)

**المبدأ:** لا تدع الطلب الخبيث يصل إلى Django أصلاً. 4 طبقات:

1. **الحافة (L3/L4/L7):** ضع Cloudflare (أو AWS Shield + CloudFront) أمام Traefik، وأخفِ IP الأصل (اسمح فقط لنطاقات الـCDN في الجدار الناري). فعّل "Under Attack"/تحدي JS تلقائياً عند الارتفاع.
2. **Traefik (عكسي):**
```yaml
# traefik dynamic config (file provider)
http:
  middlewares:
    ratelimit-global:
      rateLimit: { average: 50, burst: 100, period: 1s }
    ratelimit-login:
      rateLimit: { average: 5, burst: 10, period: 1m }
    inflight:
      inFlightReq: { amount: 100, sourceCriterion: { requestHost: false, ipStrategy: { depth: 1 } } }
    sec-headers:
      headers:
        stsSeconds: 31536000
        stsIncludeSubdomains: true
        stsPreload: true
        contentTypeNosniff: true
        frameDeny: true
        referrerPolicy: "same-origin"
        customResponseHeaders: { Permissions-Policy: "camera=(), microphone=(self), geolocation=()" }
    buffering:
      buffering: { maxRequestBodyBytes: 6291456, memRequestBodyBytes: 1048576 }
    retry: { retry: { attempts: 2 } }
# entrypoint timeouts
# --entrypoints.websecure.transport.respondingTimeouts.readTimeout=15s
# --entrypoints.websecure.transport.respondingTimeouts.idleTimeout=60s
# --entrypoints.web.http.redirections.entrypoint.to=websecure
```
3. **Gunicorn/Django:** `--workers (2*CPU+1) --timeout 30 --max-requests 1000 --max-requests-jitter 100 --limit-request-line 4094`، مع `gthread` للـI/O.
4. **تطبيق:** حدود DRF/Redis (لديكم أساس)؛ أضف Throttle لمسارات الدخول، الأوامر (agent)، التقارير/PDF الثقيلة، والتصدير. نفّذ الأعمال الثقيلة عبر Celery بطابور ومهلات، وكاش Redis للقراءات العامة، و`CONN_MAX_AGE` + PgBouncer لحماية قاعدة البيانات من استنزاف الاتصالات.

**حماية الموارد:** حدود CPU/ذاكرة لكل حاوية (`deploy.resources.limits`)، `ulimit`، `fail2ban` على سجلات Traefik، `nftables` (`limit rate over 100/second` + `ct count over 50`)، وSYN cookies (`net.ipv4.tcp_syncookies=1`).

**قاطع الدائرة (Load Shedding):** عند تجاوز الحمل، أعد 503 للمسارات غير الحرجة أولاً (التقارير، الوكيل) وحافظ على الدخول والحضور.

### ب) XSS (طبقة الكود)

1. **CSP صارمة** (`django-csp` أو ترويسة Traefik):
```python
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'",)          # بلا unsafe-inline؛ استخدم nonce عند الحاجة
CSP_STYLE_SRC = ("'self'", "https://fonts.googleapis.com")
CSP_FONT_SRC = ("'self'", "https://fonts.gstatic.com")
CSP_IMG_SRC = ("'self'", "data:")
CSP_CONNECT_SRC = ("'self'", "https://*.manarasy.io")
CSP_FRAME_ANCESTORS = ("'none'",)
CSP_OBJECT_SRC = ("'none'",)
CSP_BASE_URI = ("'self'",)
CSP_FORM_ACTION = ("'self'",)
```
   ابدأ بـ`Report-Only` أسبوعاً ثم فعّلها.
2. **الواجهة (React):** React يهرب افتراضياً؛ الخطر في `dangerouslySetInnerHTML`/`innerHTML` — البحث وجد استخدامات `innerHTML` (مثل `sessionPdfExporter.js`) فمرّر أي HTML عبر **DOMPurify** (`ALLOWED_TAGS` ضيقة). لا تضع مدخلات في `href="javascript:..."` (تحقق من البروتوكول `https?:` فقط) ولا في `eval/new Function`.
3. **الخادم:** تحقق مدخلات بقوائم سماح (أطوال، أنواع، regex) في كل Serializer؛ لا تعد إنتاج HTML من مدخلات؛ اضبط `Content-Type: application/json` و`nosniff`؛ وأي حقل نصي حر (أسماء، ملاحظات) يُخزَّن كما هو ويُهرَّب عند العرض، وللحقول التي تتحمل HTML استخدم `bleach`.
4. **تقليل أثر XSS إن وقع:** نقل التوكنات إلى HttpOnly (#1) — هذا أهم إجراء، فيصبح XSS غير قادر على سرقة الجلسة.
5. **PDF/تصدير:** هرّب القيم قبل إدخالها في قوالب HTML للتقارير والشهادات.
6. **اختبارات:** ESLint `react/no-danger`، وحالات اختبار ببيانات `"><img src=x onerror=alert(1)>` في كل حقل نصي، وOWASP ZAP baseline في CI (ضد بيئة staging فقط).

### ج) WAF
- Cloudflare Managed Rules (OWASP Core) + قواعد مخصصة: حظر `/admin` لغير IP المشرفين، تحدٍّ لـ`/api/*/login`، حظر User-Agents الفارغة، حدود جغرافية إن لزم.
- بديل مفتوح المصدر: **Coraza/ModSecurity + OWASP CRS** كإضافة Traefik، بدءاً بوضع `DetectionOnly`.

---

## 4) بنية التماسك واستمرارية العمل (Resilience)

```
المستخدم ──► CDN/WAF/DDoS ──► Load Balancer (Traefik ×2, health checks)
                                   │
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
             Django app 1     Django app 2     Django app N   (stateless، autoscale)
                  │                │                │
                  └──────► Redis (Sentinel/Cluster) ◄── Celery workers (طوابير مفصولة)
                  │
                  ▼
        PgBouncer ──► PostgreSQL Primary ══(streaming replication)══► Replica (failover: Patroni)
                                   │
                                   └─► WAL archiving + نسخ يومية مشفّرة ► تخزين خارجي غير قابل للتعديل (S3 Object Lock)
```

### المبادئ
1. **عديم الحالة (Stateless):** لا ملفات محلية ولا جلسات في الذاكرة؛ الإيصالات والنسخ على تخزين كائنات؛ الأسرار ثابتة بين النسخ (مشكلة `SECRET_KEY` العشوائي أعلاه).
2. **تكرار (Redundancy):** ≥2 نسخة تطبيق خلف LB، موزّعة على مناطق/خوادم مختلفة. قاعدة بيانات Primary+Replica مع Patroni لتبديل تلقائي (RTO < 60 ث).
3. **تعافٍ ذاتي (Auto-healing):**
```yaml
# docker-compose / swarm
services:
  api:
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-fs", "http://localhost:8000/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 20s
    deploy:
      replicas: 3
      restart_policy: { condition: any, delay: 5s }
      update_config: { order: start-first, failure_action: rollback }
      resources: { limits: { cpus: "1.0", memory: 512M } }
```
   على Kubernetes: `livenessProbe` + `readinessProbe` + HPA (CPU 60%) + PodDisruptionBudget. أضف `autoheal` أو orchestrator يعيد تشغيل الحاويات غير الصحية.
4. **تدهور رشيق (Graceful Degradation):** تحديد أولويات: دخول/حضور/تسميع (حرج) ≫ تقارير/PDF/وكيل الذكاء (قابل للتأجيل). مفاتيح ميزات (feature flags) لتعطيل المسارات الثقيلة عند الهجوم.
5. **عزل المستأجرين:** حدود معدل ومجمّعات اتصالات لكل مسجد حتى لا يُسقط مسجد واحد (أو مهاجم عبر نطاقه) الباقين؛ طابور Celery منفصل للـprovisioning.
6. **النسخ الاحتياطي (3-2-1):** يومي + WAL، تشفير، نسخة خارج الموقع بـObject Lock، **اختبار استعادة شهري**. الأهداف: RPO ≤ 15 دقيقة، RTO ≤ 1 ساعة.
7. **المراقبة والاستجابة:** Prometheus+Grafana (معدل 4xx/5xx، زمن الاستجابة، اتصالات DB)، Loki/ELK للسجلات، Sentry، تنبيهات PagerDuty/Telegram. قواعد: ارتفاع 401/429، توكنات انتحال، أحجام رفع شاذة. Fail2ban للحظر الآلي.
8. **كتيّب الحوادث (Runbook):** (1) تفعيل Under Attack، (2) رفع الحدود وإيقاف المسارات الثقيلة، (3) عزل المستأجر المتأثر، (4) تدوير الأسرار وإبطال التوكنات عند الاشتباه بالتسريب، (5) استعادة من النسخة، (6) تقرير ما بعد الحادث.
9. **الأمان في دورة التطوير (CI/CD):** `bandit`، `pip-audit`، `npm audit`، `trivy` للصور، `gitleaks` للأسرار، اختبارات عزل المستأجر (لديكم `tests_security.py` — وسّعوه ليغطي كل مسار)، ونشر Blue/Green مع rollback تلقائي.

### مؤشرات النجاح
- لا أسرار افتراضية في الإنتاج (الإقلاع يفشل).
- 0 توكنات في `localStorage`.
- كل مسار محمي بـdecorator دور واحد + اختبار عزل مستأجر.
- تحمل اختبار حمل (k6) 10× الذروة دون تجاوز p95 > 1s، مع تفعيل Rate-limit فعلياً.
- استعادة كاملة من النسخة في < ساعة، موثقة شهرياً.

---
*ملاحظة: اختبارات الحمل والاختراق يجب أن تُجرى فقط على بيئة staging تملكونها وبتصريح داخلي.*
