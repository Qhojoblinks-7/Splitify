"""Run the retention schedule, or show what it would do.

    python manage.py purge_expired_personal_data            # report only, changes nothing
    python manage.py purge_expired_personal_data --apply

Report-only by default because this command deletes rows. A schedule that runs only when
somebody remembers an extra flag is the schedule that quietly stops, and one that runs
unattended from memory is the one that deletes something a member still needs. The report is
therefore the primary output, and `--apply` is a separate, deliberate act.

s.24(5) requires destruction or de-identification at the expiry of the retention period, and
s.24(6) requires it in a manner that prevents reconstruction. Anonymising an account replaces
the phone number with a unique undialable value rather than nulling a column, so the row
cannot be re-identified by joining it back to a number that has since been reissued.
"""

from django.core.management.base import BaseCommand

from compliance.retention import apply_retention, retention_report


class Command(BaseCommand):
    help = "Report (and with --apply, execute) the Act 843 s.24 retention schedule."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually purge. Without this flag nothing is written.",
        )

    def handle(self, *args, **options):
        if not options["apply"]:
            report = retention_report()
            self.stdout.write(self.style.WARNING("DRY RUN. Nothing has been changed."))
            self._print(report)
            self.stdout.write("")
            self.stdout.write("Re-run with --apply to carry this out.")
            return

        report = apply_retention()
        self._print(report)
        self.stdout.write("")

    def _print(self, report):
        schedule = report["schedule"]
        self.stdout.write(f"Retention schedule (record hold {report['recordHoldDays']} days):")
        for name, entry in schedule.items():
            self.stdout.write(f"  {name:<20} {entry['days']} days")

        self.stdout.write("")
        self.stdout.write("Eligible now:")
        self.stdout.write(f"  expired tokens            {report['tokens']}")
        self.stdout.write(f"  expired consent records   {report['consents']}")
        self.stdout.write(f"  expired rights requests   {report['requests']}")
        self.stdout.write(f"  dormant accounts          {len(report['inactiveAccounts'])}")
        for row in report["inactiveAccounts"]:
            self.stdout.write(f"      account {row['id']} last active {row['lastActiveAt']}")
        for row in report["anonymisedAwaitingDeletion"]:
            self.stdout.write(
                f"      account {row['id']} anonymised {row['anonymisedAt']} "
                f"— hold expired, deletion attempted"
            )
        for row in report.get("deleted", []):
            verdict = "deleted" if row["deleted"] else "retained"
            self.stdout.write(f"      account {row['id']}: {verdict} — {row['reason']}")
