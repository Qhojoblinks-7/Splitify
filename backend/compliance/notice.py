"""The collection notice, in one place, versioned.

Act 843 s.27(2) lists nine things a data controller must make a data subject aware of *before*
collection. They are written once here and served from `GET /api/privacy/notice/`, because a
notice that exists in three places is a notice that will be wrong in one of them: the app
screen, the website copy and the version the member actually consented to all drift, and the
third one is the only one that is evidence.

A sentinel — an empty value or one wrapped in `__SENTINEL__` — means the fact is not yet known.
It is never rendered to a member as though it were an answer. `public_notice()` reports the
gaps, `manage.py privacy_compliance_report` refuses to certify while any remain, and a test
asserts no sentinel ever reaches the served payload.

Sections of this module, in the order the Act imposes them:

    CONTROLLER   who is the controller (s.47(1)(a))
    PURPOSES     what we process and why (s.22, s.47(1)(e), s.47(3) one entry per purpose)
    DATA         what we actually hold, from the models and endpoints that exist
    NOTICE       the member-facing text, keyed to s.27(2)(a)-(i)
"""

from __future__ import annotations

NOTICE_VERSION = "2026-10-05"

#: The controller's own particulars, for s.47(1)(a) and the foot of every notice.
#: Facts only the founder can supply stay as sentinels rather than plausible guesses: a
#: registration form answered with an invented company name is a false particular, and s.47(2)
#: makes knowingly supplying one an offence.
CONTROLLER = {
    "name": "__controller_legal_name__",
    "entityType": "Limited liability company (Ghana)",
    "registrationNumber": "",
    "tin": "",
    "address": "",
    "email": "privacy@growl.app",
    "dpoName": "__dpo_name__",
    "dpoEmail": "privacy@growl.app",
    "dpcRegistrationNumber": "",
    "hostingProvider": "__hosting_provider__",
}

#: s.27(2)(c)/(d): each purpose says whether the data behind it is mandatory or discretionary,
#: because the member's answer has to be different for each. `s.27(2)(e)` is the consequence of
#: saying no, which is a fact about the product rather than about the law.
PURPOSES = {
    "account": {
        "title": "Create and keep your account",
        "legalBasis": "Consent (s.20(1)); performance of the contract you enter into by signing up",
        "mandatory": True,
        "ifRefused": "You cannot hold a seat in a susu group, because the rotation is made of accounts.",
        "data": [
            "your mobile money number (the primary identifier, stored in E.164)",
            "your name, if you give one",
            "your email address, if you give one",
            "your password, as a one-way hash we cannot read",
            "the version of this notice you agreed to, and when",
        ],
    },
    "group": {
        "title": "Create a susu group, and let its members see who is in it",
        "legalBasis": "Consent; the shared record is the product the group asked for",
        "mandatory": True,
        "ifRefused": "You cannot create or join a group.",
        "data": [
            "your membership: which group, your position in the rotation, your role, when you joined",
            "your name (or a masked number if you gave no name) to the other members of that group",
            "the group name, target amount and collection day",
            "a fixed snapshot of the roster taken when each round opens",
        ],
    },
    "contributions": {
        "title": "Record what each member paid into the pot",
        "legalBasis": "Consent; necessary for the performance of the group's arrangement",
        "mandatory": True,
        "ifRefused": "You cannot take part in a round, and the pot cannot reach its target.",
        "data": [
            "the amount you paid, in pesewas, and the date you recorded it",
            "your mobile money provider",
            "the transaction reference from your mobile money operator",
            "the status of that payment, and who checked it",
        ],
    },
    "verification": {
        "title": "Check a payment against your mobile money operator",
        "legalBasis": "Legitimate interest of the group in not counting a payment that never happened",
        "mandatory": True,
        "ifRefused": "Your payment stays unverified, the round is blocked, and no pot is released.",
        "data": [
            "your transaction reference and the amount claimed",
            "the operator's answer, which is whether it settled, was rejected, or is not yet known",
        ],
    },
    "payout": {
        "title": "Record the pot leaving for the member whose turn it is",
        "legalBasis": "Consent; performance of the group's arrangement",
        "mandatory": True,
        "ifRefused": "The round cannot be closed and the pot cannot be released.",
        "data": [
            "the amount released, the transfer fee, and the payout reference",
            "who received it and when",
        ],
    },
    "disputes": {
        "title": "Resolve a disputed payment, and keep the decision visible",
        "legalBasis": "Legitimate interest of the group; necessary to establish legal rights (s.37(6)(c))",
        "mandatory": False,
        "ifRefused": "A disputed payment stays disputed, the round stays blocked, and no one is paid.",
        "data": [
            "who raised a dispute, the reason given, and the decision",
            "the admin trust score, which starts at 100 and drops by 25 per flagged payment",
        ],
    },
    "fraud": {
        "title": "Stop a false reference, an impersonated group, or an admin taking the pot",
        "legalBasis": "Legitimate interest of the group, and of every member in it",
        "mandatory": True,
        "ifRefused": "Not available — the group cannot operate without it.",
        "data": [
            "duplicate and replayed references",
            "invite codes, and the collection account each group is bound to",
            "an append-only log of every administrative action, visible to every member of the group",
        ],
    },
    "records": {
        "title": "Keep the records the law requires us to keep",
        "legalBasis": "Required by law (s.24(1)(a)); the Anti-Money Laundering Act, 2020 (Act 1044)",
        "mandatory": True,
        "ifRefused": "Not available — this is a legal obligation.",
        "data": [
            "the double-entry ledger and the audit trail, for seven years",
            "your anonymised account, once you have asked us to delete it",
        ],
    },
    "service": {
        "title": "Contact you about your own account",
        "legalBasis": "Legitimate interest of the data subject (s.20(1)(c))",
        "mandatory": False,
        "ifRefused": "You stop hearing from us; nothing else changes.",
        "data": [
            "your contact details, and what we send you",
        ],
    },
}

