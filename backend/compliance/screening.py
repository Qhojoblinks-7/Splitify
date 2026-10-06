"""Sanctions and PEP screening — Act 1044 compliance.

This module provides screening against UN, BoG, and other sanction lists.
The design is list-agnostic: a provider returns matches, we record them,
and the compliance team decides the action.

Rule IDs refer to `1791029123-aml-cft-screening.md`.
  S1   every account is screened at onboarding and periodically
  S2   a match is recorded, not auto-rejected — human review required
  S3   screening uses name + ID number hash, never raw ID number
  S4   the list source and version are recorded for audit
"""

from dataclasses import dataclass
from datetime import timedelta
import hashlib
import logging
from typing import Literal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from accounts.models import Account


logger = logging.getLogger("compliance.screening")


class ScreeningSource(models.TextChoices):
    """Source of the sanctions/PEP list."""
    UN_CONSOLIDATED = "un_consolidated", "UN Consolidated List"
    BOG_SANCTIONS = "bog_sanctions", "Bank of Ghana Sanctions List"
    OFAC_SDN = "ofac_sdn", "OFAC Specially Designated Nationals"
    UK_HMT = "uk_hmt", "UK HM Treasury Consolidated List"
    EU_CONSOLIDATED = "eu_consolidated", "EU Consolidated List"
    WORLD_CHECK = "world_check", "World-Check / Refinitiv"
    DOW_JONES = "dow_jones", "Dow Jones Risk & Compliance"
    CUSTOM = "custom", "Custom List"


class ScreeningStatus(models.TextChoices):
    PENDING = "pending", "Screening Not Started"
    CLEAR = "clear", "No Match Found"
    POTENTIAL_MATCH = "potential_match", "Potential Match — Review Required"
    CONFIRMED_MATCH = "confirmed_match", "Confirmed Match — Blocked"
    FALSE_POSITIVE = "false_positive", "Cleared as False Positive"
    ERROR = "error", "Screening Failed"


class SanctionsScreening(models.Model):
    """One screening run for one account against one list source."""

    account = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="sanctions_screenings"
    )
    source = models.CharField(max_length=30, choices=ScreeningSource.choices)
    source_version = models.CharField(max_length=50, blank=True, default="")
    status = models.CharField(
        max_length=20, choices=ScreeningStatus.choices, default=ScreeningStatus.PENDING
    )

    # What was screened (hashed, never raw)
    name_screened = models.CharField(max_length=240)
    id_hash_screened = models.CharField(max_length=64, blank=True, default="")

    # Match details (populated when status is potential_match or confirmed_match)
    match_name = models.CharField(max_length=240, blank=True, default="")
    match_score = models.FloatField(null=True, blank=True)  # Provider's confidence score
    match_details = models.TextField(blank=True, default="")  # Provider's raw match data

    # Resolution
    reviewed_by = models.CharField(max_length=120, blank=True, default="")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["account", "source"],
                condition=models.Q(status__in=[ScreeningStatus.PENDING, ScreeningStatus.CLEAR]),
                name="one_pending_or_clear_screening_per_account_source",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["account", "status"]),
        ]

    def __str__(self):
        return f"{self.account_id} {self.source} {self.status}"

    def mark_clear(self, *, actor: str = ""):
        self.status = ScreeningStatus.CLEAR
        self.reviewed_by = actor
        self.reviewed_at = timezone.now()
        self.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])

    def mark_potential_match(
        self,
        *,
        match_name: str,
        match_score: float,
        match_details: str,
        actor: str = "",
    ):
        self.status = ScreeningStatus.POTENTIAL_MATCH
        self.match_name = match_name
        self.match_score = match_score
        self.match_details = match_details
        self.reviewed_by = actor
        self.reviewed_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "match_name",
                "match_score",
                "match_details",
                "reviewed_by",
                "reviewed_at",
                "updated_at",
            ]
        )

    def resolve_false_positive(self, *, actor: str, note: str):
        if self.status != ScreeningStatus.POTENTIAL_MATCH:
            raise ValidationError("Only a potential match can be resolved as a false positive")
        self.status = ScreeningStatus.FALSE_POSITIVE
        self.resolution_note = note
        self.reviewed_by = actor
        self.reviewed_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "resolution_note",
                "reviewed_by",
                "reviewed_at",
                "updated_at",
            ]
        )

    def resolve_confirmed_match(self, *, actor: str, note: str):
        if self.status != ScreeningStatus.POTENTIAL_MATCH:
            raise ValidationError("Only a potential match can be resolved as confirmed")
        self.status = ScreeningStatus.CONFIRMED_MATCH
        self.resolution_note = note
        self.reviewed_by = actor
        self.reviewed_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "resolution_note",
                "reviewed_by",
                "reviewed_at",
                "updated_at",
            ]
        )
        # Also update the account's sanctions flags
        self.account.sanctions_match = True
        self.account.sanctions_match_details = f"{self.source}: {match_name} — {note}"
        self.account.save(update_fields=["sanctions_match", "sanctions_match_details"])


