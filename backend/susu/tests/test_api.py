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
from susu.models import Contribution, Membership, Payout, Round, SusuGroup

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


@pytest.fixture
def payer(group):
    """A regular member — somebody who is not the admin.

    Separate from `admin` on purpose. An admin may not verify or reverse their own contribution,
    so a test that has one account pay *and* confirm is describing a transition the API refuses.
    Most of the money assertions below need a member to pay and somebody else to confirm, which
    is also the shape of a real group.
    """
    return Membership.objects.get(group=group, order=2).account


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
# Creating and joining a group (G2, G3, G4, I51)
# --------------------------------------------------------------------------


class TestGroupCreation:
    def test_the_creator_is_installed_as_admin_at_slot_one(self, admin):
        response = api_for(admin).post(
            reverse("group-create"),
            {"name": "Market Susu", "targetPesewas": 30000, "collectionDay": 5},
            format="json",
        )

        assert response.status_code == 201, response.data
        created = SusuGroup.objects.get(pk=response.data["id"])
        membership = created.memberships.get()
        assert membership.account_id == admin.id
        assert membership.order == 1
        assert membership.role == Membership.Role.ADMIN

    def test_the_response_carries_the_invite_code_the_admin_shares(self, admin):
        response = api_for(admin).post(
            reverse("group-create"),
            {"name": "Market Susu", "targetPesewas": 30000},
            format="json",
        )

        assert response.status_code == 201
        assert len(response.data["inviteCode"]) == 8
        assert response.data["memberCount"] == 1
        assert SusuGroup.objects.get(pk=response.data["id"]).invite_code == response.data["inviteCode"]

    def test_creating_a_group_opens_no_round(self, admin):
        # The first round opens on first read, idempotently. Opening one here would mean a retry
        # of this request could leave a group with two rounds.
        response = api_for(admin).post(
            reverse("group-create"),
            {"name": "Market Susu", "targetPesewas": 30000},
            format="json",
        )

        assert SusuGroup.objects.get(pk=response.data["id"]).rounds.count() == 0

    def test_a_round_opens_once_and_stays_one(self, admin):
        created = api_for(admin).post(
            reverse("group-create"),
            {"name": "Market Susu", "targetPesewas": 30000},
            format="json",
        ).data
        client = api_for(admin)

        first = client.get(reverse("current-round", args=[created["id"]]))
        second = client.get(reverse("current-round", args=[created["id"]]))

        assert first.status_code == 200
        assert first.data["id"] == second.data["id"]

    def test_anonymous_creation_is_refused(self):
        response = APIClient().post(
            reverse("group-create"), {"name": "Market Susu", "targetPesewas": 30000}, format="json"
        )

        assert response.status_code == 401

    @pytest.mark.parametrize(
        "payload",
        [
            {"targetPesewas": 30000},
            {"name": "   "},
            {"name": "Market Susu"},
            {"name": "Market Susu", "targetPesewas": 0},
            {"name": "Market Susu", "target psewas": 30000},
        ],
    )
    def test_an_unusable_group_is_refused_with_a_reason(self, admin, payload):
        response = api_for(admin).post(reverse("group-create"), payload, format="json")

        assert response.status_code == 400
        assert response.data

    def test_two_groups_never_share_an_invite_code(self, admin):
        client = api_for(admin)
        codes = {
            client.post(
                reverse("group-create"),
                {"name": f"Susu {index}", "targetPesewas": 10000},
                format="json",
            ).data["inviteCode"]
            for index in range(12)
        }

        assert len(codes) == 12


