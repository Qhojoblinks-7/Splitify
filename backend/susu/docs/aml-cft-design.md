# AML/CFT Screening Design — Growl Group Susu

**Status: design only. Nothing here is implemented, and nothing here is legal advice.**

This document specifies what a screening programme would need to contain for Growl. It is
written because the obligation does not disappear by being unscoped — Ghana's Anti-Money
Laundering Act, 2020 (Act 1044) and the Financial Intelligence Centre Act, 2019 (Act 1013)
impose duties on designated persons regardless of whether a product has a screening feature.
Deciding later is still deciding.

**This is not a substitute for counsel.** Every section below needs sign-off from a Ghanaian
AML practitioner and the BoG/FIC before implementation. Where the design turns on a legal
question, the question is stated rather than answered.

---

## 1. Scope: what Growl is, in the regulator's terms

The compliance posture is the most important input to every decision here, so it comes first.

| Question | Answer | Consequence for screening |
|---|---|---|
| Does Growl hold funds? | **No.** Never, by design | No custodial monitoring, no pooled-account thresholds |
| Does Growl transmit money? | **No.** Member → mobile money → member | Not a payment service; no MSB-style transaction monitoring |
| Does Growl give instructions to a payment rail? | **No.** No payout endpoint exists | No instruction-monitoring or sanctions-screening-on-payout |
| Does Growl hold an account balance? | **No.** It holds *records* of transactions | Reconciliation obligations attach to the partner, not to us |
| Does Growl connect members to each other? | **Yes** | This is where the residual obligation sits |

The residual risk is concentrated in one sentence: **Growl builds and operates the
infrastructure through which a group of people repeatedly collect and redistribute money to
each other, outside a bank's controls.**

That is structurally close to what the Act 1044 definitions target, and the exemption most
worth testing is whether a rotating savings circle whose members already know and trust each
other falls inside it. **This is the central open legal question in the whole programme, and it
belongs in the Act 987 opinion, not in a design document.** If the answer is that we are in
scope, the remaining sections describe the minimum viable programme.

### 1.1 The scope decision drives everything

| If out of scope | If in scope |
|---|---|
| Register as a reporting institution anyway | Full programme: MLRO, STR filing, screening, training, record-keeping |
| Keep the audit trail for trust, not compliance | Keep it as a **statutory record** (see §6) — retention rules change |
| Screening is a product feature, not an obligation | Screening is a **licence condition** |
| No FIC go-away, no penalty exposure | Penalties under Act 1044 |

Retain the audit trail regardless. It is cheap, it is already built, and it is the evidence
base for both answers.

---

## 2. Threat model: what abuse looks like here

Designed against realistic abuse of this specific product, not a generic fraud list.

| # | Vector | How it would work here | Existing control |
|---|---|---|---|
| T1 | **Funnel accounting** | Members transact to launder value between accounts they own | None. Membership is phone-verified only |
| T2 | **Piggybacking** | Someone else pays a member's contribution to launder money | Partly. Reference is logged, payer identity is **not** checked against the member |
| T3 | **Structuring** | Many contributions just under a reporting threshold | Blocked by design — max 5× share per contribution, 50 members max, rounds are weekly and small |
| T4 | **Fake references** | Members claim contributions that never happened | **The strongest control we have.** Verification from the rail's record, never self-attested. This is the single most AML-relevant feature in the product |
| T5 | **Rapid movement** | Money in and out within a round, to disguise origin | Round structure is weekly and small. A high value-per-member ratio is the signal |
| T6 | **Undisclosed third-party payers** | A member's share is funded by someone outside the group, concealing who really benefits | **Gap.** Payer identity is never compared to member identity. See §5 |
| T7 | **Group used as a shell** | A group created only to move value between a fixed set of accounts | **Gap.** Group creation is one tap and unvalidated beyond a phone number |

T4 and the structural limits largely close off T3. **T6 and T7 are the real exposure, and
neither is closed.**

### 2.1 What the product already gets right for AML

Worth recording explicitly, because these are the controls that would otherwise be expensive
to retrofit:

- A payment cannot be declared valid by the person claiming it. Only a rail-confirmed reference
  moves the pot.
- Amounts are bounded: floor, 5× share ceiling, 50 members, one verified contribution per member
  per round, all database-enforced rather than application-enforced.
- The ledger is append-only. A screen can be run against history and cannot be rewritten around.
- Every state change records actor, from-state, to-state, and reason.

---

## 3. Programme structure

### 3.1 Roles

