# Money Handling and Safeguards — Growl

**Binding specification for every cedi the platform touches.** No code that moves, verifies,
records, or displays money may ship without conforming to this document. Section 12 is the
prohibition list; section 13 is the launch checklist.

Supersedes all money-related content in `178921725-group-susu.md` and
`1791026719-growth-business-logic.md`. Domain rules from those documents still apply where this
document is silent.

---

## 0. The rule this document exists to enforce

> **A member who can prove they paid is never out of pocket. A member is never surprised by a
> debt. A group never freezes. No cedi is ever unaccounted for.**

Every rule below is a consequence of one of those four sentences. If a rule and a sentence
conflict, the sentence wins and the rule is wrong.

---

## 1. The money model

### 1.1 Who holds what

```
MEMBER                     HUBTEL (BoG EPSP licence)          GROWL
  │ │                              │                             │
  │─ MoMo GH¢100 ─────────────────▶│                             │
  │   to collection account       │                             │
  │                               │─ webhook ───────────────────▶│ match sender,
  │                               │   sender, amount, timestamp │ amount, window
  │                               │                             │
  │                               │◀─ payout instruction ───────│ rail fires when
  │◀── GH¢345 in wallet ───────────│   round complete            │ round verified
  │                               │                             │
  └── we never touch a cedi ───────┴─────────────────────────────┘
```

| Party | Holds | Never holds |
|---|---|---|
| Member | Their own wallet | — |
| Hubtel | Collection balances, under its EPSP licence, cash-backed | — |
| Growl | **Records only. Zero cedi, zero float, zero wallet.** | Any cedi, at any time, in any account, including a "temporary" or "rounding" one |

### 1.2 The disclosure, exact wording

Legal to use:

> "Growl never holds your money. Contributions are paid into a collection account held by our
> licensed payment partner, and paid out from it. Growl keeps the record, not the funds."

Never use: "your money is safe with us", "we hold your funds", "your pot is protected by Growl",
or any phrasing that implies custody. The distinction between *the partner holds it* and *we hold
it* is the entire basis of the Act 987 position (`178921725-group-susu.md` §Compliance Gate) and
BoG revoked Zeepay's DEMI licence in July 2026 for issuing e-money without cash backing. The
wording is not marketing; it is the compliance position.

---

## 2. Amounts, rounding, precision

**Every money defect in software has been a representation defect. Start here.**

| ID | Rule |
|---|---|
| M1 | Every amount is an **integer count of pesewas** (1 GH¢ = 100 pesewas). Stored, computed, compared and summed as integers. **Never** IEEE-754 float, never JavaScript `number`, never a decimal string |
| M2 | The database column is `BigInteger` / `INTEGER`. Never `Float`, never `Decimal` with an unbounded scale |
| M3 | The display layer formats from pesewas: `formatGHC(pesewas)`. Formatting is the only place a decimal point exists |
| M4 | Amounts received from Hubtel are parsed to pesewas at the boundary, once, and validated as integers. A non-integer or unparseable amount is a hard failure, never a rounded approximation |
| M5 | Multiplication for fees is computed in pesewas with **half-up rounding at the final step only**. Never round intermediates |
| M6 | Division by a member count rounds **down** to whole pesewas; the remainder is distributed **one pesewa at a time to members in rotation order**, starting at the current receiver. Deterministic and auditable, identical on every recomputation |
| M7 | Rounding direction is fixed: amounts **owed to** a member round down; amounts **charged to** a member round up. A member is never shortchanged by rounding |
| M8 | Rounding differences of ≤10 pesewas (GH¢0.10) in any round are absorbed by the group float, never by a member. Above that threshold it is an incident (Z7) |
| M9 | The client may never compute, display, or assert a settlement amount. Amounts are returned by the server and rendered verbatim. A client-computed total is a bug |

### 2.1 Worked rounding example

Group target 30000 pesewas (GH¢300.00), roster 3.

```
floor(30000 / 3) = 10000 exactly. Remainder 0. shares = [10000, 10000, 10000]
```

Group target 10000 pesewas (GH¢100.00), roster 3.

```
floor(10000 / 3) = 3333. Remainder = 10000 - (3333*3) = 1
shares, in rotation order starting at the receiver: [3334, 3333, 3333]
Sum = 10000 exactly. The receiver absorbs the extra pesewa.
```

Deterministic: any recomputation of this round on any device yields the same three numbers.

---

## 3. Contribution state machine

Every attempt is in exactly one state. Transitions are the only legal moves.

