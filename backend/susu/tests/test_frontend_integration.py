"""
The frontend, run against this backend.

pytest owns the database and the server; the jest suite owns the client. The jest process is
handed a base URL, a JWT, and the ids of a seeded group and round, and then drives the real
fetch wrapper and the real TanStack Query client against it.

Why the boundary sits here rather than in jest: the database is a Django test database with
constraints and transactions, and the server needs settings, middleware and a JWT issuer. All
of that already exists on this side. Duplicating it in a mock would test the mock.

What this layer finds that neither side can find alone:
  - a wire field the client reads that the serializer does not send
  - a float where integer pesewas were agreed, invisible to unit tests on either side
  - a permission that holds in the domain and leaks through the view
  - client and server disagreeing about the same round

`test_frontend_suite_passes` is the assertion that matters: jest exits non-zero, so a broken
contract fails the backend build rather than waiting to be found in a phone.

Rule IDs: 1791027903-money-handling-and-safeguards.md M1, Z1, C-S5, C-S9
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from rest_framework.test import APIClient

from accounts.models import Account
from susu.models import Membership, Round, SusuGroup

pytestmark = [pytest.mark.django_db(transaction=True)]

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent
JEST_ENTRY = PROJECT_DIR / "node_modules" / "jest" / "bin" / "jest.js"
INTEGRATION_SUITE = "integration.live.test.js"

PASSWORD = "pw-integration-fixture-secret"


@pytest.fixture
def seed():
    """A group with a frozen round, an admin and an outsider.

    Two members so the roster is a real allocation rather than one share, and an outsider so
    the authorization assertions have someone to be refused.
    """
    admin = Account.objects.create_user(phone="+233201000001", password=PASSWORD)
    group = SusuGroup.objects.create_group(
        name="Live Susu", target_pesewas=30000, collection_day=5,
        admin=admin, invite_code="LIVE01",
    )
    for order, number in ((2, "+233201000002"), (3, "+233201000003")):
        person = Account.objects.create_user(phone=number, password=PASSWORD)
        Membership.objects.create(group=group, account=person, order=order)

    outsider = Account.objects.create_user(phone="+233201000099", password=PASSWORD)
    return {
        "admin": admin,
        "outsider": outsider,
        "group": group,
        "round": Round.open_current(group),
    }


def issue_token(account):
    response = APIClient().post(
        "/api/auth/token/",
        {"phone": account.phone, "password": PASSWORD},
        format="json",
    )
    assert response.status_code == 200, response.data
    return response.data["access"]


def run_jest(live_server, seed):
    """Run the frontend suite in a child process against the live server."""
    environment = {
        **os.environ,
        "GROWL_API_URL": live_server.url,
        "GROWL_API_TOKEN": issue_token(seed["admin"]),
        "GROWL_API_OUTSIDER_TOKEN": issue_token(seed["outsider"]),
        "GROWL_API_PHONE": seed["admin"].phone,
        "GROWL_API_PASSWORD": PASSWORD,
        "GROWL_API_GROUP_ID": str(seed["group"].id),
        "GROWL_API_ROUND_ID": str(seed["round"].id),
        "GROWL_API_SHARE_PESEWAS": str(seed["round"].roster_snapshot[0]["share_pesewas"]),
        # Jest workers would each hold their own QueryClient against one shared round and
        # race each other on the money assertions. One worker, deterministic order.
        "JEST_WORKERS": "1",
    }

    completed = subprocess.run(
        ["node", str(JEST_ENTRY), INTEGRATION_SUITE, "--runInBand", "--ci"],
        cwd=str(PROJECT_DIR),
        env=environment,
        capture_output=True,
        text=True,
        # Jest writes UTF-8; the Windows console default is cp1252 and will throw trying to
        # decode a checkmark. Replace rather than fail: a mangled glyph cannot hide a failing
        # assertion, but a decode error hides the entire report.
        encoding="utf-8",
        errors="replace",
        timeout=300,
    )
    report = completed.stdout + completed.stderr
    print(report)
    return completed.returncode, report


def test_the_jest_runner_is_where_we_expect_it():
    # A missing dependency should fail here, with a sentence, rather than inside a subprocess
    # timeout five minutes later.
    if not JEST_ENTRY.exists():
        pytest.skip(f"{JEST_ENTRY} is absent; run npm install in {PROJECT_DIR}")


def test_the_frontend_suite_passes_against_the_live_api(live_server, seed):
    if not JEST_ENTRY.exists():
        pytest.skip("frontend dependencies are not installed")

    returncode, report = run_jest(live_server, seed)

    assert returncode == 0, f"the frontend suite failed against the live API\n{report}"
    # Guard against the suite silently skipping itself, which would be a green run that
    # verified nothing. A skipped integration suite is a broken test, not a passing one.
    assert "skipped" not in report.lower(), report
    assert "11 passed" in report or "passed" in report, report


def test_the_live_server_answers_a_token_request(live_server, seed):
    """The cheapest possible proof the server under the suite is real and reachable."""
    response = APIClient().get(f"{live_server.url}/api/groups/")
    assert response.status_code == 401