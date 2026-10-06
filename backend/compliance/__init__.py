"""Act 843 data protection: the collection notice, consent, rights, and retention.

A separate app from `susu` because its rules are a different kind of rule. The domain app
refuses a payment because a payment is wrong; this one refuses a request because the Act says
so, and it is the only place in the codebase where "the member asked nicely" is a legal trigger
rather than a courtesy.
"""
