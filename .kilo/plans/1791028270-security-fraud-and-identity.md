# Security, Fraud and Identity — Growl

**Binding specification for who may do what, and who may be believed.**

Third pillar, alongside `1791027903-money-handling-and-safeguards.md` and
`1791026719-growth-business-logic.md`. Where any of the three disagree, the money document wins on
matters of funds; this document wins on matters of identity, access and trust.

---

## 0. What we are actually defending, and what we are not

Ghana's fraud data, and the honest reading of it:

| Finding | Source |
|---|---|
| Mobile money fraud is the **highest-frequency** banking-sector category (31.5% of cases) but among the **lowest value** — GH¢142,038 net across 23 cases | Ghana Association of Banks industry fraud report, Q1 2026 |
| 123,000+ fraudulent SIM cards linked to SIM-swap activity found in 2025 | INTERPOL African Cyberthreat Assessment Report 2026 |
| GH¢19m+ lost to cybercrime, 2,000+ incidents, in nine months | Cyber Security Authority |
| Social engineering — not intrusion — is the dominant vector, now amplified by AI-cloned voices and generated messages | BoG, CSA, GSMA, MMFL white paper June 2026 |
| Ghana ranked 1st of 90 nations on the GSMA Mobile Money Regulatory Index (96.1%) | MMFL / GSMA |
| The mobile money agent network is named the most persistent fraud entry point | MMFL white paper, April 2026 forum |

### 0.1 Two consequences that shape everything below

**We are not worth attacking for our money.** A GH¢300 weekly round split across members is a
rounding error next to a bank balance. Sophisticated fraud in Ghana does not target susu pots; it
targets accounts, and it scales with value. **Per-transaction theft against Growl is not the
threat.** Over-investing in treasury-grade controls against a nonexistent attacker is the most
common way a small team burns its six months.

**The threat is impersonation.** An attacker's asset is not our database — it is our **credibility
in a market where people already trust us with their savings.** Fraud in this market runs on a
call pretending to be MTN, a fake "your transaction will be reversed" SMS, a cloned voice.
INTERPOL now reports AI voice cloning in the attack chain.

### 0.2 The structural advantage

Because Growl holds no funds (money document §1.1), an impersonator using our name has **nothing
real to steal.** There is no balance to reverse, no float to drain, no refund API to abuse. That
eliminates the most common Ghanaian mobile-money fraud pattern outright.

But it does not eliminate the residual attack: a fraudster can still persuade a member to send
money to **his own** wallet using our brand as credibility. That is Authorised Push Payment fraud,
the dominant global mobile-money pattern, and it is the primary threat this document addresses.

### 0.3 The consequence for spending

Defence is weighted to **identity assurance, impersonation resistance, and insider
detectability** — not to defending a treasury we do not have.

---

## 1. Threat model

Ranked by likelihood × impact for *this* product.

| # | Attacker | Attack | Impact | Primary control |
|---|---|---|---|---|
| T1 | **External impersonator** | Calls/SMS/WhatsApp a member claiming to be Growl, a collector, Hubtel, or a bank. Asks for PIN, OTP, or "confirms" a wallet/payment | Member loses their own money. Growl blamed. Trust destroyed — the worst outcome we have | §4, §5 |
| T2 | **Fake group operator** | Creates a convincing group on our platform (or a clone app) and collects real MoMo into their own wallet | Direct theft plus reputational damage to the category | §6 |
| T3 | **Rogue/colluding collector** | Logs contributions that never happened; collects cash and pockets it; colludes with members | Members defrauded inside a group they trusted. Hardest to detect, hardest to recover | §7 |
| T4 | **SIM-swap attacker** | Takes over a member's number, intercepts OTP, resets credentials, drains their wallet | Member's MoMo drained. Correlated failure if our auth uses the same number | §3.4 |
| T5 | **Synthetic identity** | Fake Ghana Card number, AI-generated documents, deepfake selfie | Fake members, fake collectors, laundering through real groups | §3.3 |
| T6 | **Compromised member account** | Credential stuffing, stolen phone, shared code | Attacker logs contributions, opens disputes, reads group history | §3.5 |
| T7 | **Invitation-code abuse** | Enumerates or shoulder-surfs a code, joins a group uninvited | Unwanted member; can see history and disrupt rounds | §6.3 |
| T8 | **Our own staff / insider** | Reads member financial data beyond need; extracts numbers for a scam list | Act 843 breach; enables T1 at scale | §9 |
| T9 | **Hubtel / telco insider** | Merchant record tampering, fake reversals | Previously documented as a Ghana fraud typology against merchants | §8 |
| T10 | **Disclosure attack** | A member's savings record leaked and used to target them with a loan or scam offer | Member harmed; Act 843 breach; kills the institutional tier | §10 |

