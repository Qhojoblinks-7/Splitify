"""The data protection office's queue.

    python manage.py privacy_requests list [--overdue]
    python manage.py privacy_requests show <id>
    python manage.py privacy_requests respond <id> --status answered --summary "..."
    python manage.py privacy_requests respond <id> --status partially_refused \
        --summary "..." --evidence "Act 843 s.24(1)(a), Act 1044 s.38"
    python manage.py privacy_requests execute-erasure <id> --handled-by "Name, DPO"

Why a management command and not an admin site. Two reasons, and the second is the one that
matters. First, `django.contrib.admin` is deliberately not installed: it is a full database
editor behind a login, and this system holds a money record that must never be edited. Second,
a rights queue answered by a group admin would be a conflict of interest in the strictest
available sense — the person deciding whether a member's data is erased is the person the member
may be erasing it over. The queue belongs to whoever holds the mandate in s.58, and that person
should not be a member of any group in the product.

`respond` refuses to close a request as a refusal without `--evidence`, because s.33(2) and
s.39(2) both require reasons and a refusal with no stated reason is not an answer.

`execute-erasure` is the only path that anonymises an account, and it requires the request to
be an open erasure request. Consent is not a formality here: the member asked.

The queue has no equivalent on the DPC side to this file. See `legal/act843/README.md` for the
launch gate, of which this is one item.
"""

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from compliance.models import DataSubjectRequest
from compliance.retention import anonymise_account, hard_delete_account

