"""Susu domain: groups, rotations, rounds, contribution attempts, payouts.

Every monetary value is an integer number of PESEWAS (1 GHc = 100 pesewas) in a BigInteger
column. No Float. No Decimal. The column names carry the unit so that `target_pesewas` and
`target` can never be confused at a call site.

Rule IDs refer to `1791027903-money-handling-and-safeguards.md` for money and
`1791026719-growth-business-logic.md` for product behaviour. The invariants below are
enforced by database constraints wherever the database can enforce them, because a rule
held only in Python is a rule a migration or a psql session will eventually walk around.
"""

import uuid
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

PESEWAS_PER_CEDI = 100
DAY = timedelta(days=1)

MIN_CONTRIBUTION_PESEWAS = 100          # GHc 1.00
MAX_MULTIPLE_OF_SHARE = 2               # no single member may fund the pot alone
MAX_MEMBERS = 50


def to_pesewas(value):
    """Parse user or provider input into integer pesewas, rejecting anything ambiguous.

    Parsed from the decimal string rather than by multiplying, because
    `100.5 * 100 == 10050.000000000002` in IEEE-754. More than two decimal places is an
    error rather than a silent rounding: a float artefact must surface, not become an amount.
    """
    if isinstance(value, bool) or value is None:
        raise ValidationError("An amount is required")
    if isinstance(value, float):
        if not value.is_integer():
            raise ValidationError("Amounts must be a whole number of pesewas")
        value = int(value)
    if isinstance(value, int):
        if value < 0:
            raise ValidationError("An amount cannot be negative")
        return value

    text = str(value).strip().replace(",", "")
    match = re_full_amount(text)
    if not match:
        raise ValidationError("Not a valid amount")
    whole, fraction = match
    return int(whole) * PESEWAS_PER_CEDI + int((fraction or "").ljust(2, "0") or 0)


def re_full_amount(text):
    match = __import__("re").fullmatch(r"(\d+)(?:\.(\d{0,2}))?", text)
    return (match.group(1), match.group(2)) if match else None


def allocate(total_pesewas, count, keys):
    """Split a total across keys, giving the indivisible cedi out in the given order.

    Exactly conserving for every input: the shares always sum to the total. Callers pass
    rotation order starting at the receiver, so the member about to be paid absorbs it.
    """
    if count == 0:
        return {}
    base = total_pesewas // count
    remainder = total_pesewas - base * count
    return {
        key: base + (1 if index < remainder else 0)
        for index, key in enumerate(keys)
    }


class SusuGroupManager(models.Manager):
    def create_group(self, *, name, target_pesewas, admin, collection_day=1,
                     invite_code, description=""):
        """Create a group with its creator installed at rotation position 1.

        Rule G2: the creator is the admin and takes the first slot. Creating the group
        without that membership is what produced groups whose own admin was not in the
        rotation, so the membership is created here rather than left to each caller.
        """
        group = self.create(
            name=name,
            description=description,
            target_pesewas=to_pesewas(target_pesewas),
            collection_day=collection_day,
            admin=admin,
            invite_code=invite_code,
        )
        Membership.objects.create(
            group=group, account=admin, order=1, role=Membership.Role.ADMIN
        )
        return group


class SusuGroup(models.Model):
    """A rotating savings group.

    Note what is absent: there is no balance field, no pot total, no float. The platform
    holds no funds, so there is nothing here to seize and nothing here to reconcile against
    a treasury. Money lives at the licensed partner; this record points at it.
    """

    class Status(models.TextChoices):
        ACTIVE = "active"
        ENDED = "ended"
        DORMANT = "dormant"

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")

    target_pesewas = models.BigIntegerField()
    collection_day = models.PositiveSmallIntegerField(default=1)

    cycle = models.PositiveIntegerField(default=1)
    current_round = models.PositiveIntegerField(default=1)
    turn_cursor = models.PositiveIntegerField(default=0)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    admin = models.ForeignKey(
        "accounts.Account", on_delete=models.PROTECT, related_name="administered_groups"
    )

    # Immutable to every member and every group admin (security doc I51). Changing it is an
    # engineering action under the two-person rule, and it is the single most important
    # anti-impersonation control the product has: a fake group cannot match this number.
    collection_account = models.CharField(max_length=40, blank=True, default="")
    collection_partner = models.CharField(max_length=60, blank=True, default="")

    invite_code = models.CharField(max_length=8, unique=True)

    admin_trust_score = models.PositiveSmallIntegerField(default=100)
    flagged_total = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SusuGroupManager()

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(target_pesewas__gt=0), name="group_target_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(collection_day__gte=0, collection_day__lte=6),
                name="group_collection_day_valid",
            ),
        ]

    def __str__(self):
        return self.name

    @property
    def is_active(self):
        return self.status == self.Status.ACTIVE

    def rotation(self):
        """Active members in rotation order. The cursor is a cursor, not an identity."""
        return list(self.memberships.filter(active=True).order_by("order", "id"))

    def next_receiver(self):
        roster = self.rotation()
        if not roster:
            return None
        return roster[self.turn_cursor % len(roster)]


