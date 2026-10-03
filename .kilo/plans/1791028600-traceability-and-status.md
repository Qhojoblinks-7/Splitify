# Traceability and Implementation Status — Growl

The mechanism that stops a rule from being *claimed* but not *built*.

Specifications exist for the product, for money, for security, and for the backend domain.
Between them they carry roughly 300 numbered rules. A rule ID with no implementation and no
test is a rule nobody is enforcing, and this document is the register that makes that visible
rather than assumed.

| Specification | Rules | File |
|---|---|---|
| Growth business logic | `G1`–`G8`, `R1`–`R9`, `C1`–`C8`, `V1`–`V6`, `P1`–`P7`, `D1`–`D9`, `T1`–`T5`, `X1`–`X6`, `A1`–`A2`, `O1`–`O6`, `S1`–`S8`, `E1`–`E8`, `K0`–`K9` | `1791026719-growth-business-logic.md` |
| Money handling and safeguards | `M1`–`M9`, `C-S1`–`C-S9`, `P-S1`–`P-S10`, `Z1`–`Z9`, `F1`–`F7`, `V-R1`–`V-R6`, `X1`–`X13`, `RC1`–`RC7`, `AT1`–`AT7`, `F-S1` | `1791027903-money-handling-and-safeguards.md` |
| Security, fraud and identity | `P1`–`P10`, `I1`–`I88`, `T1`–`T10` (threats) | `1791028270-security-fraud-and-identity.md` |
| Backend domain (this register) | `B1`–`B14` | below, §2.3 |

**Status vocabulary:** `BUILT` (implemented and tested) · `PARTIAL` (implemented, tests
incomplete) · `SPECIFIED` (documented, not started) · `BLOCKED` (cannot start until an external
dependency lands) · `CORRECTED` (was specified wrongly; see §5).

---

## 1. Verification commands

| Purpose | Command |
|---|---|
| Frontend suite | `npm test` (repo root) |
| Money primitives only | `npx jest __tests__/money.test.js` |
| Round model only | `npx jest __tests__/round.test.js` |
| Backend suite | `backend\.venv\Scripts\python.exe -m pytest` |
| Backend, one domain class | `backend\.venv\Scripts\python.exe -m pytest susu/tests/test_domain.py::TestPayout` |
| Django checks | `backend\.venv\Scripts\python.exe manage.py check` |

**Current state: frontend 186 tests green, backend 63 tests green. 249 total.**

Stack: Django 5.2.17, DRF 3.18.1, simplejwt 5.5.1, pytest 9.1.1, pytest-django 4.14.0,
Python 3.13.5, isolated in `backend/.venv`. SQLite for local, PostgreSQL for production.

---

## 2. Implemented — Increment 1 and 2

### 2.1 `services/money.js` — money primitives (37 tests)

| Rule | Implementation | Test |
|---|---|---|
| M1 integer pesewas, never float | `isPesewas`, `assertPesewas` guard every function | `integer guards` |
| M1 no IEEE-754 arithmetic | parsing from the decimal string, not `value * 100` | `does not produce a float artefact for 100.5` |
| M4 reject unparseable amounts | `toPesewas` throws; `tryToPesewas` reports | `rejects non-numeric input`, `reports failures instead of throwing` |
| M3 formatting only place a decimal exists | `formatGHC` | `formats pesewas as grouped cedis` |
| M6 division remainder, rotation order | `allocate(total, count, keys)` | `distributes the remainder one pesewa at a time in the given order` |
| M6 determinism | `allocate` is pure | `is deterministic across repeated calls` |
| M6 conservation | `allocate` sums to `total` for every input | `never loses or invents a single pesewa` (200 × 7 combinations) |
| M5 round only at the final step | `roundHalfUp` | `roundHalfUp` |
| M7 no member shortchanged | `allocate` floors, then adds | `splits exactly when the total divides evenly` |
| P6 `payout = verified − fee` | `payoutAmount` | `payoutAmount` |
| P6 block when the fee eats the pot | `payoutAmount` throws | `refuses to pay when the fee consumes the pot` |
| C6 shortfall never negative | `shortfall` | `shortfall` |

