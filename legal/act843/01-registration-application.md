# Application for registration as a data controller

**Form:** Data Protection Commission, Ghana · **Statute:** Act 843 (2012) §47(1), §27(1)
**Entity category applied for:** Data Controller
**Status:** DRAFT. Not submittable until the five sentinels in §11 below are filled.

---

## How this was compiled

Every statement below is checkable against the codebase, with the file and symbol that
implements it. Where a fact cannot come from the code — a company number, an address — it is
left as an explicit gap rather than filled with something plausible. **§47(2):** knowingly
supplying false information in support of an application is an offence, liable on summary
conviction to a fine not exceeding 150 penalty units, or up to one year's imprisonment, or both.

This is the reason the sentences are short and the citations are numerous. A registration is a
statement a regulator will test.

---

## 1. Business name and address — §47(1)(a)

| Item | Particular |
|---|---|
| Business name | `__controller_legal_name__` — **GAP** |
| Entity category | Limited liability company (Ghana) |
| Registered address | **GAP** — required; a PO box alone is not an address for service |
| Business activity | Software. A mobile application for running rotating savings groups (*susu*). The application is a record-keeping and coordination layer: **it does not hold, transmit or receive funds, and has no payout function.** |

The last sentence is not a disclaimer, it is the operative fact, and it is the same fact the
Act 987 opinion turns on. §47(1)(a) asks for the business, not for a description of ambition.

## 2. Representative, if an external company — §47(1)(b)

**Not applicable.** The applicant is incorporated in Ghana. If that changes — a foreign parent
holding the Ghanaian entity — this item becomes mandatory and the company must also register as
an external company under §45(2).

## 3. Description of the personal data processed, and the categories of persons — §47(1)(c)

Nine purposes are registered separately, as **§47(3)** requires where a controller keeps personal
data for two or more purposes. The full register is in
[03-data-processing-register.md](03-data-processing-register.md); the summary:

| # | Purpose | Categories of data subject |
|---|---|---|
| 1 | Account creation and maintenance | Members |
| 2 | Creating a group and operating its rotation | Members of a group |
| 3 | Recording contributions to a round | Members of a group |
| 4 | Verifying a contribution against a mobile money operator | Members of a group |
| 5 | Recording the release of a pot | Members of a group |
| 6 | Disputes and administrative accountability | Members; group admins |
| 7 | Fraud and abuse prevention | Members; group admins |
| 8 | Record-keeping required by law | Members; group admins |
| 9 | Contacting a member about their own account | Members |

**No data is collected from anyone who is not a member.** There is no advertising audience, no
analytics identity, no behavioural profile, and no data from non-members at all.

### The data itself

| Category | Fields | Where |
|---|---|---|
| Identity | Mobile money number (E.164, the primary identifier); name (optional); email (optional) | `accounts.Account` |
| Credentials | Password, stored only as a one-way hash | `accounts.Account.password` |
| Identity residue | Last four digits of a Ghana Card plus a one-way hash. **The full number is never stored** — the field does not exist, so it cannot leak | `accounts.Account.ghana_card_last4`, `.ghana_card_hash` |
| Group participation | Group, rotation position, role, join date, active flag | `susu.Membership` |
| Financial record | Contribution amount in pesewas, provider, transaction reference, status, timestamps; frozen per-round share and charge; debt balance and reason; payout amount, fee and reference | `susu.Contribution`, `susu.Round`, `susu.Payout`, `susu.Membership.debt_pesewas` |
| Ledger | Append-only double-entry postings and balances | `susu.ledger.LedgerPosting`, `.LedgerEntry` |
| Administrative | Every action taken in a group, with the actor, the state change and the reason | `susu.ledger.AuditEvent` |
| Trust | Admin trust score and flagged-transaction count | `SusuGroup.admin_trust_score`, `.flagged_total`; `Account.trust_score`, `.flagged_total` |
| Session | JWT access and refresh tokens, refresh rotation and revocation | `token_blacklist.OutstandingToken`, `.BlacklistedToken` |
| Compliance | Consent records, and the requests members make under §32–44 | `compliance.ConsentRecord`, `compliance.DataSubjectRequest` |