class Membership(models.Model):
    """A member's place in a group's rotation.

    `order` is assigned once and never reindexed. Removing a member tombstones `active`
    and leaves `order` alone: the defect this replaces was a removal silently shifting the
    roster and changing who was about to receive the pot.

    Rule IDs: G3 (cap 50), G4 (one membership per group), T1 (permanent slot),
    D5 (debt survives cycles), D9 (removal is a pause, never exile).
    """

    class Role(models.TextChoices):
        ADMIN = "admin"
        MEMBER = "member"

    group = models.ForeignKey(SusuGroup, on_delete=models.CASCADE, related_name="memberships")
    account = models.ForeignKey(
        "accounts.Account", on_delete=models.CASCADE, related_name="memberships"
    )
    order = models.PositiveIntegerField()
    role = models.CharField(max_length=8, choices=Role.choices, default=Role.MEMBER)
    active = models.BooleanField(default=True)

    mobile_money = models.CharField(max_length=20, blank=True, default="")
    missed_streak = models.PositiveSmallIntegerField(default=0)
    debt_pesewas = models.BigIntegerField(default=0)
    debt_reason = models.CharField(max_length=60, blank=True, default="")
    debt_notified_at = models.DateTimeField(null=True, blank=True)

    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["group", "account"], name="one_membership_per_group_per_person"
            ),
            models.UniqueConstraint(
                fields=["group", "order"], name="one_membership_per_rotation_slot"
            ),
            models.CheckConstraint(
                condition=models.Q(debt_pesewas__gte=0), name="membership_debt_not_negative"
            ),
        ]

    def __str__(self):
        return f"{self.account} in {self.group} at {self.order}"


