# Master Roadmap — Ntuboa

**Grow Your Wealth Together**

## What we build

One thing: **a group susu app for Ghana.**

A *susu* is a rotating savings group — the oldest financial institution in West Africa. Everyone
in a circle contributes the same amount each week; each member takes the whole pot in turn.
There is no app store category for this, no incumbent, and no platform feature. It is also
something only someone who understands West Africa can build.

## What we do not build

Decided, closed, and not revisited without new evidence:

| Dropped | Why |
|---|---|
| **Split bills / settle up** | Apple shipped "Split Bill with Apple Cash" in iOS 27 (2026), free, in Wallet. Splitwise has done it since 2011. No moat, no money. |
| **Savings pockets** | Nobody's buying it. Adds complexity, adds nothing to the sales pitch. |
| **USSD channel** | Real need in Ghana, but a 6-month build that must not come before the app works. Revisit after 10,000 members. |
| **Ads** | Makes less than one institutional customer. Withdraws trust from the one asset we have. |
| **Fee on the pot (% take rate)** | At 1% it is GH¢2.53 per group per month. The Bank of Ghana suspended a telco's 0.75% transfer fee in May 2026 "to protect consumers." Do not lead with it. |

## Product promise

> **The pot is verified before anyone gets paid.**

Every feature must serve that sentence. If a feature does not make the record more verifiable, or
make a dispute survivable, it does not ship.

## Plans

| # | Plan | File | Status |
|---|------|------|--------|
| 1 | Group Susu | `178921725-group-susu.md` | App side done; backend not started |
| 2 | State Management | `178921901-state-management.md` | Not started |
| 3 | Screen Documentation | `178921807-screen-documentation.md` | Reference |
| 4 | Backend Stack | *to be written* | Not started — **critical path** |

Dependency order: **Backend → State Management → remaining app gaps → Pilot.**

## What exists today

The susu lifecycle is complete and unit-tested: create group, fixed rotation, contributions,
verification, payout with failure/retry, miss policy, admin trust, cycle restart, history.

**57 passing domain tests.** `services/susu.js` holds the rules; `store/susu.js` holds the state.

## What is missing — the real work

The app is a working demo against in-memory mock data. These five gaps are the entire job:

| # | Gap | Why it blocks everything |
|---|-----|------------------------|
| **1** | **Backend + real auth** | Nothing persists. `CURRENT_USER_ID = "u1"` is hardcoded. Login/SignUp are navigation stubs. |
| **2** | **Server-side contribution verification** | Today a member *types* "I paid" and the app believes them. This is the product. |
| **3** | **Automated payout** | An admin pressing a button is the exact trust problem we exist to remove. |
| **4** | **Offline-first** | Signal drops constantly in Ghana markets. Every competitor claims it; nobody has visibly solved it. Our one chance to be clearly better. |
| **5** | **A licensed payment rail** | Required before any real money moves. See the compliance gate below. |

Plus the table stakes every competitor already ships: **double-entry ledger, Ghana Card
verification, CSV/PDF statements, WhatsApp receipts, export.**

## Compliance gate — before any real money moves

Non-negotiable and blocking. Ghana's Payment Systems and Services Act 2019 (Act 987) §4(1)
prohibits operating a payment service without a Bank of Ghana licence, and §4(2)(m) lists
"provision of any electronic platform for payment or receipt of funds" as a licensed activity.

| Gate | Status |
|------|--------|
| Written Act 987 legal opinion | ☐ Not started |
| Agency / aggregator agreement with a licensed DEMI or PSP (Paystack, Hubtel, Moolre, LibertePay, Fincra, dLocal) | ☐ Not started |
| 30% Ghanaian equity (founder qualifies) | ◐ Satisfied |
| Data Protection Commission registration + DPO (Act 843) | ☐ Not started |
| AML/CFT screening design | ☐ Not started |
| Published "we never hold your money" disclosure | ☐ Not started |

**Design rule: never take custody of the pot.** Money moves member → mobile money → member.
The app keeps the *record*, not the funds. Every credible competitor in Ghana and Nigeria
publishes exactly this sentence, and copying it is free legal risk reduction.

## How we make money

Free for members, forever. The payer is never the person whose trust we need.