**Special personal data under §37: none.** We process nothing relating to a child under parental
control, and nothing about religious or philosophical beliefs, ethnic origin, race, trade union
membership, political opinions, health, sexual life or criminal behaviour. A Ghana Card number
would not be §37 special personal data, but it is held as a verifier rather than a record anyway
— a field that does not exist cannot be leaked.

## 4. Special personal data — §47(1)(d)

**No.** Declared as "not held, and not intended to be held". The first membership of the
register is therefore not required. If a future feature (say, a health or a union-linked
contribution scheme) introduces §37 data, this application is wrong and must be amended under §55.

## 5. Purpose of processing — §47(1)(e)

The nine purposes in item 3. Each is specific, explicitly defined and related to the controller's
function, as **§22** requires. There is no secondary use: no marketing, no advertising, no
profiling, no model training, and no sale or supply of data to anyone for their own purposes —
**§89** prohibits the sale of personal data in any event, and none occurs.

## 6. Recipients — §47(1)(f)

| Recipient | What they receive | Why |
|---|---|---|
| **The other members of the same group** | Name (or a masked number where no name was given), rotation position, role, amount paid, amount still owed, charge, and the full group audit log including administrative actions | The savings group's shared record. **§17(c)** specification of purpose and **§25** compatibility of further processing both require this: the product is a record other members are entitled to read |
| **The licensed payment partner** — Hubtel EPSP primary, Fincra fallback | The transaction reference and the amount claimed, for the purpose of asking whether that payment settled | Verification from the provider's own response. Not a payment instruction. **No personal data beyond the reference and amount is sent** |
| **The infrastructure provider** | The database, including all of the above | Hosting. See item 7 and the gap list |
| **The Data Protection Commission, the Bank of Ghana, a court** | As required by law | **§27(4)** exemptions, and the AML/CFT obligations the payment partner imposes contractually |

Nothing else. No data broker, no advertising network, no analytics provider, no crash reporter,
no social login provider. **The app has no third-party runtime service of any kind** — there is
no analytics SDK, no advertising SDK and no crash-reporting SDK in the client, which is
verifiable from `package.json`.

## 7. International transfers — §47(1)(g)

| Transfer | Detail |
|---|---|
| **Payment partner** | The transaction reference and amount are sent to Hubtel or Fincra for verification. **The partner's own hosting locations and subprocessors are not yet named.** They must be obtained and added here before the partner goes live. **GAP** |
| **Infrastructure** | Database and backups are hosted with a provider **not yet named**. **GAP** |
| **Inside the app** | None. The client sends nothing to any third party except the controller's own API |

**Note on the pending Bill.** A Data Protection Bill was reported to be in drafting in 2025–26 to
extend oversight to artificial intelligence, automated decision-making, deepfakes and cross-border
data transfers — areas the 2012 Act does not address. This application is made under the 2012 Act
and should be reviewed against the enacted text when it arrives. In particular, **§18(2)** of the
current Act requires that personal data about a *foreign* data subject be processed in compliance
with the law of their jurisdiction; every member of this product is in Ghana, so it does not bite
today, and a diaspora funding tier would need it re-examined.

## 8. Class of persons whose data is held — §47(1)(h)

**Members of a Growl susu group**, being adults who have created an account and either created a
group or joined one by invite code. At pilot scale: expected hundreds, not millions.

**No names are supplied.** The Act says "the class of persons or where practicable the names of
persons". At the scale this application describes, the class is the accurate answer and a list of
names would be a list of members handed to a regulator for no purpose. This is revisited at
renewal, when the numbers may make it practicable.

## 9. Security measures — §47(1)(i)

Stated in full in [08-security-measures.md](08-security-measures.md), which separates what is
implemented from what is merely configured and from what is missing. In summary:

- Passwords hashed with **Argon2id** where the library is available (Django's strong PBKDF2
  otherwise), minimum 12 characters, common-password screening
- **JWT** authentication, 15-minute access tokens, rotating single-use refresh tokens with reuse
  detection that revokes the whole session family
- Authorization by **membership**, checked at the edge on every endpoint; a member of one group
  cannot read another's data, and an admin cannot verify or reverse their own payment
- **Append-only** ledger and audit log: a status change and its money posting happen in one
  transaction, and neither record can be edited or deleted — correction is a visible new entry
- Database **check constraints** and partial unique indexes on the invariants (one verified
  contribution per member per round, one open round per group, one payout per round)
- Every write carries an **idempotency key**, so a replayed request from an offline queue returns
  the original result instead of creating a second payment
- `SECURE_SSL_REDIRECT`, **HSTS at 12 months**, secure cookies, `SECURE_CONTENT_TYPE_NOSNIFF`,
  `X_FRAME_OPTIONS: DENY`, and a **refusal to start** in production on the development secret key
  or an empty `ALLOWED_HOSTS`
- The **only** HTTP client in the app wraps a fixed base URL and refuses any caller-supplied
  absolute URL, so a member's token cannot be sent to a third-party host
- Session tokens at rest in the **iOS keychain / Android encrypted preferences**, with memory as
  the fallback rather than plaintext storage
- **`django.contrib.admin` is not installed**: there is no database editor behind a login on a
  system holding a money record
- No third-party analytics, advertising or crash-reporting service in the client

**Known gaps, stated because the form asks what we do, not what we intend to do:** the
authentication endpoint has no rate limiting (needs a shared cache); there is no field-level
encryption at rest; and no penetration test has been carried out.

## 10. Other information the Commission may require — §47(1)(j)

- **Registered address, TIN and incorporation certificate:** pending, item 1
- **Data protection supervisor:** named on appointment, [02](02-dpo-appointment.md). §58
- **Prior registration:** none. This is a first application
- **Group company status:** not part of a group of companies
- **Turnover, average data subjects, average annual records:** to be completed for the pilot from
  the launch telemetry. *Anticipated: turnover nil (pre-revenue); data subjects in the hundreds;
  records per member per year in the low tens of contributions plus their ledger and audit rows*
- **DPC compliance contact:** `privacy@growl.app`, and the named supervisor

## 11. Outstanding before submission

| # | Gap | Blocks |
|---|---|---|
| 1 | `controller.name` | §47(1)(a) |
| 2 | `controller.registrationNumber` and `tin` | §47(1)(a) |
| 3 | `controller.address` | §47(1)(a) |
| 4 | `controller.dpoName` | §47(1)(j), §58 |
| 5 | `controller.hostingProvider` and its transfer terms | §47(1)(f), (g), (i) |
| 6 | Payment partner's subprocessors and hosting locations | §47(1)(f), (g) |
| 7 | Data protection supervisor appointed | §58 |

Run `manage.py privacy_compliance_report` after filling them: it exits non-zero while any of these
is still a placeholder, so the application cannot be submitted in a state the code disagrees with.

## 12. Refusal risk, assessed honestly

**§48** permits refusal where the particulars are insufficient, where appropriate safeguards
have not been provided, or where the applicant does not merit registration.

- **Insufficient particulars** — the main live risk, and it is administrative: gaps 1–7 above.
- **Inadequate safeguards** — the real substantive test. We are strong on integrity of the money
  record and on access control, and weak on the basics an auditor looks for first: rate limiting,
  encryption at rest, no penetration test, no staff data protection training on record.
- **Merit** — a savings-group record-keeping tool with no custody of funds, no marketing and no
  data sales. This is a better application than most, but "not a bad actor" is not the standard;
  the standard is the safeguards.

**Recommendation:** do not submit until gaps 1–7 are closed, and expect the Compliance Unit to
ask for the **Compliance Assessment (GAP analysis)** at renewal rather than only at
registration. Commission that assessment to the appointed supervisor now, so renewal in two years
is a review rather than a project.