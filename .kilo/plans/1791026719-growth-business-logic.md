# Six-Month Business Logic — Ntuboa

Governing rules for the next six months. Every product decision must trace to a rule ID in this
document, or it does not ship.

This document supersedes the growth framing in `178921950-master-roadmap.md`. The domain rules
in sections 4–9 refine `178921725-group-susu.md` where they conflict.

---

## 1. The six-month objective

**Not** "become the biggest susu app." That is a five-year goal and this plan cannot fund it.

> **Prove that collectors will pay, members will return weekly, and a verified savings record is
> something a Ghanaian credit union will lend against.**

Everything below serves that sentence. Three claims, three months each, all falsifiable.

| Claim | Proven when | By |
|---|---|---|
| Collectors will pay | ≥25 collectors paying ≥GH¢90/month for ≥3 months | M6 |
| Members return weekly | ≥40% of members in active groups log a contribution every 7 days | M4 |
| A savings record has lending value | ≥1 credit union states in writing it would underwrite against the record | M5 |

**The single number that governs every decision: Weekly Active Contributors.**

```
WAC = distinct members who logged a contribution (any status except void)
      in the trailing 7 days
    ÷ members belonging to groups with an open round
```

Not downloads. Not signups. Not groups created. A group that exists but does not collect is dead
weight, and the current code base has no way to tell you that.

**North star at M6 (hypothesis, to be validated by the field interviews):** 100 groups, 2,000
members, 50 completed cycles, >90% of rounds closed without a dispute, 25 paying collectors or
3 paying institutions. Treat these as targets to be disproven, not commitments.

---

## 2. Who we sell to, and who we serve

The previous plan assumed these were the same customer. They are not, and conflating them is why
the Collector tier has pricing and no product.

| Actor | Role | Wants | Pays? |
|---|---|---|---|
| **Member** | Contributes weekly, takes the pot in rotation | Not to lose money. To know when it is my turn. To prove I saved | **Never** (E1) |
| **Collector** | Assembles and runs 10–50 groups, GCSCA member, already earns a commission | Fewer disputes, fewer defaulters, a register for their own books | **Yes — this is the near-term revenue** |
| **Group admin** | Verifies, closes rounds, manages members. Usually unpaid, sometimes the collector | Not to be blamed | No |
| **Institution** | Credit union, SACCO, MFI, market association | Proof of thrift for underwriting | Yes — M6 onward |
| **Diaspora** | Funds a round from abroad | To send to family | Deferred past M6 (needs EPSP partner) |

**Rule A0:** the Collector is a distinct customer with their own product surface. A change that
helps members and hurts collectors does not ship, because collectors own the distribution.

---

## 3. The growth engine

### 3.1 The loops

```
LOOP 1 — COLLECTOR (primary, carries the next six months)

  collector onboarded
    → imports a whole group in one sitting (bulk add, ≤10 min for 20 members)
      → members join by code, see the rotation and their own turn date
        → first round completes, receipts exist
          → collector's dispute and defaulter load visibly drops
            → collector brings group #2, #3, #4
              → referred collector
```

Target: **2.5 groups per collector by M6.** A collector is a motivated, trusted, already-paid
sales agent. 200 conversations beats 50,000 impressions — and consumer marketing in Ghana is
unaffordable at this budget. The whole plan rests on this loop working.

**Rule G1:** a collector must be able to onboard a group without any member installing anything.
Entry is a 6-character code and a phone number. Registration is deferred until first
contribution or payout receipt.

**Rule G2:** bulk member add — pasted WhatsApp list or CSV — is a first-class collector flow, not
an admin convenience. Onboarding a 25-person group one row at a time loses the loop.

### 3.2 Loop 2 — MEMBER ADVOCACY

The artifact that spreads is **the member's turn card and savings record**, not the app. Every
Ghanaian susu member has people who want in and no way to join.

```
member completes a cycle
  → turn card: "You collected GH¢X on 14 Oct · Market Association Susu"
    → shared to their own WhatsApp circle
      → people without a group ask how to start one
        → new collector or new group requests access
          → back to Loop 1
```

**Rule M1:** the turn card and the savings record must be **designed to be screenshotted and
forwarded** — self-contained, legible at 360px, with the group name, amount, date, and status.
Any share action that requires a login flow kills this loop.

