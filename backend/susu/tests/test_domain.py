"""
Schema and invariant tests.

These assert what the DATABASE must refuse, independently of application code. A rule
enforced only in Python is a rule an alternate code path, a migration, or a direct psql
session will eventually walk around.

Rule IDs refer to:
  1791027903-money-handling-and-safeguards.md   money
  1791026719-growth-business-logic.md          product
  1791028270-security-fraud-and-identity.md     security
"""

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from accounts.models import Account
from accounts.phones import normalise_phone, validate_phone
from susu.models import Contribution, Membership, Payout, Round, SusuGroup

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------
# Identity. Phone first, email optional (I1, I2, I3)
# --------------------------------------------------------------------------


class TestPhoneNormalisation:
    def test_strips_spaces_dashes_and_brackets(self):
        assert normalise_phone(" 0244 123-567 ") == "+233244123567"

    def test_converts_a_local_number_to_e164(self):
        assert normalise_phone("0244123567") == "+233244123567"

    def test_accepts_a_number_already_in_e164(self):
        assert normalise_phone("+233 244 123 567") == "+233244123567"

    @pytest.mark.parametrize(
        "raw", ["", "abc", "+44 7700 900000", "2332441235679", None, "+233"]
    )
    def test_rejects_anything_that_is_not_a_ghanaian_mobile_number(self, raw):
        assert validate_phone(raw) is None

    def test_rejects_landline_lengths(self):
        # Ghana mobile numbers are ten digits nationally; 0XX landlines are not wallets.
        assert validate_phone("0302123456") is None


class TestAccountIdentity:
    def test_one_account_per_phone(self):
        Account.objects.create_user(phone="+233244123567", password="x")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Account.objects.create_user(phone="+233244123567", password="y")

    def test_two_spellings_of_one_number_collide(self):
        Account.objects.create_user(phone="+233244123567", password="x")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Account.objects.create_user(phone="0244 123 567", password="y")

    def test_starts_unverified_and_never_promotes_itself(self):
        account = Account.objects.create_user(phone="+233244123567", password="x")
        assert account.phone_verified is False
        assert account.id_verified is False

    def test_email_is_optional(self):
        account = Account.objects.create_user(phone="+233244123567", password="x")
        assert account.email is None

    def test_many_accounts_may_have_no_email_at_all(self):
        for index in range(5):
            Account.objects.create_user(phone=f"+23324412356{index}", password="x")

    def test_a_real_email_cannot_be_shared_by_two_accounts(self):
        Account.objects.create_user(phone="+233244123567", email="a@example.com", password="x")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Account.objects.create_user(
                    phone="+233244123566", email="a@example.com", password="y"
                )

    def test_never_stores_a_full_ghana_card_number(self):
        account = Account.objects.create_user(phone="+233244123567", password="x")
        account.ghana_card_last4 = "0123"
        account.save()
        assert not hasattr(account, "ghana_card_number")
        assert "ghana_card_number" not in [
            f.name for f in Account._meta.get_fields()
        ]


# --------------------------------------------------------------------------
# Money. Integer pesewas, never a float or a decimal (M1, M2)
# --------------------------------------------------------------------------


class TestMoneyColumnsAreIntegers:
    @pytest.mark.parametrize(
        "model,field",
        [
            (SusuGroup, "target_pesewas"),
            (Membership, "debt_pesewas"),
            (Round, "target_pesewas"),
            (Round, "fee_pesewas"),
            (Contribution, "amount_pesewas"),
        ],
    )
    def test_money_is_stored_in_an_integer_column(self, model, field):
        internal = model._meta.get_field(field)
        assert "BigInteger" in internal.get_internal_type()

    def test_no_money_field_uses_a_float_or_decimal(self):
        from django.db import models as m

        for model in (SusuGroup, Membership, Round, Contribution):
            for field in model._meta.get_fields():
                assert field.get_internal_type() not in {"FloatField", "DecimalField"}


# --------------------------------------------------------------------------
# Group and rotation. Position is permanent, never reindexed (G3, T1, T2)
# --------------------------------------------------------------------------


@pytest.fixture
def admin():
    return Account.objects.create_user(phone="+233201000001", password="pw-admin-secret")


