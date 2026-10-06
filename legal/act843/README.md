# Act 843 — Data Protection Commission registration and data protection officer

**Status:** Draft pack, ready for the facts only the company can supply. Registration is **not**
submitted. Everything in this folder is either derived from the code or marked as a gap.
**Last reviewed:** 5 October 2026

---

## What this gate is, and why it blocks launch

Ghana's Data Protection Act, 2012 (Act 843) **§27(1)** requires a data controller to register
with the Commission before it processes personal data, and **§53** prohibits unregistered
processing outright. **§56** makes failure to register an offence: a fine of up to 250 penalty
units, or up to two years' imprisonment, or both.

That is not a theoretical exposure. From 2026 the Commission has declared an enforcement year,
and a government policy directive has been announced directing the Commission to fine
organisations that are unregistered. We collect a mobile money number, a name, a payment history
and an administrative log for every member. We are a data controller. We have not registered.

**The app also cannot truthfully launch without the rest of this pack.** §27(2) requires nine
specific things to be told to a member *before* their data is collected. The draft notice that
used to sit in the app had none of the nine, and claimed the app used cookies and collected
device data — both false.

## Where each piece of this lives

| Document | What it settles |
|---|---|
| [01-registration-application.md](01-registration-application.md) | The §47(1)(a)–(j) particulars, filled from the code. This is the form. |
| [02-dpo-appointment.md](02-dpo-appointment.md) | Who the §58 data protection supervisor is, what they can do, and the appointment letter |
| [03-data-processing-register.md](03-data-processing-register.md) | The §17 accountability record: every processing activity, its basis, its retention |
| [04-privacy-notice.md](04-privacy-notice.md) | The member-facing notice, mapped to §27(2) and to the code that implements it |
| [05-retention-and-erasure.md](05-retention-and-erasure.md) | The §24 schedule, the two-stage erasure, and the commands that enforce it |
| [06-data-subject-rights.md](06-data-subject-rights.md) | How a member exercises §32–35, §39, §40 and §44, and the 21-day clock |
| [07-breach-response.md](07-breach-response.md) | The §31 runbook, with notification drafts for the Commission and the member |
| [08-security-measures.md](08-security-measures.md) | What is actually implemented, what is configured but unverified, what is missing |
| [09-dpia.md](09-dpia.md) | The impact assessment, and why this processing needs one |

**One source of truth.** The notice itself lives in the code, in
`backend/compliance/notice.py`, and is served from `GET /api/privacy/notice/`. A consent is
recorded against a version number, and the version a member read is the version the registration
application quotes. Document 04 *describes* the notice; it does not restate it, because a second
copy is a copy that will be wrong.

## The machine check

```bash
backend\.venv\Scripts\python.exe backend\manage.py privacy_compliance_report
```

This reads the code and exits non-zero while anything it can see is outstanding: an unfilled
controller particular, a missing §27(2) item, an unconfigured payment partner, a development
secret key in production, a rights request past its §39(2) deadline.

It cannot see anything that requires a signature. **A clean report is not permission to launch.**

## What is still blocking, and what it needs

| # | Blocker | Who | Needs |
|---|---|---|---|
| 1 | Company particulars | Founder | Certificate of incorporation, TIN, registered address, entity category |
| 2 | Data protection supervisor | Founder | Signed appointment; see [02](02-dpo-appointment.md) for who qualifies |
| 3 | Registration submission | Founder | Document 01 plus the incorporation certificate; fee GH¢120 (small/startup) |
| 4 | Hosting provider | Founder | A named provider with a written transfer term — item (g)/(h) of the form says *name it* |
| 5 | Payment partner transfer list | Founder | The partner's list of subprocessors and hosting locations, once an agreement exists |

### Facts only the company can supply

These are sentinels in `backend/compliance/notice.py` and are reported by the command above. They
are deliberately not guessed: **§47(2)** makes knowingly supplying a false particular an offence
(fine up to 150 penalty units, up to one year, or both).

| Field | Value |
|---|---|
| `controller.name` | `__controller_legal_name__` |
| `controller.registrationNumber` | empty |
| `controller.tin` | empty |
| `controller.address` | empty |
| `controller.dpoName` | `__dpo_name__` |
| `controller.hostingProvider` | `__hosting_provider__` |
| `controller.dpcRegistrationNumber` | empty — filled from the certificate the Commission issues |