```
                  ┌──────────── void ────────────┐   (member/withdrawn before verification)
                  │                               │
  (created) ─────▶│  pending ──▶ verified ────────┼──▶ counted toward the pot
                  │     │                        │
                  │     ├──▶ failed ──▶ (new attempt allowed)
                  │     │        ▲
                  │     │        └── re-attempt permitted indefinitely
                  │     │
                  │     └──▶ queued ──▶ pending   (offline replay, order preserved)
                  │
                  └──▶ flagged ──▶ (blocks round; only a dispute changes it)
                        │
                        └──▶ disputed ──▶ dismissed ──▶ restores previous state
                                      └──▶ upheld ──▶ failed + debt booked
```

| ID | Rule | Prevents |
|---|---|---|
| C-S1 | A contribution is counted toward the pot **only** when `status == verified` | Optimistic "verified" in the UI |
| C-S2 | A member may create a new attempt only when their last attempt is `failed`, `void`, or dispute-`upheld`. Rejected while `pending`, `queued`, `verified`, `flagged`, or `disputed` | **The permanent freeze.** One unverifiable reference can never again strand a round |
| C-S3 | At most one `verified` attempt per member per round, enforced by a database unique constraint, not by application code | Double funding a share |
| C-S4 | A contribution in `flagged` or `disputed` **blocks the round**. There is no override, no admin bypass, no timeout that clears it | Admin pressure to pay out an unverified pot |
| C-S5 | `void` is terminal and irreversible. Voiding requires an actor and a recorded reason | Silent deletion |
| C-S6 | Status transitions are validated by a single state-transition table on the server. Any transition not in that table is rejected and logged as an incident | Logic errors mutating money state |
| C-S7 | A contribution is never edited. Corrections are new records with `supersedesId`. The original remains readable forever | History rewriting |
| C-S8 | Amount cap: `1 GH¢ ≤ amount ≤ 2 × snapshot share`. Enforced server-side | One member funding the pot alone |
| C-S9 | A reference already recorded against any contribution, for any member, in any group of that user, is rejected | The same cedi funding two rounds |

---

## 4. Payout state machine

```
  ready ──▶ queued ──▶ processing ──▶ completed     (round advances, receiver keeps the turn)
                            │
                            └──▶ failed ──▶ queued  (SAME payoutKey, round unchanged)
```

| ID | Rule | Prevents |
|---|---|---|
| P-S1 | A payout is created only when `roundStatus == ready`: verified total ≥ target, no `flagged`, no `disputed`, group active, all prior payouts for the round terminal | Paying out an unverified or disputed pot |
| P-S2 | `payoutKey` is derived deterministically from the round id. **The same key on every retry.** A retry never creates a second payout | Double payment — the single unrecoverable error |
| P-S3 | Exactly one payout row per `(roundId, payoutKey)`, unique constraint. Enforced in the database | Double payment under concurrency |
| P-S4 | The round row is locked (`SELECT … FOR UPDATE`) for the entire create-instruction-and-commit sequence | Two concurrent triggers both firing |
| P-S5 | The round advances **only** on `completed`. On `failed` the round is unchanged and the receiver keeps their turn | A member losing a turn to a provider error |
| P-S6 | `payoutAmount = roundVerifiedTotal − disclosedFee`. If the result is ≤ 0, the payout is **blocked** and escalated as an incident (Z8). It is never paid as zero | A receiver receiving nothing while the round shows "paid" |
| P-S7 | No member-facing or admin-facing control may create a payout. `P1` is absolute. The only actor permitted is `system` | The admin-payouts-button trust failure |
| P-S8 | A payout is never edited. Failures and retries append status events | History rewriting |
| P-S9 | The receiver's own contribution is included in the pot. Stated on the create form before the group exists | Surprise at payout |
| P-S10 | Maximum payout attempts: 5. After the fifth failure the round is escalated to manual intervention and **never silently closed** | An infinite retry loop hiding a broken integration |

---

## 5. Conservation invariants

These are the arithmetic safety net. They must be asserted in tests for every fixture, every
transition, and nightly in production.

