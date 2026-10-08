"""Django settings for the Growl backend.

Local development uses SQLite; production targets PostgreSQL. Nothing in this file differs
between the two except the DATABASES block, which is deliberate: the domain rules must hold
identically on both engines, so the schema uses features both support (partial unique
indexes and check constraints) rather than anything engine-specific.
"""

import os
import socket
import sys
from pathlib import Path

from .environment import require_supported_django

# Before anything else. Loading settings with the wrong interpreter otherwise fails much later,
# as an obscure error inside a model definition rather than as a missing dependency.
require_supported_django()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("GROWL_SECRET_KEY", "dev-only-not-for-production")
DEBUG = os.environ.get("GROWL_DEBUG", "1") == "1"


def local_network_hosts():
    """This machine's own LAN address, so a phone on the same Wi-Fi can be served.

    A development convenience and nothing more: a hardcoded `localhost` ALLOWED_HOSTS rejects
    every request from a physical device with a `DisallowedHost` 400, which looks like the app
    failing to connect rather than like a host-header problem. Discovered by asking the socket
    which local address it would use to reach the outside world — this sends no traffic, it just
    reads what the routing table already decided.

    Production sets GROWL_ALLOWED_HOSTS and gets a fixed list, never a wildcard.
    """
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            probe.connect(("8.8.8.8", 80))
            address = probe.getsockname()[0]
        finally:
            probe.close()
    except OSError:
        return []
    return [address] if not address.startswith("127.") else []


if os.environ.get("GROWL_ALLOWED_HOSTS"):
    ALLOWED_HOSTS = os.environ["GROWL_ALLOWED_HOSTS"].split(",")
else:
    ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"]
    if DEBUG:
        ALLOWED_HOSTS += local_network_hosts()

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "accounts",
    "compliance",
    "susu",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    # After authentication, so `request.user` is resolved. Act 843 s.24: retention needs to know
    # when an account was last used, and this is the only place that knows.
    "compliance.middleware.LastSeenMiddleware",
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
#
# Argon2id is only used when the library is actually importable. Listing a hasher that cannot be
# loaded does not degrade gracefully — it raises at the first `set_password`, which is a member
# trying to sign up — so the list is built from what is installed rather than from what we wish
# were installed.
try:  # pragma: no cover - depends on the deployment, not on the code
    import argon2  # noqa: F401

    _ARGON2 = ["django.contrib.auth.hashers.Argon2PasswordHasher"]
except ImportError:  # pragma: no cover
    _ARGON2 = []