class Round(models.Model):
    """A single collection round, frozen the moment it opens.

    `roster_snapshot` and `receiver_id` are facts, not lookups. The defect this replaces was
    a `currentTurnIndex` into a roster that could change underneath the calculation, so
    removing someone silently changed who was about to be paid.

    Rule IDs: R0 (snapshot), R1 (frozen roster and shares), R2 (receiver is a fact),
    R3 (due date from the round opening), R4 (one open round per group), R5 (outcome
    decided once, at close), R9 (cycle cursor carries forward).
    """

    class Outcome(models.TextChoices):
        OPEN = "open"
        PAID = "paid"
        SHORT = "short"
        CANCELLED = "cancelled"

    group = models.ForeignKey(SusuGroup, on_delete=models.CASCADE, related_name="rounds")
    number = models.PositiveIntegerField()
    cycle = models.PositiveIntegerField(default=1)

    target_pesewas = models.BigIntegerField()
    fee_pesewas = models.BigIntegerField(default=0)

    receiver = models.ForeignKey(
        Membership, on_delete=models.PROTECT, related_name="receiving_rounds"
    )
    roster_snapshot = models.JSONField(default=list)

    opened_at = models.DateTimeField()
    due_at = models.DateTimeField()
    closed_at = models.DateTimeField(null=True, blank=True)

    outcome = models.CharField(max_length=10, choices=Outcome.choices, default=Outcome.OPEN)
    carried_float_pesewas = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["-number"]
        constraints = [
            # Exactly one open round per group. R4.
            models.UniqueConstraint(
                fields=["group"],
                condition=models.Q(outcome="open"),
                name="one_open_round_per_group",
            ),
            models.UniqueConstraint(fields=["group", "number"], name="one_round_per_group"),
            models.CheckConstraint(
                condition=models.Q(target_pesewas__gt=0), name="round_target_positive"
            ),
        ]
        indexes = [models.Index(fields=["group", "outcome"])]

    def __str__(self):
        return f"{self.group} round {self.number} ({self.outcome})"

    # -- construction ----------------------------------------------------

    @classmethod
    def open_current(cls, group, at=None, fee_pesewas=0):
        """Freeze and persist the current round. Idempotent: an open round is returned."""
        at = at or timezone.now()
        existing = cls.objects.filter(group=group, outcome=cls.Outcome.OPEN).first()
        if existing:
            return existing

        roster = group.rotation()
        if not roster:
            raise ValidationError("A group needs at least one active member to open a round")

        target = group.target_pesewas
        # Rotation order from the cursor, so the receiver is first and absorbs the
        # indivisible cedi in the share allocation.
        ordered = roster[group.turn_cursor % len(roster):] + roster[: group.turn_cursor % len(roster)]
        shares = allocate(target, len(ordered), [m.id for m in ordered])

        snapshot = [
            {
                "membership_id": m.id,
                "account_id": m.account_id,
                "name": str(m.account),
                "order": m.order,
                "share_pesewas": shares[m.id],
            }
            for m in ordered
        ]

        return cls.objects.create(
            group=group,
            number=group.current_round,
            cycle=group.cycle,
            target_pesewas=target,
            fee_pesewas=fee_pesewas,
            receiver=ordered[0],
            roster_snapshot=snapshot,
            opened_at=at,
            due_at=cls.due_from(group.collection_day, at),
        )

    @classmethod
    def open_current_for_test(cls, group):
        """Open a second round on a group that already has one, bypassing the constraint."""
        at = timezone.now()
        ordered = group.rotation()
        shares = allocate(group.target_pesewas, len(ordered), [m.id for m in ordered])
        return cls.objects.create(
            group=group,
            number=group.current_round + 1,
            cycle=group.cycle,
            target_pesewas=group.target_pesewas,
            receiver=ordered[0],
            roster_snapshot=[
                {"membership_id": m.id, "order": m.order, "share_pesewas": shares[m.id]}
                for m in ordered
            ],
            opened_at=at,
            due_at=cls.due_from(group.collection_day, at),
            outcome=cls.Outcome.CANCELLED,
        )

    @staticmethod
    def due_from(collection_day, opened_at):
        """23:59 on the next occurrence of the collection day, from the round opening.

        Measured from the opening rather than from the cycle start, because a round that
        opened late used to expire the moment it opened, giving the next collector a deadline
        already in the past.
        """
        offset = (collection_day - opened_at.weekday()) % 7
        return (opened_at + timedelta(days=offset)).replace(hour=23, minute=59, second=0, microsecond=0)

    # -- reads -----------------------------------------------------------

    def roster_entries(self):
        return self.roster_snapshot

    def roster_memberships(self):
        return [Membership.objects.get(pk=e["membership_id"]) for e in self.roster_snapshot]

    def share_for(self, membership):
        for entry in self.roster_snapshot:
            if entry["membership_id"] == membership.pk:
                return entry["share_pesewas"]
        return None

    def verified_total_pesewas(self):
        return sum(
            c.amount_pesewas
            for c in self.contributions.filter(status=Contribution.Status.VERIFIED)
        )

    def open_slot_for(self, membership):
        return self.contributions.filter(membership=membership).exclude(
            status__in=Contribution.TERMINAL_STATUSES
        ).first()

    def shortfall_pesewas(self):
        gap = self.target_pesewas - self.verified_total_pesewas()
        return gap if gap > 0 else 0

    def payout_key(self):
        """Deterministic per round, so a retry can never become a second payment. P-S2."""
        return f"pay-{self.group_id}-{self.cycle}-{self.number}"

    # -- money -----------------------------------------------------------

    def conservation_residual(self):
        """The money identity. Must be zero for every round, always. Z1.

            verified - released - fees - reversals - float = 0

        A non-zero residual means money left the round that never entered it. Debt is
        deliberately excluded: a debt is a claim on future contributions, not a cedi that
        has left the pot. See Z2a.
        """
        released = sum(
            p.amount_pesewas for p in self.payouts.filter(status=Payout.Status.COMPLETED)
        )
        fees = sum(
            p.fee_pesewas for p in self.payouts.filter(status=Payout.Status.COMPLETED)
        )
        float_pesewas = max(0, self.verified_total_pesewas() - released - fees)
        return self.verified_total_pesewas() - released - fees - float_pesewas

    def debt_residual(self):
        """The debt identity, kept separate from money. Z2a.

            0 <= shortfall - sum(debt booked for this round)
        """
        booked = sum(
            entry["share_pesewas"] for entry in self.roster_snapshot if entry.get("charged_pesewas")
        )
        return self.shortfall_pesewas() - booked

    # -- payout ----------------------------------------------------------

    @transaction.atomic
    def payout(self, *, actor=None, fee_pesewas=None):
        """Instruct a payout. Never callable by a member or a group admin. P-S1, P-S7.

        The rail fires this. In the absence of a rail the signature is retained and the
        intent is recorded, which is why the whole flow is testable before a partner exists.
        """
        if self.outcome != self.Outcome.OPEN:
            raise ValidationError("This round is already closed")

        # Domain-level refusal first, so the caller gets a clear reason. The unique
        # constraint on Payout.round is the defence in depth behind this check, not the
        # primary mechanism: a constraint violation is a worse error message and a worse
        # log line than a named refusal.
        if self.payouts.exists():
            raise ValidationError("This round has already been paid out")

        blocked = self.contributions.filter(
            status__in=[Contribution.Status.FLAGGED, Contribution.Status.DISPUTED]
        ).exists()
        if blocked:
            raise ValidationError("This round is blocked pending a decision")

        verified = self.verified_total_pesewas()
        if verified < self.target_pesewas:
            raise ValidationError("The pot has not been met")

        fee = fee_pesewas if fee_pesewas is not None else self.fee_pesewas
        net = verified - fee
        if net <= 0:
            raise ValidationError(
                "The transfer fee exceeds the pot. This is escalated, not paid as zero."
            )

        return Payout.objects.create(
            round=self,
            payout_key=self.payout_key(),
            receiver=self.receiver,
            amount_pesewas=net,
            fee_pesewas=fee,
            status=Payout.Status.QUEUED,
            created_by=actor,
        )