**Out of scope:** defending Growl's own treasury (we have none), defending against state-level
compulsion, defending the telco network's internal security.

---

## 2. Zero-trust principles

| ID | Principle |
|---|---|
| P1 | **We hold no funds.** Every access decision below is easier because of this. Never weaken it |
| P2 | **Never trust the client** for identity, amount, role, or status. The server decides; the client renders |
| P3 | **Never trust a typed value.** A reference number, a phone number, an amount, a role — all are claims until the server verifies them against a source it controls |
| P4 | **Every privileged action takes an actor and is checked in the domain layer**, never in the UI (growth doc §12) |
| P5 | **Money records are append-only.** Access may be read-only; never write (§11) |
| P6 | **Every member-visible number is member-visible to all members.** Nothing is hidden from a group except that member's own credentials |
| P7 | **Least privilege by default.** A member can read their own records. Anything else is an explicit, audited grant |
| P8 | **Fail closed on verification.** Unknown, ambiguous, or unverifiable means not verified. Never a default-allow |
| P9 | **An alert is not a control.** A logged warning that nobody acts on is theatre. Every detection has a named response |
| P10 | **The market's trust is the asset.** Every control below is judged on whether it protects a member's ability to believe a record — not merely on whether it blocks a request |

---

## 3. Identity and authentication

### 3.1 Primary identifier is the phone number

| ID | Rule | Why |
|---|---|---|
| I1 | The **Ghanaian mobile money number is the primary identity.** Email is optional and exists only for account recovery and notifications | Ghana's MoMo identity is the phone number. An email-first product cannot bind a payment to a person, which is the one thing that makes attribution work |
| I2 | Numbers are stored in **E.164** (`+233…`). Display formatting only in the UI | `024…`, `+23324…`, `233 24…` are one identity; formatting variance is an account-linking bypass |
| I3 | A phone number may belong to **one account only**, enforced by a unique constraint | Prevents account sharing and money-laundering pairs |
| I4 | Email change **never** changes identity and never affects a payout destination | Keeps the weak factor away from money |
| I5 | Identity is **`unverified` → `phone_verified` → `id_verified`**. Never skip a stage | Prevents unverified actors reaching money paths |

### 3.2 Capability ladder

| Capability | Requires | Rationale |
|---|---|---|
| Join a group by invite | `unverified` + phone number | Growth. Low risk — joining is not paying |
| Log a contribution (own) | `phone_verified` | Payment is claimed against an identity |
| Create a group | `id_verified` | Creation is the highest-leverage abuse vector |
| Receive a payout | `id_verified` + payout destination verified | Receiving is where the harm lands |
| Admin actions (review, close, restart, waive) | `phone_verified` + admin role | Reviewed and permanent |
| Manual verification (labelled) | `id_verified` + admin role + reason | Last resort, never silent |
| Institutional read/export | Contract + named individuals + consent | Act 843 |
| Any privileged money instruction | `system` actor only | Never a human |

### 3.3 Ghana Card verification

