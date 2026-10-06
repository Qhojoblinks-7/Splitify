# Data subject rights — §32 to §44

**Statute:** Act 843 (2012) §32, §33, §34, §35, §39, §40, §41, §43, §44 · **Owner:** the data
protection supervisor

---

## The rights, and where each one is exercised

| Right | Provision | In the app | Endpoint |
|---|---|---|---|
| Confirmation of whether data is held, a description of it, and **the data itself** | §32(1)(a)–(c), §35(1)(c) | Your privacy → "See everything you hold" | `GET /api/privacy/export/` |
| Description of the purposes and the recipients | §35(1)(b) | Shown in the export and in the notice | `GET /api/privacy/export/` |
| The source of the data, where it did not come from the member | §35(1)(c)(ii) | In the export: rail answers are from the operator, everything else is entered by the member | `GET /api/privacy/export/` |
| The logic behind a decision that significantly affects them | §35(1)(d) | Stated: a flag is by a named admin, −25 trust points, visible to the group, disputable | `GET /api/privacy/export/` |
| Rectification of inaccurate, irrelevant, excessive, out-of-date, incomplete, misleading or unlawfully obtained data | §33(1)(a) | "Correct something that is wrong" | `POST /api/privacy/requests/` |
| Destruction of a record we no longer have authority to retain | §33(1)(b), §44 | "Delete my data" | `POST /api/privacy/requests/` + `execute-erasure` |
| Stop processing that causes or is likely to cause unwarranted damage or distress | §39(1) | "Stop a use I object to" | `POST /api/privacy/requests/` |
| Objection, generally | §20(2)–(3) | Same as §39 | `POST /api/privacy/requests/` |
| Withdraw consent | §20(2) | "Withdraw my consent" | `POST /api/privacy/consent/` |
| Stop direct marketing | §40 | Nothing to stop — there is none, and the notice says so | — |
| Rights in relation to automated decision-making | §41 | Stated in the notice and the export | — |
| Compensation for damage or distress | §43 | Enforced by the law, not by a button | — |

## The 21-day clock

**§39(2):** "A data controller shall within twenty-one days after receipt of a notice inform the
individual in writing (a) that the data controller has complied or intends to comply with the
notice of the data subject, or (b) of the reasons for non-compliance."

Two consequences that shape the implementation:

1. **A refusal is an answer.** It must be in writing, it must give reasons, and it is subject to the
   same 21 days. There is no such thing as a request left unanswered because we could not agree
   with it.
2. **The clock starts at receipt, not at acknowledgement.** `due_at` is computed on creation and
   stored, so a late answer is visibly late rather than quietly on time. The report command lists
   anything overdue, and the release check fails on it.

`GET /api/privacy/requests/` returns each request with its status and `overdue` flag. The app
renders the due date, so the member can hold us to it.

## Identity, and refusing a request

**§32(1):** "A data subject **who provides proof of identity** may request…"

The endpoints here require a valid access token. A signed-in session **is** the proof: it is
obtained by proving a password to an account keyed on a verified mobile money number, and the
endpoints can only ever return the caller's own rows. A request arriving by email or in person is
answered through the same queue; the supervisor records the proof of identity that was given.

**Refusing a request is permitted by the Act but must be reasoned.** Three legitimate grounds:

| Ground | When it applies |
|---|---|
| The identity of the requester cannot be established | Never in practice here, because the session is the proof |
| The record is a matter of another person's rights | Narrow. The ledger and audit trail are the group's record |
| Retention is required or authorised by law | §24(1)(a); Act 1044 s.38. The ledger, audit trail and contribution rows |

**A refusal recorded without reasons is rejected by the model, not merely discouraged.** A test
asserts it. The supervisor's command line cannot close a request as `refused` or
`partially_refused` without `--evidence`, and `manage.py privacy_compliance_report` fails on any
request past its deadline.

## Rectification, and the part that cannot be rectified

**What can be corrected:** name, email, mobile money number, anything on the member's own profile.

