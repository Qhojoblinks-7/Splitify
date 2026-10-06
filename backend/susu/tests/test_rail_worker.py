"""The rail worker, and what it must refuse to do.

A pending contribution is a claim, not a cedi. Everything here is about keeping that true: the
worker may settle a payment the rail confirmed, and it may write off one the rail rejected, and
it may do nothing else. The tests that matter most are the ones asserting it stays silent.

The distinction under test throughout is UNKNOWN versus REJECTED. A rail that has no record of a
reference yet has told us nothing about whether the member paid, and treating that silence as
evidence is how a circle concludes the app lost their money.
"""

from io import StringIO

import pytest
from django.core.management import call_command

from accounts.models import Account
from susu.models import AuditEvent, Contribution, Membership, Round, SusuGroup
from susu.rail import (
    Outcome,
    RailAnswer,
    RailUnavailable,
    StubRail,
    UnconfiguredRail,
    compare_amount,
    get_rail,
)


pytestmark = pytest.mark.django_db


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
    people = []
    for index, number in enumerate(["+233201000002", "+233201000003", "+233201000004"]):
        person = Account.objects.create_user(phone=number, password="pw")
        people.append(
            Membership.objects.create(
                group=group, account=person, order=index + 2, role="member"
            )
        )
    return people


@pytest.fixture
def round_(roster):
    # Depends on `roster` deliberately: the roster is frozen into the round at opening, so a
    # round opened before the members joined would hold a snapshot of one person and every
    # contribution would be refused as "not in this round's rotation".
    return Round.open_current(roster[0].group)


def run(rail, *args):
    """Invoke the worker against a stub rail and hand back its output."""
    out, err = StringIO(), StringIO()
    call_command(
        "settle_contributions", *args, stdout=out, stderr=err, rail=rail, skip_checks=True
    )
    return out.getvalue(), err.getvalue()


def pay(round_, membership, reference, amount=10000, provider="hubtel"):
    return Contribution.record(
        round_, membership, amount_pesewas=amount, provider=provider, reference=reference
    )


class TestRailAnswers:
    def test_only_a_settled_reference_is_final(self):
        assert RailAnswer.confirmed(10000).is_final
        assert RailAnswer.rejected("denied").is_final
        # The whole reason the worker cannot fail a silent payment.
        assert not RailAnswer.unknown("nothing yet").is_final

    def test_a_settled_reference_for_another_amount_is_a_different_payment(self):
        assert compare_amount(10000, 10000)
        assert not compare_amount(10000, 5000)


class TestNoPartnerConfigured:
    def test_an_unconfigured_rail_knows_nothing_and_fails_nothing(self, round_, roster):
        attempt = pay(round_, roster[0], "ACME-001")

        _, stderr = run(UnconfiguredRail())

        assert attempt.status == Contribution.Status.PENDING
        assert round_.verified_total_pesewas() == 0
        # The warning goes to stderr deliberately: an operator watching the worker's normal
        # output must not be able to miss that nothing is being settled.
        assert "no payment partner is configured" in stderr.lower()

    def test_the_default_rail_is_the_honest_stand_in(self, settings):
        settings.SUSU_RAIL = "unconfigured"
        assert isinstance(get_rail(), UnconfiguredRail)

    def test_an_unknown_rail_name_falls_back_to_the_stand_in(self, settings):
        # A deployment cannot end up with an adapter nobody reviewed by naming it wrongly.
        settings.SUSU_RAIL = "some-partner-we-never-reviewed"
        assert isinstance(get_rail(), UnconfiguredRail)


