"""What we keep, for how long, and what we do when the time is up.

Act 843 s.24 is short and unforgiving: no longer than necessary, and at expiry, destroy, delete
or de-identify, in a manner that prevents reconstruction. Everything in this module exists to
make that checkable rather than asserted, and the important design decision is the one about
erasure.

A member who asks us to delete their data is a member of a savings group. The payment history
is not ours to delete: it is the group's record, the other members are entitled to see it, and
s.24(1)(a) plus Act 1044 s.38 require seven years of it. So the honest answer to an erasure
request is two stages, and the notice says so before the member asks:

    anonymise  now. Name, email, Ghana Card residue, mobile money destination and the login
               identifier all go, the password is made unusable, and the account can no longer
               sign in. Nothing in the group's ledger changes, and nothing about who made a
               payment is left in the money record.

    delete     later, once the seven-year hold has passed *and* the account holds no membership
               and no contribution. The database refuses this on its own wherever a round or a
               payout names the person as receiver, which is the right answer rather than a
               constraint to work around.

The alternative — deleting the rows and leaving the group with a hole in its own record — is
not a privacy feature. It is a way of losing a member's right to see what they paid.
"""

from __future__ import annotations

from datetime import timedelta

from django.db import models
from django.db.models.deletion import ProtectedError
from django.utils import timezone

from accounts.models import Account
from susu.models import Contribution, Membership, Payout, Round
from susu.ledger import AuditEvent, LedgerEntry, LedgerPosting

#: Act 1044 s.38 requires transaction records to be kept for five years from the end of the
#: business relationship; the money rules in this codebase take seven, which is the longer of
#: the two and is what the notice publishes.
RECORD_HOLD_DAYS = 7 * 365

#: A refresh token is valid for seven days (see SIMPLE_JWT in settings). Nothing about a token is
#: needed a second after it expires, so it is the one category of personal data here with no
#: retention argument at all.
TOKEN_LIFETIME_DAYS = 7

#: s.24(1)(d) does not apply to consent records: consent is the basis for everything else, so
#: keeping it for as long as we keep the data it justifies is the minimum, not an excess.
CONSENT_RETENTION_DAYS = 3 * 365

#: s.32-35 requests and their answers. Three years is long enough to show an auditor what a
#: member asked and what we said, and short enough that a request nobody ever followed up on
#: does not sit in the database for a decade.
REQUEST_RETENTION_DAYS = 3 * 365

#: An account with no membership for this long is anonymised on the same terms as an erasure
#: request. The rule is the same — purpose exhausted, so the identifying data goes — and the
#: notice says so.
INACTIVE_ACCOUNT_DAYS = 2 * 365

RETENTION = {
    "ledger_and_audit": RECORD_HOLD_DAYS,
    "consent": CONSENT_RETENTION_DAYS,
    "privacy_requests": REQUEST_RETENTION_DAYS,
    "inactive_accounts": INACTIVE_ACCOUNT_DAYS,
    "session_tokens": TOKEN_LIFETIME_DAYS,
}


def _anonymised_phone(account_id: int) -> str:
    """A unique, undialable stand-in for a deleted number.

    Unique because the column is unique and the account row survives the ledger it appears in.
    Undiallable because anything resembling a Ghanaian number could be reassigned to somebody
    else, and a recycled phone number is a re-identification of a deleted member.
    """
    return f"anon-{account_id:010d}"


def anonymise_account(account: Account, *, at=None) -> Account:
    """Strip every identifier from an account, leaving the group's record intact.

    Idempotent, and reversible by nobody — which is the point. The synthetic phone means the
    account cannot be signed into, so there is no way to end up with a half-deleted account
    that still has a working session somewhere.
    """
    at = at or timezone.now()
    account.full_name = ""
    account.email = None
    account.ghana_card_last4 = ""
    account.ghana_card_hash = ""
    account.payout_destination = ""
    account.payout_destination_verified_at = None
    account.phone_verified = False
    account.id_verified = False
    account.phone = _anonymised_phone(account.pk)
    account.set_unusable_password()
    account.anonymised_at = at
    account.save()
    return account


def hard_delete_account(account: Account) -> tuple[bool, str]:
    """Delete an anonymised account outright, if the law and the ledger both allow it.

    Returns `(deleted, reason)`. A refusal is a normal outcome, not a failure: `Round.receiver`
    and `Payout.receiver` are `PROTECT`, so the database itself refuses to remove somebody the
    money record names. Working around that would mean rewriting the money record, which the
    ledger makes impossible and which would be the actual breach.
    """
    if account.anonymised_at is None:
        return False, "not anonymised: the identifying data is still there to delete properly"
    if account.memberships.exists():
        return False, "still holds a membership in a group"
    if Contribution.objects.filter(membership__account=account).exists():
        return False, "named in a payment record inside the seven-year hold"
    try:
        account.delete()
    except ProtectedError as exc:
        protected = sorted({getattr(obj, "_meta", None).model_name for obj in exc.protected_objects})
        return False, f"named as a receiver in the money record ({', '.join(protected)})"
    return True, "deleted"