| Role | Responsibility | Note |
|---|---|---|
| MLRO | Named individual, accountable to the FIC | **Must be a real appointment.** An MLRO who is also the CTO is not a control |
| Compliance officer | Day-to-day screening, case management | Can be combined with MLRO at pilot scale; must not be combined with engineering |
| Engineering | Implement and maintain screening | No case decisions |
| Board | Receives the MLRO's report | The FIC expects MLRO reporting to the board, not to the CEO alone |

**The structural control that matters most:** whoever configures screening thresholds must not
be able to disable screening. Configuration lives behind a separate, auditable change path.

### 3.2 Register with the FIC

An application-level checklist, to be filed by counsel:

- [ ] MLRO appointed, in writing, with a published contact route
- [ ] Business risk assessment completed and documented
- [ ] Registration or exemption confirmed in writing by the FIC
- [ ] Procedures manual, board-approved
- [ ] Independent money laundering risk assessment
- [ ] Record-keeping and data retention schedule agreed
- [ ] Sanctions and PEP screening tool chosen
- [ ] Staff screening programme established
- [ ] Training delivered and evidenced, with an annual refresh
- [ ] Reporting officer route to the FIC tested

The FIC accepts reports through a dedicated channel, and **the obligation to report overrides
every other obligation in this document**, including the agreement with a member.

---

## 4. Customer due diligence

Applies at signup and continuously. Onboarding an unverifiable identity is the point at which
everything downstream becomes theatre.

### 4.1 At signup

| Step | Data | Rationale |
|---|---|---|
| Phone verification | OTP to a live Ghanaian number | **Strongest available control.** A Ghanaian mobile number is a real barrier to trivial impersonation |
| Full name | As entered | Needed for the STR, and for the member to be recognisable to a group |
| Date of birth | Date of birth | PEP screening needs it; so does identity disambiguation |
| National ID (Ghana Card) | Number, verified via the appropriate authority | **Recommended for beta.** Ghana Card numbers are verifiable; this is the single highest-value CDD addition |
| Self-declaration | PEP status, relationship to other members | Cheapest signal for T7, and a member who lies has still given us a record to compare |

### 4.2 Sanctions and PEP screening

Two tiers, because full screening on every request will not sustain a free product:

- **At signup:** full sanctions and PEP screening against the current UN, UK, EU, and US OFAC
  lists, plus Ghana's local list.
- **On transaction, before verification completes:** re-screen the member, not just the phone
  number. A hit does **not** silently drop the payment — see §7.

**A sanctions hit must block the transaction and alert, never pass silently.** A false positive
freezing a member's susu share is a real harm; the remedy is an appeal path, not a quiet ignore.

### 4.3 Beneficial ownership and control

Structuring groups so that a single beneficial owner appears as many members is T7. In a
rotating circle, everyone receives, so the usual ownership test has no clean analogue.

**Pragmatic proxy:** flag a group where a small number of accounts hold a disproportionate share
of seats across several groups, or where the same set of phone numbers appears in multiple
groups. Statistical, not proof, and deliberately framed as an alert for a human.

---

## 5. Transaction monitoring — proposed rules

Tier 1 should ship with the beta. Tier 2 requires volume to be meaningful, and building it
earlier produces noise nobody can act on.

### 5.1 Tier 1 — ships with beta

| ID | Rule | Rationale |
|---|---|---|
| M1 | Contribution amount above a configurable ceiling | The cheapest useful signal. We hold no money, so this is a *prompt for review*, not a reporting obligation |
| M2 | Member settles a contribution they did not make | **T2/T6.** Requires payer identity from the rail — see §6 |
| M3 | A reference is claimed by more than one member | Already refused by C-S9. Make it an alert, not just a 409 |
| M4 | New group, first contribution within 24 hours | Structurally normal for susu. Expected to be noisy; included so the rule exists before it is needed |
| M5 | Repeated failed or reversed attempts | A member repeatedly claiming payments that never landed |

### 5.2 Tier 2 — after real volume

| ID | Rule | Rationale |
|---|---|---|
| M6 | Member in many groups with few contributions each | T7 shell |
| M7 | Rapid entry and exit across many groups | Turnover inconsistent with a real savings circle |
| M8 | Contribution arrives from a number on no membership | T6, the strongest available signal |
| M9 | Group with no internal variation in payer | Robotic or simulated participation |

### 5.3 Tuning, and the thing to get right

Thresholds are **derived from the group's own frozen share, not from a global constant.** A
group with a GH¢50 share and a group with a GH¢5,000 share are not the same activity.

Set thresholds from observed data after a pilot period, and **review every false positive
before changing a rule.** The failure mode here is a rule tuned to suppress noise, which
suppresses the signal with it. Record every threshold change with a reason and an approver.

