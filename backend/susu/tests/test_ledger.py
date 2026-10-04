"""
Append-only ledger and audit trail.

`Round.conservation_residual` is computed from mutable rows, so a bug in any write path could
move money and the check would still balance. An append-only double-entry ledger is the
independent record: entries cannot be edited, and every movement is a balanced set of legs,
so a missing or duplicated posting shows up as an imbalance rather than as a plausible total.

Account model, deliberately small:

    partner_account   our position in the licensed partner's collection account.
                      Debit when money arrives, credit when it leaves.
    group_pot         the liability the group owes its members. Credit on collection,
                      debit when the pot is paid out.
    fee_expense / fee_payable   the transfer fee, posted as its own balanced pair so the
                      fee never distorts the partner account balance.
    debt_receivable   a claim on future contributions. An obligation, never money.

Debt is deliberately absent from the money identity: a group can owe more than it collected,
and conflating the two produces false conservation failures. See Z1 versus Z2a.

Rule IDs: 1791027903-money-handling-and-safeguards.md AT1, AT2, Z1, Z3, C-S7, P-S8
           1791028270-security-fraud-and-identity.md   P2, P7, P9, I79, I80
"""

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from accounts.models import Account
from susu.models import (
    AuditEvent,
    Contribution,
    LedgerAccount,
    LedgerEntry,
    Membership,
    Round,
    SusuGroup,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin():
    return Account.objects.create_user(phone="+233201000001", password="pw-admin-secret")


@pytest.fixture
def group(admin):
    return SusuGroup.objects.create_group(
        name="Ledger Susu", target_pesewas=30000, collection_day=5,
        admin=admin, invite_code="LED001",
    )


@pytest.fixture
def rnd(group):
    for index, number in enumerate(["+233201000002", "+233201000003", "+233201000004"]):
        person = Account.objects.create_user(phone=number, password="pw")
        Membership.objects.create(group=group, account=person, order=index + 2)
    return Round.open_current(group)


def leg(account, direction, amount):
    return {"account": account, "direction": direction, "amount_pesewas": amount}


D = LedgerEntry.Direction
COLLECTION_IN = [
    leg(LedgerAccount.PARTNER_ACCOUNT, D.DEBIT, 10000),
    leg(LedgerAccount.GROUP_POT, D.CREDIT, 10000),
]
PAYOUT_OUT = [
    leg(LedgerAccount.GROUP_POT, D.DEBIT, 10000),
    leg(LedgerAccount.PARTNER_ACCOUNT, D.CREDIT, 10000),
]
FEE = [
    leg(LedgerAccount.FEE_EXPENSE, D.DEBIT, 500),
    leg(LedgerAccount.FEE_PAYABLE, D.CREDIT, 500),
]


# --------------------------------------------------------------------------
# Balanced posting
# --------------------------------------------------------------------------


class TestBalancedPosting:
    def test_posts_a_balanced_set(self, rnd):
        assert len(LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP1")) == 2

    def test_refuses_an_unbalanced_set(self, rnd):
        with pytest.raises(ValidationError):
            LedgerEntry.post(
                rnd,
                [leg(LedgerAccount.PARTNER_ACCOUNT, D.DEBIT, 10000),
                 leg(LedgerAccount.GROUP_POT, D.CREDIT, 9000)],
                entry_type="collection", reference="MP2",
            )

    def test_refuses_an_empty_set(self, rnd):
        with pytest.raises(ValidationError):
            LedgerEntry.post(rnd, [], entry_type="collection", reference="MP3")

    def test_refuses_a_leg_of_zero(self, rnd):
        with pytest.raises(ValidationError):
            LedgerEntry.post(
                rnd,
                COLLECTION_IN + [leg(LedgerAccount.FEE_EXPENSE, D.DEBIT, 0)],
                entry_type="collection", reference="MP4",
            )

    def test_refuses_a_negative_leg(self, rnd):
        with pytest.raises(ValidationError):
            LedgerEntry.post(
                rnd,
                [leg(LedgerAccount.PARTNER_ACCOUNT, D.DEBIT, 10000),
                 leg(LedgerAccount.GROUP_POT, D.CREDIT, -10000)],
                entry_type="collection", reference="MP5",
            )

    def test_nothing_is_written_when_the_set_does_not_balance(self, rnd):
        before = LedgerEntry.objects.count()
        with pytest.raises(ValidationError):
            LedgerEntry.post(
                rnd,
                [leg(LedgerAccount.PARTNER_ACCOUNT, D.DEBIT, 10000)],
                entry_type="collection", reference="MP6",
            )
        assert LedgerEntry.objects.count() == before

    def test_refuses_a_float_amount(self, rnd):
        with pytest.raises(ValidationError):
            LedgerEntry.post(
                rnd,
                [leg(LedgerAccount.PARTNER_ACCOUNT, D.DEBIT, 10000.5),
                 leg(LedgerAccount.GROUP_POT, D.CREDIT, 10000.5)],
                entry_type="collection", reference="MP7",
            )


# --------------------------------------------------------------------------
# The money identity, asserted against the ledger (Z1, Z3)
# --------------------------------------------------------------------------


class TestLedgerConservation:
    def test_debits_equal_credits_after_a_collection(self, rnd):
        LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP8")
        assert rnd.ledger_debits_pesewas() == rnd.ledger_credits_pesewas() == 10000

    def test_the_partner_account_holds_what_was_collected(self, rnd):
        LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP9")
        assert rnd.partner_balance_pesewas() == 10000

    def test_the_partner_account_is_empty_after_the_pot_is_paid_out(self, rnd):
        LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP10")
        LedgerEntry.post(rnd, PAYOUT_OUT, entry_type="payout", reference="PAY1")
        LedgerEntry.post(rnd, FEE, entry_type="fee", reference="FEE1")
        assert rnd.ledger_debits_pesewas() == rnd.ledger_credits_pesewas()
        assert rnd.partner_balance_pesewas() == 0
        assert rnd.account_balance_pesewas(LedgerAccount.GROUP_POT) == 0
        assert rnd.account_balance_pesewas(LedgerAccount.FEE_EXPENSE) == 500

    def test_the_fee_does_not_distort_the_partner_account(self, rnd):
        # The single most tempting place to lose a cedi: charging the fee inside the payout
        # legs so the partner account no longer reconciles with the partner's own balance.
        LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP11")
        LedgerEntry.post(rnd, PAYOUT_OUT, entry_type="payout", reference="PAY2")
        LedgerEntry.post(rnd, FEE, entry_type="fee", reference="FEE2")
        assert rnd.partner_balance_pesewas() == 0
        assert rnd.ledger_debits_pesewas() == 20500

    def test_money_collected_and_never_paid_out_stays_attributable(self, rnd):
        LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP12")
        assert rnd.partner_balance_pesewas() == 10000
        assert rnd.ledger_residual_pesewas() == 0

    def test_balances_across_many_postings(self, rnd):
        for index in range(25):
            LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference=f"C-{index}")
        assert rnd.ledger_debits_pesewas() == 250000
        assert rnd.ledger_residual_pesewas() == 0

    def test_a_reversal_is_its_own_balanced_pair(self, rnd):
        LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP13")
        LedgerEntry.post(
            rnd,
            [leg(LedgerAccount.GROUP_POT, D.DEBIT, 10000),
             leg(LedgerAccount.PARTNER_ACCOUNT, D.CREDIT, 10000)],
            entry_type="reversal", reference="MP13-rev",
        )
        assert rnd.ledger_residual_pesewas() == 0
        assert rnd.partner_balance_pesewas() == 0

    def test_a_reversal_after_a_payout_leaves_a_negative_float_to_investigate(self, rnd):
        # MoMo reversal exposure (V-R2, V-R3): the money left to the receiver and then came
        # back out from under them. The float absorbs it and the group must see it.
        LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP14")
        LedgerEntry.post(rnd, PAYOUT_OUT, entry_type="payout", reference="PAY3")
        LedgerEntry.post(
            rnd,
            [leg(LedgerAccount.GROUP_POT, D.DEBIT, 10000),
             leg(LedgerAccount.PARTNER_ACCOUNT, D.CREDIT, 10000)],
            entry_type="reversal", reference="MP14-rev",
        )
        assert rnd.ledger_residual_pesewas() == 0
        assert rnd.partner_balance_pesewas() == -10000

    def test_debt_is_posted_without_touching_money(self, rnd):
        LedgerEntry.post(
            rnd,
            [leg(LedgerAccount.DEBT_RECEIVABLE, D.DEBIT, 10000),
             leg(LedgerAccount.MEMBER_PAYABLE, D.CREDIT, 10000)],
            entry_type="debt", reference="DEBT1",
        )
        assert rnd.ledger_residual_pesewas() == 0
        assert rnd.partner_balance_pesewas() == 0


# --------------------------------------------------------------------------
# Append-only. AT2, C-S7, P-S8
# --------------------------------------------------------------------------


class TestAppendOnly:
    def test_an_entry_cannot_be_edited(self, rnd):
        entry = LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP15")[0]
        entry.amount_pesewas = 999999
        with pytest.raises(ValidationError):
            entry.save()

    def test_an_entry_cannot_be_deleted(self, rnd):
        entry = LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP16")[0]
        with pytest.raises(ValidationError):
            entry.delete()

    def test_an_entry_cannot_be_repointed(self, rnd):
        entry = LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP17")[0]
        entry.round = None
        with pytest.raises(ValidationError):
            entry.save()

    def test_a_bulk_update_is_refused(self, rnd):
        LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP18")
        with pytest.raises(ValidationError):
            LedgerEntry.objects.filter(round=rnd).update(amount_pesewas=1)

    def test_a_bulk_delete_is_refused(self, rnd):
        LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP19")
        with pytest.raises(ValidationError):
            LedgerEntry.objects.filter(round=rnd).delete()

    def test_history_outlives_its_source_record(self, rnd):
        entry = LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP20")[0]
        counted = Contribution.objects.create(
            round=rnd,
            membership=Membership.objects.get(pk=rnd.roster_snapshot[0]["membership_id"]),
            amount_pesewas=10000, provider="mtn_momo", reference="MP20",
            status=Contribution.Status.VERIFIED,
        )
        counted.status = Contribution.Status.REVERSED
        counted.save()
        assert LedgerEntry.objects.filter(pk=entry.pk).exists()

    def test_a_reference_cannot_be_posted_twice(self, rnd):
        LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP21")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                LedgerEntry.post(rnd, COLLECTION_IN, entry_type="collection", reference="MP21")


# --------------------------------------------------------------------------
# Audit trail. AT1, AT4
# --------------------------------------------------------------------------


class TestAuditTrail:
    def test_records_who_did_what_from_where_to_where(self, admin, rnd):
        event = AuditEvent.record(
            actor=admin, action="round.opened", target=rnd, to_state="open",
        )
        assert event.actor_id == admin.id
        assert event.action == "round.opened"
        assert event.to_state == "open"
        assert event.actor_role == "member"

    def test_an_audit_event_cannot_be_edited(self, admin, rnd):
        event = AuditEvent.record(actor=admin, action="round.opened", target=rnd, to_state="open")
        event.reason = "rewriting history"
        with pytest.raises(ValidationError):
            event.save()

    def test_an_audit_event_cannot_be_deleted(self, admin, rnd):
        event = AuditEvent.record(actor=admin, action="round.opened", target=rnd, to_state="open")
        with pytest.raises(ValidationError):
            event.delete()

    def test_a_system_action_needs_no_actor(self, rnd):
        event = AuditEvent.record(actor=None, action="payout.completed", target=rnd, to_state="completed")
        assert event.actor is None
        assert event.actor_role == "system"

    def test_an_event_survives_the_actor_account_being_irrelevant(self, admin, rnd):
        event = AuditEvent.record(actor=admin, action="round.opened", target=rnd, to_state="open")
        assert AuditEvent.objects.filter(pk=event.pk).exists()

    def test_an_event_about_a_contribution_lands_in_the_group_feed(self, rnd):
        # The feed is filtered by group. An event whose group failed to resolve is invisible
        # to the very members it concerns, which is worse than not recording it at all.
        from susu.models import Contribution

        membership = Membership.objects.get(pk=rnd.roster_snapshot[0]["membership_id"])
        contribution = Contribution.objects.create(
            round=rnd, membership=membership, amount_pesewas=10000,
            provider="mtn_momo", reference="MP-G1", status=Contribution.Status.VERIFIED,
        )
        event = AuditEvent.record(actor=None, action="contribution.recorded", target=contribution)

        assert event.group_id == rnd.group_id
        assert AuditEvent.objects.filter(group_id=rnd.group_id, pk=event.pk).exists()