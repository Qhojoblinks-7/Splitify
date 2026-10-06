# Legal Opinion: Ghana Payment Systems and Services Act, 2019 (Act 987)
## Application to "Growl" Susu Application — "Never Hold Funds" Model

**Prepared for:** Splitify / Growl Project  
**Date:** 5 October 2026  
**Classification:** Confidential — Legal Opinion  
**Status:** DRAFT — For Internal Review Only

---

## Executive Summary

**Opinion:** The Growl susu application, as currently architected ("never hold funds" model), **does not fall within the licensing requirement** of Section 4(1) of Act 987, provided that:

1. No custody, escrow, or float of member funds occurs at any point
2. Collection and payout are routed exclusively through a licensed PSP/DEMI
3. The application functions solely as a **ledger and coordination layer**, not a payment platform

**Key Finding:** Section 4(2)(m) — "provision of any electronic platform for payment or receipt of funds" — targets platforms that **intermediate the payment flow itself**. A pure coordination/record-keeping layer that never touches funds, never initiates payment instructions, and never provides payment receipt functionality falls outside this provision.

**Risk if Deviated:** Any feature allowing the app to (a) hold funds in escrow, (b) initiate payout instructions, (c) provide virtual accounts/wallets, or (d) aggregate payment collection would trigger licensing.

---

## 1. Statutory Framework

### 1.1 Section 4(1) — General Prohibition

> "A body corporate other than a body corporate regulated under the Banks and Specialised Deposit-Taking Institutions Act, 2016 (Act 930) shall not operate a payment system or provide a payment service without a payment system licence issued by the Bank of Ghana in accordance with this Act."

### 1.2 Section 4(2) — Enumerated Payment Services

Section 4(2) lists licensable payment services. The relevant provisions:

| Subsection | Service | Relevance to Growl |
|------------|---------|-------------------|
| (c) | Transfer of funds from one account to another using any electronic means | **Not applicable** — Growl does not transfer funds |
| (d) | Transfer of electronic money from one electronic device to another | **Not applicable** — No e-money issuance or transfer |
| (e) | Provision of technological services to facilitate switching, routing, clearing and data management | **Borderline** — Growl provides data management only, not switching/routing/clearing |
| (l) | Payment system aggregation function | **Not applicable** — Growl does not aggregate payment services |
| **(m)** | **Provision of any electronic platform for payment or receipt of funds** | **Core issue — analysed in detail below** |

### 1.3 Section 9 — Offence

> "A person who contravenes section 4 commits an offence and is liable on summary conviction to a fine of not less than five thousand penalty units and not more than ten thousand penalty units or to a term of imprisonment of not less than five years and not more than ten years or to both."

---

## 2. Detailed Analysis: Section 4(2)(m) — "Electronic Platform for Payment or Receipt of Funds"

### 2.1 Textual Analysis

The phrase "electronic platform for **payment or receipt of funds**" contains three operative elements:

1. **"Electronic platform"** — A digital infrastructure/service
2. **"For"** — Indicates purpose/function
3. **"Payment or receipt of funds"** — The core activity: the platform must be **for** the act of paying or receiving

**Interpretation:** The platform must **itself** be the mechanism by which payment is made or funds are received. A platform that merely *records* payments made elsewhere, or *coordinates* payments made through a third-party rail, is not a platform "for payment or receipt of funds."

### 2.2 Regulatory Context — BoG Licensing Categories

The Bank of Ghana's **Revised Notice on Licensing of Payment System Providers (2019)** defines licence categories by **permissible activities**:

| Licence Category | Permissible Activities | Capital Requirement |
|------------------|----------------------|---------------------|
| PSP (Scheme) | Issuance of electronic money, wallet management, cash in/out, domestic transfers | GHS 8M |
| PSP (Enhanced) | Aggregation, merchant acquiring, POS, inward remittances | GHS 2M |
| PSP (Medium) | Payment gateway/portals, payment aggregation connected to Enhanced PSP, market platforms, payment applications for credit/savings/investment **in partnership with Banks** | GHS 0.8M |
| **PSP (Standard)** | **Payment application solution/development, merchant development platform, a payment solution** | **No capital required — leverages Enhanced licence** |

