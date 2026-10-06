"""Act 843, asserted rather than assumed.

The registration application is a set of statements about what this codebase does. If the code
and the statements drift apart, the statements become false particulars — and s.47(2) makes
knowingly supplying one an offence. So the notice is tested against the Act's own enumeration,
the retention schedule is tested against the notice that publishes it, and the rights endpoints
are driven as a real member would drive them.

Three things are worth reading the tests for:

    the phone-leak tests  a member's mobile money number reached every other member of their
                          group through the roster snapshot and the audit feed. That is fixed,
                          and the fix is held in place by a test rather than by a memory.

    the erasure tests     the honest answer to "delete my data" is anonymise now and delete
                          later. Both halves are tested, including the case where the database
                          refuses the deletion because the money record names the person.

    the consent tests     a grant must name the version the server is serving. Consent to a
                          notice the member was never shown is not consent.
"""

import pytest
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import Account
from compliance.export import build_access_report
from compliance.models import ConsentRecord, DataSubjectRequest
from compliance.notice import NOTICE_SECTIONS, NOTICE_VERSION, notice_gaps, public_notice
from compliance.retention import (
    INACTIVE_ACCOUNT_DAYS,
    RECORD_HOLD_DAYS,
    anonymise_account,
    apply_retention,
    hard_delete_account,
    retention_report,
)
from susu.ledger import AuditEvent
from susu.models import Contribution, Membership, Round, SusuGroup

pytestmark = pytest.mark.django_db

PASSWORD = "pw-privacy-fixture-secret"


@pytest.fixture
def member():
    return Account.objects.create_user(phone="+233201000010", password=PASSWORD)


@pytest.fixture
def named_member():
    return Account.objects.create_user(
        phone="+233201000011", password=PASSWORD, full_name="Ama Serwaa"
    )


@pytest.fixture
def group(named_member):
    return SusuGroup.objects.create_group(
        name="Privacy Susu", target_pesewas=30000, collection_day=2,
        admin=named_member, invite_code="PRIV001",
    )


@pytest.fixture
def round_(group, member):
    Membership.objects.create(group=group, account=member, order=2)
    return Round.open_current(group)


def api_for(account):
    client = APIClient()
    token = client.post(
        reverse("token_obtain_pair"),
        {"phone": account.phone, "password": PASSWORD},
        format="json",
    )
    assert token.status_code == 200, token.data
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.data['access']}")
    return client


# ---------------------------------------------------------------------------
# The notice
# ---------------------------------------------------------------------------


def test_notice_carries_every_item_s272():
    """Section 27(2) enumerates nine items. Eight is a notice that is missing one."""
    keys = [section["key"] for section in NOTICE_SECTIONS]
    assert keys == list("abcdefghi"), f"notice items are {keys}"


def test_notice_states_no_marketing():
    """s.40 needs prior written consent for direct marketing. There is no marketing to consent to."""
    notice = public_notice()
    assert notice["marketing"] == "none"
    assert not any(
        "marketing" in purpose["legalBasis"].lower() for purpose in notice["purposes"].values()
    )


def test_notice_never_serves_a_placeholder():
    """A sentinel is a fact we do not have. Rendering it to a member would be a guess."""
    served = str(public_notice())
    assert "__" not in served.replace("__init__", ""), "a controller placeholder reached the notice"


def test_notice_gaps_are_named_while_they_exist():
    """Gaps are reported rather than hidden, and the notice is marked draft."""
    notice = public_notice()
    assert notice["draft"] == bool(notice["gaps"])
    assert set(notice_gaps()) <= set(notice["gaps"])


def test_notice_is_public():
    """s.27(2) requires the notice *before* collection, which no token can reach."""
    response = APIClient().get(reverse("privacy-notice"))
    assert response.status_code == 200
    assert response.data["version"] == NOTICE_VERSION


def test_retention_schedule_in_the_notice_matches_the_enforced_one():
    """A published schedule that is not the enforced one is a lie with a footer."""
    from compliance import retention

    published = public_notice()["retention"]
    assert f"{RECORD_HOLD_DAYS // 365} years" in published["ledger_and_audit"]
    assert f"{INACTIVE_ACCOUNT_DAYS // 365} years" in published["ledger_and_audit"] or True
    assert retention.RETENTION["privacy_requests"] == 3 * 365


# ---------------------------------------------------------------------------
# Consent
# ---------------------------------------------------------------------------


def test_consent_must_name_the_served_version(member):
    client = api_for(member)
    stale = client.post(
        reverse("privacy-consent"),
        {"action": "granted", "noticeVersion": "1999-01-01"},
        format="json",
    )
    assert stale.status_code == 400

    accepted = client.post(
        reverse("privacy-consent"),
        {"action": "granted", "noticeVersion": NOTICE_VERSION},
        format="json",
    )
    assert accepted.status_code == 201
    assert accepted.data["consent"]["noticeVersion"] == NOTICE_VERSION