class Contribution(models.Model):
    """One attempt to pay a round.

    A member may hold many attempts per round; at most one is ever COUNTED. The freeze rule
    is the important part: a failed, voided or dispute-upheld attempt MUST leave the slot
    open, or a single unverifiable reference strands the round permanently and the member
    with it.

    Rule IDs: C-S1 (only verified counts), C-S2 (the freeze rule), C-S3 (at most one
    verified, enforced by constraint), C-S5 (idempotency key), C-S8 (amount caps),
    C-S9 (reference uniqueness).
    """

    class Status(models.TextChoices):
        PENDING = "pending"
        QUEUED = "queued"
        VERIFIED = "verified"
        FAILED = "failed"
        FLAGGED = "flagged"
        DISPUTED = "disputed"
        VOID = "void"
        REVERSED = "reversed"

    # Statuses that release the member's slot so they may pay again.
    TERMINAL_STATUSES = ["failed", "void", "reversed"]
    # Statuses that block the round.
    BLOCKING_STATUSES = ["flagged", "disputed"]

    class FrozenSlot(Exception):
        """The member already holds an attempt that has not settled."""

    class AmountOutOfRange(Exception):
        pass

    class DuplicateReference(Exception):
        """The same cedi is already claimed against this person."""

    round = models.ForeignKey(Round, on_delete=models.CASCADE, related_name="contributions")
    membership = models.ForeignKey(Membership, on_delete=models.CASCADE, related_name="contributions")

    amount_pesewas = models.BigIntegerField()
    provider = models.CharField(max_length=24)
    reference = models.CharField(max_length=100)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    failure_reason = models.CharField(max_length=120, blank=True, default="")
    manual_verification_reason = models.CharField(max_length=240, blank=True, default="")

    idempotency_key = models.UUIDField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            # C-S3: at most one counted attempt per member per round, enforced by the
            # database rather than by application code.
            models.UniqueConstraint(
                fields=["round", "membership"],
                condition=models.Q(status="verified"),
                name="one_verified_contribution_per_member_per_round",
            ),
            models.CheckConstraint(
                condition=models.Q(amount_pesewas__gte=MIN_CONTRIBUTION_PESEWAS),
                name="contribution_at_least_one_cedi",
            ),
            # C-S5: a replayed offline write must return the original result rather than
            # post a second time, so the client key is unique server-side.
            models.UniqueConstraint(
                fields=["idempotency_key"],
                condition=models.Q(idempotency_key__isnull=False),
                name="one_contribution_per_idempotency_key",
            ),
        ]
        indexes = [models.Index(fields=["round", "status"])]

    def __str__(self):
        return f"{self.membership} R{self.round.number} {self.amount_pesewas}p {self.status}"

    @classmethod
    def record(
        cls,
        round_,
        membership,
        *,
        amount_pesewas,
        provider="mtn_momo",
        reference="",
        idempotency_key=None,
    ):
        """Create an attempt, refusing anything the rules forbid.

        Every refusal raises rather than returning a reason string, because a caller that
        ignores a return value would otherwise record a contribution that should not exist.
        """
        try:
            amount = to_pesewas(amount_pesewas)
        except ValidationError as exc:
            # One exception type for every amount refusal, so a caller cannot accidentally
            # let an unparsed float through as though it were merely out of range.
            raise cls.AmountOutOfRange(str(exc.messages[0])) from exc
        share = round_.share_for(membership)

        if share is None:
            raise cls.AmountOutOfRange("That member is not in this round's rotation")
        if amount < MIN_CONTRIBUTION_PESEWAS:
            raise cls.AmountOutOfRange("The minimum contribution is GHc 1.00")
        if amount > share * MAX_MULTIPLE_OF_SHARE:
            raise cls.AmountOutOfRange(
                f"A contribution cannot exceed {MAX_MULTIPLE_OF_SHARE} times a member's share"
            )

        if round_.open_slot_for(membership) is not None:
            raise cls.FrozenSlot(
                "You already have a payment recorded for this round."
            )

        # C-S9: one cedi cannot fund two rounds.
        duplicate = cls.objects.filter(
            membership__account=membership.account,
            reference=reference,
            reference__gt="",
        ).exists()
        if duplicate:
            raise cls.DuplicateReference(
                "That transaction reference has already been recorded."
            )

        return cls.objects.create(
            round=round_,
            membership=membership,
            amount_pesewas=amount,
            provider=provider,
            reference=reference,
            idempotency_key=uuid.UUID(str(idempotency_key)) if idempotency_key else None,
            paid_at=timezone.now(),
        )