**Rule M2:** the statement text (`toText`) is the shareable artifact. It is already written to be
read aloud — keep it that way and put it one tap from the home screen, not three taps deep.

### 3.3 Loop 3 — THE MISSING-MEMBER LOOP (negative, and it is the dangerous one)

```
member misses two rounds
  → removed from the rotation
    → told everyone in the market the app kicked them out
      → the group distrusts the app and returns to the paper register
        → the collector's other groups follow
```

This loop is faster than either positive loop, because a market is small and embarrassment travels.

**Rule D9:** removal is a **pause, not exile.** An inactive member keeps their history, keeps a
settleable debt, and is reinstated by settled debt or a group vote. There is no public
defaults feed, no shaming list, and no permanent ban. Product rule and growth rule are the same
rule here — a debt you cannot clear is a member you lose permanently, plus testimony against us.

### 3.4 The credit flywheel — executable without the licence

**This is the most important line in the document.**

The licence wall blocks *moving money*. It does not block *selling information*. A verified,
consent-backed record of what a person contributed is data, not a payment service.

```
member accumulates verified cycles
  → a Savings Record: verifiable history of contributions and receipts
    → offered to a credit union as underwriting evidence
      → a member who gets a loan because of the record tells their whole market
        → more members join to build their own record
          → more verified history
```

**Rule S7:** the Savings Record is a first-class exportable artefact and is treated as the
product's strategic asset, not a reporting nicety.

**Rule K9:** consent to share a Savings Record with a named institution is explicit, per
institution, revocable (Act 843). Never bundled into signup.

This is the *fastest route to real revenue inside six months*, because it needs no PSP
agreement. It also happens to be the moat: the history is not copyable after the fact.

---

## 4. Group rules

| ID | Rule | Why |
|---|---|---|
| G1 | Join requires only a 6-char code + phone. No signup until first contribution or payout. | Friction at join is where every group is lost |
| G2 | Creator is the admin and takes position 1. Admin role is administrative: manage members, review, close rounds, restart. No custody, no withdrawal, no payout button. | Custody is the licence boundary |
| G3 | Max 50 members per group | Unmanageable past this |
| G4 | One membership per user per group; one phone per group | Prevents double counting and duplicate identities |
| G5 | Joining appends the member at the end of the rotation. Nobody's turn is displaced. | Fairness; also why `totalRounds` may grow |
| G6 | Membership changes take effect at the **next round open**. Never mid-round. | Removes an entire class of drift bugs |
| G7 | `totalRounds` = roster length when the cycle ends. Joiners extend it; removals never shorten it — the vacated slot is honoured for the cycle. | One rule, no drift |
| G8 | A group with ≥3 members and no round closed for 45 days is flagged `dormant` and stops counting toward WAC. | Dead groups flatter every metric |

## 5. Round rules — the round snapshot

**Rule R0 (structural, do this first):** when a round opens, freeze a snapshot.
`Round { id, number, target, receiverId, roster[{memberId, order, share}], openedAt, dueAt,
collectionDay, closedAt, outcome }`

| ID | Rule | Why |
|---|---|---|
| R1 | Roster, share, receiver, target and due date are frozen at round open. | `currentTurnIndex` into a mutable roster silently corrupts the rotation. The receiver must be a *fact* |
| R2 | `receiverId` is stored, never derived from index arithmetic at payout time | Index drift is the bug class, not the bug |
| R3 | `dueAt` = collection day at 23:59, computed from **when the round opened**, not from `cycleStartedAt` | Today a round closed late expires the next round's window on open |
| R4 | One round is open per group at a time. No skipping ahead. | Payout, debt and rotation all key on it |
| R5 | `outcome ∈ { paid, short, cancelled }`, decided once at close, immutable | I9 — history is append-only |
| R6 | Round advances only on a completed payout (P5) or an explicit close (R7) | No other path moves the turn |
| R7 | A round past `dueAt + 1 day` grace may be closed short by the admin. Closing short books debt (D2) and records a `short` outcome. | Gives every stuck round a guaranteed exit |
| R8 | The cycle cursor carries across restarts (`cursor = cursor % activeCount`) | Today `restartCycle` resets to 0, so the same member collects first every cycle forever — permanent structural bias |
| R9 | Cycle restart resets strikes, never debts. | Contradicts the stated miss policy and lets a debtor escape by waiting |

