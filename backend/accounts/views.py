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
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Account
from .phones import normalise_phone
from .social import verify_google_id_token, verify_apple_id_token, create_or_get_account, SocialVerificationError


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


class SocialAuthSerializer(serializers.Serializer):
    """Validate the social sign-in payload.

    `provider` is "google" or "apple". `id_token` is the raw ID token from the
    provider SDK. `phone` is optional — Google may supply one in the token,
    Apple returns it only on first sign-in.
    """

    provider = serializers.ChoiceField(choices=["google", "apple"])
    id_token = serializers.CharField(write_only=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)


class SocialAuthView(APIView):
    """`POST /api/auth/social/` — verify a provider ID token and issue JWTs.

    The frontend performs the OAuth flow with Google or Apple and obtains an ID
    token. This view verifies that token against the provider, creates or links
    a local Account, and returns JWT tokens in the same shape as the registration
    and token endpoints.

    AllowAny so an anonymous visitor can reach it: it is the one API surface
    that must be open.
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        payload = SocialAuthSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        provider = payload.validated_data["provider"]
        id_token = payload.validated_data["id_token"]
        phone = payload.validated_data.get("phone") or None

        if provider == "google":
            try:
                sub, email, name = verify_google_id_token(id_token)
            except SocialVerificationError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        elif provider == "apple":
            try:
                sub, email, name = verify_apple_id_token(id_token)
            except SocialVerificationError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            return Response(
                {"detail": "Unknown provider."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            account = create_or_get_account(
                email=email,
                phone=phone,
                full_name=name,
                verified=True,
            )
            tokens = RefreshToken.for_user(account)

        # A social sign-in may create an account with a placeholder phone.
        # The frontend needs to know to send the member to profile completion.
        requires_profile = account.phone == "+233000000000"

        return Response(
            {
                "access": str(tokens.access_token),
                "refresh": str(tokens),
                "requires_profile_completion": requires_profile,
            },
            status=status.HTTP_200_OK,
        )


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["full_name", "phone"]

    def validate_phone(self, value):
        try:
            return normalise_phone(value)
        except (ValueError, TypeError):
            raise serializers.ValidationError("Enter a valid Ghanaian mobile money number.")

    def update(self, instance, validated_data):
        instance.full_name = validated_data.get("full_name", instance.full_name)
        instance.phone = validated_data.get("phone", instance.phone)
        instance.save()
        return instance


class ProfileView(APIView):
    """`PATCH /api/members/me/profile/` — update the caller's profile.

    Currently limited to `full_name` and `phone`. The phone number must be unique
    and pass the same normalisation as registration. Used by social sign-in
    users who registered with a placeholder phone and need to supply their real
    number before they can receive payouts.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = ProfileSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Profile updated."}, status=status.HTTP_200_OK)