| Tier | Who | Price |
|------|-----|-------|
| **Free** | Members and admins with up to 5 groups | GH¢0 — always free, no card, no trial clock |
| **Collector** | Admin running 10–50 groups | GH¢90 / 170 / 350 per month |
| **Institution** | Credit unions, SACCOs, MFIs, market associations | GH¢1,500 – 8,000 per month |
| **Diaspora** | Someone abroad funding a group's round | 1.5% of the amount funded |

**The money is the Institution tier.** They buy reports they cannot produce today:
group-level audit trail, PAR / ageing buckets, individual member statements, BoG-category
formatting. **25 paying institutions ≈ GH¢87,500/month ≈ breakeven.**

Rules we do not break:
- **Members never pay.** Not a trial, not a small fee. If a group goes, that member tells everyone.
- **No fee on a contribution.** Members are *depositing*; a fee there reads as a tax on thrift.
- **Admins are free until they run 10+ groups.** A trader with 2 groups is not a business.
- **Keep our name off the contribution line.** If members think the app is taking their money, the circle dies.

Full pricing, unit economics and the pricing-mistakes list: `docs/research/02-monetization-research.md`.

## Field research — do this first

Everything above is built on estimates. Close the gap before writing more code.

| Priority | Action | Cost |
|---|---|---|
| 1 | Interview **50 collectors**: "how many groups do you run, how much each collects per week?" | GH¢3–5k |
| 2 | Get the **GCSCA** (Ghana Cooperative Susu Collectors Association) membership register | GH¢0 |
| 3 | Commission the **Act 987 legal opinion** | GH¢3–8k |
| 4 | Book calls with 3 credit unions / SACCOs / market associations | GH¢0 |
| 5 | Use SusuPaa and MySusuApp with real data for a week | GH¢90 |

## Delivery order

### Phase 0 — Research & compliance (weeks 1–4)
1. Field interviews; GCSCA register
2. Act 987 opinion + agency agreement
3. Names: decided — the app ships as **Ntuboa** (Twi for a rotating savings group); the repo name
   "Splitify" describes the split-bill product we just dropped and is retained as the repo name only.
4. Ghana Data Protection Commission registration

### Phase 1 — Make it real (weeks 5–12)
5. Backend: `SusuGroup`, `SusuMember`, `SusuContribution`, `SusuRound` + REST + JWT auth
6. Replace `CURRENT_USER_ID` stub with real auth (login, register, OTP, reset)
7. **Server-side contribution verification** against the payment rail — not member-typed text
8. Automated payout with retry and `select_for_update()` on round state
9. Double-entry ledger

### Phase 2 — Be clearly better (weeks 13–20)
10. Offline-first contributions with sync queue
11. Ghana Card verification
12. WhatsApp receipts (the best single UX idea in this market — borrow it from MySusuApp)
13. CSV / PDF statements and registers

### Phase 3 — Pilot (weeks 21–26)
14. 100 groups, 1,000 members, **50 completed cycles**
15. **>90% of rounds completed without a disputed round** — the retention number
16. 3 institutions as free design partners

### Phase 4 — Monetise (weeks 27+)
17. Launch Institution tier (GH¢1,500–8,000/month)
18. Diaspora rail at 1.5%, via a licensed EPSP partner
19. Seed round: the story is the contribution history as future credit infrastructure

## The metric that decides this

**Paying institutional accounts — target 25 by month 18–24.**

Everything else is diagnostic: groups live, rounds completed without dispute, groups activated per
recruited collector, active diaspora senders, SMS unit cost.

## Naming — resolved

The app ships as **Ntuboa**; the repo is **Splitify**; the product is a susu app.

- **"Ntuboa"** is a Ghanaian (Twi) word for a rotating savings group — the product itself, so it is
  on-brand and works for ASO. It does not collide with any live app on Google Play.
- **"Splitify"** now names the exact feature Apple commoditised, and a product we do not build.
  Retained as the repo name only.

**Keep "susu" and "group savings" in the store title and tagline regardless of the brand.**

## Reference material

- `docs/research/01-market-research.md` — market sizing, regulation, personas, GTM, risks
- `docs/research/02-monetization-research.md` — pricing, unit economics, roadmap
- `docs/research/03-competitive-positioning.md` — 13 competitor teardowns, positioning, threats