### 2.2 `services/round.js` — round model (37 tests)

| Rule | Implementation | Test |
|---|---|---|
| R0 round snapshot | `openRound` | `round snapshot` (10 tests) |
| R1 roster and shares frozen | `round.roster[].share` | `freezes each member's share` |
| R2 receiver is a fact | `round.receiverId`, `roundRecord` prefers a stored round | `records the receiver as a fact`, `survives a later removal of the receiver` |
| R3 due date from round open | `dueAtFrom(collectionDay, openedAt)` | `gives a late round a full window` |
| R6 rotation origin is the receiver | `openRound` rotates from the cursor | `always records the receiver as the first rotation position` |
| C-S1 only verified counts | `countedAttempt` | `counts only verified attempts`, `treats a flagged attempt as not counted` |
| C-S1 attempts are retained | `attemptsFor` | `lists every attempt a member made, in order` |
| **C-S2 the freeze rule** | `canLogContribution` | `the freeze rule` (10 tests) |
| D2 debt from actuals | `allocateDebt` | `debt from actuals` (10 tests) |
| D2 capped at own share | `allocateDebt` cap-and-redistribute loop | `caps a charge at that member's own snapshot share` |
| D2 exact conservation | `allocateDebt` floor-then-remainder | `splits an indivisible shortfall without losing a pesewa` |
| **Z1 money identity** | `conservationResidual` | `conservation` (5 tests) |
| Z2 float retained | `closingFloat` | `balances on a short round, retaining the collected money as float` |
| Z2a debt identity | `debtResidual` | `never books more debt than the shortfall` |
| Z7 residual is an incident | `conservationResidual` | `reports a residual when more was paid out than was ever collected` |
| — invariant holds universally | matrix over 125 status combinations | `holds for every contribution pattern across a matrix of rounds` |

---

## 2.3 Backend increment B1 — Django domain (63 tests)

`backend/susu/models.py`, `backend/accounts/models.py`, `backend/accounts/phones.py`.

**Design commitment:** the invariants are enforced by **database constraints** wherever the
database can enforce them. A rule held only in Python is a rule a migration, a bulk `.update()`,
or a direct `psql` session will eventually walk around.

| ID | Rule | Implementation | Enforced by | Test |
|---|---|---|---|---|
| B1 | Money is an integer count of pesewas, never a float or decimal | `to_pesewas`, `*_pesewas` BigInteger columns | Column type | `test_money_is_stored_in_an_integer_column`, `test_no_money_field_uses_a_float_or_decimal` |
| B2 | A float amount is refused outright, not rounded | `to_pesewas` rejects non-integral floats | Parse guard | `test_a_float_amount_is_refused_outright` |
| B3 | One round open per group | `one_open_round_per_group` partial unique index | **Database** | `test_the_database_refuses_a_second_open_round` |
| B4 | Opening twice returns the same round, never a second one | `Round.open_current` idempotence | Code + constraint | `test_opening_twice_returns_the_same_round…` |
| B5 | Round snapshot: roster, shares, receiver frozen | `Round.open_current`, `roster_snapshot` | Code + snapshot | `TestRoundSnapshot` (9 tests) |
| B6 | Shares conserve the target exactly | `allocate` | Code | `test_shares_conserve_the_target_exactly` |
| B7 | The indivisible cedi goes to the receiver | rotation from the cursor | Code | `test_an_indivisible_share_goes_to_the_receiver…` |
| B8 | Due date measured from the round opening, not the cycle start | `Round.due_from` | Code | `test_due_date_is_measured_from_when_the_round_opened` |
| B9 | Removing a member never moves the receiver or reindexes the roster | no reindex in code; receiver stored | Code | `test_removing_a_member_after_the_open_does_not_move_the_receiver` |
| B10 | Creator is installed at rotation position 1 (rule G2) | `SusuGroupManager.create_group` | Code | `test_the_creator_is_installed_at_rotation_position_one` |
| B11 | **The freeze rule** — a settled attempt always frees the slot | `Contribution.TERMINAL_STATUSES`, `open_slot_for` | Code | `test_re_payment_is_permitted_after_a_failed_attempt`, `…after_a_void` |
| B12 | At most one counted attempt per member per round (rule C-S3) | `one_verified_contribution_per_member_per_round` | **Database** | `test_only_one_attempt_can_be_verified_per_member_per_round` |
| B13 | Idempotency key accepted once (rule C-S5) | `one_contribution_per_idempotency_key` partial unique index | **Database** | `test_an_idempotency_key_is_accepted_once` |
| B14 | One payout per round, deterministic key (rule P-S3) | `one_payout_per_round`, `payout_key()` | **Database** + domain guard | `test_the_database_itself_refuses_a_second_payout_row`, `test_one_payout_per_round_ever` |