| ID | Rule |
|---|---|
| I6 | Verified **against the Ghana Card verification source**, never by uploading a photo and trusting an OCR |
| I7 | The **Ghana Card number is the identity anchor**, not merely a required field |
| I8 | **Liveness check** on a selfie, with spoof and deepfake detection. Document photo upload is not identity verification |
| I9 | **A Ghana Card number alone is insufficient.** Researchers on Ghana fraud state that SIMs can still be registered with false details; the check must bind to the cardholder record, not merely validate the number's format |
| I10 | A failed or suspicious verification is a **hard stop** for payout receipt. Never a warning |
| I11 | Verification results are stored as an evidence record with provider, timestamp, and result. Never a bare boolean |
| I12 | Verification status is visible to the group: an unverified member can contribute but cannot receive |

### 3.4 SIM-swap resilience

The defining account-takeover method in Ghana (123,000+ fraudulent SIMs in 2025). An attacker who
controls a number intercepts OTPs and drains the wallet in minutes.

| ID | Rule |
|---|---|
| I13 | **SMS OTP alone is never sufficient for a money-affecting action.** Session + device binding required |
| I14 | **Payout destination changes require re-verification** of the new destination and a **24-hour cooling-off period**. This is the single highest-value control in this document |
| I15 | **Account recovery never completes on SMS alone.** Requires Ghana Card re-verification or in-person confirmation at a collection point |
| I16 | A high-risk sign-in — new device, new SIM, unusual location, first payout destination — triggers step-up authentication, never a silent continuation |
| I17 | **Detect SIM changes via the telco where possible.** Hubtel can notify on number-identity change (Q10, money doc §13) |
| I18 | On suspected takeover: **freeze all payout destinations immediately**, notify the member and the group, and require re-verification. Fail closed |
| I19 | **Explicit anti-phishing warning on every screen that asks for a PIN or OTP.** Growl never asks for either, ever (§5) |
| I20 | Short-lived sessions with rotation. A session older than 30 days requires re-authentication |

### 3.5 Session and credential handling

| ID | Rule |
|---|---|
| I21 | Passwords hashed with **Argon2id** (or bcrypt cost ≥12) with a per-user salt. Never reversible, never logged, never in a client-side comparison |
| I22 | Tokens stored in **`expo-secure-store` / Keychain / Keystore** — never `AsyncStorage`, which is plaintext on Android |
| I23 | Refresh tokens rotate on use. Reuse of a rotated token revokes the whole session family |
| I24 | Session invalidated on: phone number change, Ghana Card change, payout destination change, `id_verified` downgrade |
| I25 | **Device binding.** Every session is bound to a device identifier. New device = step-up, and a notification to the existing devices |
| I26 | No self-service "email a support agent to unlock my account." Support cannot bypass §3.2 |
| I27 | Login attempts are rate-limited per identifier and per device, with exponential backoff. Lockout must not be an availability DoS against a member's legitimate access |
| I28 | **Failed authentication never reveals whether an account exists** — identical response and timing for unknown number and wrong password |

---

## 4. Impersonation defence (T1 — the primary threat)

This is where the money goes, because per §0 this is the attack that actually happens.

| ID | Rule |
|---|---|
| I29 | **Growl never asks a member for a mobile money PIN or an OTP. Ever.** No screen, no flow, no support process |
| I30 | That sentence is **published permanently in-app**, on the contribution screen, on the payout screen, and on the fraud-report screen. It is a control *and* a marketing asset |
| I31 | **One published, stable support identity**: a single number and a single domain that never change. Members must have something to check a caller's claim against |
| I32 | **No outbound calls or SMS asking a member to authorise a payment.** Any such request is a forgery by definition |
| I33 | No claim of authority by Growl that is not verifiable in-app: never "your account will be closed", never "verify to receive your pot" |
| I34 | **Never say a payment failed in a way that invites a callback.** The failure matrix (money doc §9) states plainly whether money moved; it never prompts the member to phone anyone |
| I35 | Inbound calls are not answered with account details under any circumstance. Support reads from the ledger; the member supplies identity, support never extracts it |
| I36 | **A "fraud alert" is never a push notification that links to a payment action.** Notifications are informational only; every one opens the app to a read-only view |
| I37 | Members can **verify any claim about us** in-app: our number, our domain, whether a group is real, who its admin is, what the collection account is |
| I38 | Brand-abuse reports are handled within **24 hours** and acknowledged to the reporter |