**Critical Observation:** The **PSP (Standard)** category explicitly covers "payment application solution/development" and "a payment solution" — **but only when leveraging an Enhanced licence**. This confirms that a standalone "payment application" without a licensed partner is not a recognised category; it must attach to a licensed entity.

### 2.3 Purpose of Section 4(2)(m)

The provision targets **platforms that intermediate the payment flow** — i.e., platforms where:
- The payer pays **to** the platform, or
- The platform pays **to** the payee, or
- The platform holds funds between payer and payee (even momentarily)

This is consistent with the broader Act's purpose: regulating entities that **take custody or control of funds** in the payment chain.

---

## 3. Application to Growl Architecture

### 3.1 Current Architecture (Per Implementation Plan)

```
Member → Mobile Money (MTN MoMo / Vodafone Cash / Hubtel / Fincra) → Member
                ↑                                              ↑
                │                                              │
                └────────── Licensed PSP Rail ─────────────────┘
                               ↑
                               │
                    Growl App (Ledger Only)
                    - Records contribution claims
                    - Verifies against PSP response
                    - Manages rotation, debt, rounds
                    - NO custody, NO float, NO payout trigger
```

### 3.2 Point-by-Point Assessment

| Activity | Act 987 Assessment |
|----------|-------------------|
| **Member initiates payment from their MoMo wallet** | Member ↔ PSP. Growl not a party. |
| **PSP routes funds to receiver's MoMo wallet** | PSP ↔ Member. Growl not a party. |
| **Growl records "contribution claim" (pending)** | Data entry. No funds move. Not "payment or receipt." |
| **Admin verifies against PSP response** | Verification of external event. Not payment intermediation. |
| **Growl updates ledger (double-entry, append-only)** | Accounting record. No funds touch Growl. |
| **Growl computes round completeness, next turn** | Business logic. No payment function. |
| **Growl never initiates payout instruction** | Critical — no "payment" by Growl. |
| **Growl never holds funds in escrow/wallet** | Critical — no "receipt of funds" by Growl. |
| **Growl provides no virtual account/wallet to members** | No "receipt of funds" capability. |
| **Growl never aggregates collections** | No "aggregation function" (s.4(2)(l)). |

### 3.3 The "Platform For" Test

**Question:** Is Growl a platform *for* payment or receipt of funds?

**Answer:** No. Growl is a platform **for susu group coordination and record-keeping**. Payment and receipt occur **exclusively on the licensed PSP's rails**. Growl's role is **evidentiary and administrative** — it creates the *record* of a payment that happened elsewhere.

**Analogy:** A spreadsheet that tracks susu contributions is not a payment platform. Growl is an automated, multi-user, server-validated spreadsheet with business logic — but still fundamentally a **ledger**, not a payment rail.

---

## 4. Boundary Analysis — What Would Trigger Licensing

The following features/behaviours **would** bring Growl within Act 987 licensing:

| Trigger Feature | Why It Triggers Licensing |
|-----------------|---------------------------|
| **Escrow/wallet holding member funds** | Direct "receipt of funds" (s.4(2)(m)) |
| **Initiating payout instructions to PSP** | "Payment" by the platform (s.4(2)(c)/(m)) |
| **Providing virtual accounts/collection accounts** | "Receipt of funds" on platform's accounts |
| **Aggregating multiple members' payments into single PSP transaction** | "Aggregation function" (s.4(2)(l)) + "platform for receipt" |
| **Charging fees on contributions** | Commercial payment service indicator |
| **Member pays *to Growl* (not to PSP directly)** | Platform becomes payee = "receipt of funds" |
| **Growl settles net positions between members** | "Transfer of funds" (s.4(2)(c)) / clearing (s.4(2)(a)) |
| **Issuing any form of stored value/token** | "Electronic money" (s.4(2)(d)/(j)) |

