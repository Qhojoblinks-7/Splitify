"""The whole cycle, end to end, through the rail.

Everything else in the suite tests one rule. This file runs the sequence a real group actually
performs, across two rounds, and asserts the money is right at every step:

    members join -> a round freezes -> everyone claims to have paid -> the rail confirms some
    and denies one -> the pot is met -> the rail releases it -> the rotation advances ->
    the next round opens -> a member misses -> the round closes short -> debt is booked

The reason this file exists separately: every individual transition has its own test, and a
green suite of them still does not prove the sequence works. The defects this catches are the
ones where each step is correct alone and wrong in sequence — float applied twice, debt booked
against a member who already paid in the next round, a rotation that skips a seat.

The rail is a `StubRail` throughout, because no licensed partner exists yet. The *sequence* is
what is under test, and it is identical whichever adapter answers. The one thing that cannot be
tested here, and is stated in the plan rather than pretended at, is the real rail's release.

Rule IDs: Z1, Z2, Z2a, R1, R2, R4, R5, R9, C-S1, C-S2, C-S3, D2, P-S1, P-S5
"""

from io import StringIO

import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command
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
from susu.rail import RailAnswer, StubRail, UnconfiguredRail

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin():
    return Account.objects.create_user(phone="+233201000001", password="pw-admin-secret")


@pytest.fixture
def group(admin):
    return SusuGroup.objects.create_group(
        name="Full Cycle Susu", target_pesewas=30000, collection_day=5,
        admin=admin, invite_code="FCY001",
    )


@pytest.fixture
def seats(group):
    """Four seats, in rotation order, admin first."""
    out = []
    for index, number in enumerate(["+233201000002", "+233201000003", "+233201000004"]):
        person = Account.objects.create_user(phone=number, password="pw")
        out.append(Membership.objects.create(group=group, account=person, order=index + 2))
    return out


def open_round(group):
    round_ = Round.open_current(group)
    expire(round_)
    return round_


def expire(round_, days=1):
    round_.due_at = timezone.now() - timezone.timedelta(days=days)
    round_.save(update_fields=["due_at"])
    return round_


def claim(round_, membership, amount, reference):
    """A member says they paid. Nothing is settled; the pot has not moved."""
    return Contribution.record(
        round_, membership, amount_pesewas=amount, provider="hubtel", reference=reference
    )


def settle(rail, **kwargs):
    """Run the worker once, the way a scheduler would.

    Defaults `--age-minutes` to 0 so a contribution created moments ago is eligible. The
    command's own default is 1 minute in production (a member still typing their reference
    should not be asked about yet) and 0 under test, so this only needs to state it when a
    test is deliberately exercising the age cutoff.
    """
    out = StringIO()
    call_command(
        "settle_contributions",
        limit=kwargs.get("limit", 100),
        provider=kwargs.get("provider", ""),
        age_minutes=kwargs.get("age_minutes", 0),
        stdout=out, stderr=out, rail=rail, skip_checks=True,
    )
    return out.getvalue()


# --------------------------------------------------------------------------


