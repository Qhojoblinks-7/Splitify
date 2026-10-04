"""
Debt, and the ways a payment stops holding a member's slot.

Two separate obligations that a round leaves behind when it does not go to plan:

  Debt   members agreed to pay and did not. A claim on future contributions, never money.
         It posts to the ledger without touching the collection account, because no cedi
         moved. Z2a.

  Release  a payment attempt that never settled and will not. The freeze rule means an
         unsettled attempt holds its member's slot, which is correct while it might still
         become money. Left with no escape, one payment the provider never confirms strands
         that member and the round permanently. D9, C-S2.

Both are the same shape of problem: a state the round can reach that nothing currently knows
how to leave.

Rule IDs: 1791027903-money-handling-and-safeguards.md Z1, Z2a, Z7, C-S1, C-S2, C-S7
           1791026719-growth-business-logic.md          D2, D5, D9
"""

import itertools

import pytest
from django.core.exceptions import ValidationError

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
        name="Debt Susu", target_pesewas=30000, collection_day=5,
        admin=admin, invite_code="DEB001",
    )


@pytest.fixture
def rnd(group):
    for index, number in enumerate(["+233201000002", "+233201000003", "+233201000004"]):
        person = Account.objects.create_user(phone=number, password="pw")
        Membership.objects.create(group=group, account=person, order=index + 2)
    return Round.open_current(group)


def membership_at(round_, order):
    return Membership.objects.get(group=round_.group, order=order)


@pytest.fixture
def build_round():
    """A fresh group with its own open round, per call.

    A group may only have one open round, so scenarios that need an untouched pot each get
    their own group rather than sharing one and leaning on a test helper that produces a
    round the domain would never accept.
    """
    created = itertools.count(1)

    def build(target_pesewas=30000):
        index = next(created)
        owner = Account.objects.create_user(phone=f"+2332020{index:05d}", password="pw")
        group = SusuGroup.objects.create_group(
            name=f"Debt {index}", target_pesewas=target_pesewas, collection_day=5,
            admin=owner, invite_code=f"DB{index:05d}",
        )
        for order in (2, 3, 4):
            person = Account.objects.create_user(
                phone=f"+2332030{index:04d}{order}", password="pw"
            )
            Membership.objects.create(group=group, account=person, order=order)
        return Round.open_current(group)

    return build


def pay(round_, order, amount, reference):
    contribution = Contribution.record(
        round_, membership_at(round_, order), amount_pesewas=amount, reference=reference
    )
    return contribution.mark_verified()


def pay_everyone_but(round_, skip_orders):
    """Verify a payment from every member except those named."""
    shares = {entry["order"]: entry["share_pesewas"] for entry in round_.roster_snapshot}
    for order, share in shares.items():
        if order in skip_orders:
            continue
        pay(round_, order, share, f"DEB-{order}")


# --------------------------------------------------------------------------
# Debt is booked from what actually arrived (D2, Z2a)
# --------------------------------------------------------------------------


