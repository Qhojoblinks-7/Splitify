"""Accounts: phone-first identity. Phone is the primary identifier; email is optional.

Rule IDs refer to `1791028270-security-fraud-and-identity.md`.
  I1    the mobile money number is the primary identity; email is recovery only
  I2    numbers are stored in E.164, because formatting variance is an account-linking bypass
  I3    one number, one account
  I5    identity only ever advances unverified -> phone_verified -> id_verified
  I86   a full Ghana Card number is never stored
"""

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models

from .phones import normalise_phone


class AccountManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra):
        if not phone:
            raise ValueError("A mobile money number is required")
        normalised = normalise_phone(phone)
        if not extra.get("email"):
            extra["email"] = None
        self.model.objects.create(phone=normalised, **extra)
        user = self.model.objects.get(phone=normalised)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user


class Account(AbstractBaseUser):
    """A member.

    There is deliberately no `ghana_card_number` field. Act 843 breach exposure for a
    national ID number is not a risk worth taking for a matching convenience, and a field
    that does not exist cannot be leaked. See rule I86.
    """

    phone = models.CharField(max_length=20, unique=True)
    # Nullable, not blank-string-defaulted: SQLite and PostgreSQL both permit many NULLs in
    # a unique index but only one empty string. Email is optional (I1), so most accounts have
    # none and must not collide with each other.
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True, default=None)

    full_name = models.CharField(max_length=120, blank=True, default="")

    phone_verified = models.BooleanField(default=False)
    id_verified = models.BooleanField(default=False)

    # Last two digits plus a hash are sufficient to match and expose nothing if breached.
    ghana_card_last4 = models.CharField(max_length=4, blank=True, default="")
    ghana_card_hash = models.CharField(max_length=64, blank=True, default="")

    payout_destination = models.CharField(max_length=20, blank=True, default="")
    payout_destination_verified_at = models.DateTimeField(null=True, blank=True)

    trust_score = models.PositiveSmallIntegerField(default=100)
    flagged_total = models.PositiveSmallIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []

    objects = AccountManager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.full_name or self.phone

    @property
    def masked_phone(self):
        return f"{self.phone[:4]} ••• ••{self.phone[-2:]}" if len(self.phone) > 6 else self.phone