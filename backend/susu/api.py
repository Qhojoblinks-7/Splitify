"""
The read and write surface the mobile client actually uses.

Everything a member's phone displays about money arrives from `RoundDetailSerializer`, and
every status change goes through one of these three writes. If a number can appear on a
member's screen, it is computed here from the ledger and the frozen snapshot, never accepted
from the client.

Wire format decisions, both deliberate:

  camelCase    the client is JavaScript. Exposed as explicit serializer fields rather than a
               renaming package, so the contract is readable in one file and a rename can
               never be introduced silently by a dependency.
  pesewas      every amount is an integer number of pesewas, never cedis and never a float.
               The client does the same, so a value never loses precision crossing the wire.

Payouts are deliberately absent. No endpoint here can instruct or complete one: a payout is
fired by the provider rail, never by a phone. P-S1, P-S7.

Rule IDs: 1791027903-money-handling-and-safeguards.md M1, Z1, Z3, C-S1, C-S5, C-S8,
                                                 C-S9, P-S1, P-S7, AT1, AT4
           1791028270-security-fraud-and-identity.md   I23, P2, P9
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ledger import AuditEvent, LedgerAccount
from .models import Contribution, Membership, Round, SusuGroup


# --------------------------------------------------------------------------
# Serializers
# --------------------------------------------------------------------------


class RosterEntrySerializer(serializers.Serializer):
    """One member's frozen facts for this round. A snapshot, not a live lookup."""

    membershipId = serializers.IntegerField(source="membership_id")
    accountId = serializers.IntegerField(source="account_id")
    name = serializers.CharField()
    order = serializers.IntegerField()
    sharePesewas = serializers.IntegerField(source="share_pesewas")
    chargedPesewas = serializers.IntegerField(
        source="charged_pesewas", default=0, required=False
    )


class LedgerBalanceSerializer(serializers.Serializer):
    """The append-only record, read back.

    `residualPesewas` is the health check: it must be zero. A client that ever sees it
    non-zero is looking at a broken backend, and saying so plainly beats rendering a plausible
    total. Z1, Z7.
    """

    debitsPesewas = serializers.IntegerField(source="debits_pesewas")
    creditsPesewas = serializers.IntegerField(source="credits_pesewas")
    residualPesewas = serializers.IntegerField(source="residual_pesewas")
    partnerBalancePesewas = serializers.IntegerField(source="partner_balance_pesewas")
    groupPotPesewas = serializers.IntegerField(source="group_pot_pesewas")
    debtReceivablePesewas = serializers.IntegerField(source="debt_receivable_pesewas")
    feePayablePesewas = serializers.IntegerField(source="fee_payable_pesewas")


class PayoutSerializer(serializers.Serializer):
    """Read-only. There is no write path for this anywhere in the member API. P-S1."""

    id = serializers.IntegerField()
    payoutKey = serializers.CharField(source="payout_key")
    amountPesewas = serializers.IntegerField(source="amount_pesewas")
    feePesewas = serializers.IntegerField(source="fee_pesewas")
    status = serializers.CharField()
    receiverMembershipId = serializers.IntegerField(source="receiver_id")


class RoundDetailSerializer(serializers.Serializer):
    """Everything a member's round screen needs, in one request.

    Deliberately one payload rather than six endpoints: a member looking at a round needs the
    target, the shares, what has been verified, what is still owed and what the group has
    already paid out. Fetching those separately is how a screen ends up showing a total that
    contradicts the number beside it.
    """

    id = serializers.IntegerField()
    number = serializers.IntegerField()
    cycle = serializers.IntegerField()
    outcome = serializers.CharField()
    targetPesewas = serializers.IntegerField(source="target_pesewas")
    feePesewas = serializers.IntegerField(source="fee_pesewas")
    openedAt = serializers.DateTimeField(source="opened_at")
    dueAt = serializers.DateTimeField(source="due_at")
    receiverMembershipId = serializers.IntegerField(source="receiver_id")
    roster = serializers.SerializerMethodField()
    verifiedTotalPesewas = serializers.SerializerMethodField()
    shortfallPesewas = serializers.SerializerMethodField()
    closingFloatPesewas = serializers.SerializerMethodField()
    conservationResidual = serializers.SerializerMethodField()
    debtResidual = serializers.SerializerMethodField()
    ledger = serializers.SerializerMethodField()
    payout = serializers.SerializerMethodField()

    def get_roster(self, round_):
        return RosterEntrySerializer(round_.roster_snapshot, many=True).data

    def get_verifiedTotalPesewas(self, round_):
        return round_.verified_total_pesewas()

    def get_shortfallPesewas(self, round_):
        return round_.shortfall_pesewas()

    def get_closingFloatPesewas(self, round_):
        """Money this round holds that no payout consumed, from the ledger.

        Read through `current_float_pesewas`, so the number a member is shown and the number
        the ledger holds cannot drift apart. Floored at zero for display: a negative float is
        exposure, and it is reported separately rather than as a negative amount of savings.
        Z2, Z7.
        """
        float_pesewas = round_.current_float_pesewas()
        return float_pesewas if float_pesewas > 0 else 0

    def get_conservationResidual(self, round_):
        return round_.conservation_residual()

    def get_debtResidual(self, round_):
        return round_.debt_residual()

    def get_ledger(self, round_):
        balance = lambda account: round_.account_balance_pesewas(account)  # noqa: E731
        return LedgerBalanceSerializer({
            "debits_pesewas": round_.ledger_debits_pesewas(),
            "credits_pesewas": round_.ledger_credits_pesewas(),
            "residual_pesewas": round_.ledger_residual_pesewas(),
            "partner_balance_pesewas": round_.partner_balance_pesewas(),
            "group_pot_pesewas": balance(LedgerAccount.GROUP_POT),
            "debt_receivable_pesewas": balance(LedgerAccount.DEBT_RECEIVABLE),
            "fee_payable_pesewas": balance(LedgerAccount.FEE_PAYABLE),
        }).data

    def get_payout(self, round_):
        payout = round_.payouts.first()
        return PayoutSerializer(payout).data if payout else None