## 6. Contribution rules — attempts, not entries

**Rule C0 (structural):** a member may have many *attempts* per round, exactly one of which is
*counted*.

```
Attempt { id, roundId, memberId, amount, provider, reference, idempotencyKey,
          status, supersedesId, createdAt, verifiedAt, manualVerificationReason }
Counted = status == "verified"
```

| ID | Rule | Why |
|---|---|---|
| C1 | Reject a new attempt only if the member has an attempt in `pending`, `verified`, or `disputed`. Permit it after `failed`, `void`, or `dispute-upheld`. | **Fixes the permanent deadlock.** Today a failed reference means the member can never re-pay and the round can never be paid |
| C2 | At most one counted contribution per member per round | Prevents double funding the same share |
| C3 | 1 ≤ amount ≤ 2 × snapshot share | One member must not be able to fund the pot alone |
| C4 | Reject a reference already used in this group or any other group of the user | Same cedi cannot fund two rounds |
| C5 | `idempotencyKey` is a client-generated UUID on every write. A repeat returns the original result. | Offline replay must never double-post |
| C6 | Exceeding the target is **allowed and disclosed**: "This takes the round GH¢X over the pot — GH¢X goes to [receiver]." | Turns today's silent evaporation into an intentional, consented gift |
| C7 | Optimistic UI may show `pending`/`saved offline`. It may never show `verified`. | Verification is server-side only |
| C8 | Entry takes under 30 seconds, fully offline. | The weekly habit is the retention engine |

## 7. Verification rules

| ID | Rule | Why |
|---|---|---|
| V1 | Verification is server-side against the rail. A member never self-certifies. | This is the product |
| V2 | The rail sender number must equal the member's registered number | Highest-value single fraud check in the system |
| V3 | Amount and reference must both match. Specific failures only: `reference_not_found`, `amount_mismatch`, `sender_mismatch`, `already_used`, `pending_at_provider`. | A vague "failed" pushes people to WhatsApp and out of the app |
| V4 | The admin **cannot** verify in the steady state. Admin power is review: flag, escalate, request re-proof. | If the admin can verify, the admin can lie, and the promise is void |
| V5 | A manual verification is permitted **only** with a mandatory reason, and is permanently rendered as `Manually verified by [admin]` — visually distinct from `Verified by rail` | Markets have no signal. Sometimes manual is the only option. Hide it and we are lying; label it and we are honest |
| V6 | Verification retries with backoff, then marks `failed`, then permits re-payment (C1) | Liveness |

## 8. Payout rules

| ID | Rule | Why |
|---|---|---|
| P1 | No admin payout button exists in production UI. The rail fires it. | An admin pressing "send money" is the exact trust failure we exist to remove |
| P2 | `payoutAmount = round.verifiedTotal − disclosedRailFee`. Every cedi verified is paid out or recorded as debt. | Stranded money is the P1 failure of the current code |
| P3 | The fee is shown **before** the payout is sent, and on the receipt | No one should discover it afterwards |
| P4 | One `payoutKey` per round. Retries reuse it. Server-side lock on the round. | Double payout is unrecoverable |
| P5 | The round advances only on `completed`. On `failed`, the round is unchanged and the receiver keeps their turn. | Already correct — keep it |
| P6 | The receiver's own contribution is part of the pot. State it on the create form. | Nobody should be surprised that it is not excluded |
| P7 | Receipt on completion: in-app plus a forwardable text message | The receipt is the retention and referral artifact |

## 9. Debt, settlement and removal rules

**Rule D0:** debt is computed from actuals, disclosed to the member when booked, disputable, and
survives cycles. There is no path by which a member accrues a debt they were never told about.

