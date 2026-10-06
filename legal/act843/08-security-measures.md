# Security measures — §28

**Statute:** Act 843 (2012) §28 · **Purpose:** the §47(1)(i) description of measures taken to
secure the data · **Last reviewed:** 5 October 2026

§28(1) requires the controller to take the steps necessary to secure the integrity of personal data
"through the adoption of appropriate, reasonable, technical and organisational measures" against
loss, damage, unauthorised destruction, unauthorised access and unauthorised processing. §28(2)
adds four duties that shape this document: **identify** foreseeable risks, **establish**
safeguards, **regularly verify** they work, and **update** them as risks change.

**The organising principle of this file is that distinction.** A registration form asks what we do,
not what we intend to do, and §47(2) makes a false statement an offence. So every claim below is
either implemented and testable, or marked as configured-but-unverified, or marked as missing. There
is no fourth category.

---

## Implemented and testable

Each of these is in the code and held by a test.

### Identity and session

| Measure | Where | Test |
|---|---|---|
| Mobile money number is the primary identity, stored in E.164 so formatting variance cannot become an account-linking bypass | `accounts/models.py`, `accounts/phones.py` | `accounts` tests |
| One number, one account (unique constraint) | `accounts.Account.phone` | DB constraint |
| Passwords hashed with **Argon2id** where `argon2-cffi` is importable, otherwise Django's PBKDF2 | `growl/settings.py` — the hasher list is built from what is installed rather than assumed | `test_settings_uses_argon2_when_available` |
| Minimum 12 characters, common-password screening, `set_unusable_password` where none is supplied | `AUTH_PASSWORD_VALIDATORS`, `AccountManager` | `create_test_account` refuses a password that fails the project's own rules |
| **JWT**, 15-minute access tokens | `SIMPLE_JWT` | `growl` settings |
| Refresh tokens **rotate**, and are **blacklisted on rotation**; reuse of a rotated token revokes the whole session family | `ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION`, the blacklist app | `susu` API tests |
| Session tokens at rest in the **iOS keychain / Android encrypted preferences**; memory is the fallback rather than plaintext storage | `services/tokenStorage.js` | `session.test.js` |
| Token purge on a 7-day cycle, in the retention schedule | `compliance/retention.py:purge_expired_tokens` | `test_privacy.py` |

### Authorisation — the part that matters most here

| Measure | Where | Why it matters |
|---|---|---|
| **Authorisation by membership, at the edge**, in one base class so no endpoint can forget it | `susu/api.py:IsActiveMember` | A correct domain method behind a view that never asks is worth nothing |
| A **separate** admin check for decisions about other people's money | `susu/api.py:admin_or_403` | `membership_or_403` is true of every member and therefore authorises nothing |
| `verify` and `reverse` are **admin-only and never on the admin's own contribution** | `ContributionTransitionView` | The one case where a check would otherwise approve itself |
| `void` is **the payer's own unsettled attempt only** | as above | Cancelling something you started needs no authority beyond starting it |
| **No `fail` transition exists.** No member can declare their own payment failed | by design | A member who could say that could walk away from cedi they sent |
| **No payout endpoint at all.** The rail fires payouts; no human can reach one | `growl/urls.py`, `Round.payout` | The Act 987 boundary, enforced in code rather than in a policy |
| An invite code can seat **only the caller** — there is no field that names somebody else | `GroupJoinSerializer` | A group populatable with strangers' names is a group that can be made to impersonate a real one |
| The **collection account is immutable to every member and admin** | `SusuGroup.collection_account` | A fake group cannot match the real collection number |

### Integrity of the money record