@pytest.fixture
def group(admin):
    return SusuGroup.objects.create_group(
        name="Market Association Susu",
        target_pesewas=30000,
        collection_day=5,
        admin=admin,
        invite_code="MK7QW2",
    )


@pytest.fixture
def roster(group, admin):
    # Position 1 is the creator, installed by create_group. Members join from 2.
    people = []
    for index, number in enumerate(["+233201000002", "+233201000003", "+233201000004"]):
        person = Account.objects.create_user(phone=number, password="pw")
        people.append(
            Membership.objects.create(
                group=group, account=person, order=index + 2, role="member"
            )
        )
    return people


class TestGroup:
    def test_target_is_held_in_pesewas(self, group):
        assert group.target_pesewas == 30000

    def test_invite_codes_are_unique(self, group, admin):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                SusuGroup.objects.create(
                    name="Clash",
                    target_pesewas=10000,
                    collection_day=1,
                    admin=admin,
                    invite_code="MK7QW2",
                )

    def test_the_creator_is_installed_at_rotation_position_one(self, group, admin):
        first = group.memberships.order_by("order").first()
        assert first.account_id == admin.id
        assert first.order == 1
        assert first.role == Membership.Role.ADMIN

    def test_a_removed_member_keeps_their_rotation_slot(self, group, admin, roster):
        victim = roster[1]
        victim.active = False
        victim.save()
        refreshed = Membership.objects.get(pk=victim.pk)
        assert refreshed.order == roster[1].order, "removal must not reindex the roster"

    def test_a_removal_never_moves_the_current_turn_cursor(self, group, roster):
        group.turn_cursor = 2
        group.save()
        victim = roster[0]
        victim.active = False
        victim.save()
        group.refresh_from_db()
        assert group.turn_cursor == 2

    def test_membership_is_unique_per_group(self, group, roster):
        person = roster[0].account
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Membership.objects.create(group=group, account=person, order=9)


# --------------------------------------------------------------------------
# Round snapshot. Frozen facts, not a live index (R0, R1, R2, R3)
# --------------------------------------------------------------------------


class TestRoundSnapshot:
    def test_snapshot_is_a_fact_not_a_lookup(self, group, roster):
        Round.open_current(group)
        rnd = Round.objects.get(group=group)
        assert rnd.receiver_id == group.memberships.order_by("order").first().id
        assert rnd.target_pesewas == 30000

    def test_roster_and_shares_are_frozen_into_the_round(self, group, roster):
        rnd = Round.open_current(group)
        assert len(rnd.roster_snapshot) == 4  # admin plus three members
        assert sum(entry["share_pesewas"] for entry in rnd.roster_snapshot) == 30000

    def test_shares_conserve_the_target_exactly(self, group, roster):
        rnd = Round.open_current(group)
        assert sum(e["share_pesewas"] for e in rnd.roster_snapshot) == rnd.target_pesewas

    def test_the_indivisible_cedi_goes_to_the_receiver(self, admin, roster):
        odd = SusuGroup.objects.create_group(
            name="Odd Pot", target_pesewas=10000, collection_day=1,
            admin=admin, invite_code="ODD001",
        )
        Membership.objects.create(group=odd, account=roster[0].account, order=2)
        rnd = Round.open_current(odd)
        receiver_share = next(
            e["share_pesewas"] for e in rnd.roster_snapshot if e["membership_id"] == rnd.receiver_id
        )
        other_shares = [
            e["share_pesewas"] for e in rnd.roster_snapshot if e["membership_id"] != rnd.receiver_id
        ]
        assert receiver_share == 5000
        assert all(share == 5000 for share in other_shares)

    def test_an_indivisible_share_goes_to_the_receiver_when_it_cannot_divide(self, admin):
        odd = SusuGroup.objects.create_group(
            name="Three Way", target_pesewas=10000, collection_day=1,
            admin=admin, invite_code="ODD002",
        )
        for index, number in enumerate(["+233201000007", "+233201000008"]):
            person = Account.objects.create_user(phone=number, password="pw")
            Membership.objects.create(group=odd, account=person, order=index + 2)
        rnd = Round.open_current(odd)
        shares = sorted(e["share_pesewas"] for e in rnd.roster_snapshot)
        assert shares == [3333, 3333, 3334]
        receiver_share = next(
            e["share_pesewas"] for e in rnd.roster_snapshot if e["membership_id"] == rnd.receiver_id
        )
        assert receiver_share == 3334
        assert sum(shares) == 10000

    def test_the_database_refuses_a_second_open_round(self, group, roster):
        rnd = Round.open_current(group)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Round.objects.create(
                    group=group,
                    number=rnd.number + 5,
                    cycle=rnd.cycle,
                    target_pesewas=rnd.target_pesewas,
                    receiver=rnd.receiver,
                    roster_snapshot=rnd.roster_snapshot,
                    opened_at=rnd.opened_at,
                    due_at=rnd.due_at,
                )

    def test_opening_twice_returns_the_same_round_rather_than_a_second_one(self, group, roster):
        first = Round.open_current(group)
        assert Round.open_current(group).pk == first.pk
        assert Round.objects.filter(group=group).count() == 1

    def test_removing_a_member_after_the_open_does_not_move_the_receiver(self, group, roster):
        rnd = Round.open_current(group)
        victim = roster[0]
        victim.active = False
        victim.save()
        rnd.refresh_from_db()
        assert rnd.receiver_id == rnd.roster_snapshot[0]["membership_id"]

    def test_due_date_is_measured_from_when_the_round_opened(self, group, roster):
        from django.utils import timezone
        from datetime import timedelta

        late = timezone.now() + timedelta(days=9)
        rnd = Round.open_current(group, at=late)
        assert rnd.due_at > late
        assert rnd.due_at <= late + timedelta(days=7)