| ID | Invariant |
|---|---|
| Z1 | **Per group, per round, on close — the money identity:** `Σverified − ΣpayoutsGross − Σfees − Σreversals − Σrefunds − closingFloat = 0` |
| Z2 | **`closingFloat` is the collection-account balance attributable to that group.** It is carried forward as a credit against the next round. If the group ends, it is refunded pro-rata to that round's verified contributors. It is never spent, never absorbed by us, never shown as zero |
| Z2a | **The debt identity is separate and does not appear in Z1:** `0 ≤ shortfall − ΣdebtBooked`, and `debtBooked(m, round) ≤ snapshotShare(m, round)` |
| Z3 | Per group, cumulative: `ΣallVerified − ΣallPayoutsGross − ΣallFees − ΣallReversals − ΣallRefunds − currentFloat = 0` |
| Z4 | Per member, per round: `countedAmount ≤ 2 × snapshotShare`, and `countedAttempts = 1` |
| Z5 | `debtBooked(m, round) ≤ snapshotShare(m, round)` — no member is ever charged more than their own share |
| Z6 | Sum of all `disputeUpheld` amounts equals the sum of debt booked with reason `dispute` |
| Z7 | Any residual ≠ 0 at round close is an **incident**, not a metric. Page someone |
| Z8 | Any payout blocked under P-S6, or exhausted under P-S10, is an incident |
| Z9 | `receiverOf(round) == receiverDisplayed(round)` for every open round — what the UI shows is what will be paid |

> **Correction, revision 2.** An earlier revision of this document put `ΣdebtBooked` inside Z1.
> That was wrong, and implementing it proved why: a group can owe more than it collected. Three
> members owing GH¢100 each against a GH¢300 pot, where only one person paid, leaves GH¢100 in
> the account and GH¢300 owed. Debt is a **claim on future contributions, not a cedi that has left
> the pot.** Including it in the money identity either forced float to absorb an obligation, or
> produced a false residual. The two identities are now separate: Z1 tracks money, Z2a tracks
> obligations. Only money moves; only obligations are owed.

### 5.1 Worked example — normal round

Family Susu. Target GH¢300.00 = 30000 pesewas. Roster 3, share 10000 each.
Members: Ama, Daniel, John.

| Event | Amount | Running verified |
|---|---|---|
| Ama verified | 10000 | 10000 |
| Daniel verified | 15000 (overpayment, disclosed per C6) | 25000 |
| John verified | 10000 | 35000 |

```
Σverified      = 35000
ΣpayoutsGross  = 34500   (Hubtel fee 500 pesewas deducted from the receiver, F2)
Σfees          =   500
ΣdebtBooked    =     0   ← Z2a, not part of Z1
closingFloat   =     0
35000 − 34500 − 500 − 0 − 0 = 0   ✓   (Z1)
0 ≤ 0 − 0                  ✓   (Z2a)
```

### 5.2 Worked example — short round, where the float matters

Ama 10000 verified, John 10000 verified, Daniel pays nothing.

```
Σverified      = 20000
target         = 30000
shortfall      = 30000 − 20000 = 10000
nonContributors = [Daniel], Σ their shares = 10000
debt(Daniel)   = min(10000, 10000 × 10000/10000) = 10000
```

```
Σverified      = 20000
ΣpayoutsGross  =     0
Σfees          =     0
closingFloat   = 20000
20000 − 0 − 0 − 20000 = 0   ✓   (Z1)  the whole GH¢200 is still in the account
10000 − 10000 = 0           ✓   (Z2a) Daniel owes GH¢100, capped at his share
```

Two things are true at once, and keeping them separate is the whole point: **GH¢200 of real
money is still in the collection account, and Daniel owes GH¢100.** One is float, one is debt.

**This is the case that the shipped code loses silently** — `releasePayout` sends exactly
`targetAmount` and the difference vanishes into nowhere. Losing GH¢200 to a group with no
notice, no record, and no way to ask for it is the single most likely way this product destroys
trust in a market.

### 5.3 Worked example — debt exceeding collection

Only Ama pays, in the same group.

```
Σverified      = 10000
shortfall      = 20000
debt(Daniel)   = 10000,  debt(Kofi) = 10000,  Σ = 20000
closingFloat   = 10000
```

```
10000 − 0 − 0 − 10000 = 0    ✓  (Z1)  money balances
20000 − 20000 = 0            ✓  (Z2a) obligations balance
```

The group owes GH¢200 and holds GH¢100. Under the superseded revision this read as a
`−10000` incident, which would have meant paging someone every time a group collected poorly —
the fastest way to make a conservation check something people ignore.

---

## 6. Fees

