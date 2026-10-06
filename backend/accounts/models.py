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

    class IDType(models.TextChoices):
        GHANA_CARD = "ghana_card", "Ghana Card"
        PASSPORT = "passport", "Passport"
        DRIVERS_LICENCE = "drivers_licence", "Driver's Licence"
        VOTER_ID = "voter_id", "Voter ID Card"
        SSNIT = "ssnit", "SSNIT Card"
        OTHER = "other", "Other Government ID"

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

    # CDD / KYC fields (AML/CFT Act 1044)
    id_type = models.CharField(max_length=20, choices=IDType.choices, blank=True, default="")
    id_document_hash = models.CharField(max_length=64, blank=True, default="")  # SHA-256 of ID document
    id_document_last4 = models.CharField(max_length=4, blank=True, default="")  # Last 4 of ID number
    id_verified_at = models.DateTimeField(null=True, blank=True)
    id_verified_by = models.CharField(max_length=120, blank=True, default="")  # Who verified (admin, DPO, automated)

    # Sanctions screening (Act 1044 s.38)
    sanctions_screened = models.BooleanField(default=False)
    sanctions_screened_at = models.DateTimeField(null=True, blank=True)
    sanctions_match = models.BooleanField(default=False)
    sanctions_match_details = models.TextField(blank=True, default="")

    # Payout destination (mobile money number for receiving payouts)
    payout_destination = models.CharField(max_length=20, blank=True, default="")
    payout_destination_verified_at = models.DateTimeField(null=True, blank=True)

    trust_score = models.PositiveSmallIntegerField(default=100)
    flagged_total = models.PositiveSmallIntegerField(default=0)

    # Act 843 s.24. Both dates are about retention, not about the product.
    #
    #   last_active_at  written at most once a day by the last-seen middleware, so the
    #                   retention job can tell a dormant account from a busy one. Without it
    #                   the only clock available is `updated_at`, which any write moves —
    #                   including a write the account did not make.
    #   anonymised_at   set the moment an erasure request is carried out. The account survives
    #                   as the group's record and stops being a person; see
    #                   `compliance.retention` for why the row is not simply deleted.
    last_active_at = models.DateTimeField(null=True, blank=True)
    anonymised_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []

    objects = AccountManager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.display_name

    @property
    def masked_phone(self):
        return f"{self.phone[:4]} \u2022\u2022\u2022 \u2022\u2022{self.phone[-2:]}" if len(self.phone) > 6 else self.phone

    @property
    def display_name(self):
        """What this member is called in a surface other members can read.

        Never the phone number, even when there is no name. `__str__` used to fall back to the
        number, and that value reached every group member twice: once in the frozen roster
        snapshot that names each member, and once in the audit feed's `actorName`. A member who
        signed up with a number and never typed a name was therefore broadcasting their mobile
        money number to everyone in their susu group \u2014 the one identifier in the system that can
        be used to move money by phone.

        Masked rather than omitted, because a rotation of fifty identical "Member" rows is
        unreadable and the member is not hiding \u2014 they have a number, just not a name.
        """
        if self.full_name.strip():
            return self.full_name.strip()
        if self.anonymised_at is not None:
            return "Former member"
        if self.phone.startswith("anon-"):
            return "Former member"
        return f"Member {self.masked_phone}"

    @property
    def is_anonymised(self):
        return self.anonymised_at is not None

    @property
    def cdd_complete(self) -> bool:
        """Whether minimum CDD is satisfied for Act 1044 purposes."""
        return bool(self.id_type and self.id_document_hash and self.id_verified)

    @property
    def sanctions_clear(self) -> bool:
        """Whether the account is clear of sanctions matches."""
        return self.sanctions_screened and not self.sanctions_match