---

## 5. Fraud reporting and response

| ID | Rule |
|---|---|
| I39 | **In-app fraud reporting is a first-class flow.** One screen, works offline, queues when there is no signal |
| I40 | Reports are triaged by category: impersonation, fake group, rogue collector, account takeover, phishing, other |
| I41 | **Rogue collector reports route to the group admin and the collector's relationship owner**, not to a shared inbox |
| I42 | Escalation paths published: CSA (`292` call/text, WhatsApp `0501603111`, `report@csa.gov.gh`) and BoG's Fintech and Innovation Department (`fintech@bog.gov.gh`). Surfaced in-app, because members need somewhere to go when it is not us |
| I43 | Every confirmed impersonation case is logged as a named incident with member-visible resolution |
| I44 | **Annual fraud report to members**, aggregate, no member identifiable. Proves the controls are real |
| I45 | A member can freeze their own account and all payout destinations in one action, effective immediately, without support |

---

## 6. Group and invitation security

### 6.1 Group authenticity (T2)

| ID | Rule |
|---|---|
| I46 | Every group has a **verification status**: `unverified` → `verified`. Verified requires `id_verified` creator, Ghana Card check, and **no unresolved fraud report** |
| I47 | Verification status is **visible to every member on the join screen**, before they commit |
| I48 | A group cannot be renamed to impersonate another group. Name plus invite code must be unique |
| I49 | **The collection account is displayed to every member before every payout**, with the partner's name. A member must be able to see *where* their money goes before it goes |
| I50 | Group creation is rate-limited per identity, per device, and per Ghana Card number |
| I51 | **A group's collection account is immutable to every member and to every admin.** It changes only by Growl engineering action under the two-person rule (I78), is logged, and is permanently visible (I49) |

### 6.2 Collection account visibility

The single most effective anti-impersonation control available: **the group shows, permanently and
prominently, the Hubtel collection account number it uses.** A fraudster running a fake group with a
real-looking ledger cannot match that number. A member who checks once can detect every fake group
thereafter.

### 6.3 Invitations (T7)

Current position: 6 characters from a 32-symbol alphabet ≈ 2³⁰ ≈ 1.07 billion combinations, with
no rate limiting and no binding. Enumerable at scale; photographable in a screenshot.

| ID | Rule |
|---|---|
| I52 | A join code **alone never grants access**. It resolves to a short-lived, single-use, phone-bound token |
| I53 | Tokens expire in **15 minutes** and are single-use |
| I54 | Joining requires a phone number the inviter vouched for, plus the admin's approval for groups above 10 members |
| I55 | **Join codes never appear in any shareable artefact.** The turn card, savings record and statement must be shareable for growth (growth doc M1) and must carry no access credential. This is a hard conflict resolved in favour of security |
| I56 | Join attempts rate-limited per code, per phone number, and per IP/device |
| I57 | **Suspicious join activity auto-rotates the code** and notifies the admin |
| I58 | A member can remove another member. Removal blocks reads, not just writes |
| I59 | `regenerateInviteCode` rotates immediately, invalidates outstanding tokens, and is logged |

---

## 7. Collector and insider risk (T3)

The regulator names the agent network as Ghana's most persistent fraud entry point. Our collectors
are functionally that network. **This is the highest-value control set in the document, because
the most likely person to defraud a member is someone the member already trusts.**