**Current Plan Compliance:** None of the above are in the implementation plan. The plan explicitly prohibits custody, payout triggers, and member fees.

---

## 5. Partner Agreement Structure

### 5.1 Required Legal Relationship

Growl must operate under a **commercial agreement with a licensed PSP/DEMI** (Hubtel EPSP primary, Fincra fallback) that:

1. **Acknowledges Growl as a non-licensed technology partner** — not a sub-agent, not a payment service provider
2. **Confirms all payment flows are PSP-to-customer direct** — no Growl intermediation
3. **Provides API access for verification only** — query transaction status by reference; no payment initiation
4. **Indemnifies Growl for PSP-side failures** — Growl's verification is reliant on PSP data
5. **Includes data sharing provisions compliant with Act 843 (Data Protection)**

### 5.2 Recommended PSP Licence Categories

| Partner | Licence Type | Permissible Activities Covered |
|---------|--------------|--------------------------------|
| **Hubtel** | PSP (Enhanced) / DEMI | Aggregation, payment gateway, inward remittances, merchant acquiring, **electronic platform for payment/receipt** |
| **Fincra** | PSP (Enhanced) / PSP (Scheme) | Cross-border, payment gateway, aggregation, **electronic platform for payment/receipt** |
| **Moolre / LibertePay** | PSP (Medium) / PSP (Enhanced) | Payment gateway, portals, aggregation, **electronic platform for payment/receipt** |

**Recommendation:** Execute agreement with **Hubtel (Enhanced/DEMI)** as primary. Their licence explicitly covers "provision of electronic platforms for payment or receipt of funds" — the exact s.4(2)(m) activity. Growl sits **adjacent** to this platform, not within it.

---

## 6. Data Protection Act, 2012 (Act 843) — Parallel Requirement

### 6.1 Section 18 — Registration Requirement

> "A person shall not process personal data unless the person is registered with the Commission."

Growl processes personal data (names, phone numbers, contribution histories, financial records). **Registration with the Data Protection Commission (DPC) is mandatory before launch.**

### 6.2 Section 19 — Data Protection Principles

Key principles applicable:
- **Lawfulness** — Consent or legitimate interest for susu coordination
- **Purpose limitation** — Only for susu group administration
- **Data minimisation** — No unnecessary financial data collection
- **Security safeguards** — Encryption, access controls (already in JWT auth design)
- **Retention limits** — Define retention schedule for contribution/payout records

### 6.3 Section 20 — Data Protection Officer

If processing is "core activity" or "large scale," a DPO is required. Given susu is the core product, **appoint a DPO** (can be external).

---

## 7. AML/CFT — Anti-Money Laundering / Counter-Financing of Terrorism

### 7.1 Applicable Framework

- **Anti-Money Laundering Act, 2020 (Act 1044)**
- **BoG AML/CFT Guidelines for PSPs and Fintechs (2021)**

### 7.2 Growl's Obligations (As Non-Licensed Partner)

While Growl is not a "reporting entity" under Act 1044, the **PSP partner will impose KYC/AML requirements contractually**. Growl must design for:

| Requirement | Implementation |
|-------------|----------------|
| **Customer Due Diligence (CDD)** | Collect/verify member identity at onboarding (name, phone, ID type/number) |
| **Transaction Monitoring** | Flag unusual patterns (large round amounts, rapid group creation, cross-border) |
| **Suspicious Transaction Reporting (STR)** | Internal flag → escalate to PSP partner for STR filing |
| **Record Keeping** | Retain contribution/payout records for 7 years (Act 1044 s.38) |
| **Sanctions Screening** | Screen members against UN/BoG sanction lists at onboarding |