class TestGroupJoin:
    def test_a_code_seats_the_caller_in_the_next_free_slot(self, group, outsider):
        response = api_for(outsider).post(
            reverse("group-join"), {"inviteCode": group.invite_code}, format="json"
        )

        assert response.status_code == 201
        assert response.data["memberCount"] == 2
        membership = Membership.objects.get(group=group, account=outsider)
        assert membership.order == 2
        assert membership.role == Membership.Role.MEMBER

    def test_join_cannot_name_someone_else(self, group, admin, outsider):
        # The one control that matters here. There is no `account` field to send, so a caller
        # cannot place another person in the rotation; and an attempt to smuggle one in through
        # an unexpected key adds only the caller, never the named account.
        response = api_for(outsider).post(
            reverse("group-join"),
            {"inviteCode": group.invite_code, "account": admin.id, "phone": admin.phone},
            format="json",
        )

        assert response.status_code == 201
        assert Membership.objects.filter(group=group).count() == 2
        assert Membership.objects.filter(group=group, account=admin).count() == 1

    def test_joining_twice_is_refused_rather_than_duplicated(self, group, outsider):
        client = api_for(outsider)
        client.post(reverse("group-join"), {"inviteCode": group.invite_code}, format="json")

        again = client.post(reverse("group-join"), {"inviteCode": group.invite_code}, format="json")

        assert again.status_code == 409
        assert Membership.objects.filter(group=group, account=outsider).count() == 1

    def test_an_unknown_code_is_refused(self, outsider):
        response = api_for(outsider).post(
            reverse("group-join"), {"inviteCode": "ZZZZZZZZ"}, format="json"
        )

        assert response.status_code == 404

    def test_an_unknown_code_creates_nothing_and_discloses_nothing(self, outsider, group):
        # Asking about a code nobody holds must not confirm or deny that any group exists, and
        # must not leave a membership behind. Answering 404 rather than 403 is deliberate: a
        # caller who already holds a real code has already proved they have it, so there is no
        # enumeration oracle here to close.
        client = api_for(outsider)

        response = client.post(reverse("group-join"), {"inviteCode": "ZZZZZZZZ"}, format="json")

        assert response.status_code == 404
        assert "ZZZZZZZZ" not in str(response.data)
        assert Membership.objects.filter(account=outsider).count() == 0
        assert group.memberships.count() == 1

    def test_an_ended_group_refuses_new_members(self, group, outsider):
        group.status = SusuGroup.Status.ENDED
        group.save()

        response = api_for(outsider).post(
            reverse("group-join"), {"inviteCode": group.invite_code}, format="json"
        )

        assert response.status_code == 409
        assert Membership.objects.filter(group=group, account=outsider).count() == 0

    def test_the_creator_joining_their_own_group_is_refused(self, group, admin):
        response = api_for(admin).post(
            reverse("group-join"), {"inviteCode": group.invite_code}, format="json"
        )

        assert response.status_code == 409

    def test_an_empty_code_is_refused(self, outsider):
        response = api_for(outsider).post(reverse("group-join"), {"inviteCode": "  "}, format="json")

        assert response.status_code == 400

    def test_anonymous_join_is_refused(self, group):
        response = APIClient().post(
            reverse("group-join"), {"inviteCode": group.invite_code}, format="json"
        )

        assert response.status_code == 401

    def test_the_rotation_is_capped(self, group):
        from susu.api import MAX_GROUP_MEMBERS

        for order in range(2, MAX_GROUP_MEMBERS + 1):
            person = Account.objects.create_user(
                phone=f"+2332010{order:05d}", password=PASSWORD
            )
            Membership.objects.create(group=group, account=person, order=order)

        latecomer = Account.objects.create_user(phone="+233209999999", password=PASSWORD)
        response = api_for(latecomer).post(
            reverse("group-join"), {"inviteCode": group.invite_code}, format="json"
        )

        assert response.status_code == 409
        assert Membership.objects.filter(group=group, account=latecomer).count() == 0

    def test_a_join_lands_in_the_audit_trail(self, group, outsider):
        from susu.ledger import AuditEvent

        api_for(outsider).post(
            reverse("group-join"), {"inviteCode": group.invite_code}, format="json"
        )

        assert AuditEvent.objects.filter(
            group=group, action="membership.joined", actor=outsider
        ).exists()


