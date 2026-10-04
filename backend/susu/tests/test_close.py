"""
Closing a round, and carrying what is left into the next one.

A round ends exactly once. The outcome is decided at that moment and never revisited, because
the alternative is a pot whose total changes depending on when you looked at it. R5.

Two things happen at close that have nowhere else to happen:

  Debt is booked. The shortfall is charged to the members who did not pay, capped at their own
  frozen shares, before the round stops being open. Booking it afterwards would mean a closed
  round still accruing obligations.

  The float is recorded and carried. Money that was collected and not paid out stays in the
  collection account belonging to the group, and reduces what the group needs to collect next
  round. Z2. Spending it twice, or letting it evaporate, is the defect this replaces.

This file also covers the conservation check itself, including the assertion that it can fail.
A residual check that is a tautology reports zero forever and is worse than no check at all,
because it looks like evidence.

Rule IDs: 1791027903-money-handling-and-safeguards.md Z1, Z2, Z2a, Z7, R3, R5, D2
           1791026719-growth-business-logic.md          R4, R5, R9, D2
"""

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from accounts.models import Account
from susu.models import (
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
        name="Close Susu", target_pesewas=30000, collection_day=5,
        admin=admin, invite_code="CLO001",
    )


@pytest.fixture
def rnd(group):
    for index, number in enumerate(["+233201000002", "+233201000003", "+233201000004"]):
        person = Account.objects.create_user(phone=number, password="pw")
        Membership.objects.create(group=group, account=person, order=index + 2)
    round_ = Round.open_current(group)
    expire(round_)
    return round_


def expire(round_, days=1):
    """Put a round past its collection day without waiting for it."""
    round_.due_at = timezone.now() - timezone.timedelta(days=days)
    round_.save(update_fields=["due_at"])
    return round_


def membership_at(round_, order):
    return Membership.objects.get(group=round_.group, order=order)


def pay(round_, order, amount, reference):
    return pay_as(round_, membership_at(round_, order), amount, reference)


def pay_as(round_, membership, amount, reference):
    return Contribution.record(
        round_, membership, amount_pesewas=amount, reference=reference
    ).mark_verified()


def pay_everyone_but(round_, skip_orders):
    shares = {entry["order"]: entry["share_pesewas"] for entry in round_.roster_snapshot}
    for order, share in shares.items():
        if order in skip_orders:
            continue
        pay(round_, order, share, f"CLO-{order}")


def fund_completely(round_):
    shares = {entry["order"]: entry["share_pesewas"] for entry in round_.roster_snapshot}
    for order, share in shares.items():
        pay(round_, order, share, f"CLOF-{order}")


# --------------------------------------------------------------------------
# The outcome is decided once (R5)
# --------------------------------------------------------------------------