| ID | Rule | Why |
|---|---|---|
| D1 | A miss = no counted contribution by `dueAt + 1 day` | |
| D2 | `shortfall = max(0, target − verifiedTotal)`; each non-contributor's charge is `min(share, shortfall × share / Σ non-contributor shares)` | Debt from an even split is theoretical — contributions are variable, so the number is not what anyone agreed to |
| D3 | The member is notified with the arithmetic shown, at booking | Silence is not consent |
| D4 | Debt can be disputed (X3) | |
| D5 | Debt survives cycle restart and re-activation. Never auto-cleared. | Today `restartCycle` zeroes `missedShare` — a debtor just waits |
| D6 | Four settlement paths: pay forward (clears oldest debt first, shown before confirm), lump sum, waiver with a written reason, or convert to a reduced share next cycle | A debtor must always have a way out |
| D7 | Two misses → `inactive`. Not deleted, not banned. History and debt preserved. | See loop 3 |
| D8 | Reinstatement requires settled debt or a recorded group vote | |
| D9 | No public defaults feed, no shaming list, no permanent ban | A member shamed in a market is testimony against the product |

## 10. Rotation rules

| ID | Rule | Why |
|---|---|---|
| T1 | `member.order` is assigned once and never reindexed. Removal tombstones the slot. | Today removing a member reindexes the roster and silently changes who is collecting |
| T2 | Removing the receiver mid-round transfers the round to the next active member and records a `receiver_changed` event | Never silently |
| T3 | A joiner collects at the end of the current cycle if rounds remain, otherwise first next cycle | |
| T4 | Rotation UI reads the snapshot, so what is displayed is exactly what will be paid | Acceptance criterion, not a nicety |
| T5 | Past turns are permanent and visible: who received, when, how much | The history is the asset |

## 11. Dispute rules

| ID | Rule | Why |
|---|---|---|
| X1 | Standing: the member whose money it is, or the admin who recorded it | Any other member could freeze a round |
| X2 | An open dispute blocks the round. Disputes are permanent and member-visible. | Already correct |
| X3 | Disputes also available against a **debt booking**, not only a contribution | Debt is the thing members actually contest |
| X4 | Upheld ⇒ the amount becomes that member's debt **and the slot is freed for re-payment** | Upheld without the second half re-creates the deadlock |
| X5 | Dismissed ⇒ the original verification result is restored; a flag that caused it is overturned, including its trust cost | Otherwise settling a dispute is a no-op and the round never unblocks |
| X6 | No dispute may stay open past 7 days. Auto-escalates to a group vote, then to the institution tier. | An open dispute is a denial-of-service vector by one member |

## 12. Authorization rules

**Rule A1:** every privileged action takes an actor and checks the role **in the domain layer**. Not
in the UI. This is the highest-risk item in the port to Django: today `releasePayout`,
`verifyContribution`, `flagContribution`, `closeRound`, `restartCycle`, `endGroup`, `removeMember`
and `addMember` accept any caller and rely on hidden buttons.

| Action | member | admin | collector | institution | system/rail |
|---|---|---|---|---|---|
| Create group (post-KYC) | ✓ | ✓ | — | — | — |
| Join by code | ✓ | ✓ | — | — | — |
| Log / re-log own contribution | ✓ | ✓ | — | — | — |
| Add / remove member | — | ✓ | ✓ | — | — |
| Bulk import members | — | — | ✓ | — | — |
| Flag contribution | — | ✓ | ✓ | ✓ | ✓ |
| Manual verification (reason required) | — | ✓ | ✓ | — | — |
| Close round short | — | ✓ | ✓ | — | — |
| Trigger payout | — | — | — | — | ✓ |
| Waive debt (reason required) | — | ✓ | ✓ | — | — |
| Restart cycle / end group | — | ✓ | ✓ | — | — |
| Transfer admin | — | ✓ | — | — | — |
| View statement / export | own | group | managed groups | all groups | ✓ |
| Read Savings Record of another member | — | — | — | with consent (S7) | ✓ |

**Rule A2:** admin succession is automatic and permanent in the record: who, why, when. A silent
promotion is its own trust failure.

## 13. Offline rules

Signal loss in a Ghanaian market is the normal case, not the edge case.

| ID | Rule | Why |
|---|---|---|
| O1 | Every write carries a client UUID. Server dedupes. | Replay safety |
| O2 | An offline contribution is `pending/offline`. Never displayed as verified. | Honest ledger |
| O3 | The member receives a **local receipt immediately** — screenshot/PDF with reference | They must be able to prove it at the next meeting with no signal |
| O4 | Per-row sync state is visible: `Saved offline → Queued → Verifying → Verified / Failed` | |
| O5 | The queue replays oldest-first and never marks an item synced against a server that does not exist | Current `store/queue.js:68` behaviour is correct — keep it |
| O6 | Two members logging the same reference offline: first write wins, second is `duplicate` | |