---

## 6. Records and retention

The audit trail already built is the foundation. It is currently adequate for trust purposes and
**not yet adequate as a statutory record**, for one concrete reason:

> **Gap: the audit event does not record the paying party.** A contribution records who *claimed*
> it, never who *paid* it. For AML purposes the payer is the more important party, and it is
> the party we currently cannot answer a question about.

**The fix is to capture payer identity from the rail at verification time** — the same
verification step that already asks the rail what it saw. The partner's response should be
persisted as it arrived, alongside the reference.

| Record | Retention | Note |
|---|---|---|
| Contribution, ledger entries, audit events | Per Act 1044 / FIC guidance, **confirm exact period with counsel** | Commonly 5–10 years after the relationship ends. **Do not hardcode a guess** |
| Customer due diligence records | Same period as the relationship | |
| STRs and supporting notes | Per FIC guidance | Never deleted, even if the relationship ends |
| Screening results | Duration of relationship plus the retention period | |

**A statutory retention period overrides our deletion policy.** Implementing the right-to-erasure
path in the app must not silently destroy records the Act requires us to keep — this needs to be
resolved before any account-deletion feature ships, and it is a legal question, not a
engineering one.

---

## 7. Reporting and escalation

### 7.1 Suspicious Activity Reports

The core obligation: report suspicion to the FIC, promptly, in the prescribed form.

The hardest requirement to implement correctly is that **STRs are not filed from an automated
alert.** A human decides to report; the system produces the form from the data it already holds.
Automated filing without human judgement is both a compliance failure and, in most
jurisdictions, not a defence.

Escalation path:

1. Alert raised → triaged by the compliance officer.
2. Suspicion confirmed → **MLRO decides.** The compliance officer does not file.
3. MLRO files with the FIC. **Tipped off before filing, an investigation is compromised.**
4. Member informed, unless tipping off would prejudice an investigation.
5. Disciplinary consequences: **no financial clawback** — we hold no funds, and there is nothing
   to claw back. Leverage is removal from the group and loss of access, nothing more.

### 7.2 Tipping off

A member must not be told they have been reported. This constrains the user-facing design:
the audit feed must not expose screening outcomes to other members, even though it is
member-visible by design.

**Consequence: the audit feed and the screening data must be different surfaces.** Today they
are one. Any screening implementation must keep them separate, or the feature itself becomes a
tipping-off channel.

### 7.3 Refusal and no-go

Refusing service requires a documented basis and an exit that does not itself become a tipping-off
event. A member removed for screening reasons must receive a reason, and the reason must not
name the regulator.

---

## 8. Implementation sequence

Ordered by dependency, not by importance. Each stage is independently useful.

| Stage | Work | Gate before |
|---|---|---|
| A | **Appoint the MLRO.** Nothing else is worth doing first | Everything |
| B | Capture payer identity from the rail into the ledger (§6) | C |
| C | Name and PEP screening at signup | D |
| D | Tier 1 transaction rules, alerting to a queue, no auto-filing | E |
| E | Retention schedule implemented against the counsel-confirmed periods | F |
| F | STR workflow with the MLRO, FIC forms, tipping-off controls | G |
| G | Pilot, tune thresholds, independent MLRA review | Beta expansion |

**Stage B is the one to do first technically** and the easiest to overlook, because the gap is
in the data rather than in a feature.

---

## 9. Open questions for counsel

Each of these is a question, not a decision this document is entitled to make.

1. Is a member-created rotating savings circle in scope as a "proceeds of crime" predicate
   activity? **Blocks the whole programme.**
2. Does Growl's connector role constitute providing a payment service under Act 987, separately
   from the escrow question already removed?
3. Are we a reporting institution, or exempt with registration?
4. What is the exact statutory retention period for each record class?
5. Can a member exercise data-erasure rights without breaching retention?
6. Which Ghanaian ID verification route is available and acceptable for CDD?
7. What are the consequences of screening a member's transaction — is freezing it ever correct?
8. Does the partner's own reporting cover ours, or must we report independently?
9. Are sanctions obligations triggered by Ghanaian residents, or only by international flows?

---

## 10. Summary of gaps

| Gap | Severity | Fix |
|---|---|---|
| Payer identity never recorded | **High** | Capture from the rail at verification (Stage B) |
| Shell groups undetectable | **High** | M6, M8 — need group-level analytics |
| No screening of any kind | **High** | Stages C, D — gated on A |
| No retention schedule | Medium | Stage E, gated on legal confirmation |
| Audit feed would tip off | Medium | Separate surfaces before screening ships |
| Threshold tuning | Low | Expected; do not over-tune early |