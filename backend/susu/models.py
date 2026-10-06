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
from collections import defaultdict
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from .ledger import (
    AppendOnlyModel,
    AuditEvent,
    LedgerAccount,
    LedgerEntry,
    LedgerPosting,
    PostingType,
    ledger_natural_sign,
)

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


def allocate_debt(shortfall_pesewas, shares):
    """Split a shortfall across the members who did not pay, by their frozen shares.

    `shares` is `[(membership_id, share_pesewas)]` in rotation order. Returns
    `{membership_id: charged_pesewas}` for the members who owe.

    Water-filling: split proportionally, cap anyone who has reached their own share, and
    redistribute what they could not take among whoever still has room. Two properties matter
    more than the split itself:

      exactly conserving  the charges always sum to the shortfall, never a pesewa more and
                          never a pesewa less. The indivisible cedi is handed to the largest
                          fractional claim, with rotation order breaking ties, so the result
                          is deterministic rather than dependent on dictionary order.
      capped at the share  a member never owes more than they agreed to. Anything beyond that
                          is the group inventing a debt nobody accepted.

    This mirrors `allocateDebt` in `services/round.js` exactly. The client runs this
    calculation to show a member what they owe while offline, and the server runs it to decide
    what to book. If the two ever disagree by a single pesewa, the member sees one number and
    is charged another.
    """
    if shortfall_pesewas <= 0 or not shares:
        return {}

    remaining = min(shortfall_pesewas, sum(share for _, share in shares))
    charged = {}
    active = list(shares)

    while remaining > 0 and active:
        weights = sum(share for _, share in active)

        # Provisional split, floored so nobody is provisionally over-charged.
        provisional = {}
        remainders = []
        for index, (membership_id, share) in enumerate(active):
            numerator = remaining * share
            provisional[membership_id] = numerator // weights
            remainders.append((membership_id, numerator - provisional[membership_id] * weights, index))

        # The indivisible cedi goes to the largest fractional claims; rotation order breaks
        # ties, so the same shortfall always splits the same way.
        remainders.sort(key=lambda item: (-item[1], item[2]))
        leftover = remaining - sum(provisional.values())
        for membership_id, _, _ in remainders:
            if leftover <= 0:
                break
            provisional[membership_id] += 1
            leftover -= 1

        capped = []
        still_active = []
        for membership_id, share in active:
            if provisional[membership_id] >= share:
                charged[membership_id] = share
                remaining -= share
                capped.append(membership_id)
            else:
                still_active.append((membership_id, share))

        if not capped:
            for membership_id, _ in active:
                charged[membership_id] = provisional[membership_id]
            remaining = 0
        else:
            active = still_active

    return charged


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

    class DebtDisposition(models.TextChoices):
        """The only two honest answers to "what happens to this member's debt on removal."

        We hold no money and have no way to collect, so the choice is about the *record*, not
        the cedi. `FORGIVE` posts a balanced reversal and keeps the charge in the audit trail;
        `PRESERVE` leaves the debt intact and it reappears if the member rejoins. There is
        deliberately no silent third option: a removal without a stated disposition would hide
        a real group exposure or a real write-off.
        """
        FORGIVE = "forgive"
        PRESERVE = "preserve"

    @transaction.atomic
    def deactivate(self, *, actor=None, reason="", forgive_debt=True):
        """Remove this member from rotation, and decide explicitly what happens to their debt.

        Tombstoning `active` drops the member from the next round without renumbering the
        rotation, so who was about to receive the pot does not change (T1). That is the only
        effect unless the caller also states a debt disposition:

            forgive_debt=True   the debt was a claim nobody could ever collect, so it is
                                written off as a balanced ledger reversal and the books stay
                                honest. The write-off itself is recorded so the group can still
                                see its pot was short before this member left.
            forgive_debt=False  the debt stays on the books and survives the departure; if the
                                member rejoins it is applied, and it always counts against any
                                future payout they would receive.

        A member is never anonymised or deleted here. Anonymisation is the separate, two-stage
        path in `compliance.retention` (anonymise now on an erasure request, hard-delete later
        once the seven-year hold has passed and the person still holds no membership); this
        call only removes them from the rotation. D9.
        """
        if not self.active:
            raise ValidationError("This member is already removed from the group")

        self.active = False
        if forgive_debt and self.debt_pesewas > 0:
            amount = self.debt_pesewas
            LedgerEntry.post(
                None,
                [
                    {"account": LedgerAccount.MEMBER_PAYABLE,
                     "direction": LedgerEntry.Direction.DEBIT, "amount_pesewas": amount},
                    {"account": LedgerAccount.DEBT_RECEIVABLE,
                     "direction": LedgerEntry.Direction.CREDIT, "amount_pesewas": amount},
                ],
                entry_type=PostingType.REVERSAL,
                reference=f"debt-forgive-m{self.pk}-{uuid.uuid4().hex[:8]}",
                group=self.group,
                note=f"Debt forgiven on removal: {reason[:200]}",
                actor=actor,
            )
            self.debt_pesewas = 0
            self.debt_reason = ""
            self.debt_notified_at = None

        self.save(update_fields=["active", "debt_pesewas", "debt_reason", "debt_notified_at"])

        AuditEvent.record(
            actor=actor, action="membership.deactivated",
            target=self, group=self.group,
            from_state="active", to_state="inactive",
            reason=reason,
            actor_role="admin" if actor else "system",
        )
        return self


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
    # Money brought in from the previous round, and money left behind by this one. Both are
    # facts recorded once at the boundary, never recomputed later, so the float cannot be
    # counted twice or quietly restated.
    carried_float_pesewas = models.BigIntegerField(default=0)
    closing_float_pesewas = models.BigIntegerField(default=0)
    # Bumped on every booking so each revision's postings get a distinct, deterministic
    # reference. Without it a recomputed charge could collide with its own earlier posting.
    debt_revision = models.PositiveIntegerField(default=0)

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

        # The cursor and round number are authoritative in the database, not on whichever
        # instance the caller happened to be holding. A caller whose copy predates a
        # completed payout would otherwise open a second round with a number already taken,
        # and the failure would surface as a unique-constraint error about a race.
        group.refresh_from_db(fields=["current_round", "turn_cursor", "cycle"])

        # Z2: money the previous round collected and never paid out belongs to the group and
        # reduces what they still owe. Demanding it a second time is the defect this prevents.
        # The floor keeps a round's target above zero, so a float large enough to cover the
        # whole next target leaves the remainder on the books instead of being spent by
        # arithmetic and lost.
        carried = cls._unspent_float(group)
        target = max(1, to_pesewas(group.target_pesewas) - carried)

        # Rotation order from the cursor, so the receiver is first and absorbs the
        # indivisible cedi in the share allocation.
        ordered = roster[group.turn_cursor % len(roster):] + roster[: group.turn_cursor % len(roster)]
        shares = allocate(target, len(ordered), [m.id for m in ordered])

        snapshot = [
            {
                "membership_id": m.id,
                "account_id": m.account_id,
                # `display_name`, never `str(account)`. This snapshot is served to every member
                # of the group, and the old fallback rendered a member's mobile money number
                # when they had given no name — a number that can be used to move money, handed
                # to everyone in the circle. Act 843 s.19 as well: necessary, relevant, and not
                # excessive does not include broadcasting a number nobody asked to share.
                "name": m.account.display_name,
                "order": m.order,
                "share_pesewas": shares[m.id],
                "charged_pesewas": 0,
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
            carried_float_pesewas=carried,
        )

    @classmethod
    def _unspent_float(cls, group):
        """The most recent round's unspent float, in total.

        Each closed round records what it left behind, so the running figure is the newest
        closed round's balance rather than a sum that could double-count float carried more
        than once. A float never applied stays on the books and reduces the target instead.
        """
        return cls.objects.filter(
            group=group, closing_float_pesewas__gt=0
        ).order_by("-number").values_list("closing_float_pesewas", flat=True).first() or 0

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

    def paid_pesewas_for(self, membership):
        """What this member has actually put into the pot this round.

        Verified payments only, and summed over every attempt rather than read off one of them: a
        member may hold several attempts for a round while only one is ever counted, and a
        client that displayed "their payment" by reading the newest row would show a voided or
        reversed amount as though it were money in the pot. C-S1.

        Read per member rather than derived from the round total minus everyone else, because a
        difference of two totals cannot say *who* is short, and "who still owes" is the question
        a member actually opens the screen to answer.
        """
        return sum(
            self.contributions.filter(
                membership=membership, status=Contribution.Status.VERIFIED
            ).values_list("amount_pesewas", flat=True)
        )

    def payment_state_by_membership(self):
        """`membership_id -> {"paid": pesewas, "open_status": str | None}` for the whole round.

        The per-member map the round screen renders, gathered in two queries rather than two per
        member. A roster can hold fifty people (G3), and asking the database one member at a time
        turns one screen into a hundred round trips.

        `paid` counts verified attempts only. `open_status` is the attempt currently holding the
        member's slot, and is `None` when they may pay again — which is the whole freeze rule
        stated as a fact the client can read rather than a rule it has to reimplement. C-S1, C-S2.
        """
        verified = defaultdict(int)
        for membership_id, amount in self.contributions.filter(
            status=Contribution.Status.VERIFIED
        ).values_list("membership_id", "amount_pesewas"):
            verified[membership_id] += amount

        open_slots = dict(
            self.contributions.exclude(status__in=Contribution.TERMINAL_STATUSES).values_list(
                "membership_id", "status"
            )
        )
        return {
            entry["membership_id"]: {
                "paid": verified.get(entry["membership_id"], 0),
                "open_status": open_slots.get(entry["membership_id"]),
            }
            for entry in self.roster_snapshot
        }

    def shortfall_pesewas(self):
        gap = self.target_pesewas - self.verified_total_pesewas()
        return gap if gap > 0 else 0

    def payout_key(self):
        """Deterministic per round, so a retry can never become a second payment. P-S2."""
        return f"pay-{self.group_id}-{self.cycle}-{self.number}"

    # -- money -----------------------------------------------------------

    def current_float_pesewas(self):
        """Money this round collected that no payout consumed, right now. Z2.

    Read from the append-only record rather than from the mutable rows, so it is a fact about
        the money rather than a restatement of the contributions.

        The fee is excluded because it was withheld from the pot but never left the collection
        account: it is still there, owed to the provider. Counting it as the group's money
        would promise members cedi that belong to someone else. Debt is excluded entirely: a
        debt is a claim on future contributions, not a cedi in the account.

        A negative result is real and must be shown, not floored away. It means money left to
        the receiver and was taken back, and the group has to see that. Z7.
        """
        return self.partner_balance_pesewas() - self.account_balance_pesewas(
            LedgerAccount.FEE_PAYABLE
        )

    def conservation_residual(self):
        """The money identity, checked against the ledger. Must be zero for a sound round. Z1.

            float held - (verified - paid - fees) = 0

        Both sides are computed from different places on purpose. The left is what the
        append-only record says we hold; the right is what the mutable rows say we collected
        and disbursed. If a status was written without a posting, or a posting without a
        status, the two disagree and this is where it shows.

        An earlier version computed `verified - paid - fees - max(0, that same expression)`,
        which is zero by construction and therefore reported zero forever. A check that cannot
        fail is not evidence, and it looked exactly like one. Z7.
        """
        released = sum(
            p.amount_pesewas for p in self.payouts.filter(status=Payout.Status.COMPLETED)
        )
        fees = sum(
            p.fee_pesewas for p in self.payouts.filter(status=Payout.Status.COMPLETED)
        )
        expected = self.verified_total_pesewas() - released - fees
        return self.current_float_pesewas() - expected

    # -- ledger ----------------------------------------------------------

    def ledger_debits_pesewas(self):
        return sum(
            e.amount_pesewas
            for e in self.ledger_entries.filter(direction=LedgerEntry.Direction.DEBIT)
        )

    def ledger_credits_pesewas(self):
        return sum(
            e.amount_pesewas
            for e in self.ledger_entries.filter(direction=LedgerEntry.Direction.CREDIT)
        )

    def ledger_residual_pesewas(self):
        """The independent check that the ledger balances. Must be zero, always.

        Computed from the append-only record, not from the mutable contribution rows, so it
        cannot be made to balance by the same bug that broke it. Z1.
        """
        return self.ledger_debits_pesewas() - self.ledger_credits_pesewas()

    def partner_balance_pesewas(self):
        """Our cash position: money collected minus money paid out, fees excluded."""
        return self.account_balance_pesewas(LedgerAccount.PARTNER_ACCOUNT)

    def account_balance_pesewas(self, account):
        """The balance of one account, signed so a positive number is what it is worth."""
        entries = self.ledger_entries.filter(account=account)
        debit = sum(
            e.amount_pesewas for e in entries if e.direction == LedgerEntry.Direction.DEBIT
        )
        credit = sum(
            e.amount_pesewas for e in entries if e.direction == LedgerEntry.Direction.CREDIT
        )
        return (debit - credit) * ledger_natural_sign(account)

    def debt_residual(self):
        """The debt identity, kept separate from money. Z2a.

            0 <= shortfall - sum(debt booked for this round)
        """
        booked = sum(
            entry.get("charged_pesewas", 0) for entry in self.roster_snapshot
        )
        return self.shortfall_pesewas() - booked

    def non_contributor_ids(self):
        """Rotation order. The order matters: it breaks ties in the debt split, so a member
        who pays first is not charged differently run to run. D2."""
        counted = set(
            self.contributions.filter(status=Contribution.Status.VERIFIED).values_list(
                "membership_id", flat=True
            )
        )
        return [
            entry["membership_id"]
            for entry in self.roster_snapshot
            if entry["membership_id"] not in counted
        ]

    def debt_allocation(self):
        """What each member owes this round, derived from the frozen shares. Pure.

        Derived rather than accumulated, so a member who pays late stops owing automatically.
        Charging debt nobody has discharged is how a group ends up demanding money twice.
        """
        gap = self.shortfall_pesewas()
        if gap <= 0:
            return {}

        shares_by_member = {entry["membership_id"]: entry["share_pesewas"]
                            for entry in self.roster_snapshot}
        owing = [
            (membership_id, shares_by_member[membership_id])
            for membership_id in self.non_contributor_ids()
        ]
        return allocate_debt(gap, owing)

    @transaction.atomic
    def book_debt(self, *, actor=None, reason=""):
        """Book this round's debt, posting only what changed.

        Re-derived on every call rather than appended to, so a late payment clears its
        owner's charge and a member who has already paid is never chased. Only the difference
        is posted: booking an unchanged round writes nothing, which is what makes this safe
        to call from more than one place.

        Debt posts to `debt_receivable` and `member_payable` and nowhere else. No cedi moved,
        so the collection account and the pot are untouched and the float is unaffected. A
        debt that reduced the float would tell a member they have less money than they do.
        D2, Z2a, Z1.
        """
        if self.outcome != self.Outcome.OPEN:
            raise ValidationError("Debt is booked against an open round")

        allocation = self.debt_allocation()
        snapshot = [dict(entry) for entry in self.roster_snapshot]

        self.debt_revision += 1
        revision = self.debt_revision

        for entry in snapshot:
            membership_id = entry["membership_id"]
            previous = entry.get("charged_pesewas", 0)
            wanted = allocation.get(membership_id, 0)
            delta = wanted - previous
            entry["charged_pesewas"] = wanted
            if delta == 0:
                continue

            reference = f"debt-r{self.number}-rev{revision}-m{membership_id}"
            if delta > 0:
                legs = [
                    {"account": LedgerAccount.DEBT_RECEIVABLE,
                     "direction": LedgerEntry.Direction.DEBIT, "amount_pesewas": delta},
                    {"account": LedgerAccount.MEMBER_PAYABLE,
                     "direction": LedgerEntry.Direction.CREDIT, "amount_pesewas": delta},
                ]
                entry_type = PostingType.DEBT
            else:
                legs = [
                    {"account": LedgerAccount.MEMBER_PAYABLE,
                     "direction": LedgerEntry.Direction.DEBIT, "amount_pesewas": -delta},
                    {"account": LedgerAccount.DEBT_RECEIVABLE,
                     "direction": LedgerEntry.Direction.CREDIT, "amount_pesewas": -delta},
                ]
                entry_type = PostingType.REVERSAL

            LedgerEntry.post(self, legs, entry_type=entry_type, reference=reference,
                             actor=actor)

            # The running total belongs to the person, so it carries across cycles. D5. The
            # database constraint is left to catch a reduction below zero rather than having
            # it clamped here, because a clamp would hide the corruption it is checking for.
            Membership.objects.filter(pk=membership_id).update(
                debt_pesewas=models.F("debt_pesewas") + delta
            )

            if delta > 0:
                AuditEvent.record(
                    actor=actor, action="debt.charged", target=self,
                    group=self.group, reason=reason or f"{delta}p charged",
                    actor_role="member" if actor else "system",
                )

        self.roster_snapshot = snapshot
        self.save(update_fields=["roster_snapshot", "debt_revision"])

        AuditEvent.record(
            actor=actor, action="round.debt_booked", target=self,
            to_state=f"{sum(allocation.values())}p", reason=reason,
        )

        return {"charged": allocation, "revision": revision, "residual": self.debt_residual()}

    @transaction.atomic
    def close(self, *, actor=None, reason=""):
        """Decide this round's outcome, once, and record what it left behind. R5.

        The only way a round ends without a payout having run. Everything else — a met pot, a
        blocked payment, a dispute still open — is refused rather than decided here, because
        deciding those is how a round ends up claiming money changed hands when it did not.

        Four refusals, each of which is a way this could otherwise be gamed:

          before the due date    otherwise a member closes a round early to escape paying it.
          while flagged          the total is not yet a fact, so the outcome cannot be either.
          while a payout flies   the round would close under money still in motion.
          once already closed    the outcome is decided exactly once.

        Debt is booked here rather than on demand, because a closed round that keeps
        accruing obligations is not closed. Z2a, D2.
        """
        if self.outcome != self.Outcome.OPEN:
            raise ValidationError("This round has already been closed")

        if timezone.now() < self.due_at:
            raise ValidationError("This round cannot be closed before its collection day")

        if self.contributions.filter(
            status__in=Contribution.BLOCKING_STATUSES
        ).exists():
            raise ValidationError(
                "This round is blocked pending a decision on a flagged payment"
            )

        if self.payouts.filter(
            status__in=[Payout.Status.QUEUED, Payout.Status.PROCESSING]
        ).exists():
            raise ValidationError("A payout is still in flight for this round")

        if self.verified_total_pesewas() >= self.target_pesewas:
            raise ValidationError(
                "The pot has been met. This round closes when the payout completes, not before."
            )

        self.book_debt(actor=actor, reason=reason)
        return self._finalise(self.Outcome.SHORT, actor=actor, reason=reason)

    @transaction.atomic
    def _finalise(self, outcome, *, actor=None, reason=""):
        """Record the outcome and the float leaving, then advance the rotation. R5, R9.

        Shared with the payout path so there is one place that closes a round, and therefore
        no way for two of them to disagree about what closing means.
        """
        self.outcome = outcome
        self.closed_at = timezone.now()
        self.closing_float_pesewas = self.current_float_pesewas()
        self.save(update_fields=["outcome", "closed_at", "closing_float_pesewas"])

        self.group.current_round += 1
        self.group.turn_cursor += 1
        self.group.save(update_fields=["current_round", "turn_cursor"])

        AuditEvent.record(
            actor=actor, action="round.closed", target=self,
            from_state=self.Outcome.OPEN, to_state=outcome, reason=reason,
        )
        return self

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

    class IdempotencyKeyConflict(Exception):
        """An idempotency key already belongs to a different member's payment.

        The key is globally unique, so this is either a client bug or an attempt to read
        another member's payment by guessing their key. Refused rather than answered.
        """

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

        # C-S5, and this check has to come before every state-dependent refusal below. The
        # offline queue replays writes it could not confirm; the replay arrives while the
        # original still holds the member's slot, so checking the slot first would answer a
        # retry with "you already have a payment recorded" and the client could never tell a
        # retry from a genuine second attempt. An idempotent write returns its original
        # result, whatever the state has become since.
        key = None
        if idempotency_key:
            try:
                key = uuid.UUID(str(idempotency_key))
            except (ValueError, AttributeError, TypeError) as exc:
                raise ValidationError("That idempotency key is not a valid identifier") from exc
            replay = cls.objects.filter(idempotency_key=key).first()
            if replay is not None:
                # Only the member who owns the payment may collect its replay. Answering
                # anybody else would hand one member another member's amount and reference.
                if replay.round_id == round_.id and replay.membership_id == membership.pk:
                    return replay
                raise cls.IdempotencyKeyConflict(
                    "That payment key has already been used for a different payment."
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

        try:
            # The inner atomic block so losing the unique-constraint race rolls back only the
            # insert, not the caller's transaction.
            with transaction.atomic():
                return cls.objects.create(
                    round=round_,
                    membership=membership,
                    amount_pesewas=amount,
                    provider=provider,
                    reference=reference,
                    idempotency_key=key,
                    paid_at=timezone.now(),
                )
        except IntegrityError:
            # Two devices replaying the same queued write at the same moment. One wins; the
            # other is told the truth rather than seeing a failed payment.
            if key is not None:
                replay = cls.objects.filter(idempotency_key=key).first()
                if replay is not None:
                    return replay
            raise

    # -- state transitions ------------------------------------------------
    #
    # A status change and its ledger posting happen in one transaction or not at all. The
    # defect this replaces is a status written without a posting, which leaves the mutable
    # round and the append-only record permanently disagreeing with no way to tell which
    # one is right. Z1, Z3.

    def _release(self, *, new_status, actor, reason, event):
        """Leave the pending state without a provider outcome. Shared by the two paths below.

        Neither posts to the ledger, and that is the point: no money arrived, so there is
        nothing to record. What they do is release the member's slot, which the freeze rule
        holds while an attempt might still become money. Without a way out of pending, one
        payment the provider never confirms strands that member and the round permanently.
        C-S2, D9.
        """
        if self.status != self.Status.PENDING:
            raise ValidationError(
                f"Only a pending contribution can be released; this one is {self.status}"
            )

        self.status = new_status
        self.failure_reason = reason[:120]
        self.save(update_fields=["status", "failure_reason"])

        AuditEvent.record(
            actor=actor, action=event, target=self,
            from_state=self.Status.PENDING, to_state=new_status, reason=reason,
        )
        return self

    def mark_failed(self, *, actor=None, reason=""):
        """The provider never confirmed this payment. The attempt is written off.

        Used when a payment is known not to have landed. The inverse of a reversal: nothing
        arrived, so nothing is posted.
        """
        return self._release(
            new_status=self.Status.FAILED, actor=actor,
            reason=reason or "The provider never confirmed this payment",
            event="contribution.failed",
        )

    def mark_void(self, *, actor=None, reason=""):
        """An attempt that should never have existed, cancelled by whoever made it.

        A member who entered the wrong amount, or started a payment they did not intend.
        Distinct from a failure: nobody is waiting on a provider, so there is no outcome to
        report.
        """
        return self._release(
            new_status=self.Status.VOID, actor=actor,
            reason=reason or "Cancelled before it was sent",
            event="contribution.voided",
        )

    @transaction.atomic
    def mark_verified(self, *, actor=None, reason=""):
        """Money has arrived. This is the only place the pot grows. C-S1.

        A pending attempt is a claim, not a cedi: nothing is posted until the provider or a
        manual check confirms the money. Manual verification therefore always leaves its
        reason, so a human decision is never indistinguishable from a confirmed one.
        """
        if self.status == self.Status.VERIFIED:
            raise ValidationError("This contribution has already been verified")
        if self.status in self.TERMINAL_STATUSES:
            raise ValidationError(f"A {self.status} contribution cannot be verified")

        self.status = self.Status.VERIFIED
        self.verified_at = timezone.now()
        self.manual_verification_reason = reason[:240]
        self.save(update_fields=["status", "verified_at", "manual_verification_reason"])

        LedgerEntry.post(
            self.round,
            [
                {"account": LedgerAccount.PARTNER_ACCOUNT,
                 "direction": LedgerEntry.Direction.DEBIT, "amount_pesewas": self.amount_pesewas},
                {"account": LedgerAccount.GROUP_POT,
                 "direction": LedgerEntry.Direction.CREDIT, "amount_pesewas": self.amount_pesewas},
            ],
            entry_type=PostingType.COLLECTION,
            reference=self.reference or f"contribution-{self.pk}",
            actor=actor,
        )
        AuditEvent.record(
            actor=actor, action="contribution.verified", target=self,
            from_state=self.Status.PENDING, to_state=self.Status.VERIFIED, reason=reason,
        )
        return self

    @transaction.atomic
    def mark_reversed(self, *, actor=None, reason=""):
        """The money came back out. Always the exact mirror of the collection.

        Reversal is a posting, never an edit: the original stays and the counter-entry sits
        beside it, so the sequence of events remains readable. C-S2, C-S7.
        """
        if self.status != self.Status.VERIFIED:
            raise ValidationError("Only a verified contribution can be reversed")

        self.status = self.Status.REVERSED
        self.save(update_fields=["status"])

        LedgerEntry.post(
            self.round,
            [
                {"account": LedgerAccount.GROUP_POT,
                 "direction": LedgerEntry.Direction.DEBIT, "amount_pesewas": self.amount_pesewas},
                {"account": LedgerAccount.PARTNER_ACCOUNT,
                 "direction": LedgerEntry.Direction.CREDIT, "amount_pesewas": self.amount_pesewas},
            ],
            entry_type=PostingType.REVERSAL,
            reference=f"{self.reference or self.pk}-rev",
            actor=actor,
            note=reason,
        )
        AuditEvent.record(
            actor=actor, action="contribution.reversed", target=self,
            from_state=self.Status.VERIFIED, to_state=self.Status.REVERSED, reason=reason,
        )
        return self


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

    @transaction.atomic
    def mark_completed(self, *, provider_reference="", actor=None):
        """The money reached the receiver. The only path money leaves the partner account. P-S1.

        Posts the pot and the fee separately. Folding the fee into the payout legs would make
        the partner account stop reconciling with the partner's own balance, which is the
        cheapest way to lose a cedi and the hardest to notice. P-S8.
        """
        if self.status == self.Status.COMPLETED:
            raise ValidationError("This payout has already completed")
        if self.status == self.Status.FAILED:
            raise ValidationError(
                "A failed payout cannot complete. Queue a retry with the same key instead."
            )

        previous = self.status
        self.status = self.Status.COMPLETED
        self.provider_reference = provider_reference[:100]
        self.completed_at = timezone.now()
        self.attempts = models.F("attempts") + 1
        self.save(update_fields=["status", "provider_reference", "completed_at", "attempts"])
        self.refresh_from_db()

        LedgerEntry.post(
            self.round,
            [
                {"account": LedgerAccount.GROUP_POT,
                 "direction": LedgerEntry.Direction.DEBIT, "amount_pesewas": self.amount_pesewas},
                {"account": LedgerAccount.PARTNER_ACCOUNT,
                 "direction": LedgerEntry.Direction.CREDIT, "amount_pesewas": self.amount_pesewas},
            ],
            entry_type=PostingType.PAYOUT,
            reference=self.payout_key,
            actor=actor,
        )

        if self.fee_pesewas:
            LedgerEntry.post(
                self.round,
                [
                    {"account": LedgerAccount.FEE_EXPENSE,
                     "direction": LedgerEntry.Direction.DEBIT, "amount_pesewas": self.fee_pesewas},
                    {"account": LedgerAccount.FEE_PAYABLE,
                     "direction": LedgerEntry.Direction.CREDIT, "amount_pesewas": self.fee_pesewas},
                ],
                entry_type=PostingType.FEE,
                reference=f"{self.payout_key}-fee",
                actor=actor,
            )

        AuditEvent.record(
            actor=actor, action="payout.completed", target=self,
            from_state=previous, to_state=self.Status.COMPLETED,
        )

        # P-S5: the rotation advances only on completion, never on instruction. An instructed
        # payout that later fails must leave the round exactly as it was. Closing goes through
        # the same path as any other close so the float is recorded identically.
        self.round._finalise(Round.Outcome.PAID, actor=actor)
        return self