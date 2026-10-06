"""Consent and data subject rights, recorded.

Two models, and the reason they are records rather than a column on the account is the same
reason the ledger is append-only: the question that matters is not "is this member consented?"
but "what did they agree to, which version, and when — and what happened to that consent
afterwards". An edited row answers the second question in the first question's grammar.

    ConsentRecord       one act of consent, or one withdrawal. Never modified.
    DataSubjectRequest  one request under s.32-35, s.39, s.40 or s.44, and its answer.

Act 843 references are given per method rather than per model: the Act is what forces the
21-day clock, the recorded evidence, and the refusal that has to carry a reason.
"""

from __future__ import annotations

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

#: s.39(2): twenty-one days to answer a notice in writing. The longest statutory clock we are
#: subject to, so it is the one every request is measured against — a request that is "just a
#: question" is still a request with a deadline attached to it.
RESPONSE_DAYS = 21

class ConsentRecord(models.Model):
    """One grant or one withdrawal, kept forever.

    Withdrawing is a new row, not a cleared one. A cleared row cannot show that consent was
    given and later taken back, and that sequence is the whole of what s.20(3) and s.39 are
    about. Kept for three years after the last one, per `retention.RETENTION`.
    """

    class Source(models.TextChoices):
        SIGNUP = "signup", "Given when the account was created"
        IN_APP = "in_app", "Given from the account screen"
        DPO = "dpo", "Recorded by the data protection office on the member's instruction"

    class Action(models.TextChoices):
        GRANTED = "granted", "Consent given"
        WITHDRAWN = "withdrawn", "Consent withdrawn"

    account = models.ForeignKey(
        "accounts.Account", on_delete=models.CASCADE, related_name="consents"
    )
    notice_version = models.CharField(max_length=32)
    purposes = models.JSONField(default=list)
    action = models.CharField(max_length=10, choices=Action.choices, default=Action.GRANTED)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.IN_APP)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            # One row per account, version and action. A second identical grant is a replay, and
            # storing it would make "when did they agree" answerable two ways.
            models.UniqueConstraint(
                fields=["account", "notice_version", "action"],
                name="one_consent_record_per_account_version_action",
            ),
        ]

    def __str__(self):
        return f"{self.account_id} {self.action} {self.notice_version}"

    @property
    def is_current(self) -> bool:
        return self.action == self.Action.GRANTED

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError(
                "A consent record is append-only: withdraw consent with a new record rather "
                "than editing the grant."
            )
        return super().save(*args, **kwargs)


def current_consent(account) -> ConsentRecord | None:
    """The consent that is in force, or None.

    Newest row wins, and a withdrawal is a row like any other. Reading the newest rather than
    filtering on `action` is what makes the answer correct after a withdrawal followed by a
    fresh agreement of a new version.
    """
    return ConsentRecord.objects.filter(account=account).first()


class DataSubjectRequestQuerySet(models.QuerySet):
    def open(self):
        return self.filter(status__in=DataSubjectRequest.OPEN_STATUSES)