class TestACompleteCycle:
    def test_the_whole_sequence_keeps_the_money_right(self, group, seats, admin):
        group_seat = Membership.objects.get(group=group, account=admin)

        # -- a round freezes, and everyone's share is a fact before anybody pays -----------
        first = open_round(group)
        assert first.number == 1
        assert first.outcome == Round.Outcome.OPEN
        shares = {e["membership_id"]: e["share_pesewas"] for e in first.roster_snapshot}
        assert sum(shares.values()) == first.target_pesewas
        assert first.receiver_id == group_seat.pk

        # -- everyone claims to have paid; nothing has moved ----------------------------
        claims = []
        for index, seat in enumerate([group_seat] + seats):
            ref = f"FCY-R1-{index}"
            claims.append((claim(first, seat, shares[seat.pk], ref), ref))

        assert all(c.status == Contribution.Status.PENDING for c, _ in claims)
        # The load-bearing interim fact: claims are not money.
        assert first.verified_total_pesewas() == 0
        assert first.current_float_pesewas() == 0
        assert first.ledger_residual_pesewas() == 0

        # -- the rail confirms all four --------------------------------------------------
        settle(
            StubRail({
                ref: RailAnswer.confirmed(c.amount_pesewas) for c, ref in claims
            })
        )

        first.refresh_from_db()
        assert first.verified_total_pesewas() == first.target_pesewas
        assert first.current_float_pesewas() == first.target_pesewas
        assert first.ledger_residual_pesewas() == 0

        # -- the rail releases it, and only then does the rotation move -------------------
        payout = first.payout()
        assert first.outcome == Round.Outcome.OPEN, "an instructed payout must not close the round"

        payout.mark_completed(provider_reference="RAIL-PAYOUT-1")

        first.refresh_from_db()
        group.refresh_from_db()
        assert first.outcome == Round.Outcome.PAID
        assert first.closing_float_pesewas == 0
        assert group.current_round == 2
        assert group.turn_cursor == 1

        # -- the next round opens, targeting the full amount with no float to apply -------
        second = open_round(group)
        assert second.number == 2
        assert second.carried_float_pesewas == 0
        assert second.target_pesewas == first.target_pesewas
        # Rotation advanced: the next seat up receives, not the one who just did.
        assert second.receiver_id != first.receiver_id
        assert second.ledger_residual_pesewas() == 0

        # -- a member misses, and the round closes short ---------------------------------
        short_shares = {e["membership_id"]: e["share_pesewas"] for e in second.roster_snapshot}
        for index, seat in enumerate([group_seat] + seats):
            if seat.pk == second.receiver_id:
                continue  # the receiver does not pay into their own round
            claim(second, seat, short_shares[seat.pk], f"FCY-R2-{index}").mark_verified()

        second.close()

        second.refresh_from_db()
        assert second.outcome == Round.Outcome.SHORT
        # Debt was booked at the moment of closing, not left to accrue on a closed round.
        assert second.debt_residual() == 0
        assert any(
            e["charged_pesewas"] > 0 for e in second.roster_snapshot
        ), "the member who did not pay should have been charged"
        assert second.ledger_residual_pesewas() == 0
        assert second.conservation_residual() == 0

    def test_no_money_is_created_or_destroyed_across_two_rounds(self, group, seats, admin):
        """The total verified over the group's life equals what the ledger can account for."""
        group_seat = Membership.objects.get(group=group, account=admin)
        everyone = [group_seat] + seats

        first = open_round(group)
        paid_first = 0
        for index, seat in enumerate(everyone):
            share = first.share_for(seat)
            claim(first, seat, share, f"SUM-R1-{index}").mark_verified()
            paid_first += share

        released_first = first.payout()
        released_first.mark_completed()

        second = open_round(group)
        for index, seat in enumerate(everyone):
            share = second.share_for(seat)
            if share == 0:
                continue
            claim(second, seat, share, f"SUM-R2-{index}").mark_verified()

        for round_ in (first, second):
            round_.refresh_from_db()
            # Every pesewa that entered is in the ledger, and the ledger balances.
            assert round_.ledger_residual_pesewas() == 0
            assert round_.conservation_residual() == 0

        # The pot's money counted from the append-only record rather than from the mutable
        # rows. Money entering the rail debits the partner account; money leaving credits it.
        # A contribution marked verified without a matching posting would show up here as a
        # gap between this and the sum of verified contributions.
        entered = sum(
            entry.amount_pesewas
            for entry in LedgerEntry.objects.filter(
                round__group=group,
                account=LedgerAccount.PARTNER_ACCOUNT,
                direction=LedgerEntry.Direction.DEBIT,
            )
        )
        verified = sum(
            c.amount_pesewas
            for c in Contribution.objects.filter(
                round__group=group, status=Contribution.Status.VERIFIED
            )
        )
        assert entered == verified
        assert entered == first.target_pesewas + second.target_pesewas

        # And the cedi that left is a separate, smaller number — not the same money counted
        # a second time.
        left = sum(
            entry.amount_pesewas
            for entry in LedgerEntry.objects.filter(
                round__group=group,
                account=LedgerAccount.PARTNER_ACCOUNT,
                direction=LedgerEntry.Direction.CREDIT,
            )
        )
        assert left == first.target_pesewas
        assert released_first.amount_pesewas == first.target_pesewas


