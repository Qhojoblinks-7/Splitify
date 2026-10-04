"""Append-only double-entry ledger and the audit trail.

Two separate mechanisms, both immutable:

  LedgerEntry   the money record. Every movement is a balanced set of legs, so a missing or
                duplicated posting surfaces as an imbalance rather than as a plausible total.
  AuditEvent    the who-did-what record for every state change, including actions that move
                no money at all.

Neither can be edited or deleted. `Round.conservation_residual` computes the money identity
from mutable rows, so without an independent append-only record a bug in any write path could
move money and the check would still balance.

Account model, deliberately small:

    partner_account   our position in the licensed partner's collection account. Debit when
                      money arrives, credit when it leaves.
    group_pot         the liability the group owes its members. Credit on collection, debit
                      when the pot is paid out.
    fee_expense       the transfer fee, posted as its own balanced pair so the fee never
    fee_payable       distorts the partner account balance.
    debt_receivable   a claim on future contributions. An obligation, never money.
    member_payable    the counter-leg for a debt booking.

Rule IDs: 1791027903-money-handling-and-safeguards.md  AT1, AT2, Z1, Z3, C-S7, P-S8, F2, F3
           1791028270-security-fraud-and-identity.md    P2, P7, P9, I79, I80
"""

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models, transaction


class AppendOnlyQuerySet(models.QuerySet):
    """A queryset that cannot rewrite history.

    `Model.save()` guards the single-object path; this guards the path most likely to be used
    to quietly fix a number: a bulk `update()` or `delete()`.
    """

    def update(self, **kwargs):
        raise ValidationError(
            f"{self.model.__name__} is append-only: entries are corrected with a reversal, "
            "never edited in place."
        )

    def delete(self):
        raise ValidationError(
            f"{self.model.__name__} is append-only: entries are reversed, never deleted."
        )


class AppendOnlyModel(models.Model):
    """Base for records that must never be mutated once written. AT2, C-S7, P-S8."""

    objects = AppendOnlyQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError(
                f"{self.__class__.__name__} is append-only. Post a reversal instead of "
                "editing the original."
            )
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError(
            f"{self.__class__.__name__} is append-only. Post a reversal instead of deleting."
        )


class LedgerAccount(models.TextChoices):
    PARTNER_ACCOUNT = "partner_account", "Partner collection account"
    GROUP_POT = "group_pot", "Group pot owed to members"
    FEE_EXPENSE = "fee_expense", "Transfer fee expense"
    FEE_PAYABLE = "fee_payable", "Transfer fee payable to the provider"
    DEBT_RECEIVABLE = "debt_receivable", "Agreed debt owed to the group"
    MEMBER_PAYABLE = "member_payable", "Member owed money"


# Natural polarity, so a balance always reads as "what this account is worth".
_NATURAL_SIGN = {
    LedgerAccount.PARTNER_ACCOUNT: +1,   # an asset: debits increase it
    LedgerAccount.GROUP_POT: -1,         # a liability: credits increase it
    LedgerAccount.FEE_EXPENSE: +1,       # an expense: debits increase it
    LedgerAccount.FEE_PAYABLE: -1,       # a payable: credits increase it
    LedgerAccount.DEBT_RECEIVABLE: +1,   # an asset: debits increase it
    LedgerAccount.MEMBER_PAYABLE: -1,    # a payable: credits increase it
}


def ledger_natural_sign(account):
    """+1 where a debit increases the account, -1 where a credit does."""
    return _NATURAL_SIGN.get(LedgerAccount(account), +1)


class LedgerDirection(models.TextChoices):
    DEBIT = "debit"
    CREDIT = "credit"


class PostingType(models.TextChoices):
    COLLECTION = "collection"
    PAYOUT = "payout"
    FEE = "fee"
    REVERSAL = "reversal"
    DEBT = "debt"
    FLOAT_ADJUSTMENT = "float_adjustment"


class LedgerPosting(AppendOnlyModel):
    """A balanced set of legs, written as one indivisible unit.

    The posting is the unit of atomicity and of uniqueness. A reference may be posted once
    per round per type, so a replayed webhook or a second reconciliation pass cannot double
    post. That constraint cannot live on a leg: a balanced posting is two or more legs sharing
    one reference, so a per-leg constraint would reject the second leg of every valid posting.
    C-S5, RC7.
    """

    round = models.ForeignKey(
        "susu.Round", on_delete=models.PROTECT, null=True, blank=True,
        related_name="ledger_postings",
    )
    group = models.ForeignKey("susu.SusuGroup", on_delete=models.PROTECT, related_name="ledger_postings")

    entry_type = models.CharField(max_length=20, choices=PostingType.choices)
    reference = models.CharField(max_length=120, blank=True, default="")
    note = models.CharField(max_length=200, blank=True, default="")
    actor = models.ForeignKey(
        "accounts.Account", on_delete=models.PROTECT, null=True, blank=True,
        related_name="ledger_postings",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            # An empty reference means an internally generated posting (a float adjustment,
            # say), which is legitimately repeatable. Only a real reference is unique.
            models.UniqueConstraint(
                fields=["round", "entry_type", "reference"],
                condition=models.Q(reference__gt=""),
                name="one_ledger_posting_per_reference",
            ),
        ]

    def __str__(self):
        return f"{self.entry_type} {self.reference or 'manual'}"

    @classmethod
    @transaction.atomic
    def write(cls, round_, legs, *, entry_type, reference="", group=None, actor=None, note=""):
        """Validate a whole posting, then write it. Everything or nothing.

        Refuses an unbalanced set outright. A half-written posting is worse than a missing one,
        because it reconciles with nothing and still looks plausible.
        """
        if not legs:
            raise ValidationError("A posting must contain at least one leg")

        normalised = []
        debits = credits = 0
        for raw in legs:
            account = raw.get("account")
            direction = raw.get("direction")
            amount = raw.get("amount_pesewas")

            if account not in LedgerAccount.values:
                raise ValidationError(f"Unknown ledger account: {account}")
            if direction not in LedgerDirection.values:
                raise ValidationError(f"Unknown ledger direction: {direction}")
            if isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0:
                raise ValidationError(
                    f"Every ledger leg must be a whole number of pesewas greater than zero, "
                    f"received {amount!r}"
                )

            if direction == LedgerEntry.Direction.DEBIT:
                debits += amount
            else:
                credits += amount
            normalised.append((account, direction, amount))

        if debits != credits:
            raise ValidationError(
                f"A posting must balance: debits {debits} against credits {credits}."
            )

        posting = cls.objects.create(
            round=round_,
            group=group or (round_.group if round_ else None),
            entry_type=entry_type,
            reference=reference,
            note=note,
            actor=actor,
        )
        return [
            LedgerEntry.objects.create(
                posting=posting,
                round=round_,
                group=posting.group,
                entry_type=entry_type,
                account=account,
                direction=direction,
                amount_pesewas=amount,
                reference=reference,
                note=note,
                actor=actor,
            )
            for account, direction, amount in normalised
        ]


