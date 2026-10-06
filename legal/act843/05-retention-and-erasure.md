# Retention, anonymisation and erasure — §24

**Statute:** Act 843 (2012) §24, §33(1)(b), §44 · **Enforced by:**
`manage.py purge_expired_personal_data` · **Policy source:** `backend/compliance/retention.py`

---

## What §24 actually requires

> (1) A data controller who records personal data shall not retain the personal data for a period
> longer than is necessary to achieve the purpose for which the data was collected and processed
> unless (a) the retention of the record is required or authorised by law, (b) … reasonably
> necessary for a lawful purpose related to a function or activity, (c) … required by virtue of a
> contract between the parties …, or (d) the data subject consents to the retention.
> (5) A data controller shall destroy or delete a record of personal data **or de-identify the
> record** at the expiry of the retention period. (6) The destruction or deletion … shall be done
> in a manner that **prevents its reconstruction in an intelligible form**.

Two words carry the weight. **"or de-identify"** in (5), and **"prevents reconstruction"** in (6).
Both are why the implementation de-identifies rather than only deletes, and why an anonymised
phone number is replaced with a unique undialable value rather than nulled: a null column in a row
that still sits in a payments history can be re-identified by joining it against any surviving
identifier, and a phone number that has been released back into the Ghanaian numbering plan will
be **reassigned to somebody else**.

## The schedule

Published in the notice, enforced here, and **a test asserts the two agree** — a published
schedule that is not the enforced one is a lie with a footer.

| Record | Period | Basis | Action at expiry |
|---|---|---|---|
| Ledger entries and postings | **7 years** from the round | §24(1)(a); Act 1044 s.38 | Never edited. A correction is a visible reversal. De-identified with the account |
| Audit trail | **7 years** | §24(1)(a) — the group's record of administrative acts | Same |
| Contributions, payouts, rounds | **7 years** | §24(1)(a); Act 1044 s.38 | De-identified with the account; retained as amounts |
| Groups and memberships | Life of the group, then the 7-year hold | §24(1)(c) — the contract the group entered into | Membership de-identified |
| Account (live) | Until erasure is asked for | §24(1)(c) | See below |
| Account (anonymised) | 7 years from anonymisation | §24(1)(a) | Row deleted outright if nothing names them |
| Consent records | 3 years, **anonymised accounts only** | §24(1)(a) | Deleted |
| Data subject requests and answers | 3 years | §24(1)(a) | Deleted once **closed** and past the period. An open request is never purged |
| Session tokens | 7 days (the refresh lifetime) | §19 — no purpose survives the token | Purged weekly |
| Rail verification answers | Not stored beyond the round | §24(1) — the outcome on the contribution is the record | Nothing to purge |

**The 7-year figure.** Act 1044 s.38 requires transaction records to be kept for five years from
the end of the business relationship. We take seven, being the longer of the two, and publish
seven. If the partner agreement imposes a longer period, this schedule changes and the notice
changes with it.

**Consent records are purged only for anonymised accounts.** A live member's consent is the basis
on which everything else is held; deleting it while the data stands would leave the processing
with no recorded justification — the precise opposite of §17(a).

## Erasure: the two-stage answer

A member who asks us to delete their data is a member of a savings group. The payment history is
**not ours to delete**: it is the group's record, the other members are entitled to see it, and
§24(1)(a) plus Act 1044 hold it for seven years.

So the notice says what will actually happen, **before** the member asks, and the product does
exactly that:

### Stage 1 — anonymise, now

`manage.py privacy_requests execute-erasure <id>`

| Field | Becomes |
|---|---|
| `full_name` | `""` |
| `email` | `None` |
| `ghana_card_last4`, `ghana_card_hash` | `""` |
| `payout_destination`, `payout_destination_verified_at` | cleared |
| `phone_verified`, `id_verified` | `False` |
| `phone` | `anon-0000000123` — unique, undialable |
| `password` | unusable |
| `anonymised_at` | stamped |
| `display_name` | **"Former member"** |

The account row survives as the group's record and stops being a person. It cannot sign in: there
is no password and the number is not a number.

**What does not change, and why:** the ledger, the audit trail, the contribution rows, the payout
rows. Amounts remain. They are the group's shared record, they are held de-identified, and the
member is told this in the same words on the screen, in the notice, and in the written answer.

### Stage 2 — delete, later

Once **all** of: the 7-year hold has expired, the account holds no membership, and it is named in
no contribution and no payout. Then the row is deleted.

**The database refuses the deletion wherever the money record names the person.** `Round.receiver`
and `Payout.receiver` are `PROTECT`, and `Membership` cascades only from the group. The refusal is
reported as a reason, not as an error:

```
account 412: retained — named as a receiver in the money record (payout, round)
```

Working around that would mean rewriting the money record — which the append-only ledger makes
impossible, and which would be the actual breach. **A refusal here is the system working.**

## Inactivity

An account with **no active membership** and **no authenticated activity for two years** is
anonymised on the same terms, by the same command. The rule is the same: the purpose is exhausted,
so the identifying data goes.

A dormant member of a **live group** is left alone, and a test asserts it. Two years of silence is
not the same as having left, and a savings circle can run for a decade.

`last_active_at` is written by `compliance.middleware.LastSeenMiddleware` **at most once a day**.
It is not `updated_at`, because any write moves `updated_at` — including an admin action against
one of the member's contributions — so an account nobody has touched in a year can carry a
timestamp from last week and survive the purge forever. The middleware uses `update()` rather than
`save()` so it cannot write back a stale copy of anything else.

## Running it

```bash
# Report only. Changes nothing.
backend\.venv\Scripts\python.exe backend\manage.py purge_expired_personal_data

# Carry it out.
backend\.venv\Scripts\python.exe backend\manage.py purge_expired_personal_data --apply
```

**Report-only by default**, because this command deletes rows. A schedule that runs only when
somebody remembers an extra flag is the schedule that quietly stops; one that runs unattended from
memory is the one that deletes something a member still needs.

Suggested cadence: **weekly**, from a scheduler, with the output retained. The retention report is
the artefact the supervisor reviews and produces on request; the deletion is a side effect.

## What is not automated, and why

- **The ledger and the audit trail are never purged by the schedule.** They are the group's record
  and are de-identified with the account, not deleted. There is no code path that removes them,
  which is the point.
- **Re-identification of a deleted member's contribution is not attempted.** The amount, the round,
  the status and the timestamps remain, because the group's record requires them.
- **A member who asks for deletion while a round is open is anonymised anyway**, and the round
  continues. The other members' rights do not wait on their objection, and their amounts do not
  change.
- **Backups are out of scope of this schedule.** Restoring a backup inside the 7-year hold brings
  back records that were due for deletion. At pilot scale backups are the infrastructure
  provider's responsibility, and the contract must say so — it is item 4 in the launch gate.