Also BUILT at the backend:

| Rule | Implementation | Test |
|---|---|---|
| P6/D-1 — payout pays every verified pesewa, not the target | `Round.payout` | `test_pays_an_overfunded_round_in_full_rather_than_the_target` |
| P-S5 — a failed payout leaves the round open, receiver keeps the turn | `Payout.mark_failed` | `test_a_failed_payout_leaves_the_round_open_for_the_receiver` |
| P-S10 — retries stop at 5 | `Payout.MAX_ATTEMPTS`, `can_retry` | `test_retry_stops_after_the_attempt_ceiling` |
| C-S4 — a flagged or disputed contribution blocks the payout | `Round.payout` | `test_a_blocked_round_is_never_paid` |
| P6 — a fee exceeding the pot escalates rather than paying zero | `Round.payout` | `test_a_fee_larger_than_the_pot_is_escalated_not_paid_as_zero` |
| Z1 — money identity holds on completion | `Round.conservation_residual` | `test_money_conserves_after_a_completed_payout`, `…with_nothing_verified` |
| I2/I3 — E.164 normalisation, one number one account | `normalise_phone`, unique column | `TestPhoneNormalisation`, `test_one_account_per_phone`, `test_two_spellings_of_one_number_collide` |
| I86 — no full Ghana Card number anywhere | field absent by design | `test_never_stores_a_full_ghana_card_number` |

---

## 3. Specified but not built

Nothing in this section is claimed as working. Ordered by what unblocks the most.

| Rule group | Status | Blocked by | Needed for |
|---|---|---|---|
| `P1`–`P7` payout state machine | SPECIFIED | `confirmed` status, payout key, `select_for_update` | M3 |
| `C-S3` unique counted attempt | SPECIFIED | database constraint | Backend |
| `C-S6` transition table | SPECIFIED | store rewrite | M3 |
| `R9`, `T1`–`T5` rotation tombstoning, cursor carry | SPECIFIED | store rewrite | M3 |
| `R4`, `R5`, `R7` round lifecycle | SPECIFIED | store rewrite | M3 |
| `D3`–`D9` settlement paths | SPECIFIED | store rewrite | M3 |
| `A1` actor on every privileged action | SPECIFIED | store rewrite | M3 |
| `O1`–`O6` idempotency | PARTIAL — `queue.js` has keys, no server dedupe | Backend | M3 |
| `S1`–`S8` statements, PAR, ageing | SPECIFIED | store rewrite | M4 |
| `I1`–`I88` identity and auth | SPECIFIED | Backend | M1–M3 |
| `RC1`–`RC7` reconciliation | BLOCKED | Hubtel contract | M3 gate |
| `AT1`–`AT7` audit trail | SPECIFIED | Backend | M4 |
| `E1`–`E8` entitlements | SPECIFIED | auth | M5 |

---

## 4. Corrections — rules that were specified wrongly

