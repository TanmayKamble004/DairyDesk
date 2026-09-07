"""
Django settings for the DairyDesk config project.

Configuration is read from environment variables (see ../.env.example).
A .env file in the repo root or backend/ is loaded automatically in dev.
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from the backend dir first, then fall back to the repo root.
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-insecure-change-me")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env_bool("DEBUG", True)

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    # Local
    "core",
    "health",
]

# Custom user model (must be set before core's first migration).
AUTH_USER_MODEL = "core.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "dairydesk"),
        "USER": os.environ.get("POSTGRES_USER", "dairydesk"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "dairydesk"),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

# No UserAttributeSimilarityValidator: a password is not refused for resembling
# the person's own name, username or email. Length, common passwords and
# all-numeric are still checked.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

LANGUAGE_CODE = "en-us"

# The shop is in Mumbai, and this is what "today" means to it. That matters more
# than it looks: expiry status, available_quantity and a batch's default
# received_date all come from timezone.localdate(), so under UTC everything
# after 05:30 IST was still being judged against yesterday's date.
#
# Read from TZ so one variable sets the container clock and Django together —
# otherwise the logs and the admin can disagree about what time it is.
#
# USE_TZ stays True, so this changes how datetimes are *rendered* and what
# localdate() returns, not how they are stored. Everything in Postgres is still
# UTC and existing rows are unaffected.
TIME_ZONE = os.environ.get("TZ", "Asia/Kolkata")

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = "static/"

# Uploaded files (product photos). Served by Django itself while DEBUG is on —
# see config/urls.py — which is all this local demo needs.
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        # Session auth keeps the browsable API's login usable in dev.
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    # Only the two forgotten-password endpoints are throttled, and they opt in
    # by scope rather than through DEFAULT_THROTTLE_CLASSES — the signed-in API
    # is a shop counter, not a public service, and rate-limiting it would only
    # get in the way of a busy morning.
    #
    # Five an hour per IP is the number that matters most in this feature: a
    # security question is a short, guessable secret, so what stops it being
    # brute-forced is not its own strength but how few attempts anyone gets.
    "DEFAULT_THROTTLE_RATES": {
        "password_reset": os.environ.get("PASSWORD_RESET_RATE", "5/hour"),
    },
}

# JWT lifetimes are generous because this is a local demo.
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    # Off by default in SimpleJWT — without it `last_login` never moves and the
    # Staff page's "Last login" column would read "Never" for everyone.
    "UPDATE_LAST_LOGIN": True,
}

# CORS — allow the Vite dev server origin.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")


# ---- Events / notifications ----------------------------------------------
#
# This app *produces* LOW_STOCK events; it never sends an email. Delivery is the
# notification service's job, and the SMTP credentials live there — deliberately
# not here, so the Django container has no reason to hold them.

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EVENTS_EXCHANGE = os.environ.get("EVENTS_EXCHANGE", "dairydesk.events")
LOW_STOCK_ROUTING_KEY = os.environ.get("LOW_STOCK_ROUTING_KEY", "stock.low_stock")

# The consumer's queue and its dead-letter pair. Named here as well as in the
# notification service because the *producer* declares and binds them too: a
# topic exchange silently drops messages that match no binding, so if only the
# consumer declared the queue, every alert raised before its first start would
# vanish. Declarations are idempotent, so whoever boots first wins.
LOW_STOCK_QUEUE = os.environ.get("LOW_STOCK_QUEUE", "notifications.low_stock")
EVENTS_DLX = os.environ.get("EVENTS_DLX", "dairydesk.dlx")
LOW_STOCK_DLQ = os.environ.get("LOW_STOCK_DLQ", "notifications.low_stock.dlq")

# Off switch for the outbox writer, for anyone who wants the rest of the app
# without the notification pipeline. Note it gates *writing* the event, not
# publishing it — turning the relay off instead leaves events accumulating
# safely in the outbox, which is usually what you actually want.
#
# `seed_demo` needs no such guard: it calls raise_auto_reorders directly rather
# than on_stock_changed, so reseeding cannot queue sixty alerts.
EVENTS_ENABLED = env_bool("EVENTS_ENABLED", True)

# Whether a low product must also have `auto_reorder` switched on to alert its
# supplier. Default False: raising a purchase order is a financial commitment
# and rightly opt-in, but telling a supplier you are running low is not, and the
# products nobody has automated are the ones most likely to be forgotten.
NOTIFY_ONLY_AUTO_REORDER = env_bool("NOTIFY_ONLY_AUTO_REORDER", False)

# How long the relay waits between sweeps of the outbox, and how many times it
# retries one event before parking it as FAILED.
OUTBOX_POLL_SECONDS = int(os.environ.get("OUTBOX_POLL_SECONDS", "5"))
OUTBOX_MAX_ATTEMPTS = int(os.environ.get("OUTBOX_MAX_ATTEMPTS", "10"))


# ---- Email (SMTP) ----
# Credentials come from .env; see .env.example for the Gmail setup.
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")

# Without credentials, mail is printed to the console rather than sent, so a
# fresh clone can exercise anything that emails without a mailbox to hand.
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST_USER
    else "django.core.mail.backends.console.EmailBackend",
)

EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
# Without a timeout a firewalled port 587 hangs the request thread indefinitely.
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "10"))

# Gmail rewrites any From that isn't the authenticated account, so default to it.
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL") or (
    f"DairyDesk <{EMAIL_HOST_USER}>" if EMAIL_HOST_USER else "webmaster@localhost"
)
SERVER_EMAIL = DEFAULT_FROM_EMAIL