| ID | Rule |
|---|---|
| I60 | **A collector cannot verify anything.** Verification is machine-only against the rail. Admin power is review: flag, escalate, request re-proof |
| I61 | Where collector and admin are the same person, the group is marked **`single_control`** and surfaced to members. Two-person approval required for rounds above a configured threshold |
| I62 | Every admin action is attributed, timestamped, and **permanently visible to all members** |
| I63 | **Cross-group anomaly detection per collector.** Signals: contributions arriving within seconds of each other; identical amounts across unrelated groups; verification rate near 100% with zero disputes; sudden defaulter spikes; groups created and abandoned repeatedly; dispute patterns resolved instantly |
| I64 | Anomaly detection produces a **named response**, not a log line (P9). Thresholds, auto-flag, admin review, collector suspension |
| I65 | **Member-reported cash:** where a collector handles physical cash, the app must not represent that cash as verified. Digital (rail-verified) and cash (collector-asserted) contributions are **visually and structurally distinct, always** |
| I66 | If a group operates on cash, its statement is labelled as **not independently verified**. An institution must never receive an unqualified cash-based record |
| I67 | Collector identity is **KYC'd to the same standard as any member** who receives a payout, plus business registration |
| I68 | Suspension takes effect immediately on the collector's own device, server-side, not by asking them to uninstall |
| I69 | **Member funds are never visible as a withdrawable balance to a collector.** There is no balance, by design (P1) |
| I70 | An institution's read access never implies write access, and is per-named-individual |
| I71 | Bulk member import is limited per collector per day. Import creates `unverified` members only — never verified ones |

---

## 8. Provider and telco risk (T9)

| ID | Rule |
|---|---|
| I72 | All Hubtel webhooks are **signature-verified**. Unsigned or invalid-signature payloads are dropped and alarmed |
| I73 | Webhook payloads are checked for **replay** (nonce, timestamp window) |
| I74 | Hubtel is treated as an untrusted source of *facts about money*. The ledger is the record; the webhook is an input to it |
| I75 | Every inbound amount is validated against the recorded claim before verification (money doc C-S4, V3) |
| I76 | Merchant-record tampering — historically documented against Ghanaian merchants — is covered by daily reconciliation against Hubtel's transaction list, with auto-quarantine on mismatch (money doc RC5) |
| I77 | Fake reversals are detected by RC1/RC2 reconciliation and never accepted without provider confirmation |
| I78 | **Two-person rule** on any configuration change affecting money movement: fee schedule, payout thresholds, payout destinations, freeze rules |

---

## 9. Internal access and privacy (T8, T10)

| ID | Rule |
|---|---|
| I79 | **No employee has standing production database access.** Access is time-bound, ticket-linked, and logged |
| I80 | Every production data read is logged with actor, purpose, scope, and timestamp. Reviewed monthly |
| I81 | **PII and financial data are never in logs, analytics, crash reports, or error messages.** Numbers are masked (`+233 •• ••• •67`) |
| I82 | No member's savings record is ever used for marketing, list-building, or third-party sale |
| I83 | Sharing a record with an institution requires explicit, per-institution, revocable consent (growth doc S7) |
| I84 | Data is encrypted in transit and at rest; encryption keys are managed outside the application |
| I85 | **Retention is defined and enforced.** Financial records for the statutory period; everything else is deleted on schedule, not on request from storage pressure |
| I86 | **Ghana Card numbers are never stored in full** — last two digits plus a hash are sufficient for matching and expose nothing if breached |
| I87 | **We never request a member's MoMo PIN or OTP, and our systems have no field to receive one.** Enforced at the schema level: if there is no column, there is no phishing target |
| I88 | Incident response: detect → contain → notify members → notify BoG/CSA → remediate → publish. Member notification is not optional |

---

## 10. The unifying control

The platform's moat, its retention, and its security are the same mechanism: **an auditable record
every member can read.**

Fraud in Ghana thrives on deniability — a paper register in a plastic folder cannot be checked.
A member who can see who verified their payment, who the admin is, every dispute in permanent
record, and where the collection account is, is materially harder to phish than one without that
record. Verifiability is not a compliance obligation bolted onto the product. **It is the
anti-fraud control, the retention mechanism, and the institutional sales asset — one thing.**

---