#: s.40: no direct marketing, ever. Stated in the notice and enforced by the absence of any
#: marketing purpose above, so there is no consent to withdraw and nothing to be sold.
MARKETING = "none"

#: s.27(2)(f): the lawful basis for collection, and s.27(2)(g): who else sees the data.
RECIPIENTS = {
    "group_members": (
        "The other members of your own group. They see your name (or a masked number), your "
        "position in the rotation, what you have paid, what you still owe, and every "
        "administrative action in the group's log. This is the record the group runs on."
    ),
    "payment_partner": (
        "Your licensed mobile money partner — Hubtel, or Fincra as fallback — which receives "
        "the transaction reference and amount so it can tell us whether your payment settled. "
        "The agreement with them is not yet signed, so no payment is checked automatically yet."
    ),
    "hosting": "The infrastructure provider that stores the database, named in the controller block above.",
    "law": (
        "The Data Protection Commission, the Bank of Ghana, and a court, where the law requires "
        "it. Nobody else."
    ),
}

#: s.47(1)(g): where data leaves Ghana. Named rather than paraphrased, because a transfer the
#: member cannot name is a transfer the member cannot object to.
TRANSFERS = {
    "payment_partner": (
        "Transaction references and amounts are sent to the payment partner to be checked. The "
        "partner's own servers and subprocessors must be named in the agreement; that list is "
        "part of the launch gate, not an afterthought."
    ),
    "infrastructure": "Database and backups, with the hosting provider named in the controller block.",
    "none_in_app": "The app itself sends nothing to any analytics, advertising or crash-reporting service.",
}

#: s.24, in the words a member can check. Mirrors `retention.RETENTION`; a test fails if the two
#: disagree, because a published schedule that is not the enforced one is a lie with a footer.
RETENTION_SUMMARY = {
    "ledger_and_audit": "7 years from the round, then deleted or anonymised.",
    "group_and_contributions": "For as long as the group exists, plus 7 years.",
    "account": "Until you ask us to delete it, plus 7 years of the anonymised record.",
    "sessions": "Refresh tokens live 7 days; revoked tokens are purged weekly.",
    "consent_and_rights_requests": "3 years, so we can show what you agreed to and how we answered.",
    "verification_answers": "Deleted after each round closes.",
}

#: s.28 in plain terms, and s.32-35/39/44 in the terms of a request.
SECURITY_SUMMARY = (
    "Passwords are stored as one-way hashes. Access and refresh tokens are short lived and the "
    "refresh token is single use, so a stolen copy is usable at most once. Every payment write "
    "carries a key that makes a replayed request return the original result instead of a second "
    "payment. The money record and the administrative log cannot be edited or deleted once "
    "written: a correction is a new, visible entry. Access is by membership, so one member "
    "cannot read another member's payments outside a group they share."
)

RIGHTS_SUMMARY = {
    "access": "Ask what we hold about you, and get it in a form you can read. s.32, s.35.",
    "rectify": "Ask us to correct data that is wrong, out of date, or misleading. s.33(1)(a).",
    "erase": (
        "Ask us to delete your data. We will anonymise your account immediately. We cannot "
        "delete the ledger entries or the group's payment history, because the other members "
        "hold a right to that record and the law requires us to keep it for seven years. "
        "s.24(1)(a), s.33(1)(b), s.43."
    ),
    "object": "Tell us to stop a use you object to. We answer in writing within 21 days. s.39(2).",
    "withdraw_consent": "Withdraw your consent at any time. It does not undo what was lawfully done before.",
    "stop_marketing": "There is no marketing to stop. s.40 is satisfied by there being none.",
    "automated_decisions": (
        "We do not take decisions by automated means that significantly affect you. A flag is "
        "placed by a named admin, is visible to the whole group, and can be disputed. s.41."
    ),
    "complaint": (
        "If we do not answer properly, complain to the Data Protection Commission, "
        "Registration: 0256301533, Compliance: 0256302031."
    ),
}