def purge_expired_tokens(*, at=None, apply: bool = False) -> int:
    """Delete refresh and access tokens that can no longer authenticate anything.

    A blacklisted token is already refused; an outstanding one past its expiry can never be
    exchanged. Keeping either is keeping a pseudonymous handle to an account for no reason.
    """
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    at = at or timezone.now()
    cutoff = at - timedelta(days=TOKEN_LIFETIME_DAYS)
    stale = OutstandingToken.objects.filter(expires_at__lt=at - timedelta(days=1))
    revoked = BlacklistedToken.objects.filter(blacklisted_at__lt=cutoff)
    count = stale.count() + revoked.count()
    if apply and count:
        # Outstanding first: a blacklisted row is protected by its outstanding row.
        stale.delete()
        revoked.delete()
    return count


def purge_expired_consents(*, at=None, apply: bool = False) -> int:
    """Consent records older than the retention period, for accounts long since anonymised.

    Only for anonymised accounts. A live member's consent is the basis on which everything else
    is held, so deleting it while the data stands would leave the processing with no recorded
    justification — the opposite of what s.17(a) asks for.
    """
    at = at or timezone.now()
    cutoff = at - timedelta(days=CONSENT_RETENTION_DAYS)
    from .models import ConsentRecord

    stale = ConsentRecord.objects.filter(
        created_at__lt=cutoff, account__anonymised_at__isnull=False
    )
    count = stale.count()
    if apply and count:
        stale.delete()
    return count


def purge_expired_requests(*, at=None, apply: bool = False) -> int:
    """Closed requests past their retention period.

    An open request is never purged. It has a statutory clock running against us and it is the
    evidence that we were asked.
    """
    at = at or timezone.now()
    cutoff = at - timedelta(days=REQUEST_RETENTION_DAYS)
    from .models import DataSubjectRequest

    stale = DataSubjectRequest.objects.filter(
        status__in=DataSubjectRequest.CLOSED_STATUSES, responded_at__lt=cutoff
    )
    count = stale.count()
    if apply and count:
        stale.delete()
    return count


def inactive_accounts(*, at=None, window: int = INACTIVE_ACCOUNT_DAYS) -> list[Account]:
    """Accounts that have sat outside every group for longer than the schedule allows.

    `last_active_at` is written by `LastSeenMiddleware` at most once a day per account, so it
    measures use rather than writes — an account that only ever records a payment is still
    being used, and a dormant one is not.
    """
    at = at or timezone.now()
    cutoff = at - timedelta(days=window)
    return list(
        Account.objects.filter(anonymised_at__isnull=True, last_active_at__lt=cutoff)
        .exclude(memberships__active=True)
        .distinct()
    )


def retention_report(*, at=None) -> dict:
    """Everything the schedule would do today, with nothing changed.

    The report is the artefact the data protection office reviews. A schedule nobody can
    inspect is a schedule nobody can rely on when the Commission asks what happened to the
    records of an account that closed two years ago.
    """
    at = at or timezone.now()
    due = Account.objects.filter(anonymised_at__isnull=False, anonymised_at__lt=at - timedelta(days=RECORD_HOLD_DAYS))
    return {
        "generatedAt": at.isoformat(),
        "schedule": {key: {"days": value} for key, value in sorted(RETENTION.items())},
        "recordHoldDays": RECORD_HOLD_DAYS,
        "tokens": purge_expired_tokens(at=at),
        "consents": purge_expired_consents(at=at),
        "requests": purge_expired_requests(at=at),
        "inactiveAccounts": [
            {"id": account.pk, "lastActiveAt": account.last_active_at.isoformat() if account.last_active_at else None}
            for account in inactive_accounts(at=at)
        ],
        "anonymisedAwaitingDeletion": [
            {"id": account.pk, "anonymisedAt": account.anonymised_at.isoformat()}
            for account in due
        ],
    }


def apply_retention(*, at=None) -> dict:
    """Run the schedule. The only function here that writes, and only when asked."""
    at = at or timezone.now()
    report = retention_report(at=at)

    for account in Account.objects.filter(
        anonymised_at__isnull=False,
        anonymised_at__lt=at - timedelta(days=RECORD_HOLD_DAYS),
    ):
        deleted, reason = hard_delete_account(account)
        report.setdefault("deleted", []).append({"id": account.pk, "deleted": deleted, "reason": reason})

    for account in inactive_accounts(at=at):
        anonymise_account(account, at=at)
        report.setdefault("anonymised", []).append({"id": account.pk})

    report["tokensDeleted"] = purge_expired_tokens(at=at, apply=True)
    report["consentsDeleted"] = purge_expired_consents(at=at, apply=True)
    report["requestsDeleted"] = purge_expired_requests(at=at, apply=True)
    return report
