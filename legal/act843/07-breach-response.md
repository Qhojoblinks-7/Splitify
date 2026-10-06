# Breach response — §31

**Statute:** Act 843 (2012) §31 · **Owner:** the data protection supervisor
**Notice authority:** the supervisor alone. Nobody else may decide that a compromise is not
reportable.

---

## What triggers this

**§31(1):** "Where there are reasonable grounds to believe that the personal data of a data subject
has been accessed or acquired by an unauthorised person, the data controller … shall notify the
(a) Commission, and (b) the data subject of the unauthorised access or acquisition."

**The standard is reasonable grounds to believe, not proof.** Waiting for proof is the single most
common way controllers lose a §31 argument, because by the time access is proven the member has
been exposed for months. §31(2) requires notification "as soon as reasonably practicable after the
discovery".

## The clock, and why it is tighter than the Act

| Instrument | Deadline |
|---|---|
| **Act 843 §31(2), in force** | "As soon as reasonably practicable after the discovery of the unauthorised access or acquisition" — no fixed number of hours |
| **Draft Data Protection Bill s.51(2)** | "Immediately or **within 72 hours** after the discovery", notifying "without any undue delay", with an **administrative penalty of not less than 2,000 and not more than 100,000 penalty units** for failing to notify within the timeframe |

The Bill is in draft and not law. **Run the internal clock to 24 hours anyway**, and notify the
Commission within 48–72 hours of discovery, because:

- "As soon as reasonably practicable" is judged after the fact, and an internal target is the only
  evidence that we tried to meet it
- a draft with a stated 72-hour rule and a five-figure penalty floor is a strong signal of where
  the standard is going, and migrating to it later means rebuilding the evidence trail
- **§31(4)** lets the notification to the member be **delayed** where the security agencies or the
  Commission say notification would impede a criminal investigation. That allowance is for the
  member notification, and only on their instruction. **Nothing in §31 delays notifying the
  Commission.**

## First hour

| # | Action |
|---|---|
| 1 | **Preserve evidence.** Do not clean up, do not rotate the secret key, do not delete logs. The state of the system is the evidence. |
| 2 | **Establish scope.** Which records, which data subjects, which fields. Write it down. |
| 3 | **Name one incident lead.** The supervisor by default. |
| 4 | **Contain** — but record what you did and when. A containment step that destroys evidence is a second incident. |
| 5 | **Start the notification clock.** Written, with the time. This is the artefact that proves §31(2) was taken seriously. |
| 6 | **Tell the founder.** Same day. Not after the assessment. |

## The decision: notify or not

Notify the Commission where there are **reasonable grounds to believe** personal data was accessed or
acquired by an unauthorised person.

**Notify the affected members — all of them — where any of their personal data was involved.** The
Act gives no threshold to hide behind and no de minimis exception. Judgement about *scale* is
permitted; judgement about *whether the statutory test is met* is not.

**Where the exposure is limited to a group member's own data and to members of their own group**,
that is still a notification. The data was accessed by an unauthorised person. The facts that
mitigate severity — small group, limited fields, no credentials involved — belong in the wording of
the notification, not in the decision whether to send one.

**Where no personal data was involved at all** — a password reset storm, a load-balancer
misconfiguration serving static assets, a brute-force attempt that touched nothing — there is
nothing to notify, and §31(1) is not engaged. Record the decision and the reasoning.

## The notification to the Commission

Draft below. **§31(6)–(7):** it must contain enough information for the data subject to take
protective measures, and the identity of the unauthorised person where known.

---

**To:** The Data Protection Commission — Compliance, 0256302031 ·
`compliance@dpcom.gov.gh` · **Portal:** `dataprotection.org.gh`

**Re:** Notification of unauthorised access to personal data — Data Protection Act, 2012 (Act 843)
**§31**

**1. Controller.** [LEGAL NAME], [registered address]. Registered with the Commission under §27 as
[REGISTRATION NUMBER]. Data protection supervisor: [NAME], [CONTACT].

**2. Discovery.** The compromise was discovered on [DATE] at [TIME] by [how]. Notification is made
under §31(2) [as soon as reasonably practicable / within 72 hours of] discovery.

**3. Nature of the compromise.** [What happened, in plain terms. What the failure was — an
authentication defect, a misconfigured service, an insider act, a credential compromise.]

**4. Categories of data subject affected.** [Number, and categories: members of Growl susu groups;
group administrators.]

