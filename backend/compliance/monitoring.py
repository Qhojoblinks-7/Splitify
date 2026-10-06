"""Transaction monitoring and Suspicious Transaction Reporting (STR) — Act 1044 compliance.

This module implements rule-based transaction monitoring for the susu product.
It does not make legal determinations; it flags patterns for human review.

Rule IDs refer to `1791029123-aml-cft-screening.md`.
  T1   every contribution is checked against monitoring rules
  T2   a flag creates a SuspiciousTransactionReport for review
  T3   the report is escalated to the PSP partner for STR filing
  T4   the member is not tipped off (no notification of the STR)
"""

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from enum import Enum
import logging

from django.conf import settings
from django.db import models
from django.utils import timezone

from accounts.models import Account
from susu.models import Contribution, Membership, Round, SusuGroup

logger = logging.getLogger("compliance.monitoring")


class AlertType(models.TextChoices):
    """Types of monitoring alerts."""

    STRUCTURING = "structuring", "Possible Structuring (splitting amounts)"
    LARGE_ROUND = "large_round", "Unusually Large Round Target"
    RAPID_GROUPS = "rapid_groups", "Rapid Group Creation"
    CROSS_BORDER = "cross_border", "Cross-Border Funding Indicator"
    VELOCITY = "velocity", "High Contribution Velocity"
    ROUND_ANOMALY = "round_anomaly", "Round Amount Anomaly"
    MEMBER_ANOMALY = "member_anomaly", "Member Behaviour Anomaly"
    SANCTIONS_HIT = "sanctions_hit", "Sanctions Match on Transacting Party"


class AlertSeverity(models.TextChoices):
    LOW = "low", "Low — Review at Next Cycle"
    MEDIUM = "medium", "Medium — Review Within 24 Hours"
    HIGH = "high", "High — Review Immediately"
    CRITICAL = "critical", "Critical — Block and Escalate"


class STRStatus(models.TextChoices):
    OPEN = "open", "Open — Under Review"
    ESCALATED = "escalated", "Escalated to PSP Partner for STR Filing"
    FILED = "filed", "STR Filed with FIC"
    CLOSED_NO_ACTION = "closed_no_action", "Closed — No Action Required"
    CLOSED_FALSE_POSITIVE = "closed_false_positive", "Closed — False Positive"


class SuspiciousTransactionReport(models.Model):
    """One suspicious transaction alert, and its resolution.

    This is the internal record. The actual STR filed with the Financial Intelligence
    Centre (FIC) is a separate process handled by the PSP partner.
    """

    # What triggered the alert
    alert_type = models.CharField(max_length=30, choices=AlertType.choices)
    severity = models.CharField(max_length=10, choices=AlertSeverity.choices, default=AlertSeverity.MEDIUM)

    # Context
    account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="str_alerts"
    )
    group = models.ForeignKey(
        SusuGroup, on_delete=models.PROTECT, related_name="str_alerts", null=True, blank=True
    )
    round = models.ForeignKey(
        Round, on_delete=models.PROTECT, related_name="str_alerts", null=True, blank=True
    )
    contribution = models.ForeignKey(
        Contribution, on_delete=models.PROTECT, related_name="str_alerts", null=True, blank=True
    )

    # Detection details
    rule_name = models.CharField(max_length=60)
    rule_details = models.TextField()
    detected_amount_pesewas = models.BigIntegerField(default=0)

    # Resolution
    status = models.CharField(max_length=25, choices=STRStatus.choices, default=STRStatus.OPEN)
    reviewed_by = models.CharField(max_length=120, blank=True, default="")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(blank=True, default="")

    # STR filing (when escalated to PSP)
    str_reference = models.CharField(max_length=60, blank=True, default="")
    str_filed_at = models.DateTimeField(null=True, blank=True)
    str_filed_by = models.CharField(max_length=120, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["status", "severity", "created_at"]),
            models.Index(fields=["account", "status"]),
            models.Index(fields=["group", "created_at"]),
        ]

    def __str__(self):
        return f"STR-{self.pk} {self.alert_type} {self.severity}"

    def escalate(self, *, actor: str, str_reference: str = ""):
        """Escalate to PSP partner for STR filing."""
        self.status = STRStatus.ESCALATED
        self.reviewed_by = actor
        self.reviewed_at = timezone.now()
        if str_reference:
            self.str_reference = str_reference
        self.save(update_fields=["status", "reviewed_by", "reviewed_at", "str_reference", "updated_at"])

    def mark_filed(self, *, actor: str, str_reference: str):
        """Mark as STR filed with FIC."""
        self.status = STRStatus.FILED
        self.str_reference = str_reference
        self.str_filed_by = actor
        self.str_filed_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "str_reference",
                "str_filed_by",
                "str_filed_at",
                "updated_at",
            ]
        )

    def close_no_action(self, *, actor: str, note: str):
        """Close as false positive or no action needed."""
        self.status = STRStatus.CLOSED_NO_ACTION
        self.resolution_note = note
        self.reviewed_by = actor
        self.reviewed_at = timezone.now()
        self.save(update_fields=["status", "resolution_note", "reviewed_by", "reviewed_at", "updated_at"])

    def close_false_positive(self, *, actor: str, note: str):
        """Close as confirmed false positive."""
        self.status = STRStatus.CLOSED_FALSE_POSITIVE
        self.resolution_note = note
        self.reviewed_by = actor
        self.reviewed_at = timezone.now()
        self.save(update_fields=["status", "resolution_note", "reviewed_by", "reviewed_at", "updated_at"])