Kept permanently. A spec that silently changes its mind is worse than one that admits it.

### C-1 — Z1 included debt. Fixed.

**Was:** `Σverified − ΣpayoutsGross − Σfees − Σreversals − ΣdebtBooked − closingFloat = 0`

**Now:** Z1 covers money only; Z2a covers obligations separately.

**Found by:** the matrix test `holds for every contribution pattern across a matrix of rounds`,
which produced a `−10000` residual for the case where three members owe GH¢100 each and one
person paid GH¢100.

**Why it matters:** debt is a claim on future contributions, not a cedi that has left the pot.
The old formula would have raised a conservation incident every time a group collected poorly —
teaching the team to ignore the one check that matters. It also double-deducted: GH¢200 collected
with GH¢100 owed was being treated as GH¢100 of float and GH¢100 of debt against the same money.

**Consequence for the earlier revision:** §5.2 of the money document originally showed
`closingFloat = 10000` for the two-contributor short round. The correct figure is `20000`, because
the full GH¢200 is still in the collection account.

### C-2 — Debt allocation over-booked by a pesewa. Fixed.

**Was:** each member's charge rounded independently with `roundHalfUp`, then a remainder
applied. When the shortfall was smaller than the member count, every charge rounded up and the
total exceeded the shortfall by 1 pesewa.

**Now:** floor first, then distribute the indivisible cedi by largest fractional remainder with
rotation order as the tie-break, then cap-and-redistribute.

**Found by:** `never books more debt than the shortfall`, failing on a shortfall of exactly
1 pesewa across 2 members, which booked 2.

### C-3 — `"5."` was rejected as an amount. Fixed.

The permissive pre-check was stricter than the real pattern. A bare trailing decimal point is
legitimate user input.

---

## 5. Known defects in the existing codebase

Recorded so they are not rediscovered as surprises. Each is covered by a rule above and is
scheduled for M3.

| # | Defect | Location | Rule | Test that will catch it |
|---|---|---|---|---|
| D-1 | Payout sends `targetAmount`, not the verified total; surplus evaporates | `store/susu.js:518` | Z1, P6 | `balances on a normal round with an overpayment` |
| D-2 | Collected-but-unpaid money is discarded on a short close | `store/susu.js:578` | Z2 | `balances on a short round, retaining the collected money as float` |
| D-3 | A failed contribution blocks that member from re-paying forever, stranding the round | `services/susu.js:168` | C-S2 | `PERMITS re-payment after a failed attempt` |
| D-4 | `restartCycle` zeroes `missedShare`, letting a debtor escape | `store/susu.js:643` | D5, D9 | — |
| D-5 | `restartCycle` resets `currentTurnIndex` to 0, so the same member collects first every cycle | `store/susu.js:640` | R8, T1 | — |
| D-6 | `removeMember` reindexes the roster, silently changing who is about to be paid | `store/susu.js:274` | T1, T2 | — |
| D-7 | No privileged action takes an actor or checks a role | `store/susu.js` (7 actions) | A1, P2 | — |
| D-8 | All money is `Number` in cedis | `services/susu.js`, `services/statement.js` | M1, M2 | — |
| D-9 | `provider` list contains `vodafone_cash`; the rail is now Telecel, and AT is absent | `services/susu.js:9-13` | — | — |
| D-10 | `memberStatement.contributed` counts unverified money; `groupStatement` does not | `services/statement.js:86` | S2 | — |
| D-11 | `dueSummary` treats a failed contribution as "already paid", so a stuck member is never prompted | `services/susu.js:118` | C-S2 | — |
| D-12 | No storage, hashing, token, or secure-store usage anywhere | `app/Auth/*` | I21, I22 | — |
| D-13 | `MAX_MEMBERS` used for one rule, a literal `50` for another | `store/susu.js:255` | G3 | — |
| D-14 | **Engine difference:** SQLite deadlocks when a bulk `UPDATE` is the statement that violates a partial unique index; an `INSERT` violation raises correctly. Production is PostgreSQL, where both raise | backend test harness | C-S3, P-S3 | `test_only_one_attempt_can_be_verified_per_member_per_round` (asserted via insert) |
| D-15 | A group could be created with no membership for its creator, so the admin was not in their own rotation | fixed in `SusuGroupManager.create_group` | G2 | `test_the_creator_is_installed_at_rotation_position_one` |
| D-16 | Ghana national numbers are 9 digits after the trunk zero; the parser assumed 10 and rejected every valid number | fixed in `accounts/phones.py` | I2 | `TestPhoneNormalisation` |
| D-17 | `email` was unique with a `""` default, so only one account could have no email | fixed: nullable, default `None` | I1 | `test_many_accounts_may_have_no_email_at_all` |
| D-18 | `idempotency_key` had no unique constraint, so a replayed offline write could double-post | fixed in B1 | C-S5, O1 | `test_an_idempotency_key_is_accepted_once` |
| D-19 | No double-entry ledger table. `LedgerEntry` is specified but absent, so conservation is computed on the fly rather than asserted against an immutable record | `AT1`–`AT7` | AT2 | — |

