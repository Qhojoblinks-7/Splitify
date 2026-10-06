# Data processing register — §17 accountability

**Statute:** Act 843 (2012) §17 (the eight principles), §19 (minimality), §21 (direct collection),
§22 (specific purpose), §24 (retention), §28 (security), §32–44 (rights)
**Owner:** the data protection supervisor · **Review:** at least annually, and on any change

§17(a) is **accountability**: the controller must be able to demonstrate compliance, not assert
it. This document is that demonstration. Every row cites the code that implements it, so the
register can be checked rather than trusted.

---

## The eight principles, and where each is answered

| # | §17 principle | How it is satisfied | Where |
|---|---|---|---|
| a | Accountability | This register; the machine check; the supervisor's quarterly report | This file; `manage.py privacy_compliance_report` |
| b | Lawfulness of processing | A lawful basis for each purpose below — consent, contract, legitimate interest, or a legal duty | §20 analysis per row |
| c | Specification of purpose | Nine named purposes, no secondary use, no marketing | Purposes table below; `notice.py` `MARKETING = "none"` |
| d | Compatibility of further processing | The only further processing is verification and record-keeping, both necessary to the purpose given to the member | Verification row; no marketing profile exists |
| e | Quality of information | Amounts are integer pesewas server-side, never a client value; phones normalised to E.164; the member can correct their own record | `susu/models.py:to_pesewas`; `accounts/phones.py`; access and rectification |
| f | Openness | The notice is published in the app, served from one source, and versioned | [04](04-privacy-notice.md) |
| g | Data security safeguards | JWT, authorisation by membership, append-only ledger, constraints, TLS and HSTS | [08](08-security-measures.md) |
| h | Data subject participation | Members see the roster, the payment state and the full audit log, and can ask for a copy of their data | `GET /api/groups/{id}/rounds/current/`; `GET /api/privacy/export/` |

---

## Processing activities

### 1. Account creation and maintenance

| Field | Particular |
|---|---|
| **Purpose** | Create and keep the account a member holds a seat in a group with |
| **Data subjects** | Members |
| **Data** | Mobile money number (E.164), name (optional), email (optional), password hash, consent record, `last_active_at`, `anonymised_at` |
| **Lawful basis** | **§20(1)** prior consent, given in the app and recorded with the notice version; and **§20(1)(a)** necessity for the contract the member enters into by signing up |
| **Collection** | Direct from the data subject — **§21(1)** |
| **Recipients** | None outside the controller. Not disclosed to any third party |
| **Transfer** | None |
| **Retention** | Until erasure, then the anonymised record for the 7-year hold. Inactive for 2 years and outside every group → anonymised on the schedule |
| **Security** | Argon2id hash; JWT only; no Django admin site; masked display name |
| **Evidence** | `accounts/models.py`; `compliance/models.py:ConsentRecord`; `compliance/retention.py:inactive_accounts` |

### 2. Group formation and rotation

| Field | Particular |
|---|---|
| **Purpose** | Create a group, seat its members, and run the rotation in a fixed order |
| **Data subjects** | Members of a group |
| **Data** | Group name, description, target in pesewas, collection day, invite code, collection account; membership (position, role, active, join date, mobile money number, missed streak, debt and its reason) |
| **Lawful basis** | Consent; **§20(1)(a)** the arrangement every member of the group entered into |
| **Collection** | Direct. A creator seats **themselves only** — there is no endpoint that adds a named stranger to a rotation, because a group populated with other people's names is a group that can be made to impersonate a real one |
| **Recipients** | The other members of the same group |
| **Transfer** | None |
| **Retention** | For the life of the group, plus the 7-year hold |
| **Security** | Membership checked at the edge of every endpoint; max 50 members; unique membership per group; rotation order assigned once and never reindexed |
| **Evidence** | `susu/models.py:SusuGroup, Membership`; `susu/api.py:GroupJoinView`; `GroupCreateView` |

### 3. Contribution recording