@dataclass(frozen=True)
class MonitoringContext:
    """Context for evaluating a transaction."""

    contribution: Contribution
    round_: Round
    group: SusuGroup
    membership: Membership


class MonitoringRule:
    """Base class for monitoring rules."""

    name: str = "base"
    alert_type: AlertType = AlertType.MEMBER_ANOMALY
    severity: AlertSeverity = AlertSeverity.LOW

    def evaluate(self, ctx: MonitoringContext) -> tuple[bool, str]:
        """Return (triggered, details)."""
        raise NotImplementedError


class StructuringRule(MonitoringRule):
    """Detect possible structuring: a member making multiple contributions
    just below reporting thresholds in a short period.
    """

    name = "structuring"
    alert_type = AlertType.STRUCTURING
    severity = AlertSeverity.HIGH

    # Thresholds (in pesewas)
    THRESHOLD_PESEWAS = 10_000_00  # GHc 10,000 — Ghana's CTR threshold
    WINDOW_DAYS = 7
    MIN_CONTRIBUTIONS = 3

    def evaluate(self, ctx: MonitoringContext) -> tuple[bool, str]:
        # Check recent contributions by same member in same group
        window_start = timezone.now() - timedelta(days=self.WINDOW_DAYS)
        recent = Contribution.objects.filter(
            membership=ctx.membership,
            status=Contribution.Status.VERIFIED,
            verified_at__gte=window_start,
        ).exclude(pk=ctx.contribution.pk)

        total_recent = sum(c.amount_pesewas for c in recent)
        count_recent = recent.count()

        if count_recent >= self.MIN_CONTRIBUTIONS and total_recent >= self.THRESHOLD_PESEWAS:
            return True, (
                f"{count_recent} contributions totalling {total_recent}p "
                f"in {self.WINDOW_DAYS} days (threshold: {self.THRESHOLD_PESEWAS}p)"
            )
        return False, ""


class LargeRoundRule(MonitoringRule):
    """Flag rounds with unusually large targets."""

    name = "large_round"
    alert_type = AlertType.LARGE_ROUND
    severity = AlertSeverity.MEDIUM

    # 95th percentile of round targets, or absolute cap
    ABSOLUTE_CAP_PESEWAS = 5_000_000  # GHc 50,000
    PERCENTILE_THRESHOLD = 0.95

    def evaluate(self, ctx: MonitoringContext) -> tuple[bool, str]:
        target = ctx.round_.target_pesewas
        if target >= self.ABSOLUTE_CAP_PESEWAS:
            return True, f"Round target {target}p exceeds absolute cap {self.ABSOLUTE_CAP_PESEWAS}p"
        return False, ""


class RapidGroupsRule(MonitoringRule):
    """Flag accounts creating many groups in a short time."""

    name = "rapid_groups"
    alert_type = AlertType.RAPID_GROUPS
    severity = AlertSeverity.MEDIUM

    WINDOW_DAYS = 30
    MAX_GROUPS = 5

    def evaluate(self, ctx: MonitoringContext) -> tuple[bool, str]:
        window_start = timezone.now() - timedelta(days=self.WINDOW_DAYS)
        recent_groups = SusuGroup.objects.filter(
            admin=ctx.membership.account,
            created_at__gte=window_start,
        ).count()

        if recent_groups >= self.MAX_GROUPS:
            return True, f"{recent_groups} groups created in {self.WINDOW_DAYS} days (max: {self.MAX_GROUPS})"
        return False, ""


class CrossBorderRule(MonitoringRule):
    """Flag potential cross-border funding (diaspora tier)."""

    name = "cross_border"
    alert_type = AlertType.CROSS_BORDER
    severity = AlertSeverity.MEDIUM

    def evaluate(self, ctx: MonitoringContext) -> tuple[bool, str]:
        # Check if contribution reference suggests international origin
        ref = ctx.contribution.reference.lower()
        international_indicators = ["swift", "iban", "wire", "remit", "worldremit", "wise", "western union"]

        for indicator in international_indicators:
            if indicator in ref:
                return True, f"Reference contains '{indicator}' suggesting cross-border origin"

        # Check if payout destination is international format
        dest = ctx.membership.account.payout_destination
        if dest and not dest.startswith(("0", "233")):  # Not a Ghana number
            return True, f"Payout destination {dest[:4]}**** appears international"

        return False, ""