**5. Categories of personal data involved.** [Be specific. "Mobile money numbers, names,
contribution amounts and the group audit log" is answerable. "Some user data" is not.]

**6. Approximate number of records concerned.** [ ]

**7. Likely consequences.** [What the affected person could suffer, concretely. For this system the
realistic harms are targeted social engineering and attempts to move money by mobile money — an
exposed number plus a name is a phishing attack with a name on it, which is why the member
notification tells them to distrust a call claiming to be from us.]

**8. Identity of the unauthorised person, where known.** [Or: not known. See §9.]

**9. Steps taken to contain, and when.** [Chronological.]

**10. Steps taken to remedy, and when.** [Including forcing credential rotation, revoking refresh
token families, and what was rebuilt.]

**11. Whether the affected persons have been notified, and when.** [Date, channel. If notification
is delayed under §31(4), state that and who instructed it.]

**12. Contact for follow-up.** [Name, direct line, email.]

---

## The notification to the data subject

**§31(5):** by registered mail to the last known address, by electronic mail to the last known
address, by notice on the website, by publication, or **in any other manner the Commission
directs**. §31(6) requires sufficient information for the person to take protective measures.

**Email plus an in-app notice**, because email is where a member can act and an in-app notice is
where they will actually look. A member with a compromised number needs three things: what happened,
what it means for them, and what to do.

---

**Subject:** An incident affecting your Growl account

**1. What happened.** On [DATE] we found that [plain description]. We found it on [DATE] and
contained it on [DATE].

**2. What this means for you.** [Specifically. If your mobile money number was involved: someone may
have it. We do not hold your money and never could, so nothing can be taken from your Growl balance
— but a number and a name together are enough for someone to call you pretending to be us.]

**3. What we are doing.** [ ]

**4. What you should do — please read this part.**
&nbsp;&nbsp;· [If a number was involved:] contact your mobile money operator and ask them to confirm
what is registered against your number.
&nbsp;&nbsp;· **We will never call or message you asking for your PIN, your password, or a code to
confirm a payment.** If someone does, hang up. It is not us.
&nbsp;&nbsp;· Change your Growl password.
&nbsp;&nbsp;· [If relevant: watch for a reference to your account in your group's log, and ask your
group admin if anything looks unfamiliar.]

**5. What we are not telling you and why.** [Only if a §31(4) delay has been instructed — say so
explicitly, and by whom. Otherwise this section is omitted rather than left vague.]

**6. Who to contact.** [NAME], data protection supervisor, [EMAIL], [PHONE]. Your rights: you can
ask for a copy of your data, ask us to correct it, or ask us to delete it — see Your privacy in the
app. You can also complain to the Data Protection Commission, Registration 0256301533.

---

## What must be in the incident file

Retained as long as the ledger is, and produced on request:

1. Discovery time and how it was found
2. Scope: records, data subjects, fields
3. The containment and remediation log, chronological, with times
4. **The decision to notify, or not to notify, with the reasoning and the name of the person who
   made it**
5. The notifications sent, with their content and dates
6. Any §31(4) delay, and the instruction that caused it
7. What was changed afterwards, and why

**§43 defence.** If a member claims damage or distress, the defence is proving we took reasonable
care in all the circumstances. An incident file that shows what we knew, when we knew it and who
decided is the difference between a defence and an admission.

## Pre-launch requirement

**Run this procedure as a tabletop exercise before launch, and record the date.** A breach
procedure that has never been walked through has an unknown response time, and response time is
what §31(2) and the draft Bill's 72 hours both turn on. Put it in the supervisor's evidence list
([02](02-dpo-appointment.md)) and in the beta launch gate.

## Scenarios worth rehearsing, specific to this product

| Scenario | The trap |
|---|---|
| A database backup with no longer leaves the hosting provider's region | A **transfer** question as well as a security one. §47(1)(g) names where data goes; the partner's subprocessors were already an open gap |
| An admin account compromised | The account's trust score and flags are the target, and the audit log is the defence. But an admin can verify others' payments, so a compromised admin is a payment-integrity problem |
| A member's mobile money number used to impersonate them to their group | **Already possible by design**: the group's own surface shows name and payment state. The member notification must say so, and §31(6) requires enough detail for them to act |
| A leaked reference list | References are pseudonymous but joinable to amounts and a group's timeline. Treat as a §31 event |
| Insider access to the database by a staff member or contractor | The hardest to detect and the most damaging to the "we never hold your money" claim, which is the whole of the trust position |