## 11. Prohibited — no exceptions

| # | Prohibited |
|---|---|
| 1 | Growl holding or accessing member funds, in any form (P1) |
| 2 | Any employee with standing production database access (I79) |
| 3 | PII or financial data in logs, analytics, crash reports, or error messages (I81) |
| 4 | Storing a full Ghana Card number (I86) |
| 5 | Any field, endpoint, or UI element that accepts a MoMo PIN or OTP (I87) |
| 6 | Payout destination change without re-verification and a cooling-off period (I14) |
| 7 | Account recovery completed on SMS alone (I15) |
| 8 | Email as the primary identity (I1) |
| 9 | A join code granting access without a phone-bound token (I52) |
| 10 | A join code in any shareable artefact (I55) |
| 11 | A collector or admin verifying a contribution in the steady state (I60) |
| 12 | An unverifiable identity treated as verified (P8, I10) |
| 13 | Representing collector-asserted cash as rail-verified (I65, I66) |
| 14 | Detecting fraud with no named response and no owner (P9, I64) |
| 15 | Sharing a member's record without explicit per-institution consent (I83) |
| 16 | **Scoring, recommending, arranging, or disbursing a loan.** That is a Digital Credit Services Provider activity requiring a GH¢2,000,000 licence. We share a consented record; a lender lends. BoG named 40 unlicensed digital credit apps in eight weeks of 2026 and publishes the list weekly |
| 17 | Any automated decision affecting a member's money made without a human, recorded, appealable decision behind it |

---

## 12. Risk register

| Risk | Likelihood | Impact | Control | Residual |
|---|---|---|---|---|
| Impersonation call harvesting member PINs | **High** | Severe | I29–I38, I45 | Medium — depends on member vigilance |
| Fake groups collecting real money | **High** | Severe | I46–I50, §6.2 collection account visibility | **Low** |
| Rogue collector fabricating contributions | **High** | Severe | I60–I71, I65 cash/verified distinction | Medium — behavioural, not deterministic |
| SIM swap taking over an account | Medium | Severe | I13–I20 | Medium — Ghana Card re-verification is the anchor |
| Synthetic identities | Medium | High | I6–I11 liveness + source verification | Medium |
| Invitation enumeration | Medium | Medium | I52–I59 | **Low** |
| Member record leaked for targeting | Low | Severe | I79–I88, I83 consent | **Low** |
| Hubtel webhook spoof/replay | Low | Severe | I72–I75 | **Low** |
| Insider exfiltration of member lists | Low | Severe | I79–I81 | Medium — detection, not prevention |
| Clone app impersonating Growl | **High** | Severe | I29–I37, §6.2 | Medium — external, ongoing |

---

## 13. Implementation order

| Month | Deliverable | Rule IDs |
|---|---|---|
| **M1** | Phone-first identity; E.164 normalisation; password Argon2id; `expo-secure-store`; session binding + rotation; rate limits; no-enumeration responses. Replace the email-first auth stubs entirely | I1–I5, I21–I28 |
| **M1** | Publish the never-ask statement, the stable support identity, and the verification screen (check any claim about us) | I29–I38 |
| **M2** | Join tokens; invite-code rate limits; code rotation; **remove any code from shareable artefacts**; join-screen group verification status | I46–I59 |
| **M2** | Collector KYC; cash vs rail-verified distinction; `single_control` flagging; two-person threshold | I60–I71 |
| **M3** | Ghana Card source verification + liveness; capability ladder enforced server-side | I6–I12, §3.2 |
| **M3** | Payout destination cooling-off period; step-up auth; recovery without SMS; SIM-change detection | I13–I20 |
| **M4** | Webhook signature + replay verification; reconciliation quarantine | I72–I78 |
| **M4** | Access logging, PII masking, retention enforcement, Ghana Card truncation | I79–I88 |
| **M5** | Fraud reporting flow; escalation paths; member-facing fraud report | I39–I45 |
| **M6** | Cross-group anomaly detection with named responses and owners | I63–I64 |