## How to register

**Portal:** `app.dataprotection.org.gh` · **Phone:** Registration 0256301533 · Compliance
0256302031 · Compliance email 0256302031@dpcom.gov.gh · `dataprotection.org.gh`

1. Apply as a **Data Controller** — that is what we are. We decide the purposes and the means
   of processing. The licensed payment partner is a separate controller in its own right and
   registers itself.
2. Complete the particulars in document 01. Where the form asks for turnover, average number of
   data subjects and average annual records, answer for the **pilot**, and expect to update at
   renewal.
3. Pay the fee. Current schedule: **small businesses and startups GH¢120**, medium GH¢900, large
   GH¢1,800. A pre-launch pilot is the small category; if the Commission assesses us as medium,
   that is a decision to take, not a category to argue with.
4. Upload the incorporation certificate. Registration is assessed within about 21 working days
   and a certificate is issued on approval.

**Renewal is every two years (§50)**, and renewal is assessed against a submitted Compliance
Assessment (a GAP analysis), not merely against the form. Start the assessment no later than
three months before expiry.

**Notify the Commission within 14 days (§55)** of any change to the registered particulars —
which means a change of address, DPO, hosting provider or payment partner triggers a filing. Put
this in the founder's calendar the day the certificate arrives.

## What changes if we are wrong about our category

Nothing in the design assumes small. §58 lets the Commission require a supervisor regardless of
size, and the appointment in document 02 is made anyway: at pilot scale a named person costs
almost nothing, and the alternative is discovering at the first audit that nobody owned this.
The DPC's own administrative arrangements exempt *small* controllers from appointing a
**certified** supervisor. We will appoint one internally and engage a certified supervisor as
backup — see document 02 for the reasoning and the cost.

## Findings from reviewing the code against the Act

These came out of writing this pack and are now fixed or scheduled. They are recorded because a
compliance pack that only lists what is right is not an assessment.

| Finding | Section | Status |
|---|---|---|
| A member's mobile money number was broadcast to every member of their group, via the frozen roster snapshot and again in the audit feed, whenever they had given no name | §19 minimality; §28 | **Fixed.** `Account.display_name` masks the number. Held by a test in `backend/compliance/tests/test_privacy.py` |
| The privacy notice in the app claimed cookies, device-data collection and a data-transfer regime that does not exist, and omitted all nine §27(2) items | §27(2); §17(f) openness | **Fixed.** Replaced with the served notice |
| No consent record existed, so "lawfulness under §20" was an assertion with nothing behind it | §20; §17(a) | **Fixed.** `ConsentRecord`, append-only, versioned |
| No access, erasure or objection mechanism existed anywhere | §32–35, §39, §44 | **Fixed.** Endpoints plus an in-app surface |
| No retention schedule existed, so §24(5) was unsatisfiable | §24 | **Fixed.** Schedule and enforcement command |
| `settings.py` documented Argon2id as the production hasher and did not use it | §28 | **Fixed.** Argon2id where importable |
| No TLS/HSTS/secure-cookie configuration for production | §28 | **Fixed.** Set from the environment; refuses to boot on the development secret key |
| `updated_at` was the only activity clock, so the retention job could never tell a dormant account from a busy one | §24 | **Fixed.** `last_active_at`, written at most daily |
| Auth endpoint has no rate limiting | §28 | **Open** — needs a shared cache. In the launch gate |
| No staff-facing surface for the rights queue | §44(1) | **Mitigated** — management commands only, deliberately. See [06](06-data-subject-rights.md) |
| The Act 987 opinion cites the wrong section numbers for all three Act 843 obligations | — | **Corrected** in `LEGAL_OPINION_ACT987.md` §6 |

## Corrections made to `LEGAL_OPINION_ACT987.md`

Its §6 cited §18 as the registration requirement (it is **§27**), §19 as the data protection
principles (they are **§17**), and §20 as the data protection officer provision (there is none;
supervisors are appointed under **§58**). The conclusions were right — registration and a
supervisor are both required — but a legal opinion citing the wrong sections is a document
nobody can file. Corrected in place, with the change noted in the file.