@dataclass(frozen=True)
class ScreeningInput:
    """Normalised input for screening — never raw ID numbers."""

    account_id: int
    full_name: str
    id_type: str
    id_hash: str  # SHA-256 of the ID number
    phone: str


@dataclass(frozen=True)
class ScreeningResult:
    """Result from a screening provider."""

    status: Literal["clear", "potential_match", "error"]
    match_name: str = ""
    match_score: float = 0.0
    match_details: str = ""
    error: str = ""


class BaseScreener:
    """Abstract screener — implementations call external APIs."""

    source = ScreeningSource.CUSTOM

    def screen(self, input_: ScreeningInput) -> ScreeningResult:
        raise NotImplementedError


class UnconfiguredScreener(BaseScreener):
    """Stand-in used until a screening provider is configured."""

    source = ScreeningSource.CUSTOM

    def screen(self, input_: ScreeningInput) -> ScreeningResult:
        return ScreeningResult(
            status="error",
            error="No screening provider configured. Set COMPLIANCE_SCREENER in settings.",
        )


class StubScreener(BaseScreener):
    """Scripted screener for tests."""

    source = ScreeningSource.CUSTOM

    def __init__(self, responses: dict[str, ScreeningResult] | None = None):
        self._responses = responses or {}

    def screen(self, input_: ScreeningInput) -> ScreeningResult:
        key = f"{input_.full_name}|{input_.id_hash}"
        return self._responses.get(key, ScreeningResult(status="clear"))


def _hash_id(id_number: str) -> str:
    """SHA-256 of the ID number — never store the raw number."""
    return hashlib.sha256(id_number.strip().encode()).hexdigest()


def get_screener() -> BaseScreener:
    """Get the configured screener, or the honest stand-in."""
    name = getattr(settings, "COMPLIANCE_SCREENER", "unconfigured")
    screeners = {
        "unconfigured": UnconfiguredScreener,
        "stub": StubScreener,
        # "world_check": WorldCheckScreener,  # Add when provider is contracted
        # "dow_jones": DowJonesScreener,      # Add when provider is contracted
    }
    if name in screeners:
        return screeners[name]()
    logger.warning("Unknown screener '%s', falling back to unconfigured", name)
    return UnconfiguredScreener()


def screen_account(account: Account) -> SanctionsScreening:
    """Screen a single account against the configured source.

    Called at onboarding and by the periodic screening command.
    """
    if not account.id_type or not account.id_document_hash:
        screening = SanctionsScreening.objects.create(
            account=account,
            source=get_screener().source,
            status=ScreeningStatus.ERROR,
            name_screened=account.full_name or account.phone,
            match_details="CDD incomplete: id_type and id_document_hash required",
        )
        return screening

    screener = get_screener()
    input_ = ScreeningInput(
        account_id=account.pk,
        full_name=account.full_name or account.phone,
        id_type=account.id_type,
        id_hash=account.id_document_hash,
        phone=account.phone,
    )

    # Record the screening attempt
    screening = SanctionsScreening.objects.create(
        account=account,
        source=screener.source,
        source_version=getattr(settings, "COMPLIANCE_SCREENER_VERSION", ""),
        name_screened=input_.full_name,
        id_hash_screened=input_.id_hash,
    )

    try:
        result = screener.screen(input_)
    except Exception as exc:  # pragma: no cover - network/integrations
        logger.exception("Screening failed for account %s", account.pk)
        screening.status = ScreeningStatus.ERROR
        screening.match_details = str(exc)
        screening.save(update_fields=["status", "match_details", "updated_at"])
        return screening

    if result.status == "clear":
        screening.mark_clear(actor="system")
        account.sanctions_screened = True
        account.sanctions_screened_at = timezone.now()
        account.sanctions_match = False
        account.sanctions_match_details = ""
        account.save(update_fields=["sanctions_screened", "sanctions_screened_at", "sanctions_match", "sanctions_match_details"])
    elif result.status == "potential_match":
        screening.mark_potential_match(
            match_name=result.match_name,
            match_score=result.match_score,
            match_details=result.match_details,
            actor="system",
        )
        account.sanctions_screened = True
        account.sanctions_screened_at = timezone.now()
        account.save(update_fields=["sanctions_screened", "sanctions_screened_at"])
    else:
        screening.status = ScreeningStatus.ERROR
        screening.match_details = result.error
        screening.save(update_fields=["status", "match_details", "updated_at"])

    return screening


def screen_all_unscreened(limit: int = 100) -> tuple[int, int]:
    """Screen accounts that have never been screened.

    Returns (screened_count, match_count).
    """
    accounts = Account.objects.filter(sanctions_screened=False).exclude(
        id_type="", id_document_hash=""
    )[:limit]

    screened = matches = 0
    for account in accounts:
        screening = screen_account(account)
        screened += 1
        if screening.status == ScreeningStatus.POTENTIAL_MATCH:
            matches += 1
    return screened, matches