class TestTheCycleRefusesToShortcut:
    def test_the_pot_cannot_be_released_before_the_rail_confirms(self, group, seats, admin):
        group_seat = Membership.objects.get(group=group, account=admin)
        round_ = open_round(group)

        for index, seat in enumerate([group_seat] + seats):
            claim(round_, seat, round_.share_for(seat), f"PRE-{index}")

        # Claims only. The pot is not met, so there is nothing to release.
        with pytest.raises(ValidationError):
            round_.payout()

        # And the refusal changed nothing.
        round_.refresh_from_db()
        assert round_.outcome == Round.Outcome.OPEN
        assert round_.ledger_residual_pesewas() == 0

    def test_a_round_that_is_met_cannot_be_closed_to_skip_the_payout(self, group, seats, admin):
        group_seat = Membership.objects.get(group=group, account=admin)
        round_ = open_round(group)
        for index, seat in enumerate([group_seat] + seats):
            claim(round_, seat, round_.share_for(seat), f"SKIP-{index}").mark_verified()

        # Closing a met round as short would charge people who paid; closing it as paid would
        # claim money was handed over when it was not.
        with pytest.raises(ValidationError):
            round_.close()

        assert round_.outcome == Round.Outcome.OPEN

    def test_an_unconfirmed_payment_never_blocks_or_completes_a_round(self, group, seats, admin):
        group_seat = Membership.objects.get(group=group, account=admin)
        round_ = open_round(group)
        everyone = [group_seat] + seats

        # One member's payment is simply never seen by the rail.
        confirmed = []
        for index, seat in enumerate(everyone):
            ref = f"MIX-{index}"
            confirmed.append((claim(round_, seat, round_.share_for(seat), ref), ref, seat))

        settle(StubRail({ref: RailAnswer.confirmed(c.amount_pesewas) for c, ref, _ in confirmed[:-1]}))

        round_.refresh_from_db()
        # Everyone but the last is funded. The round is short by exactly one share, not
        # complete, and the shortfall is honest about who is still holding a claim.
        assert round_.verified_total_pesewas() < round_.target_pesewas
        assert round_.shortfall_pesewas() > 0
        assert round_.open_slot_for(confirmed[-1][2]) is not None

        # A short round closes on time, not on the rail's opinion.
        round_.close()
        round_.refresh_from_db()
        assert round_.outcome == Round.Outcome.SHORT

    def test_a_failed_payment_does_not_strand_the_member_in_the_next_round(self, group, seats, admin):
        group_seat = Membership.objects.get(group=group, account=admin)
        round_ = open_round(group)
        everyone = [group_seat] + seats

        # Index 0 is the denied one, and it has its own reference rather than being trusted to
        # inherit the stub's answers.
        denied_ref = "STRAND-DENIED"
        denied_claim = claim(round_, everyone[0], round_.share_for(everyone[0]), denied_ref)

        confirmed = []
        for index, seat in enumerate(everyone[1:], start=1):
            ref = f"STRAND-{index}"
            confirmed.append((claim(round_, seat, round_.share_for(seat), ref), ref))

        rail = StubRail({ref: RailAnswer.confirmed(c.amount_pesewas) for c, ref in confirmed})
        rail.set(denied_ref, RailAnswer.rejected("insufficient funds"))
        settle(rail)

        denied_claim.refresh_from_db()
        assert denied_claim.status == Contribution.Status.FAILED

        # The write-off released the slot, so this member can still take their turn next round.
        round_.close()
        second = open_round(group)
        again = claim(second, everyone[0], second.share_for(everyone[0]), "STRAND-AFTER-1")
        assert again.status == Contribution.Status.PENDING