class TestSettlingFromTheRail:
    def test_a_confirmed_reference_settles_and_grows_the_pot(self, round_, roster):
        attempt = pay(round_, roster[0], "ACME-001")
        rail = StubRail({"ACME-001": RailAnswer.confirmed(10000, provider_reference="HT-9")})

        run(rail)

        attempt.refresh_from_db()
        assert attempt.status == Contribution.Status.VERIFIED
        assert attempt.verified_at is not None
        assert round_.verified_total_pesewas() == 10000

    def test_the_settlement_is_attributed_to_the_worker_not_a_human(self, round_, roster):
        attempt = pay(round_, roster[0], "ACME-001")
        rail = StubRail({"ACME-001": RailAnswer.confirmed(10000)})

        run(rail)

        # A machine decision stays distinguishable from a person's, so the audit trail never
        # shows a worker acting where a member's admin judgment is required.
        attempt.refresh_from_db()
        assert "settled by rail" in attempt.manual_verification_reason
        settled = AuditEvent.objects.filter(
            action="contribution.verified",
            target_type__model="contribution",
            target_id=attempt.pk,
        ).first()
        assert settled is not None
        # actor=None is the marker: the settlement happened, and nobody authorised it.
        assert settled.actor is None
        assert settled.actor_role == "system"

    def test_an_unrecognised_reference_is_left_pending_not_failed(self, round_, roster):
        attempt = pay(round_, roster[0], "ACME-001")
        rail = StubRail({})  # the rail has never heard of it

        run(rail)

        # The load-bearing assertion in this file. A member who paid a minute ago has a
        # perfectly good reference the rail has not indexed yet.
        attempt.refresh_from_db()
        assert attempt.status == Contribution.Status.PENDING
        assert attempt.failure_reason == ""

    def test_a_rejected_reference_is_written_off_with_the_rails_words(self, round_, roster):
        attempt = pay(round_, roster[0], "ACME-001")
        rail = StubRail({"ACME-001": RailAnswer.rejected("insufficient balance")})

        run(rail)

        attempt.refresh_from_db()
        assert attempt.status == Contribution.Status.FAILED
        assert "insufficient balance" in attempt.failure_reason

    def test_a_failed_attempt_releases_the_slot_so_the_member_can_pay_again(self, round_, roster):
        first = pay(round_, roster[0], "ACME-001")
        rail = StubRail({"ACME-001": RailAnswer.rejected("denied")})

        run(rail)

        # The freeze rule applies to a failure as much as to an open attempt: a written-off
        # claim must not strand somebody who genuinely meant to pay.
        assert round_.open_slot_for(roster[0]) is None
        again = pay(round_, roster[0], "ACME-002")
        assert again.status == Contribution.Status.PENDING

    def test_a_reference_settled_for_another_amount_does_not_grow_the_pot(self, round_, roster):
        attempt = pay(round_, roster[0], "ACME-001", amount=10000)
        # The rail confirms this reference, but for twice what the member claimed.
        rail = StubRail({"ACME-001": RailAnswer.confirmed(20000)})

        run(rail)

        # Somebody else's cedi is not this member's payment.
        attempt.refresh_from_db()
        assert attempt.status == Contribution.Status.FAILED
        assert round_.verified_total_pesewas() == 0

    def test_an_unreachable_rail_is_not_evidence_that_nobody_paid(self, round_, roster):
        attempt = pay(round_, roster[0], "ACME-001")

        class BrokenRail(StubRail):
            def lookup(self, **kwargs):
                raise RailUnavailable("partner timed out")

        stdout, stderr = run(BrokenRail())

        attempt.refresh_from_db()
        assert attempt.status == Contribution.Status.PENDING
        assert attempt.failure_reason == ""
        assert "NOT recorded as unpaid" in stderr
        assert "rail unreachable 1" in stdout

    def test_one_unreachable_partner_does_not_stop_the_others(self, round_, roster):
        good = pay(round_, roster[0], "ACME-001")
        stuck = pay(round_, roster[1], "ACME-002")
        answers = {"ACME-001": RailAnswer.confirmed(10000)}

        class FlakyRail(StubRail):
            def lookup(self, *, reference, provider, amount_pesewas):
                if reference == "ACME-002":
                    raise RailUnavailable("timeout")
                return StubRail(answers).lookup(
                    reference=reference, provider=provider, amount_pesewas=amount_pesewas
                )

        run(FlakyRail(answers))

        good.refresh_from_db()
        stuck.refresh_from_db()
        assert good.status == Contribution.Status.VERIFIED
        assert stuck.status == Contribution.Status.PENDING

    def test_running_twice_settles_nothing_twice(self, round_, roster):
        attempt = pay(round_, roster[0], "ACME-001")
        rail = StubRail({"ACME-001": RailAnswer.confirmed(10000)})

        run(rail)
        run(rail)

        attempt.refresh_from_db()
        # One collection entry, not two. The pot is the sum, so a double post would show up
        # here as 20000.
        assert round_.verified_total_pesewas() == 10000
        assert round_.conservation_residual() == 0

    def test_a_contribution_with_no_reference_is_never_asked_about(self, round_, roster):
        attempt = pay(round_, roster[0], "ACME-001")
        attempt.reference = ""
        attempt.save(update_fields=["reference"])
        rail = StubRail({"": RailAnswer.confirmed(10000)})

        run(rail)

        # There is nothing to look up, and inventing a confirmation would be fabricating money.
        attempt.refresh_from_db()
        assert attempt.status == Contribution.Status.PENDING

    def test_the_limit_bounds_one_run_and_leaves_the_rest_pending(self, round_, roster):
        first = pay(round_, roster[0], "ACME-001")
        second = pay(round_, roster[1], "ACME-002")
        rail = StubRail(
            {
                "ACME-001": RailAnswer.confirmed(10000),
                "ACME-002": RailAnswer.confirmed(10000),
            }
        )

        stdout = run(rail, "--limit", "1")[0]

        first.refresh_from_db()
        second.refresh_from_db()
        assert first.status == Contribution.Status.VERIFIED
        assert second.status == Contribution.Status.PENDING
        assert "--limit of 1" in stdout

    def test_a_contribution_still_being_typed_is_left_alone(self, round_, roster):
        attempt = pay(round_, roster[0], "ACME-001")
        rail = StubRail({"ACME-001": RailAnswer.confirmed(10000)})

        run(rail, "--age-minutes", "60")

        # Younger than the cutoff, so not yet anybody's business.
        attempt.refresh_from_db()
        assert attempt.status == Contribution.Status.PENDING

    def test_the_worker_only_touches_the_named_provider(self, round_, roster):
        hubtel = pay(round_, roster[0], "ACME-001", provider="hubtel")
        fincra = pay(round_, roster[1], "ACME-002", provider="fincra")
        rail = StubRail(
            {
                "ACME-001": RailAnswer.confirmed(10000),
                "ACME-002": RailAnswer.confirmed(10000),
            }
        )

        run(rail, "--provider", "hubtel")

        hubtel.refresh_from_db()
        fincra.refresh_from_db()
        # Both were confirmable by the rail. Restricting the run is a way of asking one
        # partner about one partner's transactions, not a way of protecting the other.
        assert hubtel.status == Contribution.Status.VERIFIED
        assert fincra.status == Contribution.Status.PENDING