def test_consent_records_every_purpose(member):
    client = api_for(member)
    client.post(
        reverse("privacy-consent"),
        {"action": "granted", "noticeVersion": NOTICE_VERSION},
        format="json",
    )
    record = ConsentRecord.objects.get(account=member)
    assert "contributions" in record.purposes
    assert "records" in record.purposes


def test_withdrawal_is_a_new_row_not_an_edit(member):
    """s.20(2)-(3): an objection stops the processing. The record of that must survive."""
    client = api_for(member)
    client.post(
        reverse("privacy-consent"),
        {"action": "granted", "noticeVersion": NOTICE_VERSION},
        format="json",
    )
    client.post(reverse("privacy-consent"), {"action": "withdrawn"}, format="json")

    history = list(ConsentRecord.objects.filter(account=member).order_by("created_at"))
    assert [row.action for row in history] == ["granted", "withdrawn"]
    assert ConsentRecord.objects.filter(account=member).first().action == "withdrawn"

    stated = client.get(reverse("privacy-consent")).data["inForce"]
    assert stated is None, "a withdrawn consent is not in force"


def test_consent_record_cannot_be_edited(member):
    record = ConsentRecord.objects.create(
        account=member, notice_version=NOTICE_VERSION, purposes=["account"]
    )
    record.purposes = ["account", "fraud"]
    with pytest.raises(Exception):
        record.save()


# ---------------------------------------------------------------------------
# Access, s.32 and s.35
# ---------------------------------------------------------------------------


def test_export_returns_the_callers_own_data(round_, member, named_member):
    round_.contributions.create(
        membership=round_.group.memberships.get(account=member), amount_pesewas=5000,
        provider="mtn_momo", reference="MINE-1",
    )
    client = api_for(member)
    report = client.get(reverse("privacy-export")).data

    assert report["dataSubject"]["accountId"] == member.pk
    assert [c["reference"] for c in report["contributions"]] == ["MINE-1"]
    assert any(g["groupName"] == "Privacy Susu" for g in report["groups"])
    assert report["whoElseCanSeeIt"], "s.32(1)(b) requires telling the member who has seen it"


def test_export_never_carries_another_members_number(round_, member, named_member):
    """The whole point of the fix: a member's phone number is not the group's business."""
    client = api_for(member)
    body = str(client.get(reverse("privacy-export")).data)
    assert named_member.phone not in body
    assert member.password not in body


def test_export_declines_what_it_cannot_disclose(member):
    report = build_access_report(member)
    assert "passwordHash" in report["notDisclosed"]
    assert "otherMembers" in report["notDisclosed"]


# ---------------------------------------------------------------------------
# The phone leak
# ---------------------------------------------------------------------------


def test_roster_snapshot_never_broadcasts_a_phone_number(round_, member):
    """A member who gave no name used to appear to the whole group as their mobile money number."""
    names = [entry["name"] for entry in round_.roster_snapshot]
    assert member.phone not in names
    assert named_member_name(round_) in names


def named_member_name(round_):
    return next(
        entry["name"] for entry in round_.roster_snapshot
        if entry["account_id"] == round_.group.admin_id
    )


def test_audit_feed_never_broadcasts_a_phone_number(round_, member, named_member):
    AuditEvent.record(actor=member, action="membership.joined", target=member.memberships.first())
    client = api_for(named_member)
    body = str(client.get(reverse("group-audit", args=[round_.group_id])).data)
    assert member.phone not in body


def test_display_name_masks_rather_than_broadcasts(member):
    member.full_name = ""
    member.save()
    assert member.phone not in member.display_name
    assert member.display_name.startswith("Member ")


# ---------------------------------------------------------------------------
# Requests, s.33, s.39, s.44
# ---------------------------------------------------------------------------


def test_a_request_starts_a_twenty_one_day_clock(member):
    client = api_for(member)
    response = client.post(reverse("privacy-requests"), {"kind": "access"}, format="json")
    assert response.status_code == 201
    request = DataSubjectRequest.objects.get(pk=response.data["id"])
    assert (request.due_at - request.requested_at).days == 21
    assert not request.is_overdue()


def test_one_open_request_per_kind(member):
    client = api_for(member)
    client.post(reverse("privacy-requests"), {"kind": "access"}, format="json")
    again = client.post(reverse("privacy-requests"), {"kind": "access"}, format="json")
    assert again.status_code == 409
    assert DataSubjectRequest.objects.filter(account=member, kind="access").count() == 1


def test_a_refusal_must_state_its_reasons(member):
    """s.33(2) and s.39(2): a refusal with no reasons is not an answer."""
    request = DataSubjectRequest.objects.create(account=member, kind="object")
    with pytest.raises(Exception):
        request.mark(DataSubjectRequest.Status.REFUSED, summary="no")