#: s.27(2)(a)-(i), in order, each mapped to the Act. Keys are the section letters so a test can
#: assert completeness against the Act rather than against our memory of it.
NOTICE_SECTIONS = [
    {
        "key": "a",
        "act": "s.27(2)(a)",
        "title": "What we collect",
        "body": (
            "Your mobile money number, your name and email if you give them, the payments you "
            "record and their transaction references, your place in each group's rotation, and "
            "an append-only log of what was done in your group. We never store a Ghana Card "
            "number, and we never ask for one."
        ),
    },
    {
        "key": "b",
        "act": "s.27(2)(b)",
        "title": "Who is responsible",
        "body": "The controller is named in the contact block at the foot of this notice.",
    },
    {
        "key": "c",
        "act": "s.27(2)(c)",
        "title": "Why we collect it",
        "body": (
            "To run the savings group you are in: to hold the rotation, to record what was paid, "
            "to check that payment against your mobile money operator, to release the pot, and to "
            "keep the record the law requires. Every purpose is listed above with its own basis."
        ),
    },
    {
        "key": "d",
        "act": "s.27(2)(d)",
        "title": "Whether you must give it",
        "body": (
            "Some of it you must give: a mobile money number to hold a seat, and a payment "
            "reference to count towards a round. Some is optional: your name, your email, and a "
            "dispute. Each purpose above says which is which."
        ),
    },
    {
        "key": "e",
        "act": "s.27(2)(e)",
        "title": "What happens if you do not",
        "body": (
            "No account, no seat, no round. An account with no name on it is shown to the group as "
            "a masked number, so nothing about you is invented and nothing is exposed."
        ),
    },
    {
        "key": "f",
        "act": "s.27(2)(f)",
        "title": "The lawful basis",
        "body": (
            "Your consent, given in the app and recorded with the version of this notice and the "
            "time; and, where we cannot rely on consent, the performance of the arrangement your "
            "group entered into, a legitimate interest of your group, and the record-keeping the "
            "law requires of us."
        ),
    },
    {
        "key": "g",
        "act": "s.27(2)(g)",
        "title": "Who else sees it",
        "body": (
            "The other members of your own group, your licensed mobile money partner (to check "
            "one reference), our infrastructure provider, and the regulators or a court where the "
            "law requires it. We do not sell your data, and there is no advertising in this app."
        ),
    },
    {
        "key": "h",
        "act": "s.27(2)(h)",
        "title": "The nature and category of the data",
        "body": (
            "Contact and account data; financial records about a group you belong to, which are "
            "not a credit assessment of you; and an administrative log. We hold no special personal "
            "data within the meaning of s.37 — nothing about your health, beliefs, politics, "
            "union membership, sex life, or criminal behaviour is collected, inferred or held."
        ),
    },
    {
        "key": "i",
        "act": "s.27(2)(i)",
        "title": "Your rights, available now",
        "body": (
            "You can see what we hold and ask us to correct it before you give it, and at any "
            "time afterwards. Both are in the app, under Your privacy, and both are answered "
            "within 21 days."
        ),
    },
]

NOTICE_TITLE = "Privacy Notice"


def _is_gap(value) -> bool:
    if not value:
        return True
    text = str(value)
    return text.startswith("__") and text.endswith("__")


def notice_gaps() -> list[str]:
    """Every controller particular we do not yet know. Empty means certifiable."""
    return [f"controller.{key}" for key, value in sorted(CONTROLLER.items()) if _is_gap(value)]


def public_notice() -> dict:
    """The payload served to the app and quoted in the registration application.

    `draft` is true while a sentinel remains, and the gaps are named rather than hidden: a
    notice that quietly omits the controller's address is worse than one that says the address
    is not published yet, because the omission is invisible to the person reading it.
    """
    gaps = notice_gaps()
    return {
        "version": NOTICE_VERSION,
        "title": NOTICE_TITLE,
        "draft": bool(gaps),
        "gaps": gaps,
        "controller": {key: value for key, value in CONTROLLER.items() if not _is_gap(value)},
        "purposes": PURPOSES,
        "recipients": RECIPIENTS,
        "transfers": TRANSFERS,
        "marketing": MARKETING,
        "retention": RETENTION_SUMMARY,
        "security": SECURITY_SUMMARY,
        "rights": RIGHTS_SUMMARY,
        "sections": NOTICE_SECTIONS,
    }
