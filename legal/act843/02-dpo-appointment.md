# Data protection supervisor (DPO) — appointment and mandate

**Statute:** Act 843 (2012) §58 · **Status:** DRAFT. Requires a signature.

---

## The name the Act uses

Act 843 §58 says **data protection supervisor**, appointed from "certified and qualified" persons
against criteria set by the Commission, and §58(5) permits the supervisor to be an employee of the
controller. It does **not** create a general obligation to appoint one: the duty the Act imposes
is on the Commission, which may require a controller to designate a supervisor.

Two consequences, and they pull in opposite directions:

- The DPC's published guidance exempts **small** data controllers from appointing a *certified*
  supervisor, while **medium and large** controllers are required to designate one. Size is
  determined by the Commission, not by us, and we cannot elect into the smaller category on the
  strength of our own optimism about a launch that has not happened.
- The Commission may change its mind, or change the rules, at any point. §58(3)–(4) expressly
  allows it to impose duties on a supervisor and to confer functions on itself.

**Therefore we appoint one, and we do not rely on the exemption.** A named supervisor costs very
little at pilot scale. Relying on a size exemption that has not been granted is how an
organisation ends up defending a breach with nobody accountable for it.

**The Act 987 opinion previously cited "§20" as the DPO provision. There is no §20 provision on
this.** §20 is the lawful-basis provision (consent, justification and objection). This has been
corrected in `LEGAL_OPINION_ACT987.md` §6.

---

## Two roles, not one

The workload splits into two jobs that need different people and different authority:

| Role | Who | What it is |
|---|---|---|
| **Data protection supervisor** (§58) | An accountable person — internal at pilot scale, external when the volume justifies it | Owns the register, runs the compliance assessment, answers the Commission, signs the renewal. Must be able to say no to the founder |
| **Certified supervisor** | Engaged from the DPC's accredited list, as backup | Provides the certification §58(7) requires and the GAP analysis at renewal, without a permanent cost at pilot scale |

**Engage both.** An internal supervisor satisfies accountability while the volume is small; the
certified supervisor is what the Act's criteria and the renewal process actually ask for, and
having them under contract before renewal means renewal is a review rather than a scramble.

The DPC runs a Certified Data Protection Supervisor (CDPS) training programme, and reports having
trained over 800 officers. Confirm current fees and dates with the Commission
(Training 0256226922) before naming anyone as certified.

---

## Independence, and the conflict that is already in this product

**§58 does not create a general right of independence for the supervisor.** That is a weakness in
the Act, not an oversight in this mandate, and it has to be closed by contract and by reporting
line rather than assumed.

This product has a specific, concrete conflict that a generic independence clause would miss. The
**group admin** is the most powerful human actor in the product: they verify contributions, reverse
payments, flag disputes, and lose their role after two flags. A member who believes the admin
mishandled their contribution will want their data erased, or an access request answered
honestly, or the admin's trust record examined.

**The data protection supervisor must therefore not be a member or admin of any group in the
product, and must not be the person the complaint is about.** This is the reason the rights queue
is deliberately a management command rather than an admin site (see
[06-data-subject-rights.md](06-data-subject-rights.md)). The founder is the controller and must be
answerable, but must not be the sole reviewer of a complaint about a group the founder administers.

**Report to:** the board, or in its absence to the founder, in writing, at least quarterly —
regardless of whether anything has gone wrong. A supervisor who reports only on problems is
discovered at the worst moment.

---

## Mandate

### The supervisor must

1. **Maintain the register** in [03](03-data-processing-register.md) and the notice in
   [04](04-privacy-notice.md), and change both **before** a feature ships, not after.
2. **Own the rights queue**: `manage.py privacy_requests` — list, inspect, answer, execute an
   erasure. Answer within the §39(2) **21 days**, in writing, every time.
3. **Run the retention schedule** — `manage.py purge_expired_personal_data` — and report what it
   did. The report is the artefact; the deletion is the side effect.
4. **Keep the machine check honest**: `manage.py privacy_compliance_report` before every release.
   A non-zero exit blocks the release.
5. **Run the breach procedure** in [07](07-breach-response.md) and hold the notification
   authority. Nobody else may decide that a compromise is not reportable.
6. **Answer the Commission**, and keep the §55 14-day change notification current.
7. **Keep a record of training** for everyone who touches personal data, and of the annual review.
8. **Advise on new processing**, and record the advice whether or not it was taken. Advice that
   leaves no trace is not advice.

### The supervisor may

- **Stop a release.** Veto over shipping a feature that adds personal data without a register
  entry, a lawful basis, a retention period and a notice update. This is the real power of the
  role and it is worthless if exercised only in writing after the fact.
- **Refuse a group admin's request** for member data beyond what the group surface already shows.
- **Order the anonymisation** of an account on an erasure request, and refuse the outright
  deletion where the money record names the person.

### The supervisor may not

- Release a payout, or instruct one. There is no payout function to release.
- Verify, reverse or flag a contribution. The authority is split deliberately
  (`backend/susu/api.py`), and the supervisor has no more of it than any other member.
- Edit the ledger or the audit log. They are append-only by construction, and a data protection
  officer with write access to a money record is a worse arrangement than no data protection
  officer at all.