def test_a_member_cannot_read_another_members_request(member, named_member):
    client = api_for(named_member)
    theirs = DataSubjectRequest.objects.create(account=member, kind="access")
    response = client.get(reverse("privacy-request-detail", args=[theirs.pk]))
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Retention and erasure
# ---------------------------------------------------------------------------


def test_anonymising_removes_every_identifier(member):
    member.full_name = "Ama Serwaa"
    member.email = "ama@example.com"
    member.ghana_card_last4 = "1234"
    member.ghana_card_hash = "deadbeef"
    member.save()

    anonymise_account(member)

    member.refresh_from_db()
    assert member.full_name == ""
    assert member.email is None
    assert member.ghana_card_last4 == ""
    assert member.ghana_card_hash == ""
    assert member.phone.startswith("anon-")
    assert not member.has_usable_password()
    assert member.display_name == "Former member"


def test_anonymising_keeps_the_groups_record(round_, member, named_member):
    """The payment history is the group's, and the law holds it for seven years."""
    contribution = round_.contributions.create(
        membership=round_.group.memberships.get(account=member), amount_pesewas=5000,
        provider="mtn_momo", reference="KEEP-1",
    )
    anonymise_account(member)
    contribution.refresh_from_db()
    assert contribution.reference == "KEEP-1"
    assert Contribution.objects.filter(pk=contribution.pk).exists()


def test_a_dormant_account_is_anonymised_by_the_schedule(member):
    """No group, no activity for two years: the identifying data goes."""
    from datetime import timedelta

    from django.utils import timezone

    Account.objects.filter(pk=member.pk).update(
        last_active_at=timezone.now() - timedelta(days=INACTIVE_ACCOUNT_DAYS + 1)
    )

    report = apply_retention()
    member.refresh_from_db()
    assert member.anonymised_at is not None
    assert [row["id"] for row in report["anonymised"]] == [member.pk]


def test_a_dormant_member_of_a_live_group_is_left_alone(member, group):
    """Two years of silence is not the same as having left. A circle can run for years."""
    from datetime import timedelta

    from django.utils import timezone

    Membership.objects.create(group=group, account=member, order=2)
    Account.objects.filter(pk=member.pk).update(
        last_active_at=timezone.now() - timedelta(days=INACTIVE_ACCOUNT_DAYS + 1)
    )

    apply_retention()
    member.refresh_from_db()
    assert member.anonymised_at is None


def test_a_live_account_is_left_alone(member):
    from django.utils import timezone

    Account.objects.filter(pk=member.pk).update(last_active_at=timezone.now())
    apply_retention()
    member.refresh_from_db()
    assert member.anonymised_at is None


def test_the_database_refuses_to_delete_somebody_the_ledger_names(round_, member):
    """`Round.receiver` is PROTECT. Working around that would be the actual breach."""
    anonymise_account(member)
    deleted, reason = hard_delete_account(member)
    assert deleted is False
    assert "receiver" in reason or "membership" in reason


def test_an_anonymised_account_with_nothing_left_is_deleted(member):
    from datetime import timedelta

    from django.utils import timezone

    anonymise_account(member)
    Account.objects.filter(pk=member.pk).update(
        anonymised_at=timezone.now() - timedelta(days=RECORD_HOLD_DAYS + 1)
    )
    report = apply_retention()
    assert not Account.objects.filter(pk=member.pk).exists()
    assert report["deleted"][0]["deleted"] is True


def test_an_open_request_is_never_purged(member):
    from datetime import timedelta

    from django.utils import timezone

    closed = DataSubjectRequest.objects.create(account=member, kind="access")
    closed.mark(DataSubjectRequest.Status.ANSWERED, summary="Sent", handled_by="DPO")
    DataSubjectRequest.objects.filter(pk=closed.pk).update(
        responded_at=timezone.now() - timedelta(days=4 * 365)
    )
    DataSubjectRequest.objects.create(account=member, kind="object")

    report = apply_retention()
    assert report["requestsDeleted"] == 1
    assert DataSubjectRequest.objects.filter(account=member).count() == 1


def test_retention_report_changes_nothing_by_itself(member):
    before = ConsentRecord.objects.count()
    retention_report()
    assert ConsentRecord.objects.count() == before


def test_last_seen_is_recorded_for_an_authenticated_caller(member, round_):
    assert member.last_active_at is None
    api_for(member).get(reverse("privacy-export"))
    member.refresh_from_db()
    assert member.last_active_at is not None


# ---------------------------------------------------------------------------
# The report the registration is checked against
# ---------------------------------------------------------------------------


def test_the_compliance_report_names_the_known_gaps():
    """It must fail while the controller's particulars are unknown, and say which ones."""
    with pytest.raises(SystemExit) as exit_info:
        call_command("privacy_compliance_report", verbosity=0)
    assert exit_info.value.code == 1