class DataSubjectRequest(models.Model):
    """A request from a data subject, and what we did about it.

    The status is the whole point. "We did not answer" and "we answered and here is the
    evidence" must be distinguishable in the record, because s.33(2) and s.39(2) both require
    the controller to give the member credible evidence rather than silence, and s.39(2)
    requires a written answer within twenty-one days either way — a refusal is an answer.
    """

    class Kind(models.TextChoices):
        ACCESS = "access", "Tell me what you hold about me (s.32, s.35)"
        RECTIFY = "rectify", "Correct data that is wrong or out of date (s.33(1)(a))"
        ERASE = "erase", "Delete my data (s.33(1)(b), s.44)"
        OBJECT = "object", "Stop a processing I object to (s.39)"
        WITHDRAW_CONSENT = "withdraw_consent", "Withdraw my consent (s.20(2))"
        STOP_MARKETING = "stop_marketing", "Stop direct marketing (s.40)"

    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        IN_PROGRESS = "in_progress", "Being answered"
        ANSWERED = "answered", "Answered in full"
        PARTIALLY_REFUSED = "partially_refused", "Answered, with part refused"
        REFUSED = "refused", "Refused"
        WITHDRAWN = "withdrawn", "Withdrawn by the member"

    OPEN_STATUSES = (Status.RECEIVED, Status.IN_PROGRESS)
    CLOSED_STATUSES = (Status.ANSWERED, Status.PARTIALLY_REFUSED, Status.REFUSED, Status.WITHDRAWN)

    account = models.ForeignKey(
        "accounts.Account", on_delete=models.CASCADE, related_name="privacy_requests"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    detail = models.TextField(blank=True, default="")

    #: A plain default rather than `auto_now_add`, because the twenty-one day clock is computed
    #: from this instant in `save()` — and `auto_now_add` writes the row a few microseconds
    #: *after* that, which made every request look like it had been answered on day twenty.
    requested_at = models.DateTimeField(default=timezone.now)
    #: s.39(2). Computed on creation rather than read from a clock at answer time, so a late
    #: answer is visibly late rather than quietly on time.
    due_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)

    response_summary = models.TextField(blank=True, default="")
    #: s.33(2) "credible evidence in support of the data", and s.39(2)(b) "the reasons for
    #: non-compliance". A refusal without a reason is not an answer, so the model requires one.
    evidence = models.TextField(blank=True, default="")
    handled_by = models.CharField(max_length=120, blank=True, default="")

    class Meta:
        ordering = ["-requested_at", "-id"]
        constraints = [
            # One open request per kind. A member asking the same question twice does not get
            # two clocks running, and a duplicate cannot be used to make the queue look fuller.
            models.UniqueConstraint(
                fields=["account", "kind"],
                condition=models.Q(status__in=["received", "in_progress"]),
                name="one_open_request_per_kind",
            ),
        ]
        indexes = [models.Index(fields=["status", "due_at"])]

    objects = DataSubjectRequestQuerySet.as_manager()

    def __str__(self):
        return f"{self.account_id} {self.kind} ({self.status})"

    def save(self, *args, **kwargs):
        if self._state.adding and not self.due_at:
            self.due_at = self.requested_at + timedelta(days=RESPONSE_DAYS)
        if self.status in self.CLOSED_STATUSES and not self.responded_at:
            self.responded_at = timezone.now()
        if self.status in (self.Status.PARTIALLY_REFUSED, self.Status.REFUSED) and not self.evidence.strip():
            raise ValidationError(
                "A refusal must record the reasons. s.33(2) and s.39(2) both require them."
            )
        if self.status in (self.Status.ANSWERED, self.Status.PARTIALLY_REFUSED) and not self.response_summary.strip():
            raise ValidationError("An answer must say what was done.")
        return super().save(*args, **kwargs)

    def mark(self, status, *, summary="", evidence="", handled_by=""):
        """Close the request. The only state change a member's file allows."""
        if self.status in self.CLOSED_STATUSES:
            raise ValidationError(f"This request was already closed as {self.status}")
        if status not in self.CLOSED_STATUSES:
            raise ValidationError("Use mark for a closed state; the open states are set on creation.")
        self.status = status
        self.response_summary = summary
        self.evidence = evidence
        self.handled_by = handled_by
        self.save()
        return self

    def is_overdue(self, at=None) -> bool:
        at = at or timezone.now()
        return self.status in self.OPEN_STATUSES and self.due_at <= at


# --- Sanctions / PEP Screening (Act 1044) -----------------------------------
# Imported from compliance.screening to keep the model definitions together
# with the screening logic. The model is defined in screening.py and re-exported
# here so Django's model discovery finds it.
from .screening import (
    SanctionsScreening,
    ScreeningSource,
    ScreeningStatus,
)

# --- Transaction Monitoring / STR (Act 1044) ---------------------------------
from .monitoring import (
    SuspiciousTransactionReport,
    AlertType,
    AlertSeverity,
    STRStatus,
)

__all__ = [
    "ConsentRecord",
    "DataSubjectRequest",
    "SanctionsScreening",
    "ScreeningSource",
    "ScreeningStatus",
    "SuspiciousTransactionReport",
    "AlertType",
    "AlertSeverity",
    "STRStatus",
]