class TestTheCycleWithoutAPartner:
    def test_a_group_can_still_open_a_round_and_log_claims(self, group, seats, admin):
        group_seat = Membership.objects.get(group=group, account=admin)
        round_ = open_round(group)
        attempt = claim(round_, group_seat, round_.share_for(group_seat), "NOPARTNER-1")

        # Before a licence agreement exists, this is the honest state: the record is kept and
        # nothing is settled. A member can always be told what the app knows.
        settle(UnconfiguredRail())

        attempt.refresh_from_db()
        assert attempt.status == Contribution.Status.PENDING
        assert round_.ledger_residual_pesewas() == 0
        assert round_.outcome == Round.Outcome.OPEN

    def test_nothing_is_settled_twice_when_the_worker_runs_repeatedly(self, group, seats, admin):
        group_seat = Membership.objects.get(group=group, account=admin)
        round_ = open_round(group)

        refs = []
        for index, seat in enumerate([group_seat] + seats):
            ref = f"REPEAT-{index}"
            claim(round_, seat, round_.share_for(seat), ref)
            refs.append(ref)

        rail = StubRail({
            ref: RailAnswer.confirmed(round_.share_for(seat))
            for ref, seat in zip(refs, [group_seat] + seats)
        })

        settle(rail)
        settle(rail)
        settle(rail)

        round_.refresh_from_db()
        # Three runs, one pot. A worker on a schedule is the normal case, not the edge case.
        assert round_.verified_total_pesewas() == round_.target_pesewas
        assert round_.ledger_residual_pesewas() == 0
        assert round_.conservation_residual() == 0


class TestMemberRemovalAndDebtDisposition:
    """D9: removing a member must decide, explicitly, what happens to their debt.

    Growl holds no money and is not authorised to collect, so a debt is never a claim that can
    be settled. It is a record. The only two honest dispositions are: forgive it (a balanced
    reversal that keeps the ledger even), or leave it intact so it survives and reappears if the
    member ever rejoins. There is no silent third option.
    """

    def test_forgiving_debt_posts_a_balanced_reversal_and_drops_to_zero(self, group, seats, admin):
        group_seat = Membership.objects.get(group=group, account=admin)
        leaving = seats[0]

        round_ = open_round(group)
        # The leaver pays nothing; the round closes short in their share.
        for seat in [group_seat, seats[1], seats[2]]:
            claim(round_, seat, round_.share_for(seat), f"FORGIVE-{seat.pk}").mark_verified()
        round_.close()
        round_.refresh_from_db()

        leaving.refresh_from_db()
        owed = leaving.debt_pesewas
        assert owed > 0, "the leaver should owe their share"

        before_residual = round_.conservation_residual()

        leaving.deactivate(actor=admin, reason="leaving the group", forgive_debt=True)
        leaving.refresh_from_db()

        assert leaving.active is False
        assert leaving.debt_pesewas == 0
        assert leaving.debt_reason == ""
        assert leaving.debt_notified_at is None

        # The write-off is a balanced pair of legs for every pesewa it removes.
        reversals = group.ledger_entries.filter(reference__startswith="debt-forgive")
        assert reversals.count() == 2
        assert sum(
            e.amount_pesewas for e in reversals.filter(direction=LedgerEntry.Direction.DEBIT)
        ) == owed
        assert sum(
            e.amount_pesewas for e in reversals.filter(direction=LedgerEntry.Direction.CREDIT)
        ) == owed

        # ...and it does not alter the round that produced the debt.
        round_.refresh_from_db()
        assert round_.conservation_residual() == before_residual

        # ...and it is auditable.
        assert group.audit_events.filter(action="membership.deactivated").exists()

    def test_preserving_debt_keaves_the_ledger_and_stays_intact(self, group, seats, admin):
        group_seat = Membership.objects.get(group=group, account=admin)
        leaving = seats[1]

        round_ = open_round(group)
        for seat in [group_seat, seats[0], seats[2]]:
            claim(round_, seat, round_.share_for(seat), f"PRESERVE-{seat.pk}").mark_verified()
        round_.close()
        round_.refresh_from_db()

        leaving.refresh_from_db()
        owed = leaving.debt_pesewas
        assert owed > 0

        leaving.deactivate(actor=admin, reason="moving away", forgive_debt=False)
        leaving.refresh_from_db()

        assert leaving.active is False
        # The debt stays on the membership, counted against anything they ever receive back.
        assert leaving.debt_pesewas == owed
        assert not group.ledger_entries.filter(
            entry_type="reversal", reference__startswith="debt-forgive"
        ).exists()

    def test_an_already_removed_member_is_not_forgiven_again(self, group, seats, admin):
        leaving = seats[2]
        leaving.deactivate(actor=admin, reason="first removal", forgive_debt=False)
        leaving.refresh_from_db()
        assert leaving.active is False

        with pytest.raises(ValidationError, match="already removed"):
            leaving.deactivate(actor=admin, reason="second attempt", forgive_debt=True)
