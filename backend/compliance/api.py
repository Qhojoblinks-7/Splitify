"""The member's side of Act 843, as HTTP.

Four things a member can do, and one thing the app must be able to show them before they have
an account:

    GET  /api/privacy/notice/            the notice, with its version. Public, because a notice
                                         shown after signup is a notice given too late (s.27(2)).
    GET  /api/privacy/export/            what we hold about the caller (s.32, s.35)
    GET  /api/privacy/consent/           what they agreed to, and which version
    POST /api/privacy/consent/           give or withdraw consent (s.20)
    GET  /api/privacy/requests/          their own requests, with the s.39(2) clock
    POST /api/privacy/requests/          make one (s.32-35, s.39, s.40, s.44)

The notice is served from the same module the registration application quotes, so the version
a member consented to is the version the Commission was shown. Two copies of a notice is one
copy too many.
"""

from __future__ import annotations

from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .export import build_access_report
from .models import ConsentRecord, DataSubjectRequest, current_consent
from .notice import NOTICE_VERSION, PURPOSES, public_notice

ALL_PURPOSES = sorted(PURPOSES)


class PublicNoticeView(APIView):
    """`GET /api/privacy/notice/` — no token, no personal data, no reason to hide it."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        return Response(public_notice())


class ConsentSerializer(serializers.Serializer):
    """Give or withdraw, against a version of the notice.

    A grant must name the current version. Consent to a notice the member was not shown is not
    consent, and accepting whatever version the phone happens to send would make the version
    field decorative.
    """

    action = serializers.ChoiceField(choices=[choice for choice, _ in ConsentRecord.Action.choices])
    noticeVersion = serializers.CharField(max_length=32, required=False, default="")

    def validate(self, attrs):
        if attrs["action"] == ConsentRecord.Action.GRANTED:
            if attrs.get("noticeVersion") != NOTICE_VERSION:
                raise serializers.ValidationError(
                    {
                        "noticeVersion": (
                            f"The notice on the server is version {NOTICE_VERSION}. Read it, then "
                            "agree to that version."
                        )
                    }
                )
        return attrs


class ConsentView(APIView):
    """`GET` what is in force, `POST` a grant or a withdrawal."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        consent = current_consent(request.user)
        history = ConsentRecord.objects.filter(account=request.user).order_by("created_at")
        return Response({
            "inForce": (
                {
                    "noticeVersion": consent.notice_version,
                    "purposes": consent.purposes,
                    "grantedAt": consent.created_at,
                }
                if consent and consent.is_current
                else None
            ),
            "currentNoticeVersion": NOTICE_VERSION,
            "history": [
                {
                    "noticeVersion": record.notice_version,
                    "action": record.action,
                    "source": record.source,
                    "purposes": record.purposes,
                    "at": record.created_at,
                }
                for record in history
            ],
        })

    def post(self, request):
        payload = ConsentSerializer(data=request.data)
        if not payload.is_valid():
            return Response(payload.errors, status=status.HTTP_400_BAD_REQUEST)
        data = payload.validated_data

        try:
            with transaction.atomic():
                consent = ConsentRecord.objects.create(
                    account=request.user,
                    notice_version=(
                        data["noticeVersion"] or NOTICE_VERSION
                    ),
                    purposes=ALL_PURPOSES if data["action"] == ConsentRecord.Action.GRANTED else [],
                    action=data["action"],
                    source=ConsentRecord.Source.IN_APP,
                )
        except IntegrityError:
            # The same consent recorded twice. Answer with what is already true rather than
            # with a 409 that reads as a refusal: nothing has gone wrong and the member's
            # position is unchanged.
            existing = ConsentRecord.objects.filter(
                account=request.user, notice_version=data["noticeVersion"] or NOTICE_VERSION,
                action=data["action"],
            ).first()
            return Response(
                {
                    "consent": {
                        "noticeVersion": existing.notice_version,
                        "action": existing.action,
                        "at": existing.created_at,
                    },
                    "alreadyRecorded": True,
                }
            )
        return Response(
            {
                "consent": {
                    "noticeVersion": consent.notice_version,
                    "action": consent.action,
                    "purposes": consent.purposes,
                    "at": consent.created_at,
                },
                "alreadyRecorded": False,
            },
            status=status.HTTP_201_CREATED,
        )


class MyDataView(APIView):
    """`GET /api/privacy/export/` — the caller's own data, s.32 and s.35.

    The identity check is the access token, which is what it is for: s.32(1) says a data
    subject who provides proof of identity may ask, and a signed-in session is proof enough for
    an endpoint that can only ever return the caller's own rows.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(build_access_report(request.user))


class PrivacyRequestSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=[choice for choice, _ in DataSubjectRequest.Kind.choices])
    detail = serializers.CharField(required=False, allow_blank=True, default="", max_length=4000)


class PrivacyRequestListCreateView(APIView):
    """`GET` the caller's requests, `POST` a new one.

    One open request per kind, enforced by a partial unique constraint rather than by a check
    here. A check can be raced and a duplicate is a real harm: it looks like two answers are owed
    and only one is.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([
            {
                "id": request_.pk,
                "kind": request_.kind,
                "status": request_.status,
                "detail": request_.detail,
                "requestedAt": request_.requested_at,
                "dueAt": request_.due_at,
                "respondedAt": request_.responded_at,
                "responseSummary": request_.response_summary or None,
                "evidence": request_.evidence or None,
                "overdue": request_.is_overdue(),
            }
            for request_ in DataSubjectRequest.objects.filter(account=request.user)
        ])

    def post(self, request):
        payload = PrivacyRequestSerializer(data=request.data)
        if not payload.is_valid():
            return Response(payload.errors, status=status.HTTP_400_BAD_REQUEST)
        data = payload.validated_data

        try:
            with transaction.atomic():
                request_ = DataSubjectRequest.objects.create(
                    account=request.user, kind=data["kind"], detail=data["detail"]
                )
        except IntegrityError:
            open_one = DataSubjectRequest.objects.filter(
                account=request.user, kind=data["kind"]
            ).open().first()
            return Response(
                {
                    "detail": "You already have a request of this kind open. We are answering it.",
                    "requestId": open_one.pk if open_one else None,
                    "dueAt": open_one.due_at if open_one else None,
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            {
                "id": request_.pk,
                "kind": request_.kind,
                "status": request_.status,
                "requestedAt": request_.requested_at,
                "dueAt": request_.due_at,
            },
            status=status.HTTP_201_CREATED,
        )


class PrivacyRequestDetailView(APIView):
    """`GET /api/privacy/requests/<id>/` — one of the caller's own requests.

    Scoped to the caller's rows rather than filtered after a broad query, so there is no code
    path in which a member's identifier is compared with a foreign one and the comparison is
    what decides the answer.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        try:
            request_ = DataSubjectRequest.objects.get(pk=request_id, account=request.user)
        except (DataSubjectRequest.DoesNotExist, ValueError):
            return Response({"detail": "No such request."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "id": request_.pk,
            "kind": request_.kind,
            "status": request_.status,
            "detail": request_.detail,
            "requestedAt": request_.requested_at,
            "dueAt": request_.due_at,
            "respondedAt": request_.responded_at,
            "responseSummary": request_.response_summary or None,
            "evidence": request_.evidence or None,
            "handledBy": request_.handled_by or None,
            "overdue": request_.is_overdue(),
        })
