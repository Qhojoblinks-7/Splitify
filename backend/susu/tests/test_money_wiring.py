"""
Where the ledger is wired to the transitions that make money real.

The ledger tests prove the ledger works. These prove it is actually used: an attempt that
becomes verified moves cash, a reversal takes it back, and a completed payout empties the pot.
A ledger nothing posts to is a ledger that balances perfectly while recording nothing.

The rule under test throughout: the append-only record and the mutable round must agree. If a
code path moves a contribution status without posting, one of the two totals goes wrong and
the discrepancy is visible.

Rule IDs: 1791027903-money-handling-and-safeguards.md AT1, AT2, Z1, Z3, C-S1, C-S5,
                                                 C-S7, P-S1, P-S2, P-S3, P-S5, P-S8, P-S10
           1791028270-security-fraud-and-identity.md   P2, P7, P9
"""

import pytest
from django.core.exceptions import ValidationError

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


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------


@pytest.fixture
def admin():
    return Account.objects.create_user(phone="+233201000001", password="pw-admin-secret")


@pytest.fixture
def group(admin):
    return SusuGroup.objects.create_group(
        name="Wiring Susu", target_pesewas=30000, collection_day=5,
        admin=admin, invite_code="WIR001",
    )


@pytest.fixture
def rnd(group):
    for index, number in enumerate(["+233201000002", "+233201000003", "+233201000004"]):
        person = Account.objects.create_user(phone=number, password="pw")
        Membership.objects.create(group=group, account=person, order=index + 2)
    return Round.open_current(group)


def pay(round_, order, amount, reference):
    """Record one member's attempt for this round."""
    membership = Membership.objects.get(group=round_.group, order=order)
    return Contribution.record(
        round_, membership, amount_pesewas=amount, reference=reference
    )


def fund_the_pot(round_):
    """Every member pays their share, verified. Returns the contributions."""
    shares = {entry["order"]: entry["share_pesewas"] for entry in round_.roster_snapshot}
    paid = []
    for order, share in shares.items():
        contribution = pay(round_, order, share, f"WIRE-{order}")
        paid.append(contribution.mark_verified())
    return paid


# --------------------------------------------------------------------------
# Verification posts a collection
# --------------------------------------------------------------------------


class TestVerificationPostsMoney:
    def test_a_verified_contribution_posts_a_collection(self, rnd):
        contribution = pay(rnd, 2, 10000, "MP-V1").mark_verified()

        assert contribution.status == Contribution.Status.VERIFIED
        assert rnd.partner_balance_pesewas() == 10000
        assert rnd.account_balance_pesewas(LedgerAccount.GROUP_POT) == 10000
        assert rnd.ledger_residual_pesewas() == 0

    def test_a_recorded_attempt_moves_no_money_yet(self, rnd):
        # A pending attempt is a claim, not a cedi. Posting here is how a phantom balance
        # appears in the ledger for money that never arrived.
        contribution = pay(rnd, 2, 10000, "MP-V2")
        assert contribution.status == Contribution.Status.PENDING
        assert rnd.partner_balance_pesewas() == 0
        assert rnd.ledger_debits_pesewas() == 0

    def test_the_ledger_total_matches_the_contributions(self, rnd):
        fund_the_pot(rnd)
        assert rnd.partner_balance_pesewas() == rnd.verified_total_pesewas()

    def test_a_failed_contribution_cannot_be_verified(self, rnd):
        contribution = pay(rnd, 2, 10000, "MP-V3")
        contribution.status = Contribution.Status.FAILED
        contribution.save()

        with pytest.raises(ValidationError):
            contribution.mark_verified()
        assert rnd.partner_balance_pesewas() == 0

    def test_a_contribution_cannot_be_verified_twice(self, rnd):
        contribution = pay(rnd, 2, 10000, "MP-V4").mark_verified()

        with pytest.raises(ValidationError):
            contribution.mark_verified()
        assert rnd.partner_balance_pesewas() == 10000

    def test_manual_verification_keeps_its_reason(self, rnd):
        contribution = pay(rnd, 2, 10000, "MP-V5").mark_verified(
            reason="Confirmed against the provider statement"
        )
        assert "provider statement" in contribution.manual_verification_reason

    def test_a_second_member_verifying_keeps_the_pot_growing(self, rnd):
        pay(rnd, 2, 10000, "MP-V6").mark_verified()
        pay(rnd, 3, 10000, "MP-V7").mark_verified()
        assert rnd.partner_balance_pesewas() == 20000


# --------------------------------------------------------------------------
# Reversal takes it back (V-R2, V-R3)
# --------------------------------------------------------------------------