| ID | Rule |
|---|---|
| F1 | **A member never pays any fee.** No fee on a contribution, a payout, a pot, a statement, a record, or a dispute. Ever |
| F2 | The rail fee is disclosed **before** the payout is sent, in the same screen: "Growl pays the GH¢5.00 transfer fee out of your pot. You receive GH¢345.00." Never discovered afterwards |
| F3 | The fee is deducted from the receiver's payout, never added to the target, never charged to a contributor |
| F4 | If the fee would exceed the pot, the payout is blocked and escalated (P-S6). Never partially paid without the receiver's knowledge |
| F5 | The fee is a round expense recorded on the round. It is never absorbed silently by Growl and never charged to a group later |
| F6 | Provider pricing changes are a versioned configuration change, never a code change, and never retroactive to a closed round |
| F7 | MTN charges **zero** on merchant-code payments, and Ghana's 1.5% e-levy was abolished on 2 April 2025. Contributions routed through a merchant collection account are therefore *cheaper for members* than the peer-to-peer transfers they use today. This is a fact for sales, never a promise about our own pricing |

---

## 7. Fraud and abuse precautions

| ID | Attack | Precaution |
|---|---|---|
| X1 | Admin verifies a payment they never received | **The admin cannot verify at all** in the steady state. Verification is machine-only against the rail |
| X2 | No-signal market forces a manual verification | Permitted only with a mandatory written reason, and permanently rendered as `Manually verified by [admin]`, visually distinct from `Verified by rail`, visible to every member |
| X3 | Fake reference typed by a member | Verification matches the rail's actual inbound: sender number, amount, timestamp. A typed reference is a claim, never a proof |
| X4 | Member claims a payment by someone else's number | Sender must equal the member's registered number (V2). No exceptions, no admin override |
| X5 | Same cedi claimed twice | Reference uniqueness across all of a user's groups (C-S9) |
| X6 | Replay of an offline write | Client-generated UUID `idempotencyKey` on every mutation; a repeat returns the original result, never a second write |
| X7 | Two concurrent payout triggers | Deterministic `payoutKey` + unique constraint + `SELECT … FOR UPDATE` (P-S2, P-S3, P-S4) |
| X8 | Burst of fake accounts inflating a group | Velocity caps: contributions per member per round (C-S8), groups per user per day, members per group (50 max), rounds opened per group per day (1) |
| X9 | One member funds the entire pot to control the payout | 2 × share cap (C-S8) |
| X10 | Insider diverts the float | Growl holds zero funds (§1.1), so there is nothing to divert. Float is visible per group (Z2) and reconciled daily (§9) |
| X11 | Admin revenge-controls a member | Removal is a pause with a settlement and reinstatement path (D6–D9). No permanent ban, no public defaults feed |
| X12 | A disputed contribution is quietly resolved to release a payout | Disputes are permanent and member-visible; upheld requires an explicit recorded decision; there is no timeout that auto-resolves (X6 in the growth plan) |
| X13 | Third party funds a round and disputes the group's money | Diaspora funding (deferred past M6) would be a **gift to the group**, recorded as such, with no claim on the pot and no visibility of member records |

---

## 8. Mobile money reversal exposure

**The most under-appreciated money risk in this product.**

A member can pay their contribution, the round can verify, the pot can be paid out to the next
collector — and *then* the payer reverses the MoMo transfer. The group has received a pot it
already paid away. In Ghana, MoMo transfers and merchant payments can be reversed by the payer
and, in merchant scenarios, by the merchant.