class VelocityRule(MonitoringRule):
    """Flag unusually high contribution velocity for a member."""

    name = "velocity"
    alert_type = AlertType.VELOCITY
    severity = AlertSeverity.LOW

    MAX_CONTRIBUTIONS_PER_WEEK = 3

    def evaluate(self, ctx: MonitoringContext) -> tuple[bool, str]:
        week_start = timezone.now() - timedelta(days=7)
        recent_count = Contribution.objects.filter(
            membership=ctx.membership,
            status=Contribution.Status.VERIFIED,
            verified_at__gte=week_start,
        ).count()

        if recent_count >= self.MAX_CONTRIBUTIONS_PER_WEEK:
            return True, f"{recent_count} verified contributions in 7 days (max: {self.MAX_CONTRIBUTIONS_PER_WEEK})"
        return False, ""


class RoundAnomalyRule(MonitoringRule):
    """Flag rounds where contributions are unusually concentrated."""

    name = "round_anomaly"
    alert_type = AlertType.ROUND_ANOMALY
    severity = AlertSeverity.MEDIUM

    MAX_SINGLE_SHARE_RATIO = Decimal("0.5")  # No one member > 50% of pot

    def evaluate(self, ctx: MonitoringContext) -> tuple[bool, str]:
        verified_total = ctx.round_.verified_total_pesewas()
        if verified_total == 0:
            return False, ""

        member_paid = ctx.round_.paid_pesewas_for(ctx.membership)
        ratio = Decimal(member_paid) / Decimal(verified_total)

        if ratio > self.MAX_SINGLE_SHARE_RATIO:
            return True, f"Member contributed {ratio:.1%} of verified pot (max: {self.MAX_SINGLE_SHARE_RATIO:.0%})"
        return False, ""


class MemberAnomalyRule(MonitoringRule):
    """Flag members with anomalous behaviour patterns."""

    name = "member_anomaly"
    alert_type = AlertType.MEMBER_ANOMALY
    severity = AlertSeverity.LOW

    def evaluate(self, ctx: MonitoringContext) -> tuple[bool, str]:
        # Check trust score
        if ctx.membership.account.trust_score < 50:
            return True, f"Member trust score {ctx.membership.account.trust_score} below threshold (50)"

        # Check flagged total
        if ctx.membership.account.flagged_total >= 2:
            return True, f"Member has {ctx.membership.account.flagged_total} flagged transactions"

        # Check sanctions status
        if ctx.membership.account.sanctions_match:
            return True, f"Member has sanctions match: {ctx.membership.account.sanctions_match_details}"

        return False, ""


# All rules in evaluation order (high severity first)
RULES = [
    StructuringRule(),
    LargeRoundRule(),
    CrossBorderRule(),
    RoundAnomalyRule(),
    RapidGroupsRule(),
    VelocityRule(),
    MemberAnomalyRule(),
]


def evaluate_contribution(contribution: Contribution) -> list[SuspiciousTransactionReport]:
    """Run all monitoring rules against a verified contribution.

    Returns list of created STR alerts.
    """
    if contribution.status != Contribution.Status.VERIFIED:
        return []

    round_ = contribution.round
    group = round_.group
    membership = contribution.membership

    ctx = MonitoringContext(
        contribution=contribution,
        round_=round_,
        group=group,
        membership=membership,
    )

    alerts = []
    for rule in RULES:
        triggered, details = rule.evaluate(ctx)
        if triggered:
            alert = SuspiciousTransactionReport.objects.create(
                alert_type=rule.alert_type,
                severity=rule.severity,
                account=membership.account,
                group=group,
                round=round_,
                contribution=contribution,
                rule_name=rule.name,
                rule_details=details,
                detected_amount_pesewas=contribution.amount_pesewas,
            )
            alerts.append(alert)
            logger.warning(
                "AML alert: %s [%s] for account %s in group %s — %s",
                rule.alert_type, rule.severity, membership.account_id, group.id, details
            )

    return alerts


def get_open_alerts(severity: AlertSeverity | None = None, limit: int = 100):
    """Get open STR alerts for review."""
    qs = SuspiciousTransactionReport.objects.filter(status=STRStatus.OPEN)
    if severity:
        qs = qs.filter(severity=severity)
    return qs[:limit]


def get_alerts_for_account(account: Account, limit: int = 50):
    """Get all STR alerts for an account."""
    return SuspiciousTransactionReport.objects.filter(account=account)[:limit]