class RoundSummarySerializer(serializers.Serializer):
    """A group's rounds, for the group screen. No money detail, no roster."""

    id = serializers.IntegerField()
    number = serializers.IntegerField()
    cycle = serializers.IntegerField()
    outcome = serializers.CharField()
    targetPesewas = serializers.IntegerField(source="target_pesewas")
    dueAt = serializers.DateTimeField(source="due_at")
    verifiedTotalPesewas = serializers.SerializerMethodField()

    def get_verifiedTotalPesewas(self, round_):
        return round_.verified_total_pesewas()


class ContributionSerializer(serializers.Serializer):
    """One attempt, as the client sees it after the write."""

    id = serializers.IntegerField()
    roundId = serializers.IntegerField(source="round_id")
    membershipId = serializers.IntegerField(source="membership_id")
    amountPesewas = serializers.IntegerField(source="amount_pesewas")
    provider = serializers.CharField()
    reference = serializers.CharField()
    status = serializers.CharField()
    failureReason = serializers.CharField(source="failure_reason", allow_blank=True)
    verifiedAt = serializers.DateTimeField(source="verified_at", allow_null=True)


class ContributionCreateSerializer(serializers.Serializer):
    """What a phone may send when logging a payment.

    Three refusals worth reading the code for. `amount_pesewas` has no default and no
    fallback, so a missing amount is an error rather than a zero. `reference` is required
    when present at all, because an unreferenced payment cannot be matched to a provider
    transaction later. `idempotency_key` is accepted from the client so an offline write that
    is replayed returns the original contribution instead of creating a second one. C-S5.
    """

    amountPesewas = serializers.IntegerField(source="amount_pesewas", min_value=1)
    reference = serializers.CharField(max_length=100, allow_blank=False, trim_whitespace=True)
    provider = serializers.CharField(max_length=24, required=False, default="mtn_momo")
    idempotencyKey = serializers.UUIDField(
        source="idempotency_key", required=False, allow_null=True
    )

    def validate_amountPesewas(self, value):
        if value > 10 ** 12:
            raise serializers.ValidationError("That amount is larger than any payment we accept")
        return value


class AuditEventSerializer(serializers.Serializer):
    """The group's audit feed. Read-only, and readable by every member. AT1, AT4."""

    id = serializers.IntegerField()
    action = serializers.CharField()
    actorRole = serializers.CharField(source="actor_role")
    actorName = serializers.SerializerMethodField()
    roundNumber = serializers.IntegerField(source="round_number", allow_null=True)
    fromState = serializers.CharField(source="from_state", allow_blank=True)
    toState = serializers.CharField(source="to_state", allow_blank=True)
    reason = serializers.CharField(allow_blank=True)
    createdAt = serializers.DateTimeField(source="created_at")

    def get_actorName(self, event):
        return str(event.actor) if event.actor_id else None


# --------------------------------------------------------------------------
# Permissions
# --------------------------------------------------------------------------


