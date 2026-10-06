"""Talking to a licensed payment partner, and to nothing else.

The rest of the application decides what is *true* about money. This module's only job is to
ask the rail what it saw, and hand back an answer the domain can act on. It never decides that
money arrived, and it never moves money.

Two adapters are named here, and the order is a legal boundary rather than a preference:

    hubtel    Hubtel EPSP, primary
    fincra    Fincra, fallback

PawaPay, Eversend and Kollekt are deliberately absent. They are not interchangeable with the
others for our purposes, and an aggregator may not be wired up as primary in this product.

Every adapter answers the same three questions with the same vocabulary, so the worker does not
branch on which partner is configured:

    CONFIRMED  the rail saw this reference, the amount matches, it settled. Money arrived.
    REJECTED   the rail saw this reference and it did not settle. It will not settle later.
    UNKNOWN    the rail has no record of this reference *yet*.

The distinction that matters most is UNKNOWN versus REJECTED. UNKNOWN is not evidence of
absence: a member who pays a minute before the worker runs has a perfectly good reference the
rail has not indexed yet. Failing a payment on UNKNOWN is how a circle loses trust in the app
over a timing window, so UNKNOWN retries and only ever ages into a human decision.
"""

from dataclasses import dataclass
from decimal import Decimal
import base64
import json
import logging
from urllib.parse import urljoin

import requests
from django.conf import settings
from django.core.exceptions import ValidationError

logger = logging.getLogger("susu.rail")


class Outcome:
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class RailAnswer:
    """What the rail said about one reference.

    `amount_pesewas` is compared, not trusted: a confirmed reference for a different amount is
    not this member's payment, and treating it as one would put money in the pot that nobody
    sent toward this round.
    """

    outcome: str
    amount_pesewas: int | None = None
    provider_reference: str = ""
    reason: str = ""

    @property
    def is_final(self):
        """Whether waiting longer could change the answer. UNKNOWN is deliberately not final."""
        return self.outcome in (Outcome.CONFIRMED, Outcome.REJECTED)

    @classmethod
    def confirmed(cls, amount_pesewas, provider_reference=""):
        return cls(Outcome.CONFIRMED, amount_pesewas, provider_reference)

    @classmethod
    def rejected(cls, reason=""):
        return cls(Outcome.REJECTED, None, "", reason)

    @classmethod
    def unknown(cls, reason=""):
        return cls(Outcome.UNKNOWN, None, "", reason)


class RailUnavailable(Exception):
    """The rail could not be reached, or answered with something we cannot read.

    Distinct from a REJECTED answer. The provider being briefly unreachable says nothing about
    whether a member paid, so this must never be recorded against their payment.
    """


class BaseRail:
    """The shape every adapter implements. Subclasses translate; none of them decide."""

    name = "base"

    def lookup(self, *, reference, provider, amount_pesewas):
        raise NotImplementedError


class UnconfiguredRail(BaseRail):
    """Stand-in used until a partner agreement is signed.

    It answers UNKNOWN for everything, which is the honest answer: we have not asked anyone,
    so we do not know. The effect is that the worker makes no progress and the manual
    verification path stays the only way a payment becomes verified — which is the correct
    state of the world before Act 987's licence question is settled.
    """

    name = "unconfigured"

    def lookup(self, *, reference, provider, amount_pesewas):
        return RailAnswer.unknown("No payment partner is configured")


class StubRail(BaseRail):
    """A scripted rail for tests and local development.

    Answers are given per reference. An amount mismatch is reported as REJECTED rather than
    confirmed, because that is what a real rail does when a reference exists for a different
    amount, and a test double that returned CONFIRMED would let a real mismatch through.
    """

    name = "stub"

    def __init__(self, answers=None):
        self._answers = dict(answers or {})

    def set(self, reference, answer):
        self._answers[reference] = answer

    def lookup(self, *, reference, provider, amount_pesewas):
        answer = self._answers.get(reference)
        if answer is None:
            return RailAnswer.unknown("No record of this reference")
        if answer.outcome == Outcome.CONFIRMED and answer.amount_pesewas != amount_pesewas:
            return RailAnswer.rejected(
                f"Reference exists for {answer.amount_pesewas}p, not {amount_pesewas}p"
            )
        return answer