| Field | Particular |
|---|---|
| **Purpose** | Record what each member claims to have paid into the current round |
| **Data subjects** | Members of a group |
| **Data** | Amount in pesewas, provider, transaction reference, status, failure reason, manual verification reason, idempotency key, timestamps |
| **Lawful basis** | Consent; **§20(1)(a)** performance of the group's arrangement |
| **Collection** | Direct — the member types the reference on their own phone |
| **Recipients** | The other members of the group see **amount and status**, not the reference. The reference is visible to the admin who verifies it |
| **Transfer** | None at this stage |
| **Retention** | 7 years from the round. Never deleted, only corrected by a visible reversal |
| **Security** | Idempotency key, unique reference per member, one verified contribution per member per round (database constraint), amount ceiling of twice a member's share |
| **Evidence** | `susu/models.py:Contribution`; `susu/api.py:ContributionCreateView` |

### 4. Verification against the payment rail

| Field | Particular |
|---|---|
| **Purpose** | Establish whether a claimed payment actually settled, from the operator's answer rather than from a request |
| **Data subjects** | Members of a group |
| **Data** | Transaction reference, claimed amount, provider, and the rail's answer (confirmed / rejected / unknown) |
| **Lawful basis** | **§20(1)(e)** the legitimate interest of the group in not counting a payment that never happened; **§20(1)(c)** the legitimate interest of the member, whose money it is |
| **Collection** | From the licensed partner, under the partner's authority. This is a **third-party source**: **§27(3)** requires the member to be told, and the notice's "who else sees it" and "why" items do so |
| **Recipients** | The partner receives the reference and the amount. Nothing else leaves |
| **Transfer** | **To the licensed partner — see the gap list in [01](01-registration-application.md).** The partner's hosting locations and subprocessors must be named |
| **Retention** | Verification answers are not stored beyond the round; the outcome is recorded on the contribution |
| **Security** | A confirmed reference whose **amount does not match** is rejected, never accepted. UNKNOWN is never treated as REJECTED — failing a payment on a timing window is how a circle loses trust in the app |
| **Evidence** | `susu/rail.py`; `backend/susu/management/commands/settle_contributions.py` |

**Status: no partner agreement is signed, so no verification runs.** The worker in "unconfigured"
mode answers UNKNOWN for everything and settles nothing. That is the correct state of the world
before Act 987's licence question is settled, and it is stated in the notice rather than hidden.

### 5. Pot release

| Field | Particular |
|---|---|
| **Purpose** | Record the pot leaving for the member whose turn it is |
| **Data subjects** | Members receiving a round |
| **Data** | Amount, fee, payout key, provider reference, status, attempts, completion time |
| **Lawful basis** | Consent; **§20(1)(a)** performance of the group's arrangement |
| **Recipients** | The other members of the group |
| **Transfer** | To the licensed partner, as the counterparty to the transfer |
| **Retention** | 7 years |
| **Security** | **There is no payout endpoint.** No member and no admin can reach a payout instruction through the API; the rail fires it. The domain method exists and is unreachable from the surface. Deterministic payout key, unique per round, five attempts maximum, and the rotation advances only on completion |
| **Evidence** | `susu/models.py:Round.payout, Payout`; `susu/api.py` (no payout route) |

### 6. Disputes and administrative accountability

| Field | Particular |
|---|---|
| **Purpose** | Resolve a disputed payment, and keep the decision visible to those affected |
| **Data subjects** | Members; group admins |
| **Data** | Who flagged or disputed, the reason given, the state change, the admin trust score and flagged count |
| **Lawful basis** | **§20(1)(e)** legitimate interest of the group; **§37(6)(c)** establishing, exercising or defending legal rights, which the Act presumes necessary |
| **Collection** | Direct — a member disputes their own payment, or an admin records a flag |
| **Recipients** | **Every member of the group.** The audit log is not filtered by role |
| **Transfer** | None |
| **Retention** | **Permanent.** The dispute record is deliberately not deletable: a group that can lose its record of a dispute cannot be held to it |
| **Security** | Split authority — `verify` and `reverse` are admin-only and never on the admin's own contribution. An admin cannot check themselves |
| **Evidence** | `susu/ledger.py:AuditEvent`; `susu/api.py:ContributionTransitionView` |