---

## 14. Pre-launch checklist

**Identity**
- [ ] Phone-first identity; email optional and recovery-only (I1, I4)
- [ ] E.164 normalisation with a unique constraint on numbers (I2, I3)
- [ ] Capability ladder enforced server-side; no client-side role checks (I5, §3.2)
- [ ] Ghana Card verified against the source API, with liveness (I6, I8)
- [ ] Full Ghana Card numbers never stored (I86)
- [ ] Passwords Argon2id; tokens in `expo-secure-store`, never AsyncStorage (I21, I22)
- [ ] Refresh-token rotation with reuse detection; session family revocation (I23)

**SIM swap**
- [ ] No SMS-only auth for any money-affecting action (I13)
- [ ] **Payout destination change requires re-verification + 24h cooling-off, enforced server-side** (I14)
- [ ] Recovery impossible on SMS alone (I15)
- [ ] Step-up auth on new device / new SIM / first destination (I16)
- [ ] Suspected-takeover flow freezes destinations and notifies the group (I18)

**Impersonation**
- [ ] **"Growl never asks for your PIN or OTP"** published in-app on contribution, payout and fraud screens (I30)
- [ ] **Schema-level proof**: no field anywhere accepts a PIN or OTP (I87)
- [ ] One stable support identity, published; no outbound authorisation calls (I31, I32)
- [ ] Members can verify any claim about us in-app (I37)

**Group integrity**
- [ ] Group verification status visible on the join screen (I47)
- [ ] **Collection account displayed permanently, and before every payout** (§6.2, I49)
- [ ] Join requires a phone-bound single-use 15-minute token (I52, I53)
- [ ] **No join code in the turn card, savings record, or statement** (I55)
- [ ] Join rate limits; auto-rotation on suspicious activity (I56, I57)

**Collector**
- [ ] Collectors cannot verify; verification is machine-only (I60)
- [ ] `single_control` flagged where collector = admin; two-person threshold above it (I61)
- [ ] Cash contributions structurally distinct from rail-verified, in UI and in exports (I65)
- [ ] Statements from cash-based groups labelled not independently verified (I66)
- [ ] Bulk import creates unverified members only (I71)

**Internal**
- [ ] No standing production DB access; time-bound, ticket-linked, logged (I79)
- [ ] PII masked in logs, analytics, crash reports, errors (I81)
- [ ] Production reads logged with actor, purpose, scope; reviewed monthly (I80)
- [ ] Member records never used for marketing or sale (I82)

**Response**
- [ ] In-app fraud reporting works offline and queues (I39)
- [ ] CSA and BoG escalation paths published in-app (I42)
- [ ] One-action account freeze for members (I45)
- [ ] Brand-abuse cases acknowledged within 24 hours (I38)

**Verification of the verification**
- [ ] Red-team exercise: scripted impersonation call against real members' comprehension (I29–I38)
- [ ] Red-team: attempt to verify a contribution without a rail match (P8, I60)
- [ ] Red-team: enumerate invite codes against rate limits (I56)
- [ ] Red-team: takeover simulation — SIM change, OTP intercept, recovery attempt (I13–I20)
- [ ] Insider exercise: attempt to read production member data outside a ticket (I79)

---

## 15. Change control

1. Any change to §11 (prohibitions), §3 (identity), or §4 (impersonation defence) requires a
   failing test demonstrating the current behaviour is exploitable, written **before** the change.
   No test, no change.
2. Any change to §11 requires written Act 987 and Act 843 sign-off. They are legal boundaries.
3. **Every rule ID maps to at least one automated test or a documented manual verification step
   in §14.** A rule ID with neither is unimplemented and must not be reported as done.
4. Residual risk in §12 marked Medium is **accepted risk**, not deferred work. It is reviewed at
   each gate in `1791026719-growth-business-logic.md` §18.
5. This document supersedes conflicting statements in all previous plans. Where they disagree,
   this document is correct.