class TestClosingOnce:
    def test_a_short_round_closes_as_short(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})

        rnd.close()

        assert rnd.outcome == Round.Outcome.SHORT
        assert rnd.closed_at is not None

    def test_a_round_cannot_be_closed_twice(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.close()

        with pytest.raises(ValidationError):
            rnd.close()

    def test_a_met_round_may_not_be_closed_until_the_payout_has_run(self, rnd):
        # Closing a met round as short would book debt from members who already paid, and
        # closing it as paid would claim money was handed over when nobody received it.
        fund_completely(rnd)

        with pytest.raises(ValidationError):
            rnd.close()
        assert rnd.outcome == Round.Outcome.OPEN

    def test_a_round_cannot_be_closed_before_its_due_date(self, rnd):
        # Otherwise a member closes a round early to escape paying it.
        rnd.due_at = timezone.now() + timezone.timedelta(days=3)
        rnd.save(update_fields=["due_at"])
        pay_everyone_but(rnd, skip_orders={3, 4})

        with pytest.raises(ValidationError):
            rnd.close()
        assert rnd.outcome == Round.Outcome.OPEN

    def test_a_disputed_payment_blocks_the_close(self, rnd):
        # The total is not yet a fact, so the outcome cannot be. Closing now would decide the
        # round on a number that is still moving.
        pay_everyone_but(rnd, skip_orders={3, 4})
        flagged = Contribution.objects.filter(round=rnd, status="verified").first()
        flagged.status = Contribution.Status.FLAGGED
        flagged.save()

        with pytest.raises(ValidationError):
            rnd.close()
        assert rnd.outcome == Round.Outcome.OPEN

    def test_a_payout_in_flight_blocks_the_close(self, rnd):
        fund_completely(rnd)
        rnd.payout()

        with pytest.raises(ValidationError):
            rnd.close()

    def test_closing_books_the_debt_in_the_same_moment(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})

        rnd.close()

        charges = {
            entry["membership_id"]: entry["charged_pesewas"]
            for entry in rnd.roster_snapshot
        }
        assert charges[membership_at(rnd, 3).pk] == 7500
        assert rnd.debt_residual() == 0

    def test_closing_a_closed_round_leaves_it_impossible_to_reopen(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.close()

        # A payout after close would move money out of a round whose books are final.
        with pytest.raises(ValidationError):
            rnd.payout()


# --------------------------------------------------------------------------
# Float is recorded and carried, never spent twice (Z2)
# --------------------------------------------------------------------------


class TestFloatCarryForward:
    def test_money_collected_and_not_paid_out_becomes_float(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})

        rnd.close()

        assert rnd.current_float_pesewas() == 15000
        assert rnd.closing_float_pesewas == 15000

    def test_the_next_round_targets_only_what_is_still_owed(self, rnd):
        # GH150 is already in the collection account. Demanding it again would ask the group
        # for money twice.
        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.close()

        following = Round.open_current(rnd.group)

        assert following.carried_float_pesewas == 15000
        assert following.target_pesewas == 15000
        assert sum(entry["share_pesewas"] for entry in following.roster_snapshot) == 15000

    def test_the_next_round_reports_the_float_it_inherited(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.close()

        following = Round.open_current(rnd.group)

        assert following.number == 2
        assert following.outcome == Round.Outcome.OPEN
        assert following.target_pesewas < rnd.target_pesewas

    def test_a_round_with_no_float_left_carries_nothing(self, rnd):
        fund_completely(rnd)
        rnd.payout().mark_completed()

        following = Round.open_current(rnd.group)

        assert rnd.closing_float_pesewas == 0
        assert following.carried_float_pesewas == 0
        assert following.target_pesewas == rnd.group.target_pesewas

    def test_the_whole_float_can_never_be_applied_away_to_nothing(self, rnd):
        # A round's target must stay above zero. So when the float is large enough to cover
        # the entire next target, only what the target can absorb is applied, and the rest
        # stays on the previous round's record rather than being deleted by the arithmetic.
        rnd.closing_float_pesewas = 99999999
        rnd.outcome = Round.Outcome.SHORT
        rnd.save()
        rnd.group.current_round = 2
        rnd.group.save(update_fields=["current_round"])

        following = Round.open_current(rnd.group)

        assert following.target_pesewas == 1
        assert following.carried_float_pesewas == 99999999
        # Still on the books, not written off by being applied.
        rnd.refresh_from_db()
        assert rnd.closing_float_pesewas == 99999999

    def test_a_reversal_after_payout_shows_as_negative_float_not_a_surplus(self, rnd):
        # The provider took back money this group had already handed over. It must be visible
        # as exposure rather than absorbed into the next round's target.
        fund_completely(rnd)
        rnd.payout().mark_completed()
        Contribution.objects.filter(round=rnd).first().mark_reversed()

        assert rnd.partner_balance_pesewas() == -7500


# --------------------------------------------------------------------------
# The conservation check must be able to fail (Z1, Z7)
# --------------------------------------------------------------------------


class TestConservationIsReal:
    def test_it_is_zero_across_the_normal_paths(self, rnd):
        assert rnd.conservation_residual() == 0

        pay_everyone_but(rnd, skip_orders={3, 4})
        assert rnd.conservation_residual() == 0

        rnd.close()
        assert rnd.conservation_residual() == 0

    def test_it_is_zero_after_a_payout_and_its_fee(self, rnd):
        fund_completely(rnd)
        rnd.payout(fee_pesewas=500).mark_completed()

        assert rnd.conservation_residual() == 0

    def test_it_is_zero_after_a_reversal_before_any_payout(self, rnd):
        contribution = pay(rnd, 2, 7500, "CLO-REV-1")
        contribution.mark_reversed()

        assert rnd.conservation_residual() == 0

    def test_it_detects_a_status_changed_without_a_posting(self, rnd):
        # The defect the whole layer exists to catch: a mutable row moved and the append-only
        # record did not. Only the ledger is independent enough to notice.
        pay(rnd, 2, 7500, "CLO-DRIFT-1")

        Contribution.objects.filter(round=rnd).update(status="reversed")

        assert rnd.conservation_residual() != 0
        assert rnd.ledger_residual_pesewas() == 0

    def test_it_detects_a_posting_without_a_status_change(self, rnd):
        LedgerEntry.post(
            rnd,
            [
                {"account": LedgerAccount.PARTNER_ACCOUNT,
                 "direction": LedgerEntry.Direction.DEBIT, "amount_pesewas": 999},
                {"account": LedgerAccount.GROUP_POT,
                 "direction": LedgerEntry.Direction.CREDIT, "amount_pesewas": 999},
            ],
            entry_type="collection", reference="CLO-GHOST-1",
        )

        assert rnd.ledger_residual_pesewas() == 0
        assert rnd.conservation_residual() != 0

    def test_a_reversal_exposure_balances_the_books_but_shows_as_a_negative_float(self, rnd):
        # Z7: the ledger and the contributions genuinely agree here — the reversal posted and
        # the status moved together — so the residual is correctly zero. What must not happen
        # is the exposure disappearing: the float goes negative and stays negative, because
        # money left to the receiver and was taken back.
        fund_completely(rnd)
        rnd.payout().mark_completed()
        Contribution.objects.filter(round=rnd).first().mark_reversed()

        assert rnd.ledger_residual_pesewas() == 0
        assert rnd.conservation_residual() == 0
        assert rnd.current_float_pesewas() == -7500

    def test_debt_never_makes_it_non_zero(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.book_debt()

        assert rnd.conservation_residual() == 0