class TestWhoHasPaid:
    """Per-member payment state, so the round screen can answer "who still owes". C-S1, C-S2."""

    def _roster(self, client, round_):
        response = client.get(reverse("round-detail", args=[round_.id]))
        assert response.status_code == 200
        return {entry["membershipId"]: entry for entry in response.data["roster"]}

    def test_every_member_starts_at_nothing_paid_and_no_open_attempt(self, group, rnd, admin):
        roster = self._roster(api_for(admin), rnd)

        assert len(roster) == 4
        for entry in roster.values():
            assert entry["paidPesewas"] == 0
            assert entry["openStatus"] is None

    def test_a_verified_payment_shows_against_the_member_who_made_it(self, group, rnd, admin):
        payer = Membership.objects.get(group=group, order=2)
        client = api_for(payer.account)
        created = log_payment(client, rnd, amount=10000, reference="PAID-1").data
        api_for(admin).post(
            reverse("contribution-transition", args=[created["id"], "verify"]), {}, format="json"
        )

        roster = self._roster(api_for(payer.account), rnd)

        assert roster[payer.id]["paidPesewas"] == 10000
        assert roster[payer.id]["openStatus"] == "verified"
        # And nobody else's number moved with it.
        for membership_id, entry in roster.items():
            if membership_id != payer.id:
                assert entry["paidPesewas"] == 0

    def test_a_pending_payment_is_neither_paid_nor_released(self, group, rnd):
        payer = Membership.objects.get(group=group, order=2)
        log_payment(api_for(payer.account), rnd, amount=10000, reference="PEND-1")

        entry = self._roster(api_for(payer.account), rnd)[payer.id]

        # The slot is held while the payment might still become money, and the pot has not moved.
        assert entry["paidPesewas"] == 0
        assert entry["openStatus"] == "pending"

    def test_a_reversed_payment_frees_the_slot_and_leaves_nothing_counted(self, group, rnd, admin):
        payer = Membership.objects.get(group=group, order=2)
        client = api_for(payer.account)
        created = log_payment(client, rnd, amount=10000, reference="REV-1").data
        verifier = api_for(admin)
        verifier.post(
            reverse("contribution-transition", args=[created["id"], "verify"]), {}, format="json"
        )
        verifier.post(
            reverse("contribution-transition", args=[created["id"], "reverse"]), {}, format="json"
        )

        entry = self._roster(api_for(payer.account), rnd)[payer.id]

        assert entry["paidPesewas"] == 0
        assert entry["openStatus"] is None

    def test_the_round_total_is_the_sum_of_what_members_are_shown_as_having_paid(self, group, rnd, admin):
        # Two different members, because C-S3 permits at most one verified payment per member
        # per round — paying twice from one account is refused, not summed. Both are confirmed by
        # the admin, since neither may confirm their own.
        verifier = api_for(admin)
        last = None
        for order in (2, 3):
            payer = Membership.objects.get(group=group, order=order)
            created = log_payment(api_for(payer.account), rnd, amount=10000, reference=f"SUM-{order}").data
            verifier.post(
                reverse("contribution-transition", args=[created["id"], "verify"]), {}, format="json"
            )
            last = payer

        response = verifier.get(reverse("round-detail", args=[rnd.id]))

        perMember = sum(entry["paidPesewas"] for entry in response.data["roster"])
        assert perMember == response.data["verifiedTotalPesewas"] == 20000


