# Debt forgiveness and member removal policy

**Status:** Adopted by engineering. Legal review pending before launch.
**Last reviewed:** 8 October 2026
**Related:** Short-round resolution rules in `1791027903-money-handling-and-safeguards.md` §5.4 (SR1–SR3)

---

## 1. Principle

A member who leaves a susu group may owe the group their share of a round that closed short.
Growl is not authorised to collect money (Act 987), so this debt is a record, not a claim that
can be settled. The policy below governs what happens to that record when the member is removed
from the rotation.

Debt originates from a short round: when a round closes short (SR1), the collected amount is paid
to the receiver and each non-paying member receives a `DebtClaim` from the group's debt booking.
The claim is settled only when the debtor receives a payout (SR2). If the debtor leaves before
receiving, the debt persists (SR3) — see §2 below for how removal interacts with outstanding debt.

## 2. The two dispositions

| Disposition | What the code does | When it is used |
|---|---|---|
| **Forgive** | Writes a balanced group-level `REVERSAL` posting (DEBIT `member_payable` / CREDIT `debt_receivable`, `round=None`) and zeros `debt_pesewas`. The write-off is preserved in the audit trail. | The member is leaving permanently, the group agrees to write off the exposure, and an admin explicitly chooses this path. |
| **Preserve** | Leaves `debt_pesewas` intact on the `Membership`. The debt survives departure and counts against any future payout the member would receive if they rejoin. | The member may return, or the group wants the record to remain until a later decision. |

There is deliberately no silent third option. A removal without a stated disposition would either
hide a real group exposure or silently destroy it, both of which are worse than the explicit choice.

### 2.1 Short-round debt is not forgiven on removal

Debt created by a short round is a `DebtClaim` owed to a specific creditor (the receiver who was
shorted), not a group-level obligation. On removal:

- If the debtor **has not yet received** in the current cycle, the `DebtClaim` is preserved (not
  written off). The creditor must be made whole from the debtor's next payout when they rejoin, or
  the claim remains as an outstanding receivable on the membership record.
- If the debtor **has already received** in the current cycle, an exit contribution equal to the
  next receiver's shortfall is charged before removal, protecting the innocent member who would
  have received.

**Rule 3 (departure cost):** A member who leaves after receiving covers their share of the next
receiver's shortfall. A member who leaves before receiving forfeits their unpaid debt — their
creditor eats the loss.

## 3. How the code enforces this

- `Membership.deactivate(actor, reason, forgive_debt)` requires the caller to pass `forgive_debt`
  explicitly. The default is `True`, so a caller cannot forget to decide.
- If `forgive_debt=True` and `debt_pesewas > 0`, the reversal posting is written inside the same
  transaction as the membership deactivation. Either both happen or neither does.
- The `reference` on the reversal includes a UUID suffix, so a second forgiveness on the same
  membership cannot collide with the first.
- `debt_reason` and `debt_notified_at` are cleared only on forgiveness. On preserve they remain
  so the record is complete.
- An `AuditEvent("membership.deactivated")` records who performed the action, when, and why.

## 4. What the member sees

When a payout is released, the member-facing copy discloses the transfer fee before the money
moves:

> "Growl pays the GHC X transfer fee out of the pot. You receive GHC Y."

The fee is withheld from the pot but is posted to the ledger as a balanced pair
(`fee_expense` / `fee_payable`), so the books stay even. If the fee would exceed the pot,
`Round.payout` refuses the payout before any posting is written (P-S6).

## 5. What the backend guarantees

- **F1:** No member ever pays a fee. The fee comes from the pot, not from the receiver.
- **F2:** The fee is disclosed in the same screen that releases the payout. It is never discovered
  afterwards.
- **F4:** A fee larger than the pot blocks the payout and escalates. The payout is never partially
  paid without the receiver's knowledge.
- **D9:** A removed member's debt is never silently cleared. The disposition is explicit, recorded,
  and auditable.

## 6. Open questions for legal review

1. Does the write-off of a debt on member removal create a taxable event under Ghana tax law?
2. Is the seven-year retention of the reversal posting compatible with the member's data-erasure
   rights under Act 843 s.24(1)(a)?
3. Should the debt-preservation path be surfaced to the member when they rejoin, or handled
   silently in the backend?