- Decide a case in which they are the subject of the complaint.

---

## Resources

The DPC's guidance expects a supervisor to have enough authority to be credible. Concretely:

| Resource | Pilot | Basis |
|---|---|---|
| Direct access to all personal data, subject to no approval | Yes | §35(1)(c) — the right of access is the supervisor's own |
| Query rights over every group and ledger table | Yes | §28(2)(c) — verify the safeguards, not just describe them |
| A standing line in the release checklist | Yes | Otherwise the veto above is a suggestion |
| External budget for a certified supervisor | GH¢2,000 – 5,000 / year | Fees unverified; confirm with the Commission |
| Board reporting | Quarterly, in writing | §58(2) — monitoring compliance is the job |

---

## Appointment letter

*Replace the bracketed fields. Sign before filing the application: §47(1)(j) asks for the
supervisor, and an application naming a supervisor who has not accepted is a false particular.*

---

**DATA PROTECTION SUPERVISOR — APPOINTMENT**

**Date:** [ ]

**Between:** [CONTROLLER LEGAL NAME] ("the Company"), a company incorporated in the Republic of
Ghana, of [REGISTERED ADDRESS], the data controller for the Growl mobile application (the
"Service")

**And:** [NAME], [PROFESSION AND QUALIFICATION], of [ADDRESS] ("the Supervisor")

**1. Appointment.** The Company appoints the Supervisor as its data protection supervisor under
section 58 of the Data Protection Act, 2012 (Act 843), with effect from [DATE]. The Supervisor
accepts the appointment on the terms set out below.

**2. Scope.** The appointment covers all processing of personal data by the Company in operating
the Service, whether carried out by the Company, by its officers and employees, or by a processor
acting on its authority. It covers the Company as a data controller; it does not extend to the
Company's own employment processing except where a data subject's rights under Act 843 are
engaged.

**3. Duties.** The Supervisor shall:

&nbsp;&nbsp;(a) maintain the data processing register and the collection notice published to data
subjects, and review both at least annually and on any material change;
&nbsp;&nbsp;(b) monitor the Company's compliance with Act 843 and report to [the Board / the
founder] in writing at least quarterly, whether or not any incident has occurred;
&nbsp;&nbsp;(c) receive, answer and record every request made by a data subject under sections 32
to 35, 39, 40 and 44, and answer each in writing within twenty-one days of receipt;
&nbsp;&nbsp;(d) administer and report on the retention schedule;
&nbsp;&nbsp;(e) advise the Company on the lawful basis, notice and safeguards for any new or
changed processing, and record that advice;
&nbsp;&nbsp;(f) implement and oversee the Company's breach response procedure, including the
notification of the Commission and of affected data subjects under section 31;
&nbsp;&nbsp;(g) maintain the record of training for staff who handle personal data; and
&nbsp;&nbsp;(h) liaise with the Data Protection Commission and keep the Company's registered
particulars current, including notification of changes within fourteen days under section 55.

**4. Authority.** For the purpose of performing these duties the Supervisor shall have access to
all personal data processed in the operation of the Service, without the need for prior approval,
and the Company shall not require the Supervisor to seek approval before accessing such data. The
Supervisor may require the Company to suspend the release of any feature that introduces personal
data without a lawful basis, a retention period and an updated notice.

**5. Independence.** The Supervisor shall not be a member or administrator of any savings group
operated through the Service, and shall not determine any matter in which they are themselves the
subject of a complaint. The Company shall not instruct the Supervisor in the exercise of the
duties above, and shall not remove, penalise or reduce the emoluments of the Supervisor except for
cause.

**6. Resources.** The Company shall provide the Supervisor with [the resources specified in the
schedule], and shall not permit the removal of the [certified data protection supervisor] engaged
as backup without the Supervisor's written agreement.

**7. Confidentiality.** The Supervisor shall keep confidential all personal data accessed and all
matters coming to their knowledge, save where disclosure is required by law or is necessary in the
performance of these duties.

**8. Term and termination.** This appointment takes effect on [DATE] and continues until
[TERMINATION], or until the Supervisor resigns in writing, or until the Company is no longer a
data controller in respect of the Service. The Company shall give not less than three months'
written notice of any termination, which shall not take effect during the currency of an
unanswered data subject request without the Supervisor's written agreement.

**9. Nothing in this letter** creates an employment relationship, or removes any right of a data
subject under Act 843.

**Signed for the Company:** ____________________  Name: [ ] Title: [ ] Date: [ ]

**Signed by the Supervisor:** ____________________  Name: [ ] Date: [ ]

---

## Evidence the Commission will look for

A mandate on paper is not evidence. Keep, and be ready to produce:

1. The signed letter
2. Certification, or the DPC training record, for a supervisor who holds one
3. A quarterly written report — even when it says "nothing to report"
4. The register, with dated review entries
5. The training register for staff who touch personal data
6. One answered data subject request, end to end, with its dates
7. The breach procedure, with a tabletop exercise completed at least once
8. The Compliance Assessment (GAP analysis) filed for the next renewal under §50

**A supervisor with no artefact trail is, from the Commission's point of view, no supervisor.**