class TestWhetherYouMayPay:
    def test_a_member_with_no_attempt_may_pay(self, group, rnd):
        response = api_for(group.admin).get(reverse("round-detail", args=[rnd.id]))

        assert response.data["canContribute"] is True
        assert response.data["openContributionId"] is None
        assert response.data["myMembershipId"] == group.memberships.get(account=group.admin).id

    def test_an_open_attempt_blocks_a_second_one(self, group, rnd):
        payer = Membership.objects.get(group=group, order=2)
        client = api_for(payer.account)
        created = log_payment(client, rnd, amount=10000, reference="HOLD-1").data

        response = client.get(reverse("round-detail", args=[rnd.id]))

        assert response.data["canContribute"] is False
        assert response.data["openContributionId"] == created["id"]

    def test_withdrawing_the_attempt_reopens_the_slot(self, group, rnd):
        payer = Membership.objects.get(group=group, order=2)
        client = api_for(payer.account)
        created = log_payment(client, rnd, amount=10000, reference="VOID-1").data
        client.post(
            reverse("contribution-transition", args=[created["id"], "void"]), {}, format="json"
        )

        response = client.get(reverse("round-detail", args=[rnd.id]))

        assert response.data["canContribute"] is True
        assert response.data["openContributionId"] is None

    def test_each_member_sees_their_own_slot_not_a_neighbour_s(self, group, rnd):
        first = Membership.objects.get(group=group, order=2)
        second = Membership.objects.get(group=group, order=3)
        created = log_payment(api_for(first.account), rnd, amount=10000, reference="MINE-1").data

        mine = api_for(first.account).get(reverse("round-detail", args=[rnd.id]))
        theirs = api_for(second.account).get(reverse("round-detail", args=[rnd.id]))

        assert mine.data["openContributionId"] == created["id"]
        assert mine.data["canContribute"] is False
        assert theirs.data["openContributionId"] is None
        assert theirs.data["canContribute"] is True

    def test_someone_outside_the_rotation_never_learns_whether_they_may_pay(self, group, rnd, outsider):
        # The read is refused outright rather than answered with `canContribute: false`. That is
        # stronger than the flag being closed: a non-member gets no roster, no pot and no hint
        # that the group exists, so there is nothing to gate in the first place.
        response = api_for(outsider).get(reverse("round-detail", args=[rnd.id]))

        assert response.status_code == 403
        assert "canContribute" not in response.data
        assert "roster" not in response.data

    def test_a_removed_member_is_refused_the_round_again(self, group, rnd):
        # Removed after the round froze. The roster still lists them — that is the point of a
        # frozen snapshot — but they are no longer an active member, so they lose the read and
        # with it any way to act on the round.
        departed = Membership.objects.get(group=group, order=3)
        departed.active = False
        departed.save()

        response = api_for(departed.account).get(reverse("round-detail", args=[rnd.id]))

        assert response.status_code == 403


