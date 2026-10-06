"""The answer to "tell me what you hold about me", built rather than promised.

s.32(1)(c) and s.35(1)(c) require the personal data itself, in an intelligible form. s.35(1)(b)
requires the purposes and the recipients. s.35(1)(d) requires the logic behind any decision
that significantly affected the member. A request that produces a ticket number is none of
those, so this is a real report and the API returns it as one.

What is deliberately absent, and why, is part of the answer rather than a gap in it:

    the password hash          disclosing it would hand over the account
    the Ghana Card hash        a verifier, not a disclosure; the member is told it exists
    session tokens            identifying and useless to them, and a live secret if leaked
    other members' data        their phone numbers and emails are none of this member's business

What is deliberately present even though it is uncomfortable: the facts about other people
that appear in this member's own records, and the fact that their payment state is visible to
the group. s.32(1)(b) requires the member to be told who has had access to their data, and
answering "nobody" would be the one false thing in the document.
"""

from __future__ import annotations

from django.utils import timezone

from accounts.models import Account
from compliance.models import ConsentRecord, DataSubjectRequest
from compliance.notice import NOTICE_VERSION
from susu.ledger import AuditEvent
from susu.models import Contribution, Payout

#: Named, not omitted silently. A member who cannot see why something is missing will assume
#: the worst, and they are the only person who can decide whether the answer is good enough.
NOT_DISCLOSED = {
    "passwordHash": "Never disclosed. A hash of your password cannot be given to you without "
                    "also being given to anyone who read this report.",
    "ghanaCardHash": "We hold a one-way hash so a Ghana Card can be matched without being "
                     "stored. A hash is a verifier, not a record, and disclosing it serves no "
                     "purpose you can act on.",
    "sessionTokens": "Refresh and access tokens are not personal data you can use, and a live "
                     "one in a document is a live secret. Sign out to revoke them.",
    "otherMembers": "The names, numbers and email addresses of the other members of your groups "
                    "are not included. Your own records do quote them where a group action names "
                    "them, and those quotations are left exactly as they were written.",
}


def _iso(value):
    return value.isoformat() if value else None


def build_access_report(account: Account, *, at=None) -> dict:
    """Everything about one account, in the form s.32 and s.35 ask for."""
    at = at or timezone.now()

    memberships = list(
        account.memberships.select_related("group").order_by("group_id", "order")
    )
    membership_ids = [m.pk for m in memberships]

    contributions = list(
        Contribution.objects.filter(membership_id__in=membership_ids)
        .select_related("round", "round__group")
        .order_by("created_at")
    )
    payouts = list(
        Payout.objects.filter(receiver_id__in=membership_ids)
        .select_related("round", "round__group")
        .order_by("created_at")
    )
    events = list(
        AuditEvent.objects.filter(actor=account).select_related("group").order_by("created_at")
    )
    consents = list(ConsentRecord.objects.filter(account=account).order_by("created_at"))
    requests = list(DataSubjectRequest.objects.filter(account=account).order_by("requested_at"))

    return {
        "generatedAt": _iso(at),
        "noticeVersion": NOTICE_VERSION,
        "dataSubject": {
            "accountId": account.pk,
            "phone": account.phone,
            "email": account.email,
            "fullName": account.full_name,
            "phoneVerified": account.phone_verified,
            "idVerified": account.id_verified,
            "ghanaCardLast4": account.ghana_card_last4 or None,
            "trustScore": account.trust_score,
            "flaggedTotal": account.flagged_total,
            "payoutDestination": account.payout_destination or None,
            "createdAt": _iso(account.created_at),
            "lastActiveAt": _iso(account.last_active_at),
            "anonymisedAt": _iso(account.anonymised_at),
        },
        "purposes": "See the privacy notice, which lists every purpose with its own lawful basis.",
        "recipients": (
            "The other members of each group you belong to; your licensed mobile money partner, "
            "for the transaction references it checks; our infrastructure provider; and a "
            "regulator or court where the law requires it."
        ),
        "groups": [
            {
                "groupId": membership.group_id,
                "groupName": membership.group.name,
                "role": membership.role,
                "rotationOrder": membership.order,
                "active": membership.active,
                "joinedAt": _iso(membership.joined_at),
                "debtPesewas": membership.debt_pesewas,
                "debtReason": membership.debt_reason,
                "missedStreak": membership.missed_streak,
                "mobileMoneyOnFile": bool(membership.mobile_money),
            }
            for membership in memberships
        ],
        "contributions": [
            {
                "id": contribution.pk,
                "groupName": contribution.round.group.name,
                "roundNumber": contribution.round.number,
                "amountPesewas": contribution.amount_pesewas,
                "provider": contribution.provider,
                "reference": contribution.reference,
                "status": contribution.status,
                "failureReason": contribution.failure_reason or None,
                "manualVerificationReason": contribution.manual_verification_reason or None,
                "recordedAt": _iso(contribution.created_at),
                "paidAt": _iso(contribution.paid_at),
                "verifiedAt": _iso(contribution.verified_at),
            }
            for contribution in contributions
        ],
        "payoutsReceived": [
            {
                "id": payout.pk,
                "groupName": payout.round.group.name,
                "roundNumber": payout.round.number,
                "amountPesewas": payout.amount_pesewas,
                "feePesewas": payout.fee_pesewas,
                "status": payout.status,
                "providerReference": payout.provider_reference or None,
                "completedAt": _iso(payout.completed_at),
            }
            for payout in payouts
        ],
        "auditEvents": [
            {
                "id": event.pk,
                "action": event.action,
                "groupName": event.group.name if event.group_id else None,
                "roundNumber": event.round_number,
                "fromState": event.from_state or None,
                "toState": event.to_state or None,
                "reason": event.reason or None,
                "at": _iso(event.created_at),
            }
            for event in events
        ],
        "consents": [
            {
                "noticeVersion": consent.notice_version,
                "action": consent.action,
                "source": consent.source,
                "purposes": consent.purposes,
                "at": _iso(consent.created_at),
            }
            for consent in consents
        ],
        "requests": [
            {
                "id": request.pk,
                "kind": request.kind,
                "status": request.status,
                "detail": request.detail or None,
                "requestedAt": _iso(request.requested_at),
                "dueAt": _iso(request.due_at),
                "respondedAt": _iso(request.responded_at),
                "responseSummary": request.response_summary or None,
            }
            for request in requests
        ],
        "whoElseCanSeeIt": [
            "Every member of each group you belong to can see your name (or a masked number), "
            "your position in the rotation, what you have paid, and what you still owe.",
            "Every member can read the group's log of administrative actions, including yours.",
            "Your mobile money operator holds the payment itself, and the partner we ask about a "
            "reference holds the reference and the amount.",
        ],
        "decisionsAboutYou": (
            "No decision affecting you is taken by automated means. A flagged payment is "
            "recorded by a named group admin, costs that admin 25 trust points, is visible to "
            "every member, and can be disputed. Two flags remove the admin's role."
        ),
        "notDisclosed": NOT_DISCLOSED,
    }