**What cannot:** a ledger posting, an audit event, a contribution that was verified, a payout. These
are append-only by construction — `AppendOnlyModel` raises on both `save()` and queryset
`update()`/`delete()`.

This is correct, and it is worth defending to a member in exactly those words: **the money record
is corrected by a new, visible entry, never by editing the old one.** A member disputing a payment
does not get the row changed; they get the dispute recorded, the round blocked, the admin's trust
score reduced and the reversal posted. Every other member can see it happen. §33(4) requires us to
inform each person to whom corrected data was disclosed, and §44(4) requires notifying third parties
of a rectification, erasure or destruction — satisfied here by the fact that the correction is
visible to the group in the first place.

If a member's **own** data is genuinely wrong in the money record — a payment attributed to the
wrong seat — the answer is a reversal and a re-recording, which is a new fact rather than an edit,
and the audit log shows exactly who decided it.

## Answering the questions the Act expects

**§32(1)(b) asks for "the identity of a third party or a category of a third party who has or has
had access to the information."** The export names the categories: the other members of the group,
the licensed payment partner, the infrastructure provider, and a regulator or court.

**§35(1)(c)(ii) asks for "the source of the data".** Two sources are not the member: the payment
operator, whose answer settles whether a claimed payment happened; and the group's invite code,
which is how a member comes to be seated in a rotation at all.

**§41 asks about automated decision-making.** The answer is no — with one disclosure worth making
plainly rather than hiding: **the shortfall allocation is computed, not decided.** When a round
closes short, the debt each member is charged is derived by a deterministic water-filling split of
their own frozen shares, largest fractional claim first, rotation order breaking ties. It is the
same calculation on every device and every run, it is shown to the member before they pay, and it
is not a judgement about any person. This is disclosed in the DPIA, [09](09-dpia.md).

## Where the queue lives, and why not in the app

**The supervisor's queue is `manage.py privacy_requests`.** There is no admin site.

Two reasons, and the second is the one that matters:

1. `django.contrib.admin` is deliberately **not installed**. It is a full database editor behind a
   login, on a system holding a money record that must never be edited. Installing it to answer
   rights requests would have been an absurd trade.
2. **A group admin must not answer requests about their own group.** They are the person most likely
   to be the subject of the complaint — they verify payments, reverse them, flag disputes and lose
   their role after two flags. The queue belongs to the supervisor, who is required by the mandate
   in [02](02-dpo-appointment.md) to hold no membership in any group in the product.

The queue commands:

```bash
manage.py privacy_requests list [--overdue] [--open] [--kind erase]
manage.py privacy_requests show 42
manage.py privacy_requests respond 42 --status answered --summary "..." --handled-by "Name, DPO"
manage.py privacy_requests respond 42 --status partially_refused \
    --summary "..." --evidence "Act 843 s.24(1)(a); Act 1044 s.38" --handled-by "Name, DPO"
manage.py privacy_requests execute-erasure 42 --handled-by "Name, DPO"
```

**Known limitation, stated rather than hidden:** there is no staff-facing web surface, so an
answer currently requires shell access to the server. That is acceptable for a pilot with a named
supervisor and a handful of requests, and it is **not** acceptable at beta scale. Before beta the
queue needs a staff surface — behind staff authentication, with the supervisor's role enforced, and
with `django.contrib.admin` still left uninstalled.

## Complaints to the Commission

The notice tells every member:

> If we do not answer properly, you can complain to the Data Protection Commission —
> Registration 0256301533, Compliance 0256302031.

**§39(3)** allows the Commission, where satisfied that a complainant is justified, to **order** the
controller to comply. That is why a reasoned refusal is written down: a refusal with reasons can be
reviewed; a refusal with none cannot.

**§43** allows a member who suffers damage or distress to seek compensation, and gives us a
defence: proving that we took reasonable care in all the circumstances to comply. This pack, the
register, the schedule, the consent records and the answered requests are that defence. They are
worth keeping for exactly that reason.