| Measure | Where |
|---|---|
| **Append-only** ledger and audit log. `save()` raises on edit; the queryset's `update()` and `delete()` raise too | `susu/ledger.py:AppendOnlyModel`, `AppendOnlyQuerySet` |
| A status change and its ledger posting happen in **one transaction or not at all** | `mark_verified`, `mark_reversed`, `mark_completed` |
| Every posting must **balance**; a half-written posting is refused outright | `LedgerPosting.write` |
| One posting per round, per type, per reference (partial unique index) | `one_ledger_posting_per_reference` |
| **Conservation residual** and **debt residual** computed from the append-only record, so a bug cannot make the check pass | `Round.conservation_residual`, `debt_residual` |
| One verified contribution per member per round; one open round per group; one payout per round | DB partial unique constraints |
| Amount caps enforced by **check constraints**, not only in Python | `contribution_at_least_one_cedi`, `group_target_positive` |
| **Idempotency key** unique per contribution — a replayed offline write returns the original result | `one_contribution_per_idempotency_key`, and the key must belong to the same member's payment |
| Reference uniqueness per member; a duplicate is a 409 | `Contribution.record` |
| `select_for_update()` on round state changes | `Round.open_current`, `close`, `payout` |
| A settlement only becomes a **collection** when confirmed; a manual verification always leaves its reason, so a human decision stays distinguishable from a provider's | `manual_verification_reason` |
| A rail answer of **UNKNOWN is never treated as REJECTED** | `susu/rail.py` |

### Minimisation, and the defect this pack found

| Measure | Where |
|---|---|
| **No Ghana Card field exists.** Only a last-four and a hash. A field that does not exist cannot be leaked | `accounts.Account` — and the comment there says why |
| **A member's phone number is never shown to another member.** `display_name` masks it | `Account.display_name`; used in the roster snapshot and the audit feed |
| No member sees another member's **transaction reference** — only amount and status | `RosterEntrySerializer` |
| **No analytics, advertising, or crash-reporting service** in the client | `package.json` — verifiable |
| **No `django.contrib.admin`**: no database editor behind a login on a system holding a money record | `INSTALLED_APPS` |
| Consent and rights records are **append-only**, like the ledger | `compliance.models.ConsentRecord` |

### Transport, deployment and the client's network boundary

| Measure | Where |
|---|---|
| `SECURE_SSL_REDIRECT`, **HSTS 12 months** with subdomains and preload, secure cookies, `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_REFERRER_POLICY: same-origin`, `X_FRAME_OPTIONS: DENY` | `growl/settings.py`, production only |
| `SECURE_PROXY_SSL_HEADER` for the TLS-terminating proxy — without it `SECURE_SSL_REDIRECT` loops forever | as above |
| **Refuses to start** in production on the development secret key or an empty `ALLOWED_HOSTS` | as above |
| **One HTTP client**, wrapping a fixed base URL, refusing any caller-supplied absolute URL and any `//host` path, with one timeout, one auth header and one error shape | `services/api.js` |
| Session tokens are read at request time, never baked into a closure | `services/auth.js` |

### Privacy controls added by this pack

| Measure | Where | Test |
|---|---|---|
| **Consent recorded** against the served notice version, append-only, withdrawal as a new record | `compliance/api.py:ConsentView` | `test_privacy.py` |
| **Access** returns the caller's own data, with the refusals named rather than hidden | `compliance/export.py` | `test_export_returns_the_callers_own_data` |
| **Rights requests** tracked with a stored 21-day deadline; a refusal cannot be recorded without reasons | `compliance/models.py` | `test_a_refusal_must_state_its_reasons` |
| **Retention enforced**, with a dry-run report as the primary output | `compliance/retention.py` | `test_retention_report_changes_nothing_by_itself` |
| **Erasure anonymises**, and the database refuses outright deletion wherever the money record names the person | `compliance/retention.py` | `test_the_database_refuses_to_delete_somebody_the_ledger_names` |
| A machine check that **fails a release** while the controller particulars are unknown | `manage.py privacy_compliance_report` | `test_the_compliance_report_names_the_known_gaps` |

---

## Configured but not yet verified

§28(2)(c) requires the safeguards to be **regularly verified** as well as established. These are
switched on and believed working, and none has been independently checked. That is a real gap, and
the register must not describe them as verified.

