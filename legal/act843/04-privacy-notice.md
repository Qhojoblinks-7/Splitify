# The collection notice — §27(2)

**Statute:** Act 843 (2012) §27(2)(a)–(i) · **Canonical source:** `backend/compliance/notice.py`
**Served from:** `GET /api/privacy/notice/` (public) · **Shown in the app:** `/PrivacyPolicy`
**Version:** `2026-10-05` — recorded against every consent

---

## Why the notice lives in the code

Three copies of a privacy notice is two too many. The one that would drift first is the one a
member reads in the app; the one that must not drift is the version a consent is recorded against,
because that is the evidence. So there is a single source — `backend/compliance/notice.py` —
served to the app, quoted in the registration application, and stamped on every consent record.

This file **describes** the notice and maps each item to the provision that requires it and to the
code that implements it. It deliberately does not restate the member-facing text.

## §27(2) in full

> (2) A data controller who intends to collect personal data shall ensure that the data subject is
> aware of (a) the nature of the data being collected; (b) the name and address of the person
> responsible for the collection; (c) the purpose for which the data is required for collection;
> (d) whether or not the supply of the data by the data subject is discretionary or mandatory;
> (e) the consequences of failure to provide the data; (f) the authorised requirement for the
> collection of the information or the requirement by law for its collection; (g) the recipients of
> the data; (h) the nature or category of the data; and (i) the existence of the right of access
> to and the right to request rectification of the data collected before the collection.

Two things about the drafting that change how this is implemented:

- It applies **"before the collection"**. A notice reached by tapping a link after signup is
  therefore a notice given too late. The endpoint serving it is deliberately the only **public**
  endpoint in the system: it must be reachable by someone who has no account and no token.
- Item (i) is about the right of access and rectification **existing**. A member must be told
  before they hand over a mobile money number that they can see it and have it corrected — which
  is why both rights are in the app, not only in an email address at the bottom of a page.

## Item-by-item

| §27(2) | What the notice tells the member | Implemented by |
|---|---|---|
| **(a)** Nature of the data | The mobile money number, the optional name and email, the payments and their transaction references, the place in each rotation, and an append-only log of what was done in their group. **Never a Ghana Card number** | `NOTICE_SECTIONS[0]`, key `a` |
| **(b)** Responsible person | The controller's name and address, and the named data protection supervisor, in the contact block | `CONTROLLER` in `notice.py`; the foot of the screen |
| **(c)** Purpose | Nine purposes, each with its own lawful basis, each marked mandatory or optional | `PURPOSES` |
| **(d)** Mandatory or discretionary | Stated per purpose. A mobile money number to hold a seat is mandatory; a name, an email and a dispute are optional | `PURPOSES[*].mandatory` |
| **(e)** Consequences of refusal | Per purpose, in the product's own terms: no account, no seat, no round. And that an unnamed member is shown as a masked number, so nothing about them is invented or exposed | `PURPOSES[*].ifRefused` |
| **(f)** Lawful requirement | Consent recorded with the notice version and the time; and, where consent cannot be relied on, performance of the group's arrangement, the group's legitimate interest, and the record-keeping the law requires | `PURPOSES[*].legalBasis`, citing §20(1)(a)–(e) |
| **(g)** Recipients | The other members of their own group; the licensed mobile money partner, for one reference; the infrastructure provider; and a regulator or court where the law requires it. **No advertising, no sale, no analytics** | `RECIPIENTS` |
| **(h)** Nature and category | Contact and account data; financial records about a group they belong to, **which are not a credit assessment of them**; an administrative log. **No §37 special personal data is collected, inferred or held** | `NOTICE_SECTIONS[7]` |
| **(i)** Rights, before collection | Both rights are named, both are in the app under "Your privacy", and both are answered within 21 days | `NOTICE_SECTIONS[8]`, `RIGHTS_SUMMARY` |

Beyond the nine, the notice also publishes what the Act requires elsewhere and a member is
entitled to know: **retention** (§24), **security measures** (§28), **the recipients and
transfers in full**, **direct marketing (§40 — there is none)**, **automated decision-making
(§41 — there is none)**, and **how to complain to the Commission**.

## The two sentences that matter most to a member

A savings-group member is not looking for a data protection policy; they are looking for two
answers. Both are in the notice, in the first screen rather than the last:

> **Growl keeps the record of your contributions. It never holds your money.** Your payment goes
> from your mobile money to your group on your operator's rail, and we only write down what
> happened.

> **The other members of your own group can see your name, your position in the rotation, what you
> have paid, and what you still owe.** This is the record the group runs on, and it is the first
> thing you should know rather than the last.

The second sentence is a disclosure that most products of this shape do not make at all. It is
also the product's whole design: a rotation where members cannot see who has paid is a rotation
where members police each other.

## Consent, and what it is recorded against

`POST /api/privacy/consent/` with `{"action": "granted", "noticeVersion": "2026-10-05"}`.

- **A grant must name the version the server is serving.** Consent to a notice the member was
  never shown is not consent, so the endpoint rejects any other version rather than storing a
  meaningless field. A test asserts this.
- **A withdrawal is a new record, not an edit.** A cleared row cannot show that consent was given
  and later taken back, and that sequence is all §20(2)–(3) and §39 are about.
- **Records are append-only** at the model level, exactly as the ledger is. Editing a consent
  record raises rather than writes.
- **Consent is one instrument, not nine checkboxes.** The purposes are published together and
  agreed together; a granular toggle on a screen nine feet long is a way to appear compliant.

## The gaps in the notice, and what happens while they exist

The controller's legal name, its address, its TIN, the named supervisor and the hosting provider
are sentinels. A sentinel is never rendered to a member as though it were an answer:

- `public_notice()` reports `draft: true` and **names** the gaps
- the app shows a "still being completed" card rather than a blank
- `noticeSections()` **drops** any section whose text still contains a placeholder, so a raw
  `__dpo_name__` cannot reach a member's screen — asserted by a test
- `manage.py privacy_compliance_report` exits non-zero while any remain, which is intended to
  block a release

The honest alternative to a draft notice would be a complete one with invented particulars, which
is what §47(2) makes an offence.

## Versioning

| Version | Date | Change |
|---|---|---|
| 2026-10-05 | 5 Oct 2026 | First published version. Replaces an undated, unversioned screen that contained none of the nine items and two false claims about cookies and device data |

**On any future version:** bump `NOTICE_VERSION`, add a row here, and ask members to agree to it.
Existing consents remain valid for the version they were given — the record is what was agreed,
not a standing approval.