class IsActiveMember(APIView):
    """Base view: authenticated, and inside a group.

    A caller with a valid token but no membership gets 403, never a shape of the group. The
    membership check happens here rather than in each view so no endpoint can forget it.
    """

    permission_classes = [IsAuthenticated]

    def membership_or_403(self, request, group_id):
        try:
            membership = Membership.objects.select_related("group").get(
                account=request.user, group_id=group_id, active=True
            )
        except (Membership.DoesNotExist, ValueError):
            return None, Response(
                {"detail": "You are not an active member of that group."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return membership, None


# --------------------------------------------------------------------------
# Views
# --------------------------------------------------------------------------


class RoundDetailView(IsActiveMember):
    """`GET /api/rounds/<round_id>/`"""

    def get(self, request, round_id):
        try:
            round_ = Round.objects.select_related("group", "receiver").get(pk=round_id)
        except (Round.DoesNotExist, ValueError):
            return Response({"detail": "No such round."}, status=status.HTTP_404_NOT_FOUND)

        _, refused = self.membership_or_403(request, round_.group_id)
        if refused:
            return refused
        return Response(RoundDetailSerializer(round_).data)


class CurrentRoundView(IsActiveMember):
    """`GET /api/groups/<group_id>/rounds/current/`

    The app's entry point. Opening is idempotent, so a client that calls this after a cold
    start gets the round that already exists rather than a second one.
    """

    def get(self, request, group_id):
        membership, refused = self.membership_or_403(request, group_id)
        if refused:
            return refused

        round_ = Round.open_current(membership.group)
        return Response(RoundDetailSerializer(round_).data)


class ContributionCreateView(IsActiveMember):
    """`POST /api/rounds/<round_id>/contributions/`

    Every domain refusal is translated into a 400 carrying the model's own message, so a
    frozen slot or a duplicate reference reaches the member in words they can act on. The
    refusal itself is the rule: it is not an error to be tolerated, it is the answer.
    """

    def post(self, request, round_id):
        try:
            round_ = Round.objects.get(pk=round_id)
        except (Round.DoesNotExist, ValueError):
            return Response({"detail": "No such round."}, status=status.HTTP_404_NOT_FOUND)

        membership, refused = self.membership_or_403(request, round_.group_id)
        if refused:
            return refused

        payload = ContributionCreateSerializer(data=request.data)
        if not payload.is_valid():
            return Response(payload.errors, status=status.HTTP_400_BAD_REQUEST)
        data = payload.validated_data

        try:
            contribution = Contribution.record(
                round_, membership, **data
            )
        except Contribution.FrozenSlot as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Contribution.DuplicateReference as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        except Contribution.IdempotencyKeyConflict as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        except Contribution.AmountOutOfRange as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as exc:
            return Response(
                {"detail": exc.messages[0] if exc.messages else "That payment was refused."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        AuditEvent.record(
            actor=request.user, action="contribution.recorded", target=contribution,
            to_state=contribution.status,
        )
        return Response(
            ContributionSerializer(contribution).data, status=status.HTTP_201_CREATED
        )


class ContributionTransitionView(IsActiveMember):
    """`POST /api/contributions/<pk>/verify/` and `.../reverse/`

    Both transitions post to the ledger inside the same transaction as the status change, so a
    member can never be told a payment verified while the money record disagrees.

    `void` is also reachable, for a member cancelling their own unsettled attempt before it is
    sent. It posts nothing, because nothing ever arrived; what it does is release their slot,
    which the freeze rule otherwise holds indefinitely. C-S2.

    There is deliberately no `fail` here. Marking a payment failed asserts that the provider
    never confirmed money, and a member who could say that about their own payment could walk
    away from cedi they actually sent. That transition belongs to the verification worker,
    where it is made from a provider response rather than a request. P2, P-S1.
    """

    def post(self, request, pk, transition):
        try:
            contribution = Contribution.objects.select_related(
                "round", "membership", "membership__account"
            ).get(pk=pk)
        except (Contribution.DoesNotExist, ValueError):
            return Response({"detail": "No such contribution."}, status=status.HTTP_404_NOT_FOUND)

        _, refused = self.membership_or_403(request, contribution.round.group_id)
        if refused:
            return refused

        reason = request.data.get("reason", "")

        if transition == "void":
            # Only your own unsettled attempt. Somebody else's is not yours to cancel.
            if contribution.membership.account_id != request.user.pk:
                return Response(
                    {"detail": "That is not your payment."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            apply_transition = contribution.mark_void
        elif transition == "verify":
            apply_transition = contribution.mark_verified
        elif transition == "reverse":
            apply_transition = contribution.mark_reversed
        else:
            return Response(
                {"detail": "Unknown transition."}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            apply_transition(actor=request.user, reason=reason)
        except DjangoValidationError as exc:
            return Response(
                {"detail": exc.messages[0] if exc.messages else "That change was refused."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        round_ = Round.objects.get(pk=contribution.round_id)
        return Response({
            "contribution": ContributionSerializer(contribution).data,
            "round": RoundDetailSerializer(round_).data,
        })


class GroupAuditFeedView(IsActiveMember):
    """`GET /api/groups/<group_id>/audit/`

    Every member of the group can read the whole trail, admin actions included. An admin
    action nobody can see is an admin action nobody can hold to account for. AT4.
    """

    def get(self, request, group_id):
        membership, refused = self.membership_or_403(request, group_id)
        if refused:
            return refused

        events = AuditEvent.objects.filter(group=membership.group).select_related("actor")[:100]
        return Response(AuditEventSerializer(events, many=True).data)


class GroupListView(APIView):
    """`GET /api/groups/` — the groups this account belongs to, and nothing else."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        groups = SusuGroup.objects.filter(
            memberships__account=request.user, memberships__active=True
        ).distinct()
        return Response([
            {
                "id": group.id,
                "name": group.name,
                "targetPesewas": group.target_pesewas,
                "collectionDay": group.collection_day,
                "cycle": group.cycle,
                "currentRound": group.current_round,
                "inviteCode": group.invite_code,
                "rounds": RoundSummarySerializer(
                    group.rounds.order_by("-number")[:5], many=True
                ).data,
            }
            for group in groups
        ])