class LedgerEntry(AppendOnlyModel):
    """One leg of a posting. Always written in balanced sets, never on its own."""

    Direction = LedgerDirection
    EntryType = PostingType

    posting = models.ForeignKey(
        LedgerPosting, on_delete=models.PROTECT, related_name="entries"
    )
    round = models.ForeignKey(
        "susu.Round", on_delete=models.PROTECT, null=True, blank=True, related_name="ledger_entries"
    )
    group = models.ForeignKey(
        "susu.SusuGroup", on_delete=models.PROTECT, related_name="ledger_entries"
    )

    entry_type = models.CharField(max_length=20, choices=EntryType.choices)
    account = models.CharField(max_length=24, choices=LedgerAccount.choices)
    direction = models.CharField(max_length=6, choices=Direction.choices)
    amount_pesewas = models.BigIntegerField()

    reference = models.CharField(max_length=120, blank=True, default="")
    note = models.CharField(max_length=200, blank=True, default="")
    actor = models.ForeignKey(
        "accounts.Account", on_delete=models.PROTECT, null=True, blank=True,
        related_name="ledger_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount_pesewas__gt=0), name="ledger_amount_positive"
            ),
        ]
        indexes = [models.Index(fields=["group", "account"])]

    def __str__(self):
        return f"{self.entry_type} {self.direction} {self.account} {self.amount_pesewas}p"

    @property
    def signed_pesewas(self):
        sign = +1 if self.direction == self.Direction.DEBIT else -1
        return sign * self._natural_sign() * self.amount_pesewas

    def _natural_sign(self):
        return _NATURAL_SIGN.get(LedgerAccount(self.account), +1)

    @classmethod
    def post(cls, round_, legs, **kwargs):
        """Write a balanced posting. See `LedgerPosting.write`."""
        return LedgerPosting.write(round_, legs, **kwargs)


class AuditEvent(AppendOnlyModel):
    """An immutable record of an action, whether or not it moved money. AT1, AT4.

    Visible to every member of the group. An admin action that cannot be seen is an admin
    action nobody can hold to account for.
    """

    actor = models.ForeignKey(
        "accounts.Account", on_delete=models.PROTECT, null=True, blank=True,
        related_name="audit_events",
    )
    actor_role = models.CharField(max_length=16, default="system")

    action = models.CharField(max_length=60)
    target_type = models.ForeignKey(ContentType, on_delete=models.PROTECT, null=True, blank=True)
    target_id = models.PositiveBigIntegerField(null=True, blank=True)
    target = GenericForeignKey("target_type", "target_id")

    group = models.ForeignKey(
        "susu.SusuGroup", on_delete=models.PROTECT, null=True, blank=True,
        related_name="audit_events",
    )
    round_number = models.IntegerField(null=True, blank=True)

    from_state = models.CharField(max_length=20, blank=True, default="")
    to_state = models.CharField(max_length=20, blank=True, default="")
    reason = models.CharField(max_length=240, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["group", "action"])]

    def __str__(self):
        return f"{self.action} by {self.actor_role} at {self.created_at:%Y-%m-%d %H:%M}"

    @classmethod
    def resolve_group(cls, target, group=None):
        """Find the group a target belongs to, so a call site cannot forget.

        An audit event with no group is invisible in the group's feed, which means an action
        that happened but cannot be seen by the people affected. Resolving it here, once, is
        the only way to make that impossible: at least one of these always holds for the
        models that record events.
        """
        if group is not None:
            return group
        if target is None:
            return None

        found = getattr(target, "group", None)
        if found is not None:
            return found
        for relation in ("round", "membership"):
            related = getattr(target, relation, None)
            if related is not None:
                found = getattr(related, "group", None)
                if found is not None:
                    return found
        return None

    @classmethod
    def record(cls, *, actor, action, target=None, group=None, from_state=None,
               to_state="", reason="", actor_role=None):
        """Record an action. An action with no human actor is attributed to the system."""
        if actor_role is None:
            actor_role = "system" if actor is None else "member"

        target_type = None
        target_id = None
        if target is not None:
            target_type = ContentType.objects.get_for_model(target)
            target_id = target.pk

        return cls.objects.create(
            actor=actor,
            actor_role=actor_role,
            action=action,
            target_type=target_type,
            target_id=target_id,
            group=cls.resolve_group(target, group),
            round_number=getattr(target, "number", None),
            from_state=from_state or "",
            to_state=to_state or "",
            reason=reason or "",
        )
