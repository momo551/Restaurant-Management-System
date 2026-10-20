"""
Django settings for Restaurant Management System.
"""

from pathlib import Path
from datetime import timedelta
from decouple import config
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# SECRET_KEY comes from the process environment, falling back to backend/.env via
# python-decouple (the same loader used for every other setting below). A real
# environment variable always wins, so Railway only needs the variable set.
# No fallback/default value is provided on purpose: a missing production key must
# fail loudly instead of silently signing tokens with a guessable value.
SECRET_KEY = config('SECRET_KEY', default='')

if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is not configured. Set the SECRET_KEY environment variable "
        "(production/Railway) or define it in backend/.env for local development. "
        "See backend/.env.example for the expected variable names."
    )

DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

# Environment variables override these local-development defaults in Railway.
_default_cors_origins = ','.join([
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://restaurant-system-alpha.vercel.app',
])
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in config('CORS_ALLOWED_ORIGINS', default=_default_cors_origins).split(',')
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'channels',
    'axes',
    'tenants',
    'users',
    'menu',
    'tables',
    'orders',
    'billing',
    'reports',
    'stock',
    'django_filters',
    'loyalty',
    'cloudinary_storage',
    'cloudinary',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'axes.middleware.AxesMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'

# ─── Channels & Caching ───────────────────────────────────────────────────────
#
# INTENTIONAL DESIGN: InMemoryChannelLayer is used without Redis.
#
# This project runs as a single Daphne process on Railway (see Procfile).
# InMemoryChannelLayer works correctly in that topology:
#   - WebSocket group messages (kitchen display, order tracking) are broadcast
#     within the same process and are delivered reliably.
#
# KNOWN LIMITATION: If Railway scales to more than one replica of the backend
# service, each process has its own isolated in-memory layer and cross-replica
# WebSocket broadcasts will NOT work. For multi-replica deployments a shared
# channel layer (e.g. channels_redis or a database-backed layer) would be
# required. This project does not use Redis and does not require it.

CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
}
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}

# ─── Database ─────────────────────────────────────────────────────────────────

_DB_URL = config('DATABASE_URL', default=f'sqlite:///{BASE_DIR / "db.sqlite3"}')
# print("DATABASE_URL =", _DB_URL)
# print("DEBUG =", DEBUG)
if _DB_URL.startswith('postgres'):
    # dj-database-url handles SSL, port, encoding, and conn pooling correctly
    DATABASES = {
        'default': dj_database_url.parse(
            _DB_URL,
            conn_max_age=60,
            conn_health_checks=True,
            ssl_require=_DB_URL.startswith("postgresql+ssl://")
        )
    }
elif _DB_URL.startswith('sqlite'):
    _db_path = _DB_URL.split('///')[-1] if '///' in _DB_URL else 'db.sqlite3'
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / _db_path,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': config('DB_ENGINE', default='django.db.backends.sqlite3'),
            'NAME': config('DB_NAME', default=str(BASE_DIR / 'db.sqlite3')),
            'USER': config('DB_USER', default=''),
            'PASSWORD': config('DB_PASSWORD', default=''),
            'HOST': config('DB_HOST', default=''),
            'PORT': config('DB_PORT', default=''),
            'CONN_MAX_AGE': 60,
        }
    }

# --------------------------------------------------------------------------
# Production Database Guard:
# In production (DEBUG=False), SQLite is strictly prohibited because container
# ephemeral disks wipe data on every deployment/restart. Fail fast if DATABASE_URL
# is missing or resolves to SQLite.
# --------------------------------------------------------------------------
import sys
_is_test = 'test' in sys.argv or config('TESTING', default=False, cast=bool)
if not DEBUG and not _is_test and DATABASES['default'].get('ENGINE') == 'django.db.backends.sqlite3':
    raise RuntimeError(
        "Production misconfiguration: SQLite database engine is not permitted when DEBUG=False. "
        "A valid PostgreSQL DATABASE_URL must be configured on Railway."
    )


# ─── Password Validation ──────────────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── Auth ─────────────────────────────────────────────────────────────────────

AUTH_USER_MODEL = 'users.User'

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'users.backends.EmailOrUsernameModelBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# ─── Internationalization ─────────────────────────────────────────────────────

LANGUAGE_CODE = 'ar'
TIME_ZONE = 'Africa/Cairo'
USE_I18N = True
USE_TZ = True

# ─── Email ────────────────────────────────────────────────────────────────────

EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='Restaurant System <noreply@example.com>')

# ─── Static & Media ───────────────────────────────────────────────────────────

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ─── Cloudinary ───────────────────────────────────────────────────────────────

CLOUDINARY_CLOUD_NAME = config('CLOUDINARY_CLOUD_NAME', default='')
if CLOUDINARY_CLOUD_NAME:
    CLOUDINARY_STORAGE = {
        'CLOUD_NAME': CLOUDINARY_CLOUD_NAME,
        'API_KEY': config('CLOUDINARY_API_KEY', default=''),
        'API_SECRET': config('CLOUDINARY_API_SECRET', default=''),
    }
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── REST Framework ───────────────────────────────────────────────────────────

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/minute',
        'user': '120/minute',
    },
}

# ─── JWT ──────────────────────────────────────────────────────────────────────

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS512',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# ─── CORS & CSRF ──────────────────────────────────────────────────────────────

from corsheaders.defaults import default_headers

CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=False, cast=bool)
CORS_ALLOW_HEADERS = list(default_headers) + [
    'content-disposition',
]

# Production: set CSRF_TRUSTED_ORIGINS on Railway to your Railway URL and Vercel URLs, e.g.
#   "https://restaurant-system-production-77a8.up.railway.app,https://your-admin.vercel.app"
_default_csrf_origins = ','.join([
    'https://restaurant-system-alpha.vercel.app',
])
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in config('CSRF_TRUSTED_ORIGINS', default=_default_csrf_origins).split(',')
    if origin.strip()
]

# ─── Security ─────────────────────────────────────────────────────────────────

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=(not DEBUG and not _is_test), cast=bool)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ─── Axes ─────────────────────────────────────────────────────────────────────

AXES_FAILURE_LIMIT = 10
AXES_COOLOFF_TIME = timedelta(hours=1)
AXES_LOCKOUT_TEMPLATE = None
AXES_RESET_ON_SUCCESS = True
AXES_LOCKOUT_PARAMETERS = ['username', 'ip_address']

# ─── Logging ──────────────────────────────────────────────────────────────────

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': config('DJANGO_LOG_LEVEL', default='INFO'),
            'propagate': False,
        },
        'channels': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}

# ─── Sentry ───────────────────────────────────────────────────────────────────

SENTRY_DSN = config('SENTRY_DSN', default='')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.2,
        send_default_pii=False,
    )