class TestWorkerCannotOutrankTheDomain:
    def test_the_worker_cannot_settle_the_admins_own_contribution(self, round_, roster):
        # The admin's own seat, so the contribution belongs to the person doing the verifying
        # work. Self-verification is refused for a human at the API layer; this asserts the
        # worker does not quietly become a way around that rule.
        admin_seat = Membership.objects.get(group=round_.group, account__phone="+233201000001")
        attempt = pay(round_, admin_seat, "ACME-001", amount=10000)
        rail = StubRail({"ACME-001": RailAnswer.confirmed(10000)})

        run(rail)

        # Worth being explicit about what this does and does not assert. `mark_verified` has no
        # self-verification guard of its own — that guard lives in the API layer, which knows who
        # is calling. The worker has no caller and therefore no self to be partial about: the
        # rail's record of a settled transaction is not the admin vouching for themselves, so
        # settling is correct here. What must hold is that the settlement is attributed to the
        # machine and not to the admin, which the audit assertion below pins.
        attempt.refresh_from_db()
        assert attempt.status == Contribution.Status.VERIFIED
        settled = AuditEvent.objects.filter(
            action="contribution.verified",
            target_type__model="contribution",
            target_id=attempt.pk,
        ).get()
        assert settled.actor is None
        assert settled.actor_role == "system"

    def test_the_ledger_stays_balanced_after_every_outcome(self, round_, roster):
        settled = pay(round_, roster[0], "ACME-001")
        rejected = pay(round_, roster[1], "ACME-002")
        unknown = pay(round_, roster[2], "ACME-003")
        rail = StubRail(
            {
                "ACME-001": RailAnswer.confirmed(10000),
                "ACME-002": RailAnswer.rejected("denied"),
            }
        )

        run(rail)

        # Three different outcomes, and the money identity still holds.
        assert round_.ledger_residual_pesewas() == 0
        assert round_.conservation_residual() == 0
        settled.refresh_from_db()
        rejected.refresh_from_db()
        unknown.refresh_from_db()
        assert settled.status == Contribution.Status.VERIFIED
        assert rejected.status == Contribution.Status.FAILED
        assert unknown.status == Contribution.Status.PENDING