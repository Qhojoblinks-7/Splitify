"""When an account was last used, so the retention schedule has something true to read.

s.24 asks for no longer than necessary, and "necessary" needs a clock. The only other candidate
on the account is `updated_at`, which any write moves — including a write the account did not
make, such as an admin action against one of its contributions — so an account nobody has
touched in a year can carry a timestamp from last week and survive the purge indefinitely.

At most one write per account per day. A member opening the app forty times in an afternoon
must not produce forty database writes, and the day is short enough that the value stays honest
for the only question asked of it: is this account still in use?
"""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

WRITE_INTERVAL = timedelta(days=1)


class LastSeenMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._record(request)
        except Exception:  # pragma: no cover - never fail a request over a timestamp
            pass
        return response

    def _record(self, request):
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False) or not user.pk:
            return
        now = timezone.now()
        # `update`, not `save`: this runs after the view has already written the account it may
        # have changed, and a full save would write back a stale copy of everything else.
        # `anonymised_at__isnull=True` because a deleted member is not "active", and writing to
        # their row would keep the record the retention job is waiting to be allowed to remove.
        user.__class__.objects.filter(
            Q(last_active_at__isnull=True) | Q(last_active_at__lt=now - WRITE_INTERVAL),
            pk=user.pk,
            anonymised_at__isnull=True,
        ).update(last_active_at=now)