class TestWhoMayConfirmMoney:
    """Only an admin may confirm or reverse, and never their own payment.

    This is the sharpest control in the API and it was once absent: `verify` and `reverse` were
    gated on active membership alone, so any member could mark money in as received without a
    cedi moving, fill the pot, and have a payout fire. A member asserting that their own payment
    arrived is self-attestation — the exact thing the payment rail exists to replace — so it is
    refused rather than trusted. P2, P-S1.
    """

    def _pay(self, account, rnd, reference="AUTH-1"):
        return log_payment(api_for(account), rnd, reference=reference).data["id"]

    def test_a_plain_member_cannot_verify_anyone(self, rnd, payer, group):
        other = Membership.objects.get(group=group, order=3).account
        contribution_id = self._pay(other, rnd)

        response = api_for(payer).post(
            reverse("contribution-transition", args=[contribution_id, "verify"]), {}, format="json"
        )

        assert response.status_code == 403
        assert Contribution.objects.get(pk=contribution_id).status == "pending"
        assert rnd.contributions.get(pk=contribution_id).amount_pesewas  # untouched
        assert rnd.ledger_entries.count() == 0, "a refused verify must not post anything"

    def test_a_plain_member_cannot_verify_their_own_payment(self, rnd, payer):
        # The exploit in its purest form: nobody else is even involved, and the member is still
        # refused, because the person confirming their own money cannot be a check on themselves.
        contribution_id = self._pay(payer, rnd)

        response = api_for(payer).post(
            reverse("contribution-transition", args=[contribution_id, "verify"]), {}, format="json"
        )

        assert response.status_code == 403
        assert Contribution.objects.get(pk=contribution_id).status == "pending"
        assert rnd.ledger_entries.count() == 0

    def test_an_admin_cannot_verify_their_own_payment(self, rnd, admin):
        contribution_id = self._pay(admin, rnd)

        response = api_for(admin).post(
            reverse("contribution-transition", args=[contribution_id, "verify"]), {}, format="json"
        )

        assert response.status_code == 403
        assert Contribution.objects.get(pk=contribution_id).status == "pending"
        assert rnd.ledger_entries.count() == 0

    def test_an_admin_may_verify_somebody_elses_payment(self, rnd, admin, payer):
        contribution_id = self._pay(payer, rnd)

        response = api_for(admin).post(
            reverse("contribution-transition", args=[contribution_id, "verify"]), {}, format="json"
        )

        assert response.status_code == 200
        assert response.data["round"]["verifiedTotalPesewas"] == 10000

    def test_a_plain_member_cannot_reverse_a_verified_payment(self, rnd, admin, payer, group):
        # Reversal takes money back out of the pot. Left open to any member it was a way to empty
        # a pot that had not yet been paid out, and to block the round on the way.
        contribution_id = self._pay(payer, rnd)
        api_for(admin).post(
            reverse("contribution-transition", args=[contribution_id, "verify"]), {}, format="json"
        )

        response = api_for(payer).post(
            reverse("contribution-transition", args=[contribution_id, "reverse"]), {}, format="json"
        )

        assert response.status_code == 403
        assert Contribution.objects.get(pk=contribution_id).status == "verified"

    def test_an_admin_cannot_reverse_their_own_payment(self, rnd, admin, group):
        # Needs a second admin: the first cannot verify their own payment, so their contribution
        # can never reach `verified`, which means they can never be in a position to reverse one.
        # A second admin confirms it, and then the owner of that payment tries to take it back.
        second_admin = Membership.objects.get(group=group, order=3)
        second_admin.role = Membership.Role.ADMIN
        second_admin.save()

        contribution_id = self._pay(admin, rnd)
        assert api_for(second_admin.account).post(
            reverse("contribution-transition", args=[contribution_id, "verify"]), {}, format="json"
        ).status_code == 200

        response = api_for(admin).post(
            reverse("contribution-transition", args=[contribution_id, "reverse"]), {}, format="json"
        )

        assert response.status_code == 403
        assert Contribution.objects.get(pk=contribution_id).status == "verified"
        assert rnd.ledger_entries.count() == 2, "a refused reverse must not post anything"

    def test_the_refusal_follows_the_payer_not_the_admin_role(self, rnd, admin, group):
        # Stated on its own because it is easy to get backwards. A second admin is refused nothing
        # for being an admin — they may confirm a member's payment — and it is the *payer* who is
        # refused. Until a verification worker exists, an admin's own contribution to their own
        # group therefore simply stays pending.
        second_admin = Membership.objects.get(group=group, order=3)
        second_admin.role = Membership.Role.ADMIN
        second_admin.save()

        contribution_id = self._pay(admin, rnd)

        payer_admin = api_for(admin).post(
            reverse("contribution-transition", args=[contribution_id, "verify"]), {}, format="json"
        )
        assert payer_admin.status_code == 403
        assert Contribution.objects.get(pk=contribution_id).status == "pending"

        # A different admin, who did not pay it, may.
        other_admin = api_for(second_admin.account).post(
            reverse("contribution-transition", args=[contribution_id, "verify"]), {}, format="json"
        )
        assert other_admin.status_code == 200
        assert Contribution.objects.get(pk=contribution_id).status == "verified"

    def test_a_member_may_still_void_their_own_unsettled_payment(self, rnd, payer):
        # Closing the freeze rule must not be collateral damage: cancelling something you started
        # and never sent still needs no authority beyond starting it.
        contribution_id = self._pay(payer, rnd)

        response = api_for(payer).post(
            reverse("contribution-transition", args=[contribution_id, "void"]), {}, format="json"
        )

        assert response.status_code == 200
        assert Contribution.objects.get(pk=contribution_id).status == "void"

    def test_a_member_may_not_void_somebody_elses_attempt(self, rnd, payer, group):
        other = Membership.objects.get(group=group, order=3).account
        contribution_id = self._pay(other, rnd)

        response = api_for(payer).post(
            reverse("contribution-transition", args=[contribution_id, "void"]), {}, format="json"
        )

        assert response.status_code == 403
        assert Contribution.objects.get(pk=contribution_id).status == "pending"

    def test_an_outsider_cannot_verify_at_all(self, rnd, payer, outsider):
        contribution_id = self._pay(payer, rnd)

        response = api_for(outsider).post(
            reverse("contribution-transition", args=[contribution_id, "verify"]), {}, format="json"
        )

        assert response.status_code == 403

    def test_there_is_still_no_way_to_declare_your_own_payment_failed(self, rnd, payer):
        # Not a permissions matter but a truth one: only the provider can say money never
        # arrived, so the transition is absent rather than restricted.
        contribution_id = self._pay(payer, rnd)

        response = api_for(payer).post(
            reverse("contribution-transition", args=[contribution_id, "fail"]), {}, format="json"
        )

        assert response.status_code == 404


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

    def test_the_ledger_residual_is_reported_and_is_zero(self, rnd, admin, payer):
        log_payment(api_for(payer), rnd)

        response = api_for(admin).post(
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

    def test_a_reversal_lets_the_member_pay_again(self, rnd, admin, payer):
        client = api_for(payer)
        created = log_payment(client, rnd, reference="API-MP-6")
        contribution_id = created.data["id"]

        verifier = api_for(admin)
        verifier.post(
            reverse("contribution-transition", args=[contribution_id, "verify"]),
            {}, format="json",
        )
        verifier.post(
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
    def test_verifying_grows_the_pot_and_the_collection_account(self, rnd, admin, payer):
        client = api_for(payer)
        verifier = api_for(admin)
        contribution_id = log_payment(client, rnd).data["id"]

        response = verifier.post(
            reverse("contribution-transition", args=[contribution_id, "verify"]),
            {}, format="json",
        )

        assert response.status_code == 200
        assert response.data["round"]["verifiedTotalPesewas"] == 10000
        assert response.data["round"]["ledger"]["partnerBalancePesewas"] == 10000
        assert response.data["round"]["closingFloatPesewas"] == 10000

    def test_verifying_twice_is_refused_and_posts_nothing(self, rnd, admin, payer):
        client = api_for(payer)
        verifier = api_for(admin)
        contribution_id = log_payment(client, rnd).data["id"]
        url = reverse("contribution-transition", args=[contribution_id, "verify"])

        assert verifier.post(url, {}, format="json").status_code == 200
        assert verifier.post(url, {}, format="json").status_code == 400
        assert rnd.ledger_entries.count() == 2

    def test_reversing_takes_the_money_back_and_is_never_silent(self, rnd, admin, payer):
        client = api_for(payer)
        verifier = api_for(admin)
        contribution_id = log_payment(client, rnd).data["id"]
        verifier.post(
            reverse("contribution-transition", args=[contribution_id, "verify"]),
            {}, format="json",
        )
        response = verifier.post(
            reverse("contribution-transition", args=[contribution_id, "reverse"]),
            {}, format="json",
        )

        assert response.data["contribution"]["status"] == "reversed"
        assert response.data["round"]["ledger"]["partnerBalancePesewas"] == 0
        assert response.data["round"]["ledger"]["residualPesewas"] == 0

    def test_reversing_an_older_payment_does_not_eat_a_live_one(self, rnd, admin, payer):
        # Found by the frontend integration suite. A reversed attempt is already excluded from
        # the verified total, so subtracting it again removes a cedi that is still in the
        # collection account. The float is what a member is told they have.
        client = api_for(payer)
        verifier = api_for(admin)

        first = log_payment(client, rnd, reference="API-F1").data["id"]
        verifier.post(
            reverse("contribution-transition", args=[first, "verify"]), {}, format="json"
        )
        verifier.post(
            reverse("contribution-transition", args=[first, "reverse"]), {}, format="json"
        )

        second = log_payment(client, rnd, amount=7500, reference="API-F2").data["id"]
        response = verifier.post(
            reverse("contribution-transition", args=[second, "verify"]), {}, format="json"
        )

        assert response.data["round"]["verifiedTotalPesewas"] == 7500
        assert response.data["round"]["closingFloatPesewas"] == 7500
        assert response.data["round"]["ledger"]["partnerBalancePesewas"] == 7500

    def test_the_audit_feed_shows_a_member_both_sides(self, group, rnd, admin, payer):
        client = api_for(payer)
        verifier = api_for(admin)
        contribution_id = log_payment(client, rnd).data["id"]
        verifier.post(
            reverse("contribution-transition", args=[contribution_id, "verify"]),
            {}, format="json",
        )

        response = client.get(reverse("group-audit", args=[group.id]))
        actions = [event["action"] for event in response.data]
        assert "contribution.recorded" in actions
        assert "contribution.verified" in actions

    def test_the_audit_feed_is_readable_by_any_member(self, group, rnd, admin, payer):
        client = api_for(payer)
        verifier = api_for(admin)
        contribution_id = log_payment(client, rnd).data["id"]
        verifier.post(
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


# --------------------------------------------------------------------------
# The member summary (the home tab's numbers, from the server)
# --------------------------------------------------------------------------


class TestMemberSummary:
    def test_anonymous_requests_are_refused(self, group):
        response = APIClient().get(reverse("member-summary"))
        assert response.status_code == 401

    def test_a_member_with_no_groups_sees_zeros(self, outsider):
        data = api_for(outsider).get(reverse("member-summary")).data

        assert data["groupCount"] == 0
        assert data["activeGroupCount"] == 0
        assert data["potTotalPesewas"] == 0
        assert data["contributedPesewas"] == 0
        assert data["receivedPesewas"] == 0
        assert data["debtPesewas"] == 0
        assert data["attentionCount"] == 0
        assert data["groups"] == []
        assert data["due"] == []

    def test_the_summary_counts_only_the_callers_own_groups(self, group, admin, outsider):
        data = api_for(admin).get(reverse("member-summary")).data

        assert data["activeGroupCount"] == 1
        assert data["adminOfCount"] == 1
        assert data["potTotalPesewas"] == group.target_pesewas
        assert [g["id"] for g in data["groups"]] == [group.id]
        assert data["groups"][0]["myRole"] == "admin"

        assert api_for(outsider).get(reverse("member-summary")).data["groups"] == []

    def test_contributed_counts_verified_money_and_nothing_else(self, group, rnd, admin, payer):
        client = api_for(payer)
        log_payment(client, rnd)

        # A logged payment is a claim, not money: it must not move the total.
        assert api_for(payer).get(reverse("member-summary")).data["contributedPesewas"] == 0

        contribution = Contribution.objects.get(membership__account=payer)
        api_for(admin).post(
            reverse("contribution-transition", args=[contribution.id, "verify"]),
            {}, format="json",
        )

        data = api_for(payer).get(reverse("member-summary")).data
        assert data["contributedPesewas"] == 10000

    def test_received_counts_completed_payouts_to_the_caller(self, group, rnd, admin):
        membership = Membership.objects.get(group=group, account=admin)
        Payout.objects.create(
            round=rnd, payout_key="summary-test-1", receiver=membership,
            amount_pesewas=30000, status=Payout.Status.COMPLETED,
        )

        assert api_for(admin).get(reverse("member-summary")).data["receivedPesewas"] == 30000

    def test_debt_is_summed_from_the_callers_memberships(self, group, rnd, payer):
        Membership.objects.filter(account=payer).update(debt_pesewas=2500)

        assert api_for(payer).get(reverse("member-summary")).data["debtPesewas"] == 2500

    def test_due_lists_an_open_round_the_caller_has_not_paid(self, group, rnd, payer):
        due = api_for(payer).get(reverse("member-summary")).data["due"]

        assert [entry["groupId"] for entry in due] == [group.id]
        assert due[0]["roundId"] == rnd.id
        assert due[0]["sharePesewas"] == rnd.share_for(
            Membership.objects.get(group=group, account=payer)
        )

    def test_a_round_with_an_attempt_in_flight_is_not_due(self, group, rnd, payer):
        log_payment(api_for(payer), rnd)

        assert api_for(payer).get(reverse("member-summary")).data["due"] == []

    def test_a_verified_round_is_not_due(self, group, rnd, admin, payer):
        contribution = log_payment(api_for(payer), rnd).data["id"]
        api_for(admin).post(
            reverse("contribution-transition", args=[contribution, "verify"]),
            {}, format="json",
        )

        assert api_for(payer).get(reverse("member-summary")).data["due"] == []

    def test_attention_counts_the_callers_open_attempts(self, group, rnd, payer, admin):
        log_payment(api_for(payer), rnd, reference="API-MP-ATTN")
        # Somebody else's attempt is not this member's attention.
        log_payment(api_for(admin), rnd, reference="API-MP-OTHER")

        assert api_for(payer).get(reverse("member-summary")).data["attentionCount"] == 1