## 14. Statement and record rules

| ID | Rule | Why |
|---|---|---|
| S1 | Statements are **derived** from the ledger, never stored separately | One source of truth |
| S2 | `contributed` counts **verified only**. Pending appears as `Awaiting verification`, separately. | Today `memberStatement` counts `Queued`/`Saved offline` while `groupStatement` counts verified — two definitions of one number in one document |
| S3 | `outstanding` is labelled *agreed debt* with its share basis shown | It is a settlement figure, not money already paid |
| S4 | CSV is required, PDF is required before any institution signs. Both must carry the metadata header block. | Credit unions open these in Excel |
| S5 | Institutional reports: group ledger, PAR (rounds past `dueAt + grace`), ageing buckets 0–7 / 8–14 / 15–30 / 31–60 / 60+, **debt ageing**, rotation history | Debt ageing is the report nobody else can produce |
| S6 | Institutions are read-only observers with export. Never custody, never member-facing | |
| S7 | Sharing a member's Savings Record with a named institution is explicit, per institution, and revocable (Act 843) | The credit flywheel's consent model |
| S8 | The ledger is append-only. Corrections are reversal entries. Nothing is ever edited or deleted | I9 — the record is the moat |

## 15. Money conservation — the invariant test

For every closed round, this must hold exactly:

```
Σ verified contributions  −  payouts released  −  debt booked  −  refunds  =  0
```

**Rule Z1:** assert this across all rounds in the test suite, for every fixture, every state
transition, and in production as a nightly job. A non-zero residual is an incident, not a metric.

This single identity catches stranded money, overpayment evaporation, and debt miscalculation at
once. It cannot even be stated against the current code, because a round can hold verified money
that no payout will ever release.

## 16. Entitlements and pricing rules

| ID | Rule |
|---|---|
| E1 | **No member ever pays anything.** No fee on a contribution, a payout, a pot, a statement, or a record. Ever. Not a trial, not a cent |
| E2 | Free: member, or admin/collector with ≤5 groups. No card, no trial clock, no expiry |
| E3 | Collector: 10 / 25 / 50 groups → GH¢90 / 170 / 350 per month |
| E4 | Institution: GH¢1,500–8,000 per month |
| E5 | Entitlement gating is on **collector features only** (bulk import, chase list, register export, statement branding). Never on member features |
| E6 | Deferred past M6: diaspora funding at 1.5%, paid by the sender, never deducted from the pot — requires an EPSP partner |
| E7 | No ads. Ever. One institutional customer is worth more than every impression Ghana can sell |
| E8 | The platform's name never appears on a member's payment record as a party to the transfer. Full stop |

## 17. Compliance as product rules

| Gate | Product consequence | Needed by |
|---|---|---|
| Act 987 scoped opinion — **record-only** product | Gates Track A (what we can sell now) | M1 |
| Act 987 full opinion + PSP/DEMI agreement | Gates Track B (rail verification, automated payout) | M3 decision point |
| Act 843 / DPC registration + DPO | Consent model S7, retention, privacy policy | M2 |
| AML/CFT screening design | Ghana Card check gating group creation and payout receipt; screening record retained | M4 |
| Published "we never hold your money" | In-app, on the create form, on the payout screen | M1 |

**Rule K0:** no money movement of any kind ships before the full opinion and the partner
agreement are signed in writing. Build the ledger and the record; leave the rail disconnected.

## 18. Six-month plan

Two tracks run in parallel because the licence is the long pole, and the credit flywheel is not
blocked by it.

### Track A — money-free value, ship now (no licence needed)