class TestDebtBooking:
    def test_a_fully_paid_round_books_no_debt(self, rnd):
        pay_everyone_but(rnd, skip_orders=set())

        assert rnd.book_debt()["charged"] == {}
        assert rnd.debt_residual() == 0

    def test_debt_is_proportional_to_the_shares_that_were_owed(self, rnd):
        # Two of four members pay. The two who did not owe the two shares that are missing,
        # split between them in proportion to those shares.
        pay_everyone_but(rnd, skip_orders={3, 4})

        charged = rnd.book_debt()["charged"]

        assert charged == {membership_at(rnd, 3).pk: 7500, membership_at(rnd, 4).pk: 7500}

    def test_debt_always_sums_to_exactly_the_shortfall(self, build_round):
        # Never a pesewa more and never a pesewa less. The indivisible cedi has to land
        # somewhere specific or the debt identity breaks by rounding.
        for skip in ({3}, {4}, {3, 4}, {2, 3}):
            round_ = build_round()
            shares = {e["order"]: e["share_pesewas"] for e in round_.roster_snapshot}
            for order, share in shares.items():
                if order not in skip:
                    pay(round_, order, share, f"DEB2-{order}")

            charged = round_.book_debt()["charged"]
            assert sum(charged.values()) == round_.shortfall_pesewas(), skip

    def test_no_member_is_charged_more_than_their_own_share(self, rnd):
        # A member can owe at most what their frozen share was. Anything beyond that is the
        # group inventing a debt nobody agreed to.
        pay_everyone_but(rnd, skip_orders={2, 3, 4})

        charged = rnd.book_debt()["charged"]
        shares = {entry["membership_id"]: entry["share_pesewas"] for entry in rnd.roster_snapshot}

        for membership_id, amount in charged.items():
            assert amount <= shares[membership_id]

    def test_debt_is_capped_at_what_the_remaining_members_can_owe(self, rnd):
        # One member verified a partial payment, so the gap is larger than the three untouched
        # shares can absorb. This is the only shape in which the cap actually binds, and it is
        # the case that matters: charging beyond a member's own share would be the group
        # inventing a debt nobody agreed to. The remainder stays visible as a residual.
        pay(rnd, 2, 1000, "DEB-CAP-1")

        charged = rnd.book_debt()["charged"]

        assert rnd.shortfall_pesewas() == 29000
        assert sum(charged.values()) == 22500
        assert rnd.debt_residual() == 6500

        shares = {entry["membership_id"]: entry["share_pesewas"] for entry in rnd.roster_snapshot}
        for membership_id, amount in charged.items():
            assert amount <= shares[membership_id]

    def test_the_shortfall_is_covered_exactly_when_everyone_owes_their_whole_share(self, rnd):
        pay_everyone_but(rnd, skip_orders={1, 2, 3, 4})

        charged = rnd.book_debt()["charged"]

        assert rnd.shortfall_pesewas() == 30000
        assert sum(charged.values()) == 30000
        assert rnd.debt_residual() == 0

    def test_the_charge_is_written_into_the_frozen_snapshot(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.book_debt()

        charges = {
            entry["membership_id"]: entry["charged_pesewas"]
            for entry in rnd.roster_snapshot
        }
        assert charges[membership_at(rnd, 3).pk] == 7500
        assert charges[membership_at(rnd, 2).pk] == 0

    def test_debt_residual_reaches_zero_once_it_is_booked(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})
        assert rnd.debt_residual() == 15000

        rnd.book_debt()

        assert rnd.debt_residual() == 0

    def test_debt_is_never_negative(self, build_round):
        # The invariant, checked across the whole range of outcomes rather than one case:
        # 0 <= residual. Zero collected, partial, exactly met, and over-collected.
        cases = [
            {},
            {2: 1000},
            {2: 7500},
            {2: 15000},
            {2: 7500, 3: 7500},
            {2: 10000, 3: 10000, 4: 10000},
            {2: 15000, 3: 15000, 4: 10000},
            {2: 7500, 3: 7500, 4: 7500},
        ]
        for payments in cases:
            round_ = build_round()
            for order, amount in payments.items():
                pay(round_, order, amount, f"DEB3-{order}-{amount}")

            round_.book_debt()
            assert round_.debt_residual() >= 0, payments

    def test_debt_posts_balanced_legs(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.book_debt()

        assert rnd.ledger_residual_pesewas() == 0
        assert rnd.account_balance_pesewas(LedgerAccount.DEBT_RECEIVABLE) == 15000
        assert rnd.account_balance_pesewas(LedgerAccount.MEMBER_PAYABLE) == 15000

    def test_debt_does_not_touch_the_money(self, rnd):
        # A claim, not a cedi. If debt moved the collection account the float would shrink by
        # money that never left, and the member would be told they have less than they do.
        pay_everyone_but(rnd, skip_orders={3, 4})
        partner_before = rnd.partner_balance_pesewas()
        pot_before = rnd.account_balance_pesewas(LedgerAccount.GROUP_POT)

        rnd.book_debt()

        assert rnd.partner_balance_pesewas() == partner_before
        assert rnd.account_balance_pesewas(LedgerAccount.GROUP_POT) == pot_before
        assert rnd.conservation_residual() == 0

    def test_booking_the_same_state_twice_posts_nothing(self, rnd):
        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.book_debt()
        postings_before = LedgerEntry.objects.count()

        rnd.book_debt()

        assert LedgerEntry.objects.count() == postings_before
        assert rnd.debt_residual() == 0

    def test_a_late_payment_clears_that_members_charge(self, rnd):
        # The member eventually pays. The debt must go with them, or the group chases money
        # that has already been collected and the identity goes negative.
        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.book_debt()
        assert rnd.debt_residual() == 0

        pay(rnd, 3, 7500, "DEB-LATE-1")
        charged = rnd.book_debt()["charged"]

        assert membership_at(rnd, 3).pk not in charged
        assert rnd.debt_residual() == 0
        assert rnd.account_balance_pesewas(LedgerAccount.DEBT_RECEIVABLE) == 7500

    def test_debt_survives_the_cycle_on_the_membership(self, rnd):
        # D5: debt belongs to the person, not to the round. It carries into the next cycle.
        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.book_debt()

        membership = membership_at(rnd, 3)
        membership.refresh_from_db()
        assert membership.debt_pesewas == 7500

    def test_debt_is_only_booked_against_an_open_round(self, rnd):
        rnd.outcome = Round.Outcome.SHORT
        rnd.save()

        with pytest.raises(ValidationError):
            rnd.book_debt()

    def test_booking_debt_is_visible_in_the_audit_trail(self, rnd, admin):
        from susu.models import AuditEvent

        pay_everyone_but(rnd, skip_orders={3, 4})
        rnd.book_debt(actor=admin)

        actions = list(
            AuditEvent.objects.filter(group=rnd.group).values_list("action", flat=True)
        )
        assert "round.debt_booked" in actions


# --------------------------------------------------------------------------
# A payment that never settles must not strand its member (C-S2, D9)
# --------------------------------------------------------------------------


class TestReleasingAnUnsettledPayment:
    def test_a_failed_payment_posts_no_money(self, rnd):
        contribution = Contribution.record(
            rnd, membership_at(rnd, 2), amount_pesewas=7500, reference="REL-1"
        )
        contribution.mark_failed(reason="The provider never confirmed the transaction")

        assert contribution.status == Contribution.Status.FAILED
        assert rnd.partner_balance_pesewas() == 0
        assert rnd.ledger_residual_pesewas() == 0

    def test_a_failed_payment_releases_the_member_slot(self, rnd):
        contribution = Contribution.record(
            rnd, membership_at(rnd, 2), amount_pesewas=7500, reference="REL-2"
        )
        contribution.mark_failed(reason="Provider timeout")

        assert rnd.open_slot_for(contribution.membership) is None
        again = Contribution.record(
            rnd, membership_at(rnd, 2), amount_pesewas=7500, reference="REL-2b"
        )
        assert again.status == Contribution.Status.PENDING

    def test_a_voided_payment_releases_the_member_slot(self, rnd):
        # A member who logged the wrong amount and cancelled it themselves.
        contribution = Contribution.record(
            rnd, membership_at(rnd, 2), amount_pesewas=7500, reference="REL-3"
        )
        contribution.mark_void(reason="Wrong amount entered")

        assert contribution.status == Contribution.Status.VOID
        assert rnd.open_slot_for(contribution.membership) is None

    def test_a_verified_payment_can_neither_fail_nor_be_voided(self, rnd):
        # Money already arrived. Releasing the slot without reversing the money would let a
        # member walk away from a payment that was collected from them.
        contribution = pay(rnd, 2, 7500, "REL-4")

        with pytest.raises(ValidationError):
            contribution.mark_failed(reason="too late")
        with pytest.raises(ValidationError):
            contribution.mark_void(reason="too late")

        assert rnd.partner_balance_pesewas() == 7500

    def test_a_reversed_payment_can_neither_fail_nor_be_voided(self, rnd):
        contribution = pay(rnd, 2, 7500, "REL-5")
        contribution.mark_reversed()

        with pytest.raises(ValidationError):
            contribution.mark_failed(reason="no")
        with pytest.raises(ValidationError):
            contribution.mark_void(reason="no")

    def test_a_failed_payment_cannot_be_verified_afterwards(self, rnd):
        # Otherwise money could arrive for an attempt already written off, and the ledger
        # would carry a collection with no counted attempt behind it.
        contribution = Contribution.record(
            rnd, membership_at(rnd, 2), amount_pesewas=7500, reference="REL-6"
        )
        contribution.mark_failed(reason="never confirmed")

        with pytest.raises(ValidationError):
            contribution.mark_verified()
        assert rnd.partner_balance_pesewas() == 0

    def test_releasing_records_its_reason_and_who_did_it(self, rnd, admin):
        from susu.models import AuditEvent

        contribution = Contribution.record(
            rnd, membership_at(rnd, 2), amount_pesewas=7500, reference="REL-7"
        )
        contribution.mark_failed(reason="Provider never confirmed", actor=admin)

        assert "never confirmed" in contribution.failure_reason

        event = AuditEvent.objects.filter(
            group=rnd.group, action="contribution.failed"
        ).latest("id")
        assert event.actor_id == admin.pk
        assert event.from_state == "pending"
        assert event.to_state == "failed"

    def test_releasing_twice_is_refused(self, rnd):
        contribution = Contribution.record(
            rnd, membership_at(rnd, 2), amount_pesewas=7500, reference="REL-8"
        )
        contribution.mark_failed(reason="once")

        with pytest.raises(ValidationError):
            contribution.mark_failed(reason="twice")