---

## 6. Increment queue

Each increment is: specification → failing test → implementation → green suite → commit. No
increment merges with a red suite.

| # | Increment | Size | Status |
|---|---|---|---|
| 1 | `services/money.js` — integer pesewa primitives | small | **Done, 37 tests** |
| 2 | `services/round.js` — snapshot, attempts, conservation, float, debt | medium | **Done, 37 tests** |
| B1 | `backend/` Django domain — accounts, groups, rounds, attempts, payouts | large | **Done, 63 tests** |
| B2 | Append-only double-entry `LedgerEntry` (D-19), audit events | medium | Next |
| B3 | DRF endpoints with authorization — actor on every privileged action (D-7, A1) | medium | Queued |
| B4 | Phone-first auth: JWT, verification, step-up, recovery without SMS (D-12) | large | Queued |
| B5 | Rail adapter, disconnected; webhook verification (RC1) | medium | Blocked on Hubtel |
| 3 | Wire `store/susu.js` to the round model; resolve D-1…D-3, D-11 | medium | Queued |
| 4 | Rotation integrity; resolve D-4, D-5, D-6 | medium | Queued |
| 7 | Debt settlement paths | medium | Queued |
| 8 | Statements, PAR, debt ageing; resolve D-8, D-10 | medium | Queued |
| 9 | Rail providers list fix; resolve D-9, D-13 | small | Queued |

**Note on sequencing:** the backend now holds the money rules of truth (B1) while the Expo app
still carries the old ones. That is a deliberate but *temporary* divergence. The app is a demo
shell; the backend is the system. Increment 3 must land before either surface is shown to a
real member, or the app will contradict the ledger a member is being shown.

---

## 7. Rules of this register

1. **A rule ID may only be reported as done with a named passing test.** No test, no claim.
2. **A correction is recorded, never overwritten.** Sections 4 and 5 grow; they are not edited away.
3. **An increment is not started until the suite is green**, and not finished until every
   defect in section 5 that it claims to resolve has a passing test.
4. **The matrix test is not optional.** Any change to money arithmetic must keep
   `holds for every contribution pattern across a matrix of rounds` passing. It found two of the
   three frontend defects above and it will find the next one.
5. **A database constraint is worth more than a code check.** Where both exist, the constraint
   is the guarantee and the code check is the error message. Both are tested separately, because
   they fail differently: D-14 exists precisely because they do.
6. **Measure before optimising.** The backend suite appeared to hang three separate times. It did
   not hang: test setup was taking ~20s per test because the fast test password hasher was never
   activated (`sys.argv` contains neither "test" nor "pytest" under `python -m pytest`). Setup
   is now 0.5s. A timeout mistaken for a deadlock costs hours if not measured.