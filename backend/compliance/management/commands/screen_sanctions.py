"""Periodic sanctions/PEP re-screening — Act 1044 compliance.

Run this from a scheduler (cron, systemd timer, Celery beat):

    python manage.py screen_sanctions --limit 500

It screens accounts that:
  - Have never been screened, OR
  - Were last screened more than SCREENING_RESCREEN_INTERVAL_DAYS ago

And have complete CDD (id_type + id_document_hash).
"""

from django.core.management.base import BaseCommand
from django.db import models
from django.utils import timezone

from accounts.models import Account
from compliance.screening import screen_account, screen_all_unscreened, get_screener
from compliance.models import SanctionsScreening, ScreeningStatus
from django.conf import settings


class Command(BaseCommand):
    help = "Re-screen accounts against sanctions/PEP lists per Act 1044."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=500,
            help="Maximum accounts to screen in one run. Default 500.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-screen even recently screened accounts (for testing).",
        )
        parser.add_argument(
            "--account-id",
            type=int,
            help="Screen a specific account by ID.",
        )

    def handle(self, *args, **options):
        screener = get_screener()
        if screener.__class__.__name__ == "UnconfiguredScreener":
            self.stderr.write(
                self.style.ERROR(
                    "No screening provider configured (COMPLIANCE_SCREENER). "
                    "Set it to 'stub', 'world_check', or 'dow_jones'."
                )
            )
            return

        account_id = options.get("account_id")
        if account_id:
            try:
                account = Account.objects.get(pk=account_id)
            except Account.DoesNotExist:
                self.stderr.write(self.style.ERROR(f"Account {account_id} not found"))
                return
            screening = screen_account(account)
            self._report_screening(screening)
            return

        limit = options["limit"]
        force = options["force"]

        # Accounts needing screening: never screened, or past re-screen interval
        cutoff = timezone.now() - timezone.timedelta(
            days=getattr(settings, "SCREENING_RESCREEN_INTERVAL_DAYS", 30)
        )

        queryset = Account.objects.exclude(id_type="", id_document_hash="")

        if force:
            # Screen all accounts with CDD, regardless of last screening date
            accounts = queryset[:limit]
        else:
            # Never screened OR last screened before cutoff
            accounts = queryset.filter(
                models.Q(sanctions_screened=False)
                | models.Q(sanctions_screened_at__lt=cutoff)
            )[:limit]

        screened = 0
        matches = 0
        errors = 0

        for account in accounts:
            screening = screen_account(account)
            screened += 1
            if screening.status == ScreeningStatus.POTENTIAL_MATCH:
                matches += 1
            elif screening.status == ScreeningStatus.ERROR:
                errors += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Screened {screened} accounts: {matches} potential matches, {errors} errors"
            )
        )

        if matches:
            self.stderr.write(
                self.style.WARNING(
                    f"{matches} potential matches require human review. "
                    "Check the admin or run with --account-id to inspect."
                )
            )

    def _report_screening(self, screening):
        status_style = {
            ScreeningStatus.CLEAR: self.style.SUCCESS,
            ScreeningStatus.POTENTIAL_MATCH: self.style.WARNING,
            ScreeningStatus.CONFIRMED_MATCH: self.style.ERROR,
            ScreeningStatus.FALSE_POSITIVE: self.style.NOTICE,
            ScreeningStatus.ERROR: self.style.ERROR,
            ScreeningStatus.PENDING: self.style.NOTICE,
        }
        style = status_style.get(screening.status, self.style.NOTICE)
        self.stdout.write(
            f"Account {screening.account_id} [{screening.source}] {style(screening.status)}"
        )
        if screening.match_name:
            self.stdout.write(f"  Match: {screening.match_name} (score: {screening.match_score})")
        if screening.match_details:
            self.stdout.write(f"  Details: {screening.match_details[:200]}")