class Command(BaseCommand):
    help = "List, inspect and answer data subject requests."

    def add_arguments(self, parser):
        subparsers = parser.add_subparsers(dest="action", required=True)

        listing = subparsers.add_parser("list", help="Requests, newest first.")
        listing.add_argument("--overdue", action="store_true", help="Only the overdue ones.")
        listing.add_argument("--open", action="store_true", help="Only the open ones.")
        listing.add_argument("--kind", choices=[c for c, _ in DataSubjectRequest.Kind.choices])

        show = subparsers.add_parser("show", help="One request in full.")
        show.add_argument("id", type=int)

        respond = subparsers.add_parser("respond", help="Close a request with an answer.")
        respond.add_argument("id", type=int)
        respond.add_argument(
            "--status",
            required=True,
            choices=[
                DataSubjectRequest.Status.ANSWERED,
                DataSubjectRequest.Status.PARTIALLY_REFUSED,
                DataSubjectRequest.Status.REFUSED,
            ],
        )
        respond.add_argument("--summary", default="", help="What was done, or will be done.")
        respond.add_argument(
            "--evidence",
            default="",
            help="The reasons, with the section relied on. Required for any refusal.",
        )
        respond.add_argument("--handled-by", default="", help="Name of the person answering.")

        erase = subparsers.add_parser(
            "execute-erasure", help="Anonymise the account behind an open erasure request."
        )
        erase.add_argument("id", type=int)
        erase.add_argument("--handled-by", default="")
        erase.add_argument(
            "--delete",
            action="store_true",
            help="Also attempt the outright deletion. Refused by the database where the money "
                 "record names this person, which is the correct answer.",
        )

    def handle(self, *args, **options):
        return {
            "list": self._list,
            "show": self._show,
            "respond": self._respond,
            "execute-erasure": self._execute_erasure,
        }[options["action"]](options)

    # -- list ------------------------------------------------------------

    def _list(self, options):
        requests = DataSubjectRequest.objects.select_related("account").order_by("due_at")
        if options["kind"]:
            requests = requests.filter(kind=options["kind"])
        if options["open"]:
            requests = requests.open()
        if options["overdue"]:
            requests = [r for r in requests if r.is_overdue()]

        if not requests:
            self.stdout.write("Nothing in the queue.")
            return

        now = timezone.now()
        for request in requests:
            account = request.account
            who = f"{account.display_name} (account {account.pk}, {account.masked_phone})"
            state = request.status
            if request.is_overdue():
                state = self.style.ERROR(f"{request.status} OVERDUE")
            elif request.status in DataSubjectRequest.OPEN_STATUSES:
                remaining = (request.due_at - now).days
                state = f"{request.status} ({remaining}d left)"
            self.stdout.write(f"  #{request.pk:<5} {request.kind:<17} {state:<28} {who}")
            self.stdout.write(
                f"        asked {request.requested_at:%Y-%m-%d}, due {request.due_at:%Y-%m-%d} "
                f"(s.39(2): 21 days)"
            )
            if request.detail:
                self.stdout.write(f"        member said: {request.detail[:160]}")

    # -- show ------------------------------------------------------------

    def _show(self, options):
        request = self._get(options["id"])
        self.stdout.write(f"Request #{request.pk} — {request.kind}")
        self.stdout.write(f"  member     {request.account.display_name} (account {request.account.pk})")
        self.stdout.write(f"  status     {request.status}")
        self.stdout.write(f"  asked      {request.requested_at:%Y-%m-%d %H:%M} UTC")
        self.stdout.write(f"  due        {request.due_at:%Y-%m-%d %H:%M} UTC")
        self.stdout.write(f"  answered   {request.responded_at or '—'}")
        self.stdout.write(f"  overdue    {request.is_overdue()}")
        self.stdout.write(f"  detail     {request.detail or '—'}")
        self.stdout.write(f"  summary    {request.response_summary or '—'}")
        self.stdout.write(f"  evidence   {request.evidence or '—'}")
        self.stdout.write(f"  handled by {request.handled_by or '—'}")

    # -- respond ---------------------------------------------------------

    def _respond(self, options):
        request = self._get(options["id"])
        try:
            request.mark(
                options["status"],
                summary=options["summary"],
                evidence=options["evidence"],
                handled_by=options["handled_by"],
            )
        except ValidationError as exc:
            raise CommandError("; ".join(exc.messages))
        self.stdout.write(
            self.style.SUCCESS(
                f"Request #{request.pk} closed as {request.status}. "
                f"Answered within {self._days_taken(request)} of the s.39(2) deadline."
            )
        )

    def _days_taken(self, request):
        if not request.responded_at:
            return "n/a"
        days = (request.responded_at - request.requested_at).days
        return f"{days} day(s)"

    # -- erasure ---------------------------------------------------------

    def _execute_erasure(self, options):
        request = self._get(options["id"])
        if request.kind != DataSubjectRequest.Kind.ERASE:
            raise CommandError(
                f"Request #{request.pk} is a {request.kind} request. An account is only "
                f"anonymised on an erasure request, and never on a general one."
            )
        if request.status not in DataSubjectRequest.OPEN_STATUSES:
            raise CommandError(
                f"Request #{request.pk} was already closed as {request.status}. Raise a new one "
                f"if the member wants this again."
            )

        account = request.account
        with transaction.atomic():
            anonymise_account(account)
            note = (
                "Your account has been anonymised: your name, email, mobile money destination, "
                "Ghana Card details and login number have been removed and the account can no "
                "longer sign in. The group's payment record is kept, because the other members "
                "are entitled to it and the law requires us to hold it for seven years (Act 843 "
                "s.24(1)(a)). It no longer identifies you to them."
            )
            request.mark(
                DataSubjectRequest.Status.PARTIALLY_REFUSED,
                summary=note,
                evidence=(
                    "Part refused under Act 843 s.24(1)(a) and s.33(1)(b): the ledger, audit "
                    "trail and contribution rows are the savings group's shared record and are "
                    "subject to the seven-year hold under the Anti-Money Laundering Act, 2020 "
                    "(Act 1044) s.38. They are retained de-identified."
                ),
                handled_by=options["handled_by"],
            )
            deleted, reason = ("not attempted", "deletion not requested")
            if options["delete"]:
                deleted, reason = hard_delete_account(account)

        self.stdout.write(self.style.SUCCESS(f"Account {account.pk} anonymised."))
        self.stdout.write(f"  deletion: {deleted} — {reason}")

    def _get(self, request_id):
        try:
            return DataSubjectRequest.objects.select_related("account").get(pk=request_id)
        except (DataSubjectRequest.DoesNotExist, ValueError):
            raise CommandError(f"No request #{request_id}.")