### 7.3 Design Recommendations (Already in Plan)

- Member onboarding: phone verification + optional ID document
- Contribution limits: max 50 members, variable amounts but target set by admin
- Audit trail: append-only ledger with immutable postings
- Admin trust score: procedural accountability (no financial clawback possible)

---

## 8. Equity Requirement — Section 8(4)

> "An applicant shall have at least a thirty percent equity participation of a Ghanaian."

**Status:** ✅ **Satisfied** — Founder qualifies as Ghanaian equity holder.

**Note:** This applies to the **licensed entity** (the PSP partner), not Growl. Growl as a technology company has no equity requirement under Act 987. However, if Growl ever incorporates a Ghanaian entity to hold the PSP agreement, 30% Ghanaian ownership must be maintained.

---

## 9. Conclusion & Recommendations

### 9.1 Legal Opinion

**The Growl susu application, operating strictly as a "never hold funds" ledger and coordination layer with all payment flows routed directly between members and a licensed PSP, does not require a payment system licence under Act 987.**

The critical statutory gateway — Section 4(2)(m) "provision of any electronic platform for payment or receipt of funds" — is not triggered because Growl:
- Never receives funds from members
- Never pays funds to members
- Never initiates payment instructions
- Never holds funds, even momentarily
- Provides only record-keeping, verification, and coordination services

### 9.2 Mandatory Conditions for This Opinion to Hold

| Condition | Status | Action Required |
|-----------|--------|-----------------|
| No custody/escrow/float of funds | ✅ In plan | Enforce in code review; no future feature creep |
| All payments member ↔ PSP direct | ✅ In plan | Verify PSP integration implements direct pay |
| No payout initiation by Growl | ✅ In plan | No payout endpoint exists — maintain |
| Licensed PSP partner agreement signed | ❌ Not started | **BLOCKING — Execute before any live funds** |
| DPC registration + DPO appointed | ❌ Not started | Initiate immediately |
| AML/CFT design implemented | ❌ Not started | Implement screening/monitoring before launch |
| PSP provides verification API (not payment API) | ❌ Not started | Confirm with Hubtel/Fincra |

### 9.3 Immediate Next Steps (Phase 0 — Blocking)

1. **Execute PSP Agreement** with Hubtel (primary) / Fincra (fallback) — target: 2 weeks
2. **Register with Data Protection Commission** — target: 2 weeks (parallel)
3. **Appoint DPO** (can be consultant) — target: 1 week
4. **Implement AML/CFT screening** (sanctions list, CDD at onboarding) — target: 2 weeks
5. **Board sign-off** on this opinion and compliance gate — target: 1 week

### 9.4 Ongoing Compliance

- **Quarterly review** of feature roadmap against licensing boundary
- **Annual legal opinion refresh** (or on material architecture change)
- **PSP agreement renewal tracking** (typically 5-year tenure)
- **BoG regulatory updates monitoring** — Act 987 amendments or new notices

---

## 10. Disclaimer

This opinion is based on:
- Act 987 as enacted 14 May 2019 (GhaLII version)
- BoG Revised Notice on Licensing of Payment System Providers (September 2019)
- Publicly available BoG guidance and licensing categories
- The Growl architecture as documented in `.kilo/plans/178921725-group-susu.md` (implementation plan v1)

**This opinion does not constitute:**
- A guarantee of BoG non-enforcement
- Advice on tax, company law, or other regulatory regimes
- A substitute for formal BoG confirmation (which can be sought via a "no-action letter" request)

**Recommendation:** Consider requesting a **BoG no-action letter** describing the exact "never hold funds" model, to obtain regulatory certainty before public launch.

---

**Prepared by:** [Legal Counsel Name]  
**Reviewed by:** [CTO/Founder]  
**Version:** 1.0 — DRAFT  
**Distribution:** Founder, CTO, Board Advisor (Legal)