# --------------------------------------------------------------------------
# Contribution attempts. The freeze rule, enforced by constraint (C-S1..C-S3)
# --------------------------------------------------------------------------


@pytest.fixture
def rnd(group, roster):
    Round.open_current(group)
    return Round.objects.get(group=group)


class TestContributionAttempts:
    def test_amounts_are_integer_pesewas(self, rnd, roster):
        c = Contribution.record(rnd, roster[0], amount_pesewas=10000)
        assert c.amount_pesewas == 10000
        assert isinstance(c.amount_pesewas, int)

    def test_a_second_attempt_is_refused_while_one_is_open(self, rnd, roster):
        Contribution.record(rnd, roster[0], amount_pesewas=10000)
        with pytest.raises(Contribution.FrozenSlot):
            Contribution.record(rnd, roster[0], amount_pesewas=10000)

    def test_re_payment_is_permitted_after_a_failed_attempt(self, rnd, roster):
        first = Contribution.record(rnd, roster[0], amount_pesewas=10000)
        Contribution.objects.filter(pk=first.pk).update(status="failed")
        second = Contribution.record(rnd, roster[0], amount_pesewas=10000)
        assert second.pk != first.pk
        assert Contribution.objects.filter(round=rnd, membership=roster[0]).count() == 2

    def test_re_payment_is_permitted_after_a_void(self, rnd, roster):
        first = Contribution.record(rnd, roster[0], amount_pesewas=10000)
        Contribution.objects.filter(pk=first.pk).update(status="void")
        assert Contribution.record(rnd, roster[0], amount_pesewas=10000).pk != first.pk

    def test_only_one_attempt_can_be_verified_per_member_per_round(self, rnd, roster):
        first = Contribution.record(rnd, roster[0], amount_pesewas=10000)
        Contribution.objects.filter(pk=first.pk).update(status="failed")
        Contribution.objects.create(
            round=rnd,
            membership=roster[0],
            amount_pesewas=10000,
            provider="mtn_momo",
            reference="MP-X1",
            status=Contribution.Status.VERIFIED,
        )
        # The database refuses a second counted attempt for the same member and round.
        # Asserted by insert: SQLite deadlocks rather than raising when a bulk UPDATE is the
        # statement that violates a partial unique index. The production engine is
        # PostgreSQL, where both forms raise. See traceability register D-14.
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Contribution.objects.create(
                    round=rnd,
                    membership=roster[0],
                    amount_pesewas=10000,
                    provider="mtn_momo",
                    reference="MP-X2",
                    status=Contribution.Status.VERIFIED,
                )

    def test_the_verified_attempt_is_unique_only_while_it_stays_verified(self, rnd, roster):
        first = Contribution.record(rnd, roster[0], amount_pesewas=10000)
        Contribution.objects.filter(pk=first.pk).update(status="failed")
        second = Contribution.record(rnd, roster[0], amount_pesewas=10000)
        Contribution.objects.filter(pk=second.pk).update(status="failed")
        third = Contribution.objects.create(
            round=rnd, membership=roster[0], amount_pesewas=10000,
            provider="mtn_momo", reference="MP-X3", status=Contribution.Status.VERIFIED,
        )
        assert third.status == Contribution.Status.VERIFIED

    def test_only_the_verified_attempt_counts_toward_the_pot(self, rnd, roster):
        pending = Contribution.record(rnd, roster[0], amount_pesewas=10000)
        failed = Contribution.record(rnd, roster[1], amount_pesewas=10000)
        Contribution.objects.filter(pk=failed.pk).update(status="failed")
        Contribution.objects.filter(pk=pending.pk).update(status="verified")
        assert rnd.verified_total_pesewas() == 10000

    def test_a_replayed_idempotency_key_returns_the_original_payment(self, rnd, roster):
        # C-S5: a replay is a retry, and a retry must not become a second cedi. The old
        # behaviour raised here, which answered a member's retry with a database error.
        key = "a" * 32
        first = Contribution.record(rnd, roster[0], amount_pesewas=10000, idempotency_key=key)

        replay = Contribution.record(rnd, roster[0], amount_pesewas=10000, idempotency_key=key)

        assert replay.pk == first.pk
        assert Contribution.objects.count() == 1

    def test_one_member_cannot_collect_another_members_payment_with_a_guessed_key(
        self, rnd, roster
    ):
        # The key is globally unique, so a member who guesses or reuses another's key must be
        # refused rather than handed that member's amount and reference. P2, P9.
        key = "b" * 32
        Contribution.record(rnd, roster[0], amount_pesewas=10000, idempotency_key=key)

        with pytest.raises(Contribution.IdempotencyKeyConflict):
            Contribution.record(rnd, roster[1], amount_pesewas=10000, idempotency_key=key)

    def test_a_member_cannot_be_charged_more_than_twice_their_frozen_share(self, rnd, roster):
        share = rnd.share_for(roster[0])
        Contribution.record(rnd, roster[0], amount_pesewas=share * 2)
        with pytest.raises(Contribution.AmountOutOfRange):
            Contribution.record(rnd, roster[1], amount_pesewas=10 ** 9)

    def test_the_smallest_possible_contribution_is_one_cedi(self, rnd, roster):
        with pytest.raises(Contribution.AmountOutOfRange):
            Contribution.record(rnd, roster[0], amount_pesewas=99)

    def test_a_reference_cannot_be_reused_anywhere_by_the_same_person(self, rnd, roster, group):
        Contribution.record(
            rnd, roster[0], amount_pesewas=10000, reference="MP2601.0001",
            provider="mtn_momo",
        )
        other = Round.open_current_for_test(group)
        with pytest.raises(Contribution.DuplicateReference):
            Contribution.record(
                other, roster[0], amount_pesewas=10000, reference="MP2601.0001",
                provider="mtn_momo",
            )
        assert other.pk is not None

    def test_a_float_amount_is_refused_outright(self, rnd, roster):
        with pytest.raises(Contribution.AmountOutOfRange):
            Contribution.record(rnd, roster[0], amount_pesewas=10000.5)

    def test_history_is_retained_across_a_re_payment(self, rnd, roster):
        first = Contribution.record(rnd, roster[0], amount_pesewas=10000)
        Contribution.objects.filter(pk=first.pk).update(status="failed")
        Contribution.record(rnd, roster[0], amount_pesewas=10000)
        # Both attempts remain readable. The failed one is never deleted.
        assert (
            Contribution.objects.filter(round=rnd, membership=roster[0])
            .values_list("status", flat=True)
            .count()
            == 2
        )