| ID | Precaution |
|---|---|
| V-R1 | Before any payout instruction, confirm **no contribution in the round is within a reversal-risk window**. The window length must be confirmed with Hubtel per rail and configured, not hardcoded |
| V-R2 | A contribution that has been reversed transitions to `reversed`, immediately blocks its round, and books a debt against the member who caused it — the same machinery as a dispute upheld |
| V-R3 | Reversals after a payout has been made cannot be recovered from the group. They are absorbed by **the collection account's own float for that group**, up to a configured buffer, then escalated to a loss event |
| V-R4 | Groups carry a **float buffer target** (recommended: one round's pot) held in the collection account precisely to absorb reversals and provider errors. It is visible per group, never spent by us |
| V-R5 | Repeated reversals by a member are an abuse pattern: after 2, the member is suspended from creating new contributions pending admin review, and the pattern is reported to Hubtel |
| V-R6 | Hubtel's stated reversal window, fee schedule, and float behaviour **must be confirmed in writing before launch** (Q4 in §13). If the window is longer than a round's collection period, V-R1 must instead require a settlement delay before payout |

---

## 9. Failure and incident matrix

Every provider failure point, what the member sees, and the recovery path. **No member ever sees
a raw error, a spinner that never resolves, or a payment that silently disappears.**

| Failure | Member sees | System does | Recovery |
|---|---|---|---|
| Payout fails at provider | "We couldn't send your pot. It has not left the group account. John still has the pot." | `payout → failed`, same `payoutKey` | Automatic retry, max 5 (P-S10), then manual |
| Payout pending > 30 min | "Your pot is on its way. We'll tell you the moment it lands." | Alert raised | Provider reconciliation (§10) |
| Webhook lost | Nothing — the round stays `collecting`, honest | Reconciliation picks it up within 15 min | Automatic re-query |
| Duplicate webhook | Nothing | Idempotent no-op | Automatic |
| Out-of-order webhook | Nothing | Buffered by timestamp, applied in order | Automatic |
| Webhook for an unknown sender | Nothing | Recorded as `unattributed`, surfaced to the collector for manual attribution (§5.2 pattern) | Collector taps which group |
| Webhook amount differs from claim | "We received GH¢80 but you logged GH¢100. Tap to correct." | Contribution held, not verified | Member corrects (C-S2 permits a new attempt) |
| Member paid the wrong network | "That number isn't a wallet we can pay. Check the number." | Payout not attempted | Member corrects the number |
| Provider API down | "Payments are temporarily unavailable. Your contribution is saved on your phone and will sync." | Queue holds, no data loss | Automatic replay on recovery |
| Group frozen by a flag | "This round is paused pending a decision. Every member can see why." | Round blocked, admin notified | Dispute resolution, or re-payment |
| Debt booked | "You owe GH¢100 for round 3. [Pay forward] [Settle] [Ask why]" | Debt recorded with the arithmetic | Four settlement paths (D6) |
| Float remaining on group end | "GH¢100 from round 3 was never paid out. It is being returned to those who paid in." | Refund pro-rata | Automatic refund |

**Rule F-S1:** the member-facing message must state whether **their money has left**. Anything
ambiguous about whether money moved is unacceptable copy.

---

## 10. Reconciliation

| ID | Rule | Cadence |
|---|---|---|
| RC1 | Pull Hubtel's transaction list for the collection account and match every entry to a contribution by sender + amount + timestamp window | Every 15 min |
| RC2 | **Unattributed** entries (no match) are surfaced to the collector for one-tap attribution. Never auto-assigned | On detection |
| RC3 | **Orphaned** contributions (we recorded, provider has nothing) are flagged and never verified | On detection |
| RC4 | Daily: per-group conservation (Z1–Z3) computed against the provider's reported balance. Any non-zero residual is an incident (Z7) | Nightly |
| RC5 | A group is **quarantined** — payouts blocked, contributions still accepted and recorded — if its conservation check fails | Automatic |
| RC6 | Provider balance and our float attribution must agree to the pesewa, every group, daily. Any discrepancy ≥ 1 pesewa is escalated | Nightly |
| RC7 | Reconciliation is append-only. Corrections are new entries with a reason | Always |

---

## 11. Audit trail

| ID | Rule |
|---|---|
| AT1 | Every state change on money records carries: actor id, actor role, timestamp, from-state, to-state, reason. Immutable, append-only |
| AT2 | The ledger is never edited or deleted. Corrections are reversal entries (C-S7, P-S8) |
| AT3 | Every member can read the complete history of their own contributions, including disputes, flags, reversals and debt |
| AT4 | Disputes, flags, manual verifications, waivers, and admin revocations are **permanently visible to all members of the group**, not just the parties involved |
| AT5 | Institutional access is read-only and every read is logged |
| AT6 | Audit records are retained for the statutory period and are independently exportable |
| AT7 | No member's data is shared with an institution without explicit, per-institution, revocable consent (S7, Act 843) |

---

## 12. Prohibited — no exceptions, no configuration, no feature flag

| # | Prohibited |
|---|---|
| 1 | Growl holding, receiving, holding in reserve, advancing, or float-ing **any** cedi, in any account, at any time |
| 2 | Any member-facing or admin-facing control that creates a payout |
| 3 | Any member paying any fee |
| 4 | A contribution displayed as `verified` before the server says `verified` |
| 5 | An admin verifying a contribution in the steady state |
| 6 | An amount computed, asserted, or displayed by the client (M9) |
| 7 | Money stored or computed as a float (M1) |
| 8 | Editing or deleting a ledger entry |
| 9 | A round advancing without a `completed` payout or an explicit close |
| 10 | A dispute, flag, or reversal being cleared by timeout |
| 11 | A debt charged without a notification showing the arithmetic (D3) |
| 12 | Debt cleared by a cycle restart, or any automatic reset |
| 13 | Any side effect on money that is not in a state-transition table (C-S6) |
| 14 | Recommending, scoring, arranging, or disbursing a loan — that is a Digital Credit Services Provider activity requiring a GH¢2M licence. We share a consented record; a lender lends. BoG named 40 unlicensed digital credit apps in eight weeks and is publishing the list weekly |
| 15 | Any claim implying custody, protection, or safeguarding by Growl |

---

## 13. Pre-launch checklist

Nothing moves a cedi until every line is ticked. **No exceptions, no "we'll do it in the beta".**

**Legal and contractual**
- [ ] Written Act 987 opinion covering the record-only product (Track A)
- [ ] Written Act 987 opinion covering collection and payout (Track B)
- [ ] Executed agency/aggregator agreement with a direct EPSP holder
- [ ] Act 843 / Data Protection Commission registration; DPO appointed
- [ ] AML/CFT screening design approved; screening records in place
- [ ] Published "we never hold your money" disclosure, exact wording from §1.2
- [ ] Ghana Card gate live on group creation and payout receipt

**Hubtel — answered in writing**
- [ ] Q1. Can you issue a dedicated collection account per group, or only per merchant?
- [ ] Q2. Does the inbound webhook include the **payer's mobile money number**? (If no, verification is impossible and nothing ships.)
- [ ] Q3. What is the exact collection fee, payout fee, and reversal fee?
- [ ] **Q4. What is the reversal window per rail, and how long can a balance sit before you
      require settlement?** (Drives V-R1 / V-R6 — if the window exceeds a collection period,
      payout must wait for settlement.)
- [ ] Q5. Can you provide a transaction list with sender, receiver, amount and timestamp for
      attribution and per-group float proof? (RC1, Z2)
- [ ] Q6. Do you require an Act 987 opinion from us before onboarding? (Almost certainly yes.)
- [ ] Q7. Webhook signature scheme, replay protection, and delivery retry policy
- [ ] Q8. Uptime, support and incident escalation path for a 6-month pilot
- [ ] Q9. Do you permit a sub-GH¢1M/month volume account?
- [ ] **Q10. Can you notify us when a subscriber number's SIM or network identity changes, and
      when a transaction is reversed or disputed at your level?** (Drives SIM-swap detection and
      reversal handling — security doc I17, V-R2)

**Money correctness**
- [ ] All amounts in pesewas, integers end to end (M1–M9). No floats anywhere in the money path
- [ ] State-transition tables implemented and enforced on the server (C-S6)
- [ ] Unique constraints in the database for: `(roundId, memberId)` where counted; `(roundId, payoutKey)`
- [ ] `SELECT … FOR UPDATE` on round state transitions (P-S4)
- [ ] Z1–Z9 asserted in tests for every fixture and every transition
- [ ] Nightly production conservation job, with alerting (RC4, Z7)
- [ ] Rounding: rotation-order allocation implemented and tested against §2.1
- [ ] Float visible per group, carried forward, refunded pro-rata on group end (Z2)
- [ ] Reversal handling implemented and tested against a simulated reversal (V-R2, V-R3)
- [ ] Float buffer target configured per group (V-R4)
- [ ] Every row of §9 implemented with the exact member-facing copy
- [ ] Audit trail complete and immutable (AT1–AT2)
- [ ] Provider is quarantined automatically on a conservation failure (RC5)
- [ ] Idempotency key on every mutation, replay tested (X6)

**Product honesty**
- [ ] No payout button exists anywhere in the UI, including debug builds
- [ ] No member ever sees "verified" before the server says so
- [ ] No fee appears on any member-facing screen
- [ ] Manual verification renders as `Manually verified by [admin]`, never as `Verified`
- [ ] Debt booking shows its arithmetic and is disputable
- [ ] Removed members can settle and return — no permanent ban, no public defaults list

---

## 14. Change control

1. Any change to section 2 (money representation), section 5 (conservation), or section 12
   (prohibitions) requires a failing test that demonstrates the current behaviour is unsafe,
   written **before** the change. No test, no change.
2. Any change to section 12 requires written Act 987 sign-off. It is a legal boundary, not a
   preference.
3. Every rule ID in this document maps to at least one automated test. A rule ID with no test is
   an unimplemented rule and must not be reported as done.
4. This document supersedes conflicting statements in all previous plans. Where they disagree,
   this document is correct.