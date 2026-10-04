"""
The HTTP contract, asserted from the outside.

Everything the mobile client will ever see arrives through these endpoints, so these tests
cover two things at once: that the contract is the shape we promised, and that the
authorization rules hold at the edge rather than only in the domain layer.

The authorization tests matter more than they look. A domain method that refuses a
non-member is worth nothing if the view in front of it never asks. Each of these drives the
API with a real token as a real member of a different group.

Rule IDs: 1791027903-money-handling-and-safeguards.md M1, Z1, C-S5, C-S9, P-S1
           1791028270-security-fraud-and-identity.md   I23, P2, P9
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import Account
from susu.models import Contribution, Membership, Round, SusuGroup

pytestmark = pytest.mark.django_db

# One password for every fixture account, so a token helper never has to guess whose it is.
PASSWORD = "pw-integration-fixture-secret"


@pytest.fixture
def admin():
    return Account.objects.create_user(phone="+233201000001", password=PASSWORD)


@pytest.fixture
def group(admin):
    return SusuGroup.objects.create_group(
        name="API Susu", target_pesewas=30000, collection_day=5,
        admin=admin, invite_code="API001",
    )


@pytest.fixture
def rnd(group):
    for index, number in enumerate(["+233201000002", "+233201000003", "+233201000004"]):
        person = Account.objects.create_user(phone=number, password=PASSWORD)
        Membership.objects.create(group=group, account=person, order=index + 2)
    return Round.open_current(group)


@pytest.fixture
def outsider():
    return Account.objects.create_user(phone="+233201000099", password=PASSWORD)


def token_for(account):
    response = APIClient().post(
        reverse("token_obtain_pair"),
        {"phone": account.phone, "password": PASSWORD},
        format="json",
    )
    assert response.status_code == 200, response.data
    return response.data["access"]


def api_for(account):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_for(account)}")
    return client


def log_payment(client, round_, amount=10000, reference="API-MP-1"):
    return client.post(
        reverse("contribution-create", args=[round_.id]),
        {"amountPesewas": amount, "reference": reference},
        format="json",
    )


# --------------------------------------------------------------------------
# Authentication (I23)
# --------------------------------------------------------------------------


class TestAuthentication:
    def test_a_token_is_issued_for_valid_credentials(self, admin):
        client = api_for(admin)
        response = client.get(reverse("group-list"))
        assert response.status_code == 200

    def test_a_wrong_password_issues_no_token(self, admin):
        response = APIClient().post(
            reverse("token_obtain_pair"),
            {"phone": admin.phone, "password": "not-the-password"},
            format="json",
        )
        assert response.status_code == 401

    def test_an_anonymous_caller_gets_nothing(self):
        response = APIClient().get(reverse("group-list"))
        assert response.status_code == 401

    def test_a_garbage_token_is_refused(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        assert client.get(reverse("group-list")).status_code == 401


# --------------------------------------------------------------------------
# The round read contract (M1, Z1)
# --------------------------------------------------------------------------


class TestRoundContract:
    def test_current_round_is_opened_on_first_read(self, group, admin):
        response = api_for(admin).get(
            reverse("current-round", args=[group.id])
        )
        assert response.status_code == 200
        assert response.data["number"] == 1
        assert response.data["outcome"] == "open"

    def test_reading_twice_returns_the_same_round(self, group, admin):
        client = api_for(admin)
        first = client.get(reverse("current-round", args=[group.id]))
        second = client.get(reverse("current-round", args=[group.id]))
        assert first.data["id"] == second.data["id"]

    def test_the_roster_is_frozen_with_shares_in_pesewas(self, rnd, admin):
        response = api_for(admin).get(reverse("round-detail", args=[rnd.id]))
        roster = response.data["roster"]

        assert len(roster) == 4
        assert sum(entry["sharePesewas"] for entry in roster) == rnd.target_pesewas
        assert all(isinstance(entry["sharePesewas"], int) for entry in roster)

    def test_no_amount_is_a_float_anywhere_in_the_payload(self, rnd, admin):
        response = api_for(admin).get(reverse("round-detail", args=[rnd.id]))

        def walk(value):
            if isinstance(value, dict):
                for item in value.values():
                    walk(item)
            elif isinstance(value, list):
                for item in value:
                    walk(item)
            elif isinstance(value, float):
                raise AssertionError(f"A float reached the wire: {value!r}")

        walk(response.data)

    def test_the_ledger_residual_is_reported_and_is_zero(self, rnd, admin):
        client = api_for(admin)
        log_payment(client, rnd)

        response = client.post(
            reverse("contribution-transition",
                    args=[Contribution.objects.get(round=rnd).pk, "verify"]),
            {}, format="json",
        )
        assert response.data["round"]["ledger"]["residualPesewas"] == 0

    def test_a_pending_payment_does_not_count_toward_the_pot(self, rnd, admin):
        response = api_for(admin).get(reverse("round-detail", args=[rnd.id]))
        assert response.data["verifiedTotalPesewas"] == 0
        assert response.data["shortfallPesewas"] == 30000

    def test_an_unknown_round_is_a_404(self, admin):
        assert api_for(admin).get(reverse("round-detail", args=[99999])).status_code == 404


# --------------------------------------------------------------------------
# Logging a payment (C-S5, C-S9)
# --------------------------------------------------------------------------


class TestLoggingAPayment:
    def test_a_payment_is_recorded_and_returns_the_contract_shape(self, rnd, admin):
        response = log_payment(api_for(admin), rnd)

        assert response.status_code == 201
        assert response.data["amountPesewas"] == 10000
        assert response.data["status"] == "pending"
        assert response.data["reference"] == "API-MP-1"

    def test_a_missing_amount_is_refused_rather_than_defaulted_to_zero(self, rnd, admin):
        response = api_for(admin).post(
            reverse("contribution-create", args=[rnd.id]),
            {"reference": "API-MP-2"}, format="json",
        )
        assert response.status_code == 400
        assert Contribution.objects.count() == 0

    def test_a_missing_reference_is_refused(self, rnd, admin):
        response = api_for(admin).post(
            reverse("contribution-create", args=[rnd.id]),
            {"amountPesewas": 10000}, format="json",
        )
        assert response.status_code == 400
        assert Contribution.objects.count() == 0

    def test_a_second_payment_while_one_is_open_is_refused(self, rnd, admin):
        client = api_for(admin)
        assert log_payment(client, rnd, reference="API-MP-3").status_code == 201

        repeat = log_payment(client, rnd, reference="API-MP-4")
        assert repeat.status_code == 400
        assert Contribution.objects.count() == 1

    def test_a_replayed_idempotency_key_returns_the_original_payment(self, rnd, admin):
        # The offline queue replays writes it cannot confirm. Without this the replay becomes
        # a second cedi claimed against the same member. C-S5.
        client = api_for(admin)
        payload = {
            "amountPesewas": 10000,
            "reference": "API-MP-5",
            "idempotencyKey": "6f1a1f6e-0b0a-4a1e-9b2c-000000000001",
        }
        url = reverse("contribution-create", args=[rnd.id])

        first = client.post(url, payload, format="json")
        second = client.post(url, payload, format="json")

        assert first.status_code == 201
        # The replay must be answered as a success with the same payment, not refused as a
        # duplicate. A client that cannot tell a retry from a second attempt will either
        # double-count or show the member a payment error for money they already sent.
        assert second.status_code == 201
        assert second.data["id"] == first.data["id"]
        assert Contribution.objects.count() == 1

    def test_a_replay_is_answered_even_though_the_slot_is_still_held(self, rnd, admin):
        # The whole point of the ordering: the retry arrives while the original still holds
        # the member's slot, so the slot check must not get there first.
        client = api_for(admin)
        key = "6f1a1f6e-0b0a-4a1e-9b2c-000000000002"
        url = reverse("contribution-create", args=[rnd.id])

        client.post(
            url,
            {"amountPesewas": 10000, "reference": "API-MP-8", "idempotencyKey": key},
            format="json",
        )
        replay = client.post(
            url,
            {"amountPesewas": 10000, "reference": "API-MP-8", "idempotencyKey": key},
            format="json",
        )

        assert replay.status_code == 201

    def test_a_genuine_second_attempt_is_still_refused(self, rnd, admin):
        # Same slot, no shared key: a real second attempt, and it must be refused.
        client = api_for(admin)
        assert log_payment(client, rnd, reference="API-MP-9").status_code == 201
        assert log_payment(client, rnd, reference="API-MP-10").status_code == 400

    def test_a_reversal_lets_the_member_pay_again(self, rnd, admin):
        client = api_for(admin)
        created = log_payment(client, rnd, reference="API-MP-6")
        contribution_id = created.data["id"]

        client.post(
            reverse("contribution-transition", args=[contribution_id, "verify"]),
            {}, format="json",
        )
        client.post(
            reverse("contribution-transition", args=[contribution_id, "reverse"]),
            {}, format="json",
        )
        again = log_payment(client, rnd, reference="API-MP-7")
        assert again.status_code == 201

    def test_a_member_can_void_their_own_unsettled_payment(self, rnd, admin):
        # The escape from a payment that was started and never sent. Without it the member's
        # slot stays held by an attempt that is not going to arrive.
        client = api_for(admin)
        contribution_id = log_payment(client, rnd, reference="API-V1").data["id"]

        response = client.post(
            reverse("contribution-transition", args=[contribution_id, "void"]),
            {"reason": "Wrong amount entered"}, format="json",
        )

        assert response.status_code == 200
        assert response.data["contribution"]["status"] == "void"
        assert response.data["round"]["verifiedTotalPesewas"] == 0
        assert log_payment(client, rnd, reference="API-V2").status_code == 201

    def test_a_member_cannot_void_somebody_elses_payment(self, rnd, admin):
        other = Membership.objects.get(group=rnd.group, order=3).account
        contribution_id = log_payment(api_for(admin), rnd, reference="API-V3").data["id"]

        response = api_for(other).post(
            reverse("contribution-transition", args=[contribution_id, "void"]),
            {}, format="json",
        )

        assert response.status_code == 403
        assert Contribution.objects.get(pk=contribution_id).status == "pending"

    def test_a_member_cannot_mark_their_own_payment_failed(self, rnd, admin):
        # Declaring a payment failed asserts the provider never confirmed it. A member able to
        # say that about their own payment walks away from cedi they actually sent, so the
        # transition is not reachable from the member API at all.
        contribution_id = log_payment(api_for(admin), rnd, reference="API-V4").data["id"]

        response = api_for(admin).post(
            reverse("contribution-transition", args=[contribution_id, "fail"]),
            {}, format="json",
        )

        assert response.status_code == 404
        assert Contribution.objects.get(pk=contribution_id).status == "pending"


# --------------------------------------------------------------------------
# Verification moves money, and is visible to the group (C-S1, Z1, AT1)
# --------------------------------------------------------------------------


class TestVerificationOverHttp:
    def test_verifying_grows_the_pot_and_the_collection_account(self, rnd, admin):
        client = api_for(admin)
        contribution_id = log_payment(client, rnd).data["id"]

        response = client.post(
            reverse("contribution-transition", args=[contribution_id, "verify"]),
            {}, format="json",
        )

        assert response.status_code == 200
        assert response.data["round"]["verifiedTotalPesewas"] == 10000
        assert response.data["round"]["ledger"]["partnerBalancePesewas"] == 10000
        assert response.data["round"]["closingFloatPesewas"] == 10000

    def test_verifying_twice_is_refused_and_posts_nothing(self, rnd, admin):
        client = api_for(admin)
        contribution_id = log_payment(client, rnd).data["id"]
        url = reverse("contribution-transition", args=[contribution_id, "verify"])

        assert client.post(url, {}, format="json").status_code == 200
        assert client.post(url, {}, format="json").status_code == 400
        assert rnd.ledger_entries.count() == 2

    def test_reversing_takes_the_money_back_and_is_never_silent(self, rnd, admin):
        client = api_for(admin)
        contribution_id = log_payment(client, rnd).data["id"]
        client.post(
            reverse("contribution-transition", args=[contribution_id, "verify"]),
            {}, format="json",
        )
        response = client.post(
            reverse("contribution-transition", args=[contribution_id, "reverse"]),
            {}, format="json",
        )

        assert response.data["contribution"]["status"] == "reversed"
        assert response.data["round"]["ledger"]["partnerBalancePesewas"] == 0
        assert response.data["round"]["ledger"]["residualPesewas"] == 0

    def test_reversing_an_older_payment_does_not_eat_a_live_one(self, rnd, admin):
        # Found by the frontend integration suite. A reversed attempt is already excluded from
        # the verified total, so subtracting it again removes a cedi that is still in the
        # collection account. The float is what a member is told they have.
        client = api_for(admin)

        first = log_payment(client, rnd, reference="API-F1").data["id"]
        client.post(
            reverse("contribution-transition", args=[first, "verify"]), {}, format="json"
        )
        client.post(
            reverse("contribution-transition", args=[first, "reverse"]), {}, format="json"
        )

        second = log_payment(client, rnd, amount=7500, reference="API-F2").data["id"]
        response = client.post(
            reverse("contribution-transition", args=[second, "verify"]), {}, format="json"
        )

        assert response.data["round"]["verifiedTotalPesewas"] == 7500
        assert response.data["round"]["closingFloatPesewas"] == 7500
        assert response.data["round"]["ledger"]["partnerBalancePesewas"] == 7500

    def test_the_audit_feed_shows_a_member_both_sides(self, group, rnd, admin):
        client = api_for(admin)
        contribution_id = log_payment(client, rnd).data["id"]
        client.post(
            reverse("contribution-transition", args=[contribution_id, "verify"]),
            {}, format="json",
        )

        response = client.get(reverse("group-audit", args=[group.id]))
        actions = [event["action"] for event in response.data]
        assert "contribution.recorded" in actions
        assert "contribution.verified" in actions

    def test_the_audit_feed_is_readable_by_any_member(self, group, rnd, admin):
        client = api_for(admin)
        contribution_id = log_payment(client, rnd).data["id"]
        client.post(
            reverse("contribution-transition", args=[contribution_id, "verify"]),
            {}, format="json",
        )

        other = Membership.objects.get(group=rnd.group, order=3).account
        response = api_for(other).get(reverse("group-audit", args=[group.id]))
        assert response.status_code == 200
        assert len(response.data) >= 2


# --------------------------------------------------------------------------
# Authorization at the edge (P2, P9, P-S1)
# --------------------------------------------------------------------------


class TestAuthorizationAtTheEdge:
    def test_a_non_member_cannot_read_a_round(self, rnd, outsider):
        assert api_for(outsider).get(reverse("round-detail", args=[rnd.id])).status_code == 403

    def test_a_non_member_cannot_post_a_payment_to_someone_elses_group(self, rnd, outsider):
        assert log_payment(api_for(outsider), rnd).status_code == 403
        assert Contribution.objects.count() == 0

    def test_a_non_member_cannot_verify_someone_elses_payment(self, rnd, admin, outsider):
        contribution_id = log_payment(api_for(admin), rnd).data["id"]
        response = api_for(outsider).post(
            reverse("contribution-transition", args=[contribution_id, "verify"]),
            {}, format="json",
        )
        assert response.status_code == 403
        assert Contribution.objects.get(pk=contribution_id).status == "pending"

    def test_a_non_member_cannot_read_the_audit_feed(self, group, outsider):
        assert api_for(outsider).get(
            reverse("group-audit", args=[group.id])
        ).status_code == 403

    def test_a_group_list_shows_only_your_own_groups(self, group, outsider):
        assert api_for(outsider).get(reverse("group-list")).data == []

    def test_there_is_no_endpoint_that_instructs_a_payout(self, admin, rnd):
        # P-S1: a payout is fired by the provider rail. If a member-reachable route ever
        # appears for it, someone has built the ability to move a group's money by tapping a
        # button, and this test is the thing that should fail.
        from django.urls import get_resolver

        routes = {str(pattern.pattern) for pattern in get_resolver().url_patterns}
        assert not any("payout" in route for route in routes)
        assert rnd.payouts.count() == 0