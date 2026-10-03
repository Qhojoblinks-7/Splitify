"""Ghanaian mobile money number parsing.

The only identity we hold is a phone number, so its normalisation is a security control
rather than a convenience. Formatting variance is an account-linking bypass: `0244 123 567`,
`+233244123567` and `233-244-123-567` are one person, and if the database treats them as three
then a duplicate membership is one typing mistake away.

Rule IDs: security doc I2 (E.164), I3 (one number, one account).
"""

import re

# Ghana's mobile network codes. Anything else is not a mobile money wallet.
MOBILE_PREFIXES = ("20", "23", "24", "26", "27", "28", "50", "54", "55", "57", "59")
# A Ghanaian number is written 0XX XXX XXXX: ten digits with the trunk zero. E.164 drops
# the zero and the country code, leaving nine national digits (244 123 456).
NATIONAL_LENGTH = 9


def normalise_phone(raw):
    """Coerce a user-typed Ghanaian mobile number into E.164.

    Accepts `0244123456`, `+233 244 123 456`, `233-24-412-3456`. Raises on anything else.
    """
    if not raw:
        raise ValueError("A mobile money number is required")

    digits = re.sub(r"[^0-9]", "", str(raw))

    if digits.startswith("233"):
        national = digits[3:]
    elif digits.startswith("0"):
        national = digits[1:]
    else:
        national = digits

    if len(national) != NATIONAL_LENGTH or not national.startswith(MOBILE_PREFIXES):
        raise ValueError("Not a Ghanaian mobile money number")

    return f"+233{national}"


def validate_phone(raw):
    """Return the E.164 form, or None if this is not a Ghanaian mobile number.

    Landlines are rejected on purpose: a MoMo wallet is what members pay from, so a number
    we cannot pay out to is not a valid identity for this product.
    """
    try:
        return normalise_phone(raw)
    except (ValueError, TypeError):
        return None