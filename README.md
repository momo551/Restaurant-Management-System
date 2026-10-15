# Restaurant Management System

A full-stack restaurant management system separating the backend (Django), an admin dashboard (React/Vite), and a customer-facing portal (React/Vite).

## 🚀 Deployment & GitHub Guide

هذا الدليل خطوة بخطوة لشرح كيفية رفع الكود الخاص بك على GitHub ومن ثم نشره (Deploy) على منصات مجانية مثل Render (للباك-إند) و Vercel (للفرونت-إند وموقع العملاء).

---

### أولاً: الرفع على GitHub (خطوة بخطوة)

قم بفتح الـ **Terminal** داخل مجلد المشروع الرئيسي (Restaurant Management System) ونفذ الأوامر التالية بالترتيب:

#### 1. تهيئة المستودع (Initialize Repository)
```bash
git init
```

#### 2. إضافة الملفات للمستودع
بفضل ملفات الـ `.gitignore` التي قمنا بإنشائها، لن يتم رفع الملفات غير الضرورية (مثل `node_modules` و `.env`).
```bash
git add .
```

#### 3. حفظ التغييرات (Commit)
```bash
git commit -m "النسخة الأولى للمشروع جاهزة للإنتاج"
```

#### 4. إنشاء مستودع على موقع GitHub
1. اذهب إلى موقع [GitHub](https://github.com/) وسجل الدخول.
2. اضغط على زر **"+"** في الزاوية العلوية اليمنى واختر **"New repository"**.
3. اكتب اسم المستودع.
4. اجعله **Private** أو **Public** حسب رغبتك.
5. لا تقم بإضافة `README` أو `.gitignore` من الموقع.
6. اضغط **Create repository**.

#### 5. ربط المشروع المحلي بمستودع GitHub
بعد إنشاء المستودع سيعطيك GitHub أوامر مثل هذه لربط المستودع محليًا بـ GitHub. انسخها والصقها في الـ Terminal:
```bash
git branch -M main
git remote add origin https://github.com/اسم_حسابك/اسم_المستودع.git
git push -u origin main
```

---

### ثانياً: النشر (Deployment) خطوة بخطوة

سنقوم برفع **الباك-إند (Django)** على **Railway** والأجزاء الأمامية **(React)** على **Vercel**.

#### 1- رفع الباك-إند مجاناً على Railway
1. افتح موقع [Railway.app](https://railway.app/) وسجل الدخول باستخدام حساب GitHub الخاص بك.
2. للبدء، ستظهر لك لوحة التحكم الرئيسية فاضغط على زر **"New Project"**.
3. اختر **"Deploy from GitHub repo"**.
4. اختر المستودع الخاص بك (مثل `Restaurant-system`).
5. **مهم جداً (Root Directory):** بمجرد أن يظهر المشروع في واجهة Railway، اضغط عليه، واذهب إلى الإعدادات (**Settings**)، ثم تحت قسم **Service**، ابحث عن الحقل المسمى **Root Directory** واكتب فيه `backend`، ثم اضغط علامة الصح أو `Save`. (هذا سيجعل Railway يفهم أن الباك-إند كله داخل هذا المجلد).
6. اذهب إلى قائمة **Variables** (المتغيرات) وأضفها بالضغط على `New Variable` أو `RAW Editor` للصقها جميعاً معاً:
   ```env
   SECRET_KEY=your-secret-key-goes-here
   DEBUG=False
   ALLOWED_HOSTS=your-app.up.railway.app
   CORS_ALLOWED_ORIGINS=https://your-admin.vercel.app,https://your-customer.vercel.app
   CSRF_TRUSTED_ORIGINS=https://your-app.up.railway.app,https://your-admin.vercel.app,https://your-customer.vercel.app
   SECURE_SSL_REDIRECT=True
   PYTHON_VERSION=3.11.9
   ```
7. ستقوم المنصة تلقائيًا بالبناء والتشغيل بناءً على ملف `Procfile` الذي جهزناه.
8. اذهب إلى قائمة **Settings** ثم انزل لتجد **Networking**، تحت كلمة **Public Networking** اضغط على **Generate Domain** ليصنع لك رابطاً عاماً لمشروعك (مثلاً: `restaurant-system.up.railway.app`). هذا الرابط هو ما سنستخدمه!

---

#### 2- رفع لوحة الإدارة (Frontend) و موقع العملاء (Customer Website) على Vercel
قم بتنفيذ هذه الخطوات مرتين للفرونت إند وموقع العميل:
1. افتح موقع [Vercel.com](https://vercel.com/) وسجل الدخول بواسطة GitHub.
2. اضغط على **"Add New..."** ثم **"Project"**.
3. استورد المستودع.
4. **في إعدادات المشروع (Configure Project):**
   - **Framework Preset:** `Vite`
   - **Root Directory:** اختر ديركتوري سواء `frontend` أو `customer-website`.
5. في **Environment Variables**:
   - أضف المتغير `VITE_API_URL` وضع فيه قيمة الرابط الخاص بالباك اند من Railway (مثلاً: `https://restaurant-system.up.railway.app`).
6. اضغط **Deploy**.

---

### 🚨 بعد النشر
لزيادة الحماية، اذهب إلى Railway مجدداً وعدّل قيمة `ALLOWED_HOSTS` المعمولة بشكل `*` لتكون روابط موقع Vercel فقط.

مثال:
- `ALLOWED_HOSTS` = `restaurant-system.up.railway.app,restaurant-admin.vercel.app`
- `CORS_ALLOWED_ORIGINS` = `https://restaurant-admin.vercel.app,https://restaurant-customer.vercel.app`

مبروك! مشروعك الآن يعمل بالكامل! 🚀

---

## ⚙️ Production configuration notes (Phase 9B audit)

These are the settings that are **not** in any committed file, because
`.env` / `.env.production` are gitignored and never deployed. They must be set
in the host's own environment-variable panel (Railway → Variables, Vercel →
Settings → Environment Variables).

### Backend environment variables (Railway)

| Variable | Required value |
| --- | --- |
| `SECRET_KEY` | A strong unique key. **Never** reuse the value that appears in this README or in any committed file. |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | The Railway host, e.g. `restaurant-system-production-77a8.up.railway.app`. Avoid `*`. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated **https** origins of the admin and customer frontends. Defaults to local dev servers only, so production must set this or every cross-origin request is blocked. |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated **https** origins, including the Railway backend itself. Defaults to **empty**, which breaks Django admin login and any unsafe cross-origin request. Django does **not** support wildcards such as `https://*.vercel.app` — list each origin. |
| `CORS_ALLOW_ALL_ORIGINS` | `False` (leave unset). `True` disables the allow-list. |
| `SECURE_SSL_REDIRECT` | Defaults to `not DEBUG`, i.e. `True` in production. Safe behind Railway because `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` is configured. |
| `DEFAULT_PASS` | **Required only when manually running default user creation scripts.** A strong password for initial default accounts (admin, manager, cashier, etc.). This variable is NOT used during normal startup - it is only required if you manually run `python create_admin.py` or `python manage.py create_default_users` to seed initial users. **Never use a weak or default password.** |

### Frontend environment variables (Vercel)

`VITE_API_URL` must be the backend's public origin (no trailing slash, no `/api`
suffix). Vite inlines it at **build** time, so it must be present when the
bundle is built. If it is missing, the apps fall back to `http://localhost:8000`
and the deployed site will call the visitor's own machine. The Dockerfiles now
default this to the Railway backend, but an explicit value always wins.

- Admin frontend (`frontend/`): `VITE_API_URL=https://restaurant-system-production-77a8.up.railway.app`
- Customer website (`customer-website/`): the same backend origin.

### No Redis — and what that means

This project deliberately does **not** use Redis. There is no `REDIS_URL`, no
broker, and no Celery worker; background-task packages were removed from
`backend/requirements.txt` because no code imports them.

The channel layer is `channels.layers.InMemoryChannelLayer`, which is correct
for the current topology: a **single** Daphne process (`Procfile`, `Dockerfile`).

**Limitations you must not forget:**

- The in-memory layer shares messages **only inside one process**. It works for
  the kitchen display and live order tracking because there is exactly one
  backend worker.
- It provides **no cross-process or cross-instance message sharing**. If the
  backend is ever scaled to more than one worker/replica, WebSocket broadcasts
  will silently stop reaching clients connected to the other processes.
- Adding `--workers N` to Daphne/Gunicorn, or scaling Railway replicas, requires
  a shared channel layer instead. Until then, keep the backend at one process.