PASSWORD_HASHERS = _ARGON2 + [
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

# Licensed payment partner configuration (Act 987 compliance).
# Hubtel EPSP is primary; Fincra is fallback. Both are licensed PSPs in Ghana.
# Set SUSU_RAIL to "hubtel" or "fincra" to select the active adapter.
# If neither is configured, the worker runs in "unconfigured" mode and settles nothing.
SUSU_RAIL = os.environ.get("SUSU_RAIL", "unconfigured")

# --- Social Sign-In -----------------------------------------------------------
# Google and Apple OAuth client IDs. The frontend performs the provider flow and
# submits an ID token here for verification.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
APPLE_CLIENT_ID = os.environ.get("APPLE_CLIENT_ID", "")

# Hubtel EPSP credentials (primary)
HUBTEL_BASE_URL = os.environ.get("HUBTEL_BASE_URL", "https://epsp.hubtel.com")
HUBTEL_CLIENT_ID = os.environ.get("HUBTEL_CLIENT_ID", "")
HUBTEL_CLIENT_SECRET = os.environ.get("HUBTEL_CLIENT_SECRET", "")
HUBTEL_COLLECTION_ACCOUNT = os.environ.get("HUBTEL_COLLECTION_ACCOUNT", "")
HUBTEL_TIMEOUT = int(os.environ.get("HUBTEL_TIMEOUT", "30"))

# Fincra credentials (fallback)
FINCRA_BASE_URL = os.environ.get("FINCRA_BASE_URL", "https://api.fincra.com")
FINCRA_API_KEY = os.environ.get("FINCRA_API_KEY", "")
FINCRA_SECRET_KEY = os.environ.get("FINCRA_SECRET_KEY", "")
FINCRA_TIMEOUT = int(os.environ.get("FINCRA_TIMEOUT", "30"))

# ---------------------------------------------------------------------------
# Act 1044 AML/CFT — Sanctions/PEP Screening
# ---------------------------------------------------------------------------
# Set COMPLIANCE_SCREENER to "world_check", "dow_jones", or "stub" (for tests).
# If unset or "unconfigured", screening records an error and the account must
# be screened manually before any transaction is allowed.
COMPLIANCE_SCREENER = os.environ.get("COMPLIANCE_SCREENER", "unconfigured")
COMPLIANCE_SCREENER_VERSION = os.environ.get("COMPLIANCE_SCREENER_VERSION", "")

# World-Check / Refinitiv (when contracted)
WORLD_CHECK_API_KEY = os.environ.get("WORLD_CHECK_API_KEY", "")
WORLD_CHECK_BASE_URL = os.environ.get("WORLD_CHECK_BASE_URL", "https://api.world-check.com")

# Dow Jones Risk & Compliance (when contracted)
DOW_JONES_API_KEY = os.environ.get("DOW_JONES_API_KEY", "")
DOW_JONES_BASE_URL = os.environ.get("DOW_JONES_BASE_URL", "https://api.dowjones.com")

# BoG sanctions list (public, no auth required)
BOG_SANCTIONS_URL = os.environ.get(
    "BOG_SANCTIONS_URL", "https://www.bog.gov.gh/wp-content/uploads/sanctions-list.json"
)

# Screening behaviour
SCREENING_REQUIRED_AT_ONBOARDING = os.environ.get("SCREENING_REQUIRED_AT_ONBOARDING", "1") == "1"
SCREENING_REQUIRED_BEFORE_PAYOUT = os.environ.get("SCREENING_REQUIRED_BEFORE_PAYOUT", "1") == "1"

# Periodic re-screening interval (days)
SCREENING_RESCREEN_INTERVAL_DAYS = int(os.environ.get("SCREENING_RESCREEN_INTERVAL_DAYS", "30"))


# ---------------------------------------------------------------------------
# Act 843 s.28 — safeguards, not intentions
# ---------------------------------------------------------------------------
#
# The registration application asks the Commission for "a general description of measures to be
# taken to secure the data" (s.47(1)(i)), and s.28(2) asks that they be verified as well as
# established. A description of measures that are not switched on is a false particular, which
# s.47(2) makes an offence, so these are set from the environment rather than promised in a
# document.
#
# Guarded on DEBUG so the development server over plain HTTP on a LAN still works. In
# production they are not optional, and the secret key check below is a refusal to start rather
# than a warning: a deployment running on the published development key has every signed token
# in the system forgeable, and that is not something to discover from a log line.
if not DEBUG:
    from django.core.exceptions import ImproperlyConfigured

    if SECRET_KEY == "dev-only-not-for-production":
        raise ImproperlyConfigured(
            "GROWL_SECRET_KEY is unset in production. Every JWT this service signs is forgeable "
            "with the value in the source tree, so the service will not start until it is set."
        )
    if not ALLOWED_HOSTS:
        raise ImproperlyConfigured(
            "GROWL_ALLOWED_HOSTS is unset in production. Set it to the hostnames this API answers "
            "on; a wildcard is not a value."
        )

    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31_536_000          # 12 months
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    # The API sits behind a TLS-terminating proxy, so this is how Django learns the request
    # arrived over HTTPS. Without it SECURE_SSL_REDIRECT loops: every request is "insecure" and
    # is redirected to the same URL forever.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"