| Measure | What verification it needs |
|---|---|
| **TLS termination and the HSTS header** | Fetch the API headers from the production host and confirm `Strict-Transport-Security`, the redirect, and the secure cookies |
| **Argon2id in production** | Confirm `argon2-cffi` is in the production requirements, and check the hasher actually chosen |
| **PostgreSQL in production** | SQLite is development only — the settings file says so. Row locking and constraint behaviour must be confirmed on the real engine |
| **Backups** | That they exist, that they are encrypted, that a restore works, and where they are stored. **Outside Ghana is a transfer question** — §47(1)(g) |
| **The rail worker's credentials** | `HUBTEL_CLIENT_SECRET` / `FINCRA_SECRET_KEY` in a secret store, not in the environment of a developer's machine |

---

## Not implemented — the launch gate

Stated plainly, because a §47(1)(i) description that omits these is a false particular.

| Gap | Why it matters here | Fix |
|---|---|---|
| **No rate limiting on authentication** | The password is the only thing standing between an attacker and every account in a savings group. Registering accounts or brute-forcing logins is unlimited today | DRF throttling with a **shared cache** (Redis). In-memory throttling is per-process and worthless behind more than one worker |
| **No field-level encryption at rest** | The database holds mobile money numbers, names and a full payment history in plaintext | Envelope encryption for the identifiers, with the key in a KMS or secret manager. SQLite in development is the reason this has not blocked anything |
| **No multi-factor authentication** | For a group admin, whose account can verify other people's payments | OTP at minimum, before beta |
| **No penetration test** | Every control in this document is our own reading of our own code | Independent test before launch. **Budget for it; there is no cheaper way to find what we have not thought of** |
| **No staff data protection training on record** | The supervisor's evidence list requires it. There is staff | Records for everyone who touches personal data, including the contractor agreements that bind them |
| **No security monitoring or alerting** | §28(2)(d) requires updating safeguards as risks change, which needs visibility into risk | At minimum: alerts on repeated authentication failure, on admin verify/reverse volume, and on any bulk export |
| **No backup restore test** | A backup that has never been restored is a hypothesis | Restore to a scratch environment on a schedule and record the date |
| **No staff surface for the rights queue** | Rights currently require shell access. Unacceptable at beta | A staff-only surface, with `django.contrib.admin` still uninstalled |

---

## The verification programme

§28(2)(c) and (d) both require this. It is a calendar, not an aspiration.

| When | What |
|---|---|
| **Before launch** | Penetration test; restore test; TLS/HSTS header check; Argon2id confirmed; rate limiting shipped; MFA for admins; training records started |
| **Monthly** | `privacy_compliance_report`; retention dry run; review of admin verify/reverse and flag volumes; new dependencies reviewed for what data they can reach |
| **Quarterly** | Supervisor's written report, even if it says nothing happened; register review against the code; breach tabletop exercise, rotated |
| **Annually, and on any material change** | Full §28 review; penetration test retest; register rewrite; training refresh; **and a review of whether a breach procedure written a year ago still matches the system** |

## The honest summary for the registration form

> Appropriate, reasonable, technical and organisational measures are in place and tested: Argon2id
> password hashing, short-lived JWT sessions with single-use rotating refresh tokens and reuse
> detection, authorisation by group membership enforced at the edge of every endpoint with
> split authority over payment verification, an append-only double-entry ledger and audit trail that
> cannot be edited, database-level enforcement of every money invariant, idempotency keys on all
> writes, no database administration interface, a single confined HTTP client, no third-party
> analytics or advertising in the client, TLS with HSTS and secure cookies, a documented retention
> schedule enforced by an auditable command, versioned consent records, and self-service access,
> rectification and erasure with a stored statutory deadline.
>
> Rate limiting on authentication, field-level encryption at rest, multi-factor authentication for
> group administrators, independent penetration testing, recorded staff data protection training and
> security monitoring are **not yet in place and are conditions of launch**.
>
> The annual Compliance Assessment required for registration renewal under §50 will test this
> section rather than take it on trust.

**Listing the gaps is not candour for its own sake.** §48(1)(b) lets the Commission refuse
registration where appropriate safeguards have not been provided. An application that hides its gaps
is refused for them; an application that names them, with a date and an owner, is assessed on
whether the plan is credible.