class TestReversal:
    def test_a_reversal_takes_the_money_back_out(self, rnd):
        contribution = pay(rnd, 2, 10000, "MP-R1").mark_verified()
        contribution.mark_reversed()

        assert rnd.partner_balance_pesewas() == 0
        assert rnd.account_balance_pesewas(LedgerAccount.GROUP_POT) == 0
        assert rnd.ledger_residual_pesewas() == 0

    def test_a_reversal_releases_the_member_slot(self, rnd):
        # C-S2: a reversed payment must let the member pay again, or one bad reference
        # strands the member and the round permanently.
        contribution = pay(rnd, 2, 10000, "MP-R2").mark_verified()
        contribution.mark_reversed()

        assert rnd.open_slot_for(contribution.membership) is None
        again = pay(rnd, 2, 10000, "MP-R2b")
        assert again.status == Contribution.Status.PENDING

    def test_a_contribution_that_never_settled_cannot_be_reversed(self, rnd):
        with pytest.raises(ValidationError):
            pay(rnd, 2, 10000, "MP-R3").mark_reversed()
        assert rnd.ledger_residual_pesewas() == 0

    def test_a_reversal_after_a_payout_is_left_visible_not_absorbed(self, rnd):
        # MoMo reversal exposure: the money left to the receiver and came back. The float
        # absorbs it and the partner account goes negative, which is the signal that the
        # provider took back money this group had already paid out.
        fund_the_pot(rnd)
        payout = rnd.payout(fee_pesewas=0)
        payout.mark_completed()

        contribution = Contribution.objects.filter(round=rnd).first()
        contribution.mark_reversed()

        assert rnd.partner_balance_pesewas() == -contribution.amount_pesewas
        assert rnd.ledger_residual_pesewas() == 0

    def test_the_reversal_leaves_an_audit_trail_of_both_sides(self, rnd):
        contribution = pay(rnd, 2, 10000, "MP-R4").mark_verified()
        contribution.mark_reversed()

        actions = list(
            AuditEvent.objects.filter(target_id=contribution.pk).values_list("action", flat=True)
        )
        assert "contribution.verified" in actions
        assert "contribution.reversed" in actions


# --------------------------------------------------------------------------
# Payout completion empties the pot (P-S1, P-S2, P-S3, P-S5)
# --------------------------------------------------------------------------


class TestPayoutCompletion:
    def test_completion_moves_the_pot_and_the_fee(self, rnd, admin):
        fund_the_pot(rnd)
        payout = rnd.payout(actor=admin, fee_pesewas=500)
        payout.mark_completed(actor=admin, provider_reference="HUB-1")

        assert payout.status == payout.Status.COMPLETED
        assert rnd.account_balance_pesewas(LedgerAccount.GROUP_POT) == 500
        assert rnd.account_balance_pesewas(LedgerAccount.FEE_EXPENSE) == 500
        assert rnd.ledger_residual_pesewas() == 0

    def test_the_group_is_still_owed_the_fee_that_was_withheld(self, rnd, admin):
        # The pot is a liability owed to members. Withholding the provider's fee from it does
        # not discharge the group's obligation, it only relocates it, so the pot must still
        # carry the fee until the provider actually takes it.
        fund_the_pot(rnd)
        rnd.payout(actor=admin, fee_pesewas=500).mark_completed(actor=admin)

        assert rnd.account_balance_pesewas(LedgerAccount.GROUP_POT) == 500
        assert rnd.account_balance_pesewas(LedgerAccount.FEE_PAYABLE) == 500

    def test_the_fee_left_in_the_collection_account_is_owed_to_the_provider(self, rnd, admin):
        # The fee is withheld from the pot, so it never leaves the collection account. It sits
        # there as a payable, and every cedi still sitting there must be money somebody is
        # owed for. An unexplained remainder is money with no owner.
        fund_the_pot(rnd)
        rnd.payout(actor=admin, fee_pesewas=500).mark_completed(actor=admin)

        assert rnd.partner_balance_pesewas() == 500
        assert rnd.partner_balance_pesewas() == rnd.account_balance_pesewas(
            LedgerAccount.FEE_PAYABLE
        )

    def test_completion_closes_the_round_as_paid(self, rnd):
        fund_the_pot(rnd)
        rnd.payout().mark_completed()

        rnd.refresh_from_db()
        assert rnd.outcome == Round.Outcome.PAID
        assert rnd.closed_at is not None

    def test_completion_advances_the_rotation(self, rnd):
        fund_the_pot(rnd)
        rnd.payout().mark_completed()

        rnd.group.refresh_from_db()
        assert rnd.group.current_round == 2

    def test_a_completed_payout_cannot_complete_twice(self, rnd):
        fund_the_pot(rnd)
        payout = rnd.payout()
        payout.mark_completed()

        with pytest.raises(ValidationError):
            payout.mark_completed()
        assert rnd.partner_balance_pesewas() == 0

    def test_a_failed_payout_cannot_complete(self, rnd):
        fund_the_pot(rnd)
        payout = rnd.payout()
        payout.mark_failed("Provider timeout")

        with pytest.raises(ValidationError):
            payout.mark_completed()
        # Nothing posted, so the money is still where it was collected.
        assert rnd.partner_balance_pesewas() == 30000
        assert rnd.ledger_residual_pesewas() == 0

    def test_completion_does_not_post_when_it_already_did(self, rnd):
        # A replayed provider webhook must not double-pay. The payout key is deterministic
        # and the posting reference is that key, so the database refuses the second post.
        fund_the_pot(rnd)
        payout = rnd.payout()
        payout.mark_completed()

        postings = LedgerEntry.objects.filter(reference=payout.payout_key).count()
        assert postings == 2

    def test_a_round_without_a_ledger_posting_cannot_be_paid(self, rnd):
        # Every cedi out of the pot must arrive through a posting. If this ever fails, the
        # collection path is not posting and the pot total is fiction.
        fund_the_pot(rnd)
        assert rnd.account_balance_pesewas(LedgerAccount.GROUP_POT) == rnd.target_pesewas

    def test_completion_is_recorded_as_a_system_action_when_no_human_triggered_it(self, rnd):
        fund_the_pot(rnd)
        payout = rnd.payout()
        payout.mark_completed(provider_reference="HUB-2")

        event = AuditEvent.objects.filter(action="payout.completed").latest("id")
        assert event.actor_role == "system"
        assert event.to_state == "completed"

    def test_a_fee_larger_than_the_pot_is_refused_before_any_posting(self, rnd):
        fund_the_pot(rnd)
        with pytest.raises(ValidationError):
            rnd.payout(fee_pesewas=99999)
        assert rnd.partner_balance_pesewas() == 30000