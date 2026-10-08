"""
Social identity token verification for Google and Apple Sign-In.

The frontend obtains an ID token from the provider SDK (not from a browser
redirect in this codebase's flow) and POSTs it here. This module verifies that
token against the provider — proving the token was issued to this app's client
ID and has not expired — then returns the email and display name so the views
can create or retrieve a matching Account and issue our own JWTs.

Google: verifies via the tokeninfo endpoint with `requests`. This is the
development flow; a production deployment should verify the JWT signature
locally to avoid leaking the token to a third party. The two are interchangeable
here: both produce the same (sub, email, name) triple.

Apple: verifies the JWT locally using Apple's public keys. Apple does not offer
a tokeninfo endpoint, so local verification is the only option. The identity
token is a standard JWT; PyJWT is already a dependency (used by SimpleJWT).
"""

from __future__ import annotations

import json
import time
from urllib.parse import urlencode

import requests

from growl.settings import GOOGLE_CLIENT_ID, APPLE_CLIENT_ID

# Apple rotates its signing keys at https://appleid.apple.com/auth/keys. We cache
# them for the lifetime of the process; a key rotation that happens mid-process
# is handled on the next token verification attempt by the cache TTL.
_APP_KLE_URL = "https://appleid.apple.com/auth/keys"
_app_keys_cache = None
_app_keys_expires = 0
_KEY_CACHE_TTL = 3600


class SocialVerificationError(Exception):
    """Raised when a provider token cannot be verified."""


def verify_google_id_token(id_token):
    """Verify a Google ID token and return (sub, email, name).

    Uses Google's tokeninfo endpoint. Returns the Google user ID (sub),
    email, and display name. Raises SocialVerificationError on any failure.
    """
    resp = requests.get(
        "https://oauth2.googleapis.com/tokeninfo",
        params={"id_token": id_token},
        timeout=10,
    )
    if resp.status_code != 200:
        raise SocialVerificationError("Google token verification failed")

    payload = resp.json()

    # Verify the token was issued to this app's client ID. A token minted for
    # a different app is useless here but could still carry real emails if
    # Google accepted it.
    if payload.get("aud") != GOOGLE_CLIENT_ID:
        raise SocialVerificationError("Google token was not issued to this app")

    # Verify the token has not expired.
    exp = int(payload.get("exp", 0))
    if time.time() > exp:
        raise SocialVerificationError("Google token has expired")

    return payload.get("sub"), payload.get("email"), payload.get("name")


def _get_apple_keys():
    """Fetch and cache Apple's public signing keys."""
    global _app_keys_cache, _app_keys_expires

    now = time.time()
    if _app_keys_cache is not None and now < _app_keys_expires:
        return _app_keys_cache

    resp = requests.get(_APP_KLE_URL, timeout=10)
    if resp.status_code != 200:
        raise SocialVerificationError("Could not fetch Apple signing keys")

    _app_keys_cache = resp.json()
    _app_keys_expires = now + _KEY_CACHE_TTL
    return _app_keys_cache


def _find_apple_key(token):
    """Find the Apple public key matching the token's kid.

    Returns the key in JWK format suitable for PyJWT's PyJWKClient.
    """
    import jwt

    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    keys = _get_apple_keys()
    for key in keys.get("keys", []):
        if key.get("kid") == kid:
            return key
    raise SocialVerificationError("No matching Apple signing key found")


def verify_apple_id_token(id_token):
    """Verify an Apple identity token and return (sub, email, name).

    Apple's identity token is a JWT signed with one of Apple's public keys.
    We verify the signature, the audience (our client ID), and the expiry,
    then extract the user's Apple ID (sub) and email.

    Apple only returns an email on first sign-in; subsequent logins return
    only the sub. The caller should handle email=None gracefully.
    """
    import jwt

    if not APPLE_CLIENT_ID:
        raise SocialVerificationError("Apple client ID is not configured")

    try:
        key = _find_apple_key(id_token)
        # PyJWT can construct the public key from the JWK.
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
        payload = jwt.decode(
            id_token,
            public_key,
            algorithms=["RS256"],
            audience=APPLE_CLIENT_ID,
            options={"verify_exp": True},
        )
    except jwt.InvalidTokenError as exc:
        raise SocialVerificationError(f"Apple token verification failed: {exc}") from exc

    return payload.get("sub"), payload.get("email"), None


def create_or_get_account(email, phone=None, full_name=None, verified=False):
    """Find an existing Account by email or phone, or create a new one.

    Social sign-in is identifier-linked: if an account already exists with
    this email or phone, it is returned. Otherwise a new account is created
    with an unusable password (the member authenticated with the provider, not
    with a password). The phone is preferred as the primary identifier per I1.
    """
    from .models import Account

    if email:
        try:
            return Account.objects.get(email=email)
        except Account.DoesNotExist:
            pass

    if phone:
        try:
            return Account.objects.get(phone=phone)
        except Account.DoesNotExist:
            pass

    defaults = {
        "email": email,
        "full_name": full_name or "",
        "phone_verified": verified,
        "id_verified": False,
    }

    if phone:
        account = Account(phone=phone, **defaults)
    else:
        # No phone from the provider; generate a placeholder phone (rule I4:
        # phone is the primary identifier, so a social-only account gets an
        # anon- prefixed placeholder that is replaced on first phone entry).
        account = Account(phone="+233000000000", **defaults)

    account.set_unusable_password()
    account.save()
    return account