class HubtelRail(BaseRail):
    """Hubtel EPSP adapter — primary licensed partner.

    Hubtel provides mobile money collection and payout services in Ghana.
    The API uses Basic Auth with client_id:client_secret.
    """

    name = "hubtel"

    def __init__(self):
        self.base_url = getattr(settings, "HUBTEL_BASE_URL", "https://epsp.hubtel.com")
        self.client_id = getattr(settings, "HUBTEL_CLIENT_ID", "")
        self.client_secret = getattr(settings, "HUBTEL_CLIENT_SECRET", "")
        self.collection_account = getattr(settings, "HUBTEL_COLLECTION_ACCOUNT", "")
        self.timeout = getattr(settings, "HUBTEL_TIMEOUT", 30)
        self.logger = logging.getLogger("susu.rail.hubtel")

        if not self.client_id or not self.client_secret:
            raise ValidationError("Hubtel credentials not configured")

    def _auth_header(self):
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {"Authorization": f"Basic {encoded}", "Accept": "application/json"}

    def _request(self, method, path, **kwargs):
        url = urljoin(self.base_url.rstrip("/") + "/", path.lstrip("/"))
        headers = self._auth_header()
        headers.update(kwargs.pop("headers", {}))
        try:
            response = requests.request(
                method, url, headers=headers, timeout=self.timeout, **kwargs
            )
        except requests.RequestException as exc:
            self.logger.warning("Hubtel request failed: %s", exc)
            raise RailUnavailable(f"Could not reach Hubtel: {exc}") from exc

        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            self.logger.warning(
                "Hubtel error %s: %s", response.status_code, response.text[:200]
            )
            raise RailUnavailable(
                f"Hubtel returned {response.status_code}: {response.text[:200]}"
            )

        try:
            return response.json()
        except json.JSONDecodeError as exc:
            self.logger.warning("Hubtel returned non-JSON: %s", exc)
            raise RailUnavailable("Hubtel returned invalid JSON") from exc

    def lookup(self, *, reference, provider, amount_pesewas):
        """Look up a mobile money transaction by reference.

        Hubtel's transaction status endpoint returns the transaction details including
        the amount and status. We compare the amount to what was claimed.
        """
        # Hubtel uses the merchant transaction reference to look up transactions
        data = self._request("GET", f"/api/transactions/{reference}")

        if data is None:
            return RailAnswer.unknown("Transaction not found on Hubtel")

        # Expected response structure from Hubtel EPSP
        status = data.get("status", "").lower()
        amount = data.get("amount")
        provider_ref = data.get("transaction_id", reference)

        if amount is None:
            return RailAnswer.unknown("Hubtel response missing amount")

        # Convert amount to pesewas (Hubtel typically returns in cedis with decimals)
        try:
            amount_pesewas_from_rail = int(Decimal(str(amount)) * 100)
        except (ValueError, TypeError):
            return RailAnswer.unknown("Hubtel returned invalid amount")

        # Map Hubtel statuses to our outcomes
        if status in ("success", "completed", "paid", "settled"):
            if compare_amount(amount_pesewas_from_rail, amount_pesewas):
                return RailAnswer.confirmed(amount_pesewas_from_rail, provider_ref)
            return RailAnswer.rejected(
                f"Amount mismatch: rail={amount_pesewas_from_rail}p claimed={amount_pesewas}p"
            )

        if status in ("failed", "cancelled", "expired", "rejected", "declined"):
            return RailAnswer.rejected(f"Hubtel status: {status}")

        # Pending, processing, or any other status = not yet settled
        return RailAnswer.unknown(f"Hubtel status: {status}")


