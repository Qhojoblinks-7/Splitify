"""Is the registration true yet? Ask the code, not the plan.

    python manage.py privacy_compliance_report

The DPC registration form asks for particulars we either hold or do not (s.47(1)), and
s.47(2) makes knowingly supplying a false one an offence. A checklist maintained by hand drifts
from the code between one audit and the next, so this command derives the answer from what the
repository actually does: which controller particulars are still sentinels, whether the notice
carries the nine items s.27(2) requires, whether the payment partner it describes exists, and
whether any rights request has run past its statutory deadline.

Exit code 1 while anything is outstanding, so it can be wired into a deploy check rather than
read once and forgotten.

Deliberately *not* included: anything this command cannot see. It cannot tell you whether the
payment partner's agreement is signed, whether the hosting provider's contract permits the
transfer, or whether the data protection officer is certified. Those are in the launch gate in
`legal/act843/README.md`, and a clean report here is not permission to launch.
"""

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from compliance.models import DataSubjectRequest
from compliance.notice import NOTICE_SECTIONS, notice_gaps

#: s.27(2) enumerates the notice items (a) to (i). Checked against the Act's own letters rather
#: than against a count, so dropping one and adding another is a failure rather than a pass.
REQUIRED_NOTICE_KEYS = set("abcdefghi")


class Command(BaseCommand):
    help = "Report whether the Act 843 particulars are complete and the notice is served."

    def handle(self, *args, **options):
        findings = []

        for gap in notice_gaps():
            findings.append(
                f"controller.{gap} is not filled in — s.47(1) particulars cannot be submitted "
                f"with a placeholder in them"
            )

        present = {section["key"] for section in NOTICE_SECTIONS}
        for missing in sorted(REQUIRED_NOTICE_KEYS - present):
            findings.append(f"The notice has no s.27(2)({missing}) item")

        if settings.SUSU_RAIL == "unconfigured":
            findings.append(
                "No payment partner is configured, so the notice's account of the s.47(1)(f) "
                "transfers and s.47(1)(g) recipients describes an agreement that does not exist"
            )

        if not settings.DEBUG and settings.SECRET_KEY == "dev-only-not-for-production":
            findings.append("Production is running on the development secret key")

        now = timezone.now()
        for request in DataSubjectRequest.objects.open():
            if request.due_at <= now:
                findings.append(
                    f"Data subject request #{request.pk} ({request.kind}) is past the s.39(2) "
                    f"21-day deadline"
                )

        for text in findings:
            self.stdout.write(self.style.ERROR(f"  {text}"))

        if findings:
            self.stdout.write("")
            self.stdout.write(f"{len(findings)} item(s) outstanding.")
            raise SystemExit(1)

        self.stdout.write(
            self.style.SUCCESS("No gaps in anything this command can see from the code.")
        )
        self.stdout.write("")
        self.stdout.write(
            "This is not a launch decision. The signed items in legal/act843/README.md "
            "still apply."
        )