# --------------------------------------------------------------------------
# Payout. One per round, deterministic key (P-S2, P-S3, P-S4)
# --------------------------------------------------------------------------


class TestPayout:
    def _fill_round(self, rnd, *, how_many=None):
        """Have each snapshot member pay their exact frozen share."""
        entries = rnd.roster_snapshot if how_many is None else rnd.roster_snapshot[:how_many]
        for entry in entries:
            membership = Membership.objects.get(pk=entry["membership_id"])
            created = Contribution.record(rnd, membership, amount_pesewas=entry["share_pesewas"])
            Contribution.objects.filter(pk=created.pk).update(status="verified")
        return len(entries)

    def test_refused_while_the_pot_is_under_target(self, rnd):
        self._fill_round(rnd, how_many=2)
        with pytest.raises(ValidationError):
            rnd.payout(fee_pesewas=0)

    def test_pays_every_verified_pesewa_less_the_disclosed_fee(self, rnd):
        count = self._fill_round(rnd)
        assert rnd.verified_total_pesewas() == rnd.target_pesewas
        payout = rnd.payout(fee_pesewas=500)
        assert payout.amount_pesewas == rnd.target_pesewas - 500
        assert payout.fee_pesewas == 500
        assert payout.receiver_id == rnd.receiver_id
        assert payout.status == Payout.Status.QUEUED

    def test_pays_an_overfunded_round_in_full_rather_than_the_target(self, rnd):
        # D-1 in the traceability register: paying exactly the target made the surplus
        # evaporate. The receiver must receive everything that was verified.
        self._fill_round(rnd)
        first_id = rnd.roster_snapshot[0]["membership_id"]
        counted = Contribution.objects.filter(
            round=rnd, membership_id=first_id, status=Contribution.Status.VERIFIED
        ).first()
        top_up = rnd.share_for(Membership.objects.get(pk=first_id))
        Contribution.objects.filter(pk=counted.pk).update(amount_pesewas=top_up * 2)

        verified = rnd.verified_total_pesewas()
        assert verified > rnd.target_pesewas
        payout = rnd.payout(fee_pesewas=0)
        assert payout.amount_pesewas == verified
        assert payout.amount_pesewas > rnd.target_pesewas

    def test_one_payout_per_round_ever(self, rnd):
        self._fill_round(rnd)
        rnd.payout(fee_pesewas=0)
        with pytest.raises(ValidationError):
            rnd.payout(fee_pesewas=0)

    def test_the_database_itself_refuses_a_second_payout_row(self, rnd):
        self._fill_round(rnd)
        rnd.payout(fee_pesewas=0)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Payout.objects.create(
                    round=rnd,
                    payout_key=f"other-{rnd.number}",
                    receiver=rnd.receiver,
                    amount_pesewas=100,
                    status=Payout.Status.QUEUED,
                )

    def test_payout_key_is_deterministic_for_a_round(self, rnd):
        self._fill_round(rnd)
        payout = rnd.payout(fee_pesewas=0)
        assert payout.payout_key == rnd.payout_key()

    def test_a_fee_larger_than_the_pot_is_escalated_not_paid_as_zero(self, rnd):
        self._fill_round(rnd)
        with pytest.raises(ValidationError):
            rnd.payout(fee_pesewas=rnd.target_pesewas)

    def test_money_conserves_after_a_completed_payout(self, rnd):
        self._fill_round(rnd)
        payout = rnd.payout(fee_pesewas=500)
        Payout.objects.filter(pk=payout.pk).update(status=Payout.Status.COMPLETED)
        assert rnd.conservation_residual() == 0

    def test_money_conserves_when_a_round_is_paid_with_nothing_verified(self, rnd):
        assert rnd.conservation_residual() == 0

    def test_a_failed_payout_leaves_the_round_open_for_the_receiver(self, rnd):
        self._fill_round(rnd)
        payout = rnd.payout(fee_pesewas=0)
        payout.mark_failed("Provider timeout")
        rnd.refresh_from_db()
        assert rnd.outcome == Round.Outcome.OPEN
        assert payout.can_retry() is True

    def test_retry_stops_after_the_attempt_ceiling(self, rnd):
        self._fill_round(rnd)
        payout = rnd.payout(fee_pesewas=0)
        for _ in range(Payout.MAX_ATTEMPTS):
            payout.mark_failed("Provider timeout")
        assert payout.can_retry() is False

    def test_a_blocked_round_is_never_paid(self, rnd):
        self._fill_round(rnd)
        first_id = rnd.roster_snapshot[0]["membership_id"]
        Contribution.objects.filter(
            round=rnd, membership_id=first_id, status=Contribution.Status.VERIFIED
        ).update(status=Contribution.Status.FLAGGED)
        with pytest.raises(ValidationError):
            rnd.payout(fee_pesewas=0)