class FincraRail(BaseRail):
    """Fincra adapter — fallback licensed partner.

    Fincra provides payment processing across Africa including mobile money.
    The API uses Bearer token authentication.
    """

    name = "fincra"

    def __init__(self):
        self.base_url = getattr(settings, "FINCRA_BASE_URL", "https://api.fincra.com")
        self.api_key = getattr(settings, "FINCRA_API_KEY", "")
        self.secret_key = getattr(settings, "FINCRA_SECRET_KEY", "")
        self.timeout = getattr(settings, "FINCRA_TIMEOUT", 30)
        self.logger = logging.getLogger("susu.rail.fincra")

        if not self.api_key or not self.secret_key:
            raise ValidationError("Fincra credentials not configured")

    def _get_access_token(self):
        """Obtain an access token from Fincra's OAuth endpoint."""
        url = urljoin(self.base_url.rstrip("/") + "/", "/v1/auth/token")
        auth = f"{self.api_key}:{self.secret_key}"
        encoded = base64.b64encode(auth.encode()).decode()
        headers = {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        try:
            response = requests.post(
                url, headers=headers, data={"grant_type": "client_credentials"}, timeout=self.timeout
            )
        except requests.RequestException as exc:
            self.logger.warning("Fincra token request failed: %s", exc)
            raise RailUnavailable(f"Could not reach Fincra auth: {exc}") from exc

        if response.status_code >= 400:
            self.logger.warning("Fincra auth error %s: %s", response.status_code, response.text[:200])
            raise RailUnavailable(f"Fincra auth failed: {response.status_code}")

        try:
            return response.json().get("access_token")
        except (json.JSONDecodeError, KeyError) as exc:
            self.logger.warning("Fincra auth response invalid: %s", exc)
            raise RailUnavailable("Fincra auth returned invalid response") from exc

    def _request(self, method, path, token, **kwargs):
        url = urljoin(self.base_url.rstrip("/") + "/", path.lstrip("/"))
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
        headers.update(kwargs.pop("headers", {}))
        try:
            response = requests.request(
                method, url, headers=headers, timeout=self.timeout, **kwargs
            )
        except requests.RequestException as exc:
            self.logger.warning("Fincra request failed: %s", exc)
            raise RailUnavailable(f"Could not reach Fincra: {exc}") from exc

        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            self.logger.warning(
                "Fincra error %s: %s", response.status_code, response.text[:200]
            )
            raise RailUnavailable(
                f"Fincra returned {response.status_code}: {response.text[:200]}"
            )

        try:
            return response.json()
        except json.JSONDecodeError as exc:
            self.logger.warning("Fincra returned non-JSON: %s", exc)
            raise RailUnavailable("Fincra returned invalid JSON") from exc

    def lookup(self, *, reference, provider, amount_pesewas):
        """Look up a transaction by reference on Fincra."""
        token = self._get_access_token()
        if not token:
            raise RailUnavailable("Fincra token acquisition failed")

        # Fincra uses a transaction lookup endpoint
        data = self._request("GET", f"/v1/transactions/{reference}", token=token)

        if data is None:
            return RailAnswer.unknown("Transaction not found on Fincra")

        # Expected response structure from Fincra
        status = data.get("status", "").lower()
        amount = data.get("amount")
        provider_ref = data.get("reference", reference)

        if amount is None:
            return RailAnswer.unknown("Fincra response missing amount")

        # Fincra typically returns amount in kobo/cents, convert to pesewas if needed
        # Assuming Fincra returns in the base currency unit (kobo for NGN, pesewas for GHS)
        try:
            amount_pesewas_from_rail = int(amount)
        except (ValueError, TypeError):
            return RailAnswer.unknown("Fincra returned invalid amount")

        # Map Fincra statuses to our outcomes
        if status in ("success", "completed", "paid", "settled", "successful"):
            if compare_amount(amount_pesewas_from_rail, amount_pesewas):
                return RailAnswer.confirmed(amount_pesewas_from_rail, provider_ref)
            return RailAnswer.rejected(
                f"Amount mismatch: rail={amount_pesewas_from_rail}p claimed={amount_pesewas}p"
            )

        if status in ("failed", "cancelled", "expired", "rejected", "declined"):
            return RailAnswer.rejected(f"Fincra status: {status}")

        return RailAnswer.unknown(f"Fincra status: {status}")


def get_rail():
    """The configured adapter, or the honest stand-in.

    Read from settings so a partner is chosen by configuration rather than by editing code, and
    so a deployment that has not signed an agreement cannot accidentally have one wired up.

    Order matters: hubtel is primary, fincra is fallback. If the primary is configured but
    fails initialisation, the fallback is tried. If neither is configured, the unconfigured
    stand-in is returned so the worker makes no progress — the correct state before a licence
    agreement is signed.
    """
    name = getattr(settings, "SUSU_RAIL", "unconfigured")
    adapters = {
        "unconfigured": UnconfiguredRail,
        "stub": StubRail,
        "hubtel": HubtelRail,
        "fincra": FincraRail,
    }

    if name == "unconfigured":
        logger.info("No rail configured; using UnconfiguredRail (manual verify only)")
        return UnconfiguredRail()

    if name == "stub":
        return StubRail()

    if name in adapters:
        try:
            rail = adapters[name]()
            logger.info("Using configured rail: %s", rail.name)
            return rail
        except ValidationError:
            if name == "hubtel":
                logger.warning(
                    "Hubtel configured but failed initialisation; falling back to Fincra"
                )
                try:
                    rail = FincraRail()
                    logger.info("Fincra fallback initialised successfully")
                    return rail
                except ValidationError:
                    logger.error("Fincra fallback also failed; no rail available")
                    raise
            raise

    for adapter_name in ("hubtel", "fincra"):
        try:
            rail = adapters[adapter_name]()
            if adapter_name == "fincra":
                logger.warning(
                    "Hubtel not configured or unavailable; using Fincra as fallback"
                )
            else:
                logger.info("Auto-selected rail: %s", rail.name)
            return rail
        except ValidationError:
            continue

    logger.info("No rail configured; using UnconfiguredRail (manual verify only)")
    return UnconfiguredRail()


def compare_amount(answered_pesewas, expected_pesewas):
    """Whether a rail amount and a claimed amount are the same cedi.

    Kept as a named comparison rather than an inline `==` so that the rule is stated once: a
    settled reference for a different amount is never this member's payment.
    """
    return Decimal(answered_pesewas) == Decimal(expected_pesewas)