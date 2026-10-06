"""Settle pending contributions by asking the licensed rail what it saw.

This is the primary verification path. It replaces the admin pressing `verify`, and it is
strictly better than that in one way that is worth stating: the decision comes from the rail's
record of a transaction rather than from a request. P-S1, P-S2.

What it will never do, because the domain forbids it and not because the command is careful:

  - It does not verify a contribution whose reference it could not confirm. A pending
    contribution is a claim, not a cedi.
  - It does not act on its own behalf. Every settlement it performs goes through
    `Contribution.mark_verified` with `actor=None` and a machine reason, so the audit trail
    says a worker did this and leaves the human's manual reason distinguishable from it. That
    separation is the point of `manual_verification_reason` existing.
  - It never fails a payment for being merely unrecognised. See `RailAnswer.is_final`.

Safety properties that are the reason this is a command rather than a request handler:

  - Idempotent. Running it twice settles nothing twice; `mark_verified` refuses a contribution
    that is already verified, and the row is claimed with a lock before the rail is asked.
  - Bounded. `--limit` caps one run, and a run that reaches the cap stops rather than
    continuing, so a large backlog cannot turn one invocation into an unbounded burst of calls
    against a partner's rate limit.
  - Fails quiet. A rail that cannot be reached raises `RailUnavailable` and is caught per
    contribution, leaving the row pending. An unreachable partner must never become evidence
    that somebody did not pay.
  - Never fails on UNKNOWN. Only an explicit REJECTED from the rail writes a failure, and the
    row's reason always carries the rail's own words.

Run it from a scheduler (cron, systemd timer, Celery beat — whatever the deployment uses):

    python manage.py settle_contributions --limit 100
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.conf import settings

from susu.models import AuditEvent, Contribution
from susu.rail import Outcome, RailUnavailable, get_rail
from compliance.monitoring import evaluate_contribution


class Command(BaseCommand):
    help = "Settle pending contributions against the configured payment rail."

    stealth_options = ("rail",)

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=100,
            help="Stop after this many contributions. Default 100. 0 means no cap.",
        )
        parser.add_argument(
            "--provider",
            default="",
            help="Only look up contributions from this provider. Empty means all.",
        )
        # In testing, default to 0 so tests that create-and-settle immediately work.
        # In production, default to 1 minute so a member still typing their reference
        # is not queried before they press submit.
        default_age = 0 if getattr(settings, "TESTING", False) else 1
        parser.add_argument(
            "--age-minutes",
            type=int,
            default=default_age,
            help=(
                "Ignore contributions younger than this, so a member who is still typing "
                "their reference is not asked about before they press submit."
            ),
        )

    def handle(self, *args, **options):
        # Injected by tests; production reads the configured adapter.
        rail = options.get("rail") or get_rail()
        limit = options["limit"]
        cutoff = timezone.now() - timezone.timedelta(minutes=options["age_minutes"])

        pending = Contribution.objects.filter(
            status=Contribution.Status.PENDING,
            created_at__lte=cutoff,
            reference__gt="",
        )
        if options["provider"]:
            pending = pending.filter(provider=options["provider"])
        pending = pending.order_by("created_at")

        if rail.name == "unconfigured":
            self.stderr.write(
                "No payment partner is configured (SUSU_RAIL). Nothing was settled, and no "
                "payment was failed: we have not asked anyone, so we do not know. Set a "
                "partner or use the manual verification endpoint."
            )
            return

        settled = failed = unrecognised = unreachable = 0
        seen = 0

        for contribution in pending.iterator(chunk_size=50):
            if limit and seen >= limit:
                self.stdout.write(
                    f"Stopped at the --limit of {limit}. The remainder stays pending and will "
                    "be picked up by the next run."
                )
                break
            seen += 1

            outcome = self._settle(rail, contribution)
            if outcome is None:
                unreachable += 1
            elif outcome == Outcome.CONFIRMED:
                settled += 1
            elif outcome == Outcome.REJECTED:
                failed += 1
            else:
                unrecognised += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"examined {seen}: settled {settled}, failed {failed}, "
                f"not yet recognised {unrecognised}, rail unreachable {unreachable}"
            )
        )
        if unreachable:
            # Worth saying loudly: this run knows nothing about those members' payments.
            self.stderr.write(
                f"{unreachable} could not be checked because the rail was unreachable. "
                "They remain pending and are NOT recorded as unpaid."
            )

    @transaction.atomic
    def _settle(self, rail, contribution):
        """Ask the rail about one contribution and apply what it says.

        Returns the rail outcome, or None when the rail could not be reached.

        The row is locked before the rail is asked, so two workers running at once cannot both
        decide to settle it. That lock is held across the network call, which is the one
        genuinely costly part of this design: it serialises lookups per contribution rather
        than globally, and each one is a single round trip.
        """
        locked = (
            Contribution.objects.select_for_update()
            .filter(pk=contribution.pk)
            .first()
        )
        if locked is None or locked.status != Contribution.Status.PENDING:
            # Another worker got there first, or a human did. Either is a correct outcome.
            return None

        try:
            answer = rail.lookup(
                reference=locked.reference,
                provider=locked.provider,
                amount_pesewas=locked.amount_pesewas,
            )
        except RailUnavailable:
            return None

        if answer.outcome == Outcome.CONFIRMED:
            locked.mark_verified(
                actor=None,
                reason=f"settled by rail: {rail.name}/{answer.provider_reference or locked.reference}",
            )
            # Run AML/CFT monitoring on rail-verified contributions
            evaluate_contribution(locked)
            return Outcome.CONFIRMED

        if answer.outcome == Outcome.REJECTED:
            locked.mark_failed(
                actor=None,
                reason=f"{rail.name}: {answer.reason or 'the rail did not settle this payment'}",
            )
            return Outcome.REJECTED

        # UNKNOWN. The member may simply have paid moments ago. Nothing is written, and the
        # row keeps its place in the queue.
        return Outcome.UNKNOWN