| Month | Deliverable | Rule IDs |
|---|---|---|
| M1 | Round snapshot + attempt model + `payout = verifiedTotal`; money-conservation test; 50 collector interviews; 3 credit union calls; scoped Act 987 opinion commissioned | R0–R9, C0–C8, Z1 |
| M2 | Debt ledger with settlement paths; collector-facing bulk import + chase list + register export; WhatsApp receipts; turn card and Savings Record shareable; DPC registration | D0–D9, K1–K9, S7, M1, M2 |
| M3 | **GATE 1** — rotation fixes; offline receipts; statement corrections; payment-rail adapter built but disconnected; pricing validated against interviews | T1–T5, O1–O6, S1–S4 |
| M4 | **GATE 2** — Ghana Card minimum; institutional reports (PAR, ageing, debt ageing) as design-partner builds; 25 collectors onboarded | S5, S6, V4 |
| M5 | **GATE 3** — Savings Record pilot with 3 credit unions; collector subscriptions live (E3) | S5, S7, E3 |
| M6 | 25 paying collectors **or** 3 paying institutions; 50 completed cycles; WAC ≥40% | §1 |

### Track B — the licence (starts M1, decides by M3)

Act 987 opinion, PSP/DEMI negotiation (Paystack, Hubtel, Moolre, LibertePay, Fincra, dLocal),
AML design. **If not signed by end of M3, rail verification does not ship in 2026** — Track A
becomes the company and revenue comes from collectors only.

### Track C — research (weeks 1–3, GH¢3–5k)

50 collector interviews, GCSCA membership register, 3 credit unions, SusuPaa and MySusuApp with
real data. Two questions decide the model: *will a collector pay GH¢90–350/month, or only for
cash collection?* and *will a credit union lend against a contribution record, and what does it
need to see first?*

### Kill and pivot criteria

| When | If | Then |
|---|---|---|
| End of M1 | Fewer than 10 of 50 interviewed collectors will pay ≥GH¢90/month | Pricing is wrong. Move to per-group pricing or free-with-institution |
| End of M1 | No credit union will entertain underwriting on a contribution record | Drop the credit play. It is a nice story, not a business |
| End of M3 | No signed PSP agreement | Rail verification off the table for 2026. Collector SaaS only |
| End of M4 | Fewer than 40% of groups have a member active every week | The product is not habitual. Fix retention before adding any feature |
| Any time | A group reaches a state no member action can recover | Stop shipping features that week. This is the only true emergency |

## 19. Instrument before M1 ends

Every number below must exist in the codebase before M2, or M3–M6 decisions get made on instinct.

- WAC and its per-group distribution
- Round outcomes: `paid` / `short` / `cancelled`, and days from open to close
- **Rounds frozen** — open past `dueAt + grace` with no legal exit. Target: **zero, always**
- Disputes opened, upheld, dismissed, and median resolution time (SLA 7 days, X6)
- Debt booked, settled, waived, outstanding
- Contributions by status; manual-verification rate (V5) — a rising rate means the rail is failing
- Time-to-first-contribution for a new member (target < 24h from joining)
- Collector: groups per collector, groups imported per sitting, retention at 30/60/90 days
- Referrals: groups whose first contact was a member, not a collector
- Dormant groups (G8)
- Crash-free sessions and offline-contribution share (O2)

## 20. Explicitly out of scope for six months

USSD. Savings pockets. Split bills. Ads. Fee on a pot. Diaspora funding. PDF statements beyond
the minimum for design partners. Ghana Card beyond the minimum gate. Any payout button. Any
escrow, float, or wallet. Any competitor feature that does not serve §1.

---

## Appendix — what changed from the previous plan

| Previous | Now | Reason |
|---|---|---|
| Institutional tier is the business, 25 accounts = breakeven | Kept as the M6+ destination, but the **Savings Record** is the actual asset and it is sellable *before* the licence | Selling data is not a payment service. This reorders the roadmap |
| Collector tier is pricing with no product | Collector is a distinct customer with bulk import, chase list, register export | Collectors own the distribution |
| Miss policy: 1 free skip, removed after 2 | Removal is a **pause** with settlement and reinstatement | A debtor who cannot clear is a member lost plus negative testimony |
| Trust score is the accountability model | Unchanged, plus: admin cannot verify at all in the steady state (V4), manual verification is labelled (V5) | If the admin can verify, the promise is void |
| `docs/research/03-competitive-positioning.md` cited as the basis for positioning | **Does not exist in the repo** | Every competitive claim in the roadmap is currently unsourced |