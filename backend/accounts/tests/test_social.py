"""
Social sign-in: the /api/auth/social/ endpoint.

These tests verify the API contract — that a provider ID token is accepted,
that a matching or new Account is created, and that JWTs are returned in the
same shape as the token and register endpoints. The provider verification
itself (Google's tokeninfo, Apple's keys endpoint) is mocked so the tests do
not depend on network access.
"""

from unittest import mock

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import Account

pytestmark = pytest.mark.django_db

SOCIAL_URL = reverse("auth-social")


@pytest.fixture
def api_client():
    return APIClient()


GOOGLE_TOKEN = "google-id-token-123"
APPLE_TOKEN = "apple-id-token-456"


def test_google_social_signin_creates_account(api_client):
    """A Google ID token for a new email creates a new Account and returns JWTs."""
    with mock.patch("accounts.views.verify_google_id_token") as mock_verify:
        mock_verify.return_value = ("google-sub-1", "newuser@example.com", "New User")

        resp = api_client.post(
            SOCIAL_URL,
            {"provider": "google", "id_token": GOOGLE_TOKEN, "phone": "+233201000100"},
            format="json",
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "access" in body
    assert "refresh" in body
    assert body["requires_profile_completion"] is False

    account = Account.objects.get(email="newuser@example.com")
    assert account.phone == "+233201000100"
    assert not account.has_usable_password()


def test_google_social_signin_links_existing_account(api_client):
    """If an Account already exists with the Google email, it is reused, not duplicated."""
    existing = Account.objects.create_user(
        phone="+233201000100", password="pw-fixture-password123",
        email="existing@example.com",
    )

    with mock.patch("accounts.views.verify_google_id_token") as mock_verify:
        mock_verify.return_value = ("google-sub-2", "existing@example.com", "Existing User")

        resp = api_client.post(
            SOCIAL_URL,
            {"provider": "google", "id_token": GOOGLE_TOKEN},
            format="json",
        )

    assert resp.status_code == 200
    assert Account.objects.filter(email="existing@example.com").count() == 1
    assert Account.objects.get(email="existing@example.com") == existing


def test_apple_social_signin_returns_tokens(api_client):
    """An Apple ID token returns JWTs; Apple only sends email on first sign-in."""
    with mock.patch("accounts.views.verify_apple_id_token") as mock_verify:
        mock_verify.return_value = ("apple-sub-1", "appleuser@example.com", None)

        resp = api_client.post(
            SOCIAL_URL,
            {"provider": "apple", "id_token": APPLE_TOKEN, "phone": "+233201000200"},
            format="json",
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "access" in body
    assert "refresh" in body


def test_apple_social_signin_without_email(api_client):
    """Apple returns email only on first sign-in; subsequent logins have no email."""
    with mock.patch("accounts.views.verify_apple_id_token") as mock_verify:
        mock_verify.return_value = ("apple-sub-1", None, None)

        resp = api_client.post(
            SOCIAL_URL,
            {"provider": "apple", "id_token": APPLE_TOKEN, "phone": "+233201000300"},
            format="json",
        )

    assert resp.status_code == 200
    Account.objects.get(phone="+233201000300")


def test_invalid_provider_is_rejected(api_client):
    resp = api_client.post(
        SOCIAL_URL,
        {"provider": "facebook", "id_token": "some-token"},
        format="json",
    )

    assert resp.status_code == 400


def test_invalid_google_token_is_rejected(api_client):
    from accounts.social import SocialVerificationError

    with mock.patch("accounts.views.verify_google_id_token") as mock_verify:
        mock_verify.side_effect = SocialVerificationError("Invalid token")

        resp = api_client.post(
            SOCIAL_URL,
            {"provider": "google", "id_token": "bad-token"},
            format="json",
        )

    assert resp.status_code == 401


def test_invalid_apple_token_is_rejected(api_client):
    from accounts.social import SocialVerificationError

    with mock.patch("accounts.views.verify_apple_id_token") as mock_verify:
        mock_verify.side_effect = SocialVerificationError("Bad Apple token")

        resp = api_client.post(
            SOCIAL_URL,
            {"provider": "apple", "id_token": "bad-token"},
            format="json",
        )

    assert resp.status_code == 401


def test_social_auth_returns_profile_completion_flag(api_client):
    """When the backend creates a placeholder phone, the response flags it."""
    with mock.patch("accounts.views.verify_google_id_token") as mock_verify:
        mock_verify.return_value = ("google-sub-9", "placeholder@example.com", "Placeholder User")

        resp = api_client.post(
            SOCIAL_URL,
            {"provider": "google", "id_token": GOOGLE_TOKEN},
            format="json",
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["requires_profile_completion"] is True
    assert Account.objects.get(email="placeholder@example.com").phone == "+233000000000"


def test_profile_update_requires_auth(api_client):
    """An unauthenticated request to the profile endpoint is refused."""
    resp = api_client.patch(
        reverse("member-profile"),
        {"full_name": "Test User", "phone": "+233201000100"},
        format="json",
    )
    assert resp.status_code == 401


def test_profile_update_succeeds(api_client):
    """An authenticated member can update their phone and name."""
    from rest_framework_simplejwt.tokens import RefreshToken

    account = Account.objects.create_user(
        phone="+233201000001", password="pw-fixture-password123",
        email="update@example.com", full_name="Old Name",
    )
    tokens = RefreshToken.for_user(account)

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(tokens.access_token)}")

    resp = api_client.patch(
        reverse("member-profile"),
        {"full_name": "New Name", "phone": "+233201000200"},
        format="json",
    )

    assert resp.status_code == 200
    account.refresh_from_db()
    assert account.full_name == "New Name"
    assert account.phone == "+233201000200"


def test_profile_update_rejects_duplicate_phone(api_client):
    """A phone already in use by another account is rejected."""
    from rest_framework_simplejwt.tokens import RefreshToken

    Account.objects.create_user(
        phone="+233201000300", password="pw-fixture-password123",
        email="other@example.com",
    )

    account = Account.objects.create_user(
        phone="+233201000001", password="pw-fixture-password123",
        email="self@example.com",
    )
    tokens = RefreshToken.for_user(account)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(tokens.access_token)}")

    resp = api_client.patch(
        reverse("member-profile"),
        {"phone": "+233201000300"},
        format="json",
    )

    assert resp.status_code == 400