**Financial clawback: none, deliberately.** The platform holds no funds, so there is nothing to
debit, and taking a payment from a member would itself be an unlicensed payment service under
Act 987. The leverage is visibility and removal.

### 7. Fraud and abuse prevention

| Field | Particular |
|---|---|
| **Purpose** | Stop a false reference, an impersonated group, or an admin draining a pot |
| **Data subjects** | Members; group admins |
| **Data** | Duplicate and replayed references, invite codes, collection accounts, the append-only action log |
| **Lawful basis** | **§20(1)(e)** legitimate interest of the group and of every member in it |
| **Recipients** | The group's own members |
| **Transfer** | None |
| **Retention** | The action log for 7 years; a refused duplicate reference is not retained beyond the contribution it was refused against |
| **Security** | Database constraints on the invariants; `select_for_update` on round state changes; collection account immutable to every member and admin |
| **Evidence** | `susu/models.py` constraints; `susu/api.py` permission classes |

### 8. Record-keeping required by law

| Field | Particular |
|---|---|
| **Purpose** | Meet the retention obligations of the Anti-Money Laundering Act, 2020 (Act 1044) s.38, and Act 843 §24(1)(a) |
| **Data subjects** | Members |
| **Data** | The double-entry ledger, the audit trail, contributions, payouts, and the anonymised account |
| **Lawful basis** | **§20(1)(b)** authorised or required by law |
| **Recipients** | A regulator or court, on lawful demand |
| **Transfer** | None |
| **Retention** | 7 years, then destruction or de-identification in a manner that prevents reconstruction — **§24(5), §24(6)** |
| **Evidence** | `compliance/retention.py`; `manage.py purge_expired_personal_data` |

### 9. Contacting a member about their own account

| Field | Particular |
|---|---|
| **Purpose** | Account and collection reminders, and answering a question |
| **Data subjects** | Members |
| **Data** | Contact details and what is sent |
| **Lawful basis** | **§20(1)(c)** the legitimate interest of the data subject |
| **Recipients** | Nobody. No service provider sends mail on our behalf today |
| **Transfer** | None |
| **Retention** | While the account is open |
| **Direct marketing** | **None, and none planned. §40 requires prior written consent; there is nothing to consent to.** Any future marketing requires a fresh written consent and a change to this register |

---

## Data flows to non-members

Checked explicitly, because a register that only describes what we intend to do is worthless.

| Question | Answer |
|---|---|
| Do we collect from anyone who is not a member? | **No.** There is no signup endpoint that accepts data from a third party, and no public endpoint that returns personal data |
| Do we receive data from anywhere? | Only from the licensed payment partner (activity 4), which is a **processor acting for the group under the partner's authority**, disclosed under §27(3) |
| Does a member see another member's **phone number**? | **No.** `Account.display_name` masks it. This was a real defect, found by this register, and it is now held by a test |
| Does a member see another member's **payment reference**? | No — only amount and status |
| Does a member see the **full audit log**? | Yes, by design. AT4: an admin action nobody can see is an admin action nobody can hold to account for |
| Do we **sell** personal data? | **No**, and §89 prohibits it |
| Do we run **analytics or advertising**? | **No.** No such SDK is in the client |
| Do we make **automated decisions** with significant effect? | **No.** §41 is answered in the negative; a flag is placed by a named admin, is visible to the whole group, and can be disputed. See [09](09-dpia.md) for the automated-debt point, which is the closest thing to one and is disclosed there |

---

## Changes to this register

| Rule | Why |
|---|---|
| A new purpose gets a row **before** the feature ships | The notice and the register are evidence, and evidence produced afterwards is a reconstruction |
| A new recipient means a §27(2)(g) notice change and a version bump | Consent is to a notice, not to a category |
| A new transfer means a §47(1)(g) amendment and, if material, a §55 filing to the Commission within 14 days | 14 days is a statutory deadline, not a target |
| Removing a purpose means stopping the processing, not just the row | §24(1): the retention period ends when the purpose does |
| Every change is dated, named and signed by the supervisor | §17(a) |