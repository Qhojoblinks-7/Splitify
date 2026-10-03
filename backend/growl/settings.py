"""Django settings for the Growl backend.

Local development uses SQLite; production targets PostgreSQL. Nothing in this file differs
between the two except the DATABASES block, which is deliberate: the domain rules must hold
identically on both engines, so the schema uses features both support (partial unique
indexes and check constraints) rather than anything engine-specific.
"""

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("GROWL_SECRET_KEY", "dev-only-not-for-production")
DEBUG = os.environ.get("GROWL_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get("GROWL_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "accounts",
    "susu",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "growl.urls"
WSGI_APPLICATION = "growl.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": [
            "django.template.context_processors.request",
            "django.contrib.auth.context_processors.auth",
            "django.contrib.messages.context_processors.messages",
        ]},
    }
]

if os.environ.get("GROWL_DB_ENGINE", "sqlite") == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("GROWL_DB_NAME", "growl"),
            "USER": os.environ.get("GROWL_DB_USER", "growl"),
            "PASSWORD": os.environ.get("GROWL_DB_PASSWORD", ""),
            "HOST": os.environ.get("GROWL_DB_HOST", "127.0.0.1"),
            "PORT": os.environ.get("GROWL_DB_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
            # Money correctness requires real transactions and real row locking, which
            # SQLite does not give. Development only; PostgreSQL for anything real.
            "OPTIONS": {"timeout": 20},
            # A file-backed test database rather than Django's default in-memory shared
            # cache. The shared-cache in-memory database wedges under repeated
            # IntegrityError rollback cycles, which is exactly what these constraint
            # tests do on purpose.
            "TEST": {"NAME": BASE_DIR / "test_db.sqlite3", "TIMEOUT": 30},
        }
    }

AUTH_USER_MODEL = "accounts.Account"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

# Token rotation: a short-lived access token and a rotating, revocable refresh token.
# Security doc I23: reuse of a rotated refresh token revokes the whole session family.
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": __import__("datetime").timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": __import__("datetime").timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

# Production hashing. Argon2id is specified by the security document (rule I21); Django's
# PBKDF2 remains the fallback so the service starts even where argon2-cffi is unavailable.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

# Under test, hashing dominates the runtime and tests nothing about hashing itself. This
# guard has to be right or every fixture silently pays production cost: pytest sets
# PYTEST_VERSION in the environment, but `sys.argv` contains neither "test" nor "pytest"
# when invoked as `python -m pytest`, and PYTEST_CURRENT_TEST only appears once a test is
# already executing. Security rule I21 is checked against the production setting in the
# launch checklist, not here.
TESTING = (
    os.environ.get("GROWL_TESTING") == "1"
    or "PYTEST_VERSION" in os.environ
    or "pytest" in sys.modules
)

if TESTING:
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

TIME_ZONE = "Africa/Accra"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Money never travels as a float. Every amount is an integer number of pesewas; these
# guards make a float a type error rather than a silently wrong number. M1.
MONEY_MAX_PESEWAS = 10 ** 12