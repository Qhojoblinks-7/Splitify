"""
Create a test account you can sign in with from the app.

Repeatable on purpose: running it twice gives you the same account with a known password
rather than a second account you have to remember, which is the failure mode every "let me just
poke the database" session runs into.

    python manage.py create_test_account
    python manage.py create_test_account --phone +233201000001 --password ... --no-group

It refuses to invent anything quietly. The password is printed once and never logged, and it is
a real password on a real account, so this command is for local development and for a demo
database only. Running it against production would put a known credential in a database.

Rule IDs: 1791028270-security-fraud-and-identity.md I21, I23, P2
"""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Account
from susu.models import Membership, Round, SusuGroup

DEFAULT_PHONE = "+233201000001"
DEFAULT_PASSWORD = "GrowlDemo!2026"


class Command(BaseCommand):
    help = "Create (or reset) a development account and print its credentials."

    def add_arguments(self, parser):
        parser.add_argument("--phone", default=DEFAULT_PHONE)
        parser.add_argument("--password", default=DEFAULT_PASSWORD)
        parser.add_argument(
            "--name", default="Kwame Mensah", help="Display name for the account."
        )
        parser.add_argument(
            "--no-group",
            action="store_true",
            help="Create the account only, with no group to look at.",
        )
        parser.add_argument(
            "--target", type=int, default=30000, help="Group target in pesewas (GHc 300)."
        )

    @transaction.atomic
    def handle(self, *args, **options):
        phone = options["phone"].strip()
        password = options["password"]

        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError(
                "That password would not pass the project's own rules: " + "; ".join(exc.messages)
            )

        account, created = Account.objects.get_or_create(
            phone=phone, defaults={"full_name": options["name"]}
        )

        # Re-setting the password on an existing account is the point of calling this twice:
        # it is how you recover a forgotten demo login without writing to the database by hand.
        account.full_name = options["name"]
        account.set_password(password)
        account.save(update_fields=["full_name", "password"])

        membership = None
        if not options["no_group"]:
            membership = self._ensure_group(account, options["target"])

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Test account ready."))
        self.stdout.write(f"  phone     {account.phone}")
        self.stdout.write(f"  password  {password}")
        self.stdout.write(f"  name      {account.full_name}")
        self.stdout.write(f"  {'created' if created else 'reset  '}")

        if membership:
            group = membership.group
            round_ = Round.open_current(group)
            self.stdout.write(f"  group     {group.name} (id {group.id})")
            self.stdout.write(f"  invite    {group.invite_code}")
            self.stdout.write(
                f"  round     {round_.number}, target GHc {round_.target_pesewas / 100:.2f}"
            )

        self.stdout.write("")
        self.stdout.write("Sign in at /Auth/Login with the phone and password above.")
        self.stdout.write(
            "Run the API first:  backend\\.venv\\Scripts\\python.exe backend\\manage.py runserver"
        )
        self.stdout.write("")

    def _ensure_group(self, account, target_pesewas):
        """One demo group, reused on every run so the account is never in two groups."""
        group = SusuGroup.objects.filter(
            memberships__account=account, memberships__active=True
        ).first()
        if group is None:
            group = SusuGroup.objects.create_group(
                name="Growl Demo Susu",
                target_pesewas=target_pesewas,
                collection_day=5,
                admin=account,
                invite_code="GROWL01",
            )

        membership = Membership.objects.filter(group=group, account=account).first()
        if membership is None:
            membership = Membership.objects.create(group=group, account=account, order=1)

        # The account is the admin, so it holds order 1. Give it company, because a one-person
        # rotation has no shares to divide and makes the round screen look broken.
        if Membership.objects.filter(group=group).count() < 3:
            for order, (name, phone) in enumerate(
                [
                    ("Ama Serwaa", "+233201000002"),
                    ("Yaw Boateng", "+233201000003"),
                    ("Efua Danso", "+233201000004"),
                ],
                start=2,
            ):
                person, _ = Account.objects.get_or_create(
                    phone=phone, defaults={"full_name": name}
                )
                person.full_name = name
                person.set_unusable_password()
                person.save(update_fields=["full_name", "password"])
                Membership.objects.get_or_create(
                    group=group, account=person, defaults={"order": order}
                )

        return membership