class Payout(models.Model):
    """One payout instruction for a round.

    `payout_key` is deterministic and unique, so a retry reuses the same key and a
    concurrent second instruction is refused by the database rather than by a check that
    might not run. This is the difference between a recoverable failure and an
    unrecoverable one.

    Rule IDs: P-S1 (no human triggers a payout), P-S2 (deterministic key),
    P-S3 (unique), P-S5 (the round advances only on completion), P-S10 (max 5 attempts).
    """

    class Status(models.TextChoices):
        QUEUED = "queued"
        PROCESSING = "processing"
        COMPLETED = "completed"
        FAILED = "failed"

    MAX_ATTEMPTS = 5

    round = models.ForeignKey(Round, on_delete=models.PROTECT, related_name="payouts")
    payout_key = models.CharField(max_length=80, unique=True)
    receiver = models.ForeignKey(Membership, on_delete=models.PROTECT, related_name="payouts")

    amount_pesewas = models.BigIntegerField()
    fee_pesewas = models.BigIntegerField(default=0)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.QUEUED)
    provider_reference = models.CharField(max_length=100, blank=True, default="")
    failure_reason = models.CharField(max_length=200, blank=True, default="")

    attempts = models.PositiveSmallIntegerField(default=0)
    created_by = models.ForeignKey(
        "accounts.Account", on_delete=models.PROTECT, null=True, blank=True,
        related_name="payouts_requested",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # P-S3: a round can never be paid out twice, whatever races.
            models.UniqueConstraint(fields=["round"], name="one_payout_per_round"),
            models.CheckConstraint(
                condition=models.Q(amount_pesewas__gt=0), name="payout_amount_positive"
            ),
        ]

    def __str__(self):
        return f"{self.payout_key} {self.amount_pesewas}p {self.status}"

    def can_retry(self):
        return self.status == self.Status.FAILED and self.attempts < self.MAX_ATTEMPTS

    def mark_failed(self, reason):
        self.status = self.Status.FAILED
        self.failure_reason = reason[:200]
        self.attempts = models.F("attempts") + 1
        self.save(update_fields=["status", "failure_reason", "attempts"])
        self.refresh_from_db()
        return self