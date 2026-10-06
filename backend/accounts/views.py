"""
Account registration endpoint.

`POST /api/auth/register/` — creates an Account and returns JWT tokens in the
same shape as `/api/auth/token/`, so the client can sign in without a round-trip.

The phone number is normalised through `phones.normalise_phone` so that
formatting variance cannot create a duplicate account (rule I2, I3). Password
validity is enforced by Django's `AUTH_PASSWORD_VALIDATORS`
(12 chars minimum, no common passwords) — the same rules the management
command `create_test_account` uses.

AllowAny and empty authentication_classes are set so an anonymous visitor can
reach this endpoint: it is the one API surface that must be open.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Account
from .phones import normalise_phone


class RegisterSerializer(serializers.Serializer):
    """Validate the sign-up payload before the Account is ever created."""

    phone = serializers.CharField(max_length=20)
    email = serializers.EmailField(max_length=254, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=12)

    def validate_phone(self, value):
        try:
            return normalise_phone(value)
        except (ValueError, TypeError):
            raise serializers.ValidationError("Enter a valid Ghanaian mobile money number.")

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        phone = validated_data["phone"]
        password = validated_data["password"]
        email = validated_data.get("email") or None
        try:
            account = Account.objects.create_user(phone=phone, password=password, email=email)
        except IntegrityError:
            raise serializers.ValidationError({"phone": "An account with this number already exists."})
        return account


class RegisterView(APIView):
    """`POST /api/auth/register/` — create an account and issue tokens."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        payload = RegisterSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        with transaction.atomic():
            account = payload.save()
            tokens = RefreshToken.for_user(account)

        return Response(
            {"access": str(tokens.access_token), "refresh": str(tokens)},
            status=status.HTTP_201_CREATED,
        )
