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

from __future__ import annotations

import secrets

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Sum
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ledger import AuditEvent, LedgerAccount
from .models import Contribution, Membership, Payout, Round, SusuGroup
from compliance.monitoring import evaluate_contribution

# Invite codes exclude 0/O and 1/I. A code is read aloud across a market association and typed
# back in, and one ambiguous glyph is a support call at best and the wrong member in the wrong
# rotation slot at worst.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 8
_CODE_ATTEMPTS = 12

# Rule G3: a rotation larger than this stops being a savings group and becomes a list.
MAX_GROUP_MEMBERS = 50


def generate_invite_code():
    """A code no group holds yet.

    A collision is astronomically unlikely at 32^8 but not impossible, and `invite_code` is
    unique, so a clash is retried rather than raised. Failing after a dozen tries means
    something is wrong that retrying will not fix, and it is better to say so than to hand back
    a group whose invite code is already spoken for.
    """
    for _ in range(_CODE_ATTEMPTS):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
        if not SusuGroup.objects.filter(invite_code=code).exists():
            return code
    raise DjangoValidationError("Could not allocate an invite code. Please try again.")


# --------------------------------------------------------------------------
# Serializers
# --------------------------------------------------------------------------


class RosterEntrySerializer(serializers.Serializer):
    """One member's frozen facts for this round, plus where their money stands.

    A snapshot, not a live lookup: `sharePesewas` was fixed when the round opened and will not
    move, while `paidPesewas` and `openStatus` describe the attempts made since.

    Per-member payment state is readable by every member, deliberately. A rotation that hides
    who has paid is one where members police each other, and the audit feed is already readable
    by the whole group (AT4) — so withholding it here would hide nothing while leaving this
    screen unable to answer the question it is opened to answer. C-S1, AT4.
    """

    membershipId = serializers.IntegerField(source="membership_id")
    accountId = serializers.IntegerField(source="account_id")
    name = serializers.CharField()
    order = serializers.IntegerField()
    sharePesewas = serializers.IntegerField(source="share_pesewas")
    chargedPesewas = serializers.IntegerField(
        source="charged_pesewas", default=0, required=False
    )
    paidPesewas = serializers.IntegerField(source="paid_pesewas")
    openStatus = serializers.CharField(source="open_status", allow_null=True)


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
    myMembershipId = serializers.SerializerMethodField()
    canContribute = serializers.SerializerMethodField()
    openContributionId = serializers.SerializerMethodField()
    verifiedTotalPesewas = serializers.SerializerMethodField()
    shortfallPesewas = serializers.SerializerMethodField()
    closingFloatPesewas = serializers.SerializerMethodField()
    conservationResidual = serializers.SerializerMethodField()
    debtResidual = serializers.SerializerMethodField()
    ledger = serializers.SerializerMethodField()
    payout = serializers.SerializerMethodField()

    def _caller_membership(self, round_):
        """The signed-in member's slot in this round, resolved once per serialization.

        Fails closed. If this serializer is ever constructed without a request — a management
        command, a future view that forgets the context — `canContribute` reads `False` and the
        caller sends no money, which is the correct direction for something that gates a write.
        A `KeyError` here would be a louder bug but would also stop the round screen rendering
        numbers that are perfectly safe to show.

        Resolved through the frozen roster and filtered on `active`, which is the same question
        the write path asks in `membership_or_403`. Looking it up any other way would let the
        screen offer a payment the server then refuses with a 403, which reads to a member as the
        app being broken rather than as the two disagreeing.
        """
        if not hasattr(self, "_membership_cache"):
            request = self.context.get("request")
            user = getattr(request, "user", None)
            if user is None or not user.is_authenticated:
                self._membership_cache = None
            else:
                self._membership_cache = Membership.objects.filter(
                    id__in=[entry["membership_id"] for entry in round_.roster_snapshot],
                    account=user,
                    active=True,
                ).first()
        return self._membership_cache

    def get_myMembershipId(self, round_):
        membership = self._caller_membership(round_)
        return membership.id if membership else None

    def get_canContribute(self, round_):
        """Whether this member may log a payment right now.

        Asked of the server rather than derived on the phone because the freeze rule is a
        domain decision with a history of being got wrong: a member holding an unsettled attempt
        must not be able to open a second one, and only the server knows what is unsettled. The
        client uses this to enable or disable the button, never to authorise the write. C-S2.
        """
        membership = self._caller_membership(round_)
        if membership is None:
            return False
        return round_.open_slot_for(membership) is None

    def get_openContributionId(self, round_):
        """The attempt currently holding this member's slot, if any.

        So a member can withdraw the attempt they started and never sent, rather than being told
        to go and pay money that was never sent in the first place. C-S2.
        """
        membership = self._caller_membership(round_)
        if membership is None:
            return None
        open_slot = round_.open_slot_for(membership)
        return open_slot.id if open_slot else None

    def get_roster(self, round_):
        """The frozen snapshot, with each member's payment state folded in.

        The snapshot is a list of dicts captured when the round opened, so the fields the
        serializer declares are plain values and the state that has moved on is merged in here
        rather than looked up per member.
        """
        state = round_.payment_state_by_membership()
        return RosterEntrySerializer(
            [
                {
                    **entry,
                    "charged_pesewas": entry.get("charged_pesewas", 0),
                    "paid_pesewas": state[entry["membership_id"]]["paid"],
                    "open_status": state[entry["membership_id"]]["open_status"],
                }
                for entry in round_.roster_snapshot
            ],
            many=True,
        ).data

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


class GroupSerializer(serializers.Serializer):
    """One group, with the invite code its admin shares to fill the rotation."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    targetPesewas = serializers.IntegerField(source="target_pesewas")
    collectionDay = serializers.IntegerField(source="collection_day")
    feePesewas = serializers.IntegerField(source="fee_pesewas")
    cycle = serializers.IntegerField()
    currentRound = serializers.IntegerField(source="current_round")
    status = serializers.CharField()
    inviteCode = serializers.CharField(source="invite_code")
    memberCount = serializers.SerializerMethodField()

    def get_memberCount(self, group):
        return group.memberships.filter(active=True).count()


class GroupCreateSerializer(serializers.Serializer):
    """What a phone may send to start a group.

    Note what is absent: there is no roster, and no way to name the people who will join. A
    `Membership` points at an `accounts.Account`, not at a name or a number typed into a form,
    so a creator cannot place an arbitrary person in a rotation — they can only bring themselves
    and then share the invite code. That is the same anti-impersonation position as the
    collection account (I51): a group you can populate with strangers' names is a group that
    can be made to look like someone else's. G2, G3, G4.
    """

    name = serializers.CharField(max_length=100, allow_blank=False, trim_whitespace=True)
    targetPesewas = serializers.IntegerField(source="target_pesewas", min_value=1)
    collectionDay = serializers.IntegerField(
        source="collection_day", min_value=0, max_value=6, required=False, default=1
    )
    feePesewas = serializers.IntegerField(
        source="fee_pesewas", min_value=0, required=False, default=0
    )
    description = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default=""
    )

    def validate_targetPesewas(self, value):
        if value > 10 ** 12:
            raise serializers.ValidationError("That target is larger than any group we accept")
        return value

    def validate_feePesewas(self, value):
        if value > 10 ** 12:
            raise serializers.ValidationError("That fee is larger than any group we accept")
        return value


class GroupJoinSerializer(serializers.Serializer):
    """Redeeming an invite code.

    There is deliberately no `account` field. The only account that can be added by this request
    is the one making it, so joining cannot be used to place someone else in a rotation.
    """

    inviteCode = serializers.CharField(
        source="invite_code", max_length=_CODE_LENGTH, allow_blank=False, trim_whitespace=True
    )


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
        """The actor's display name, or None for an action with no human behind it.

        `display_name` rather than `str(actor)` for the same reason the roster snapshot uses it:
        the feed is readable by every member of the group, and a member who never typed a name
        used to appear in it as their full mobile money number, on every line they touched.
        """
        return event.actor.display_name if event.actor_id else None


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

    def admin_or_403(self, request, group_id):
        """As `membership_or_403`, but for decisions only a group admin may make.

        Separated deliberately rather than added as a flag. A decision about *other people's*
        money is not the same act as reading the round, and collapsing the two into one check is
        how an endpoint ends up trusting the wrong caller: `membership_or_403` answers "are you
        in this group", which is true of every member and therefore authorises nothing.
        """
        membership, refused = self.membership_or_403(request, group_id)
        if refused:
            return None, refused
        if membership.role != Membership.Role.ADMIN:
            return None, Response(
                {"detail": "Only a group admin can do that."},
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
        return Response(RoundDetailSerializer(round_, context={"request": request}).data)


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
        return Response(RoundDetailSerializer(round_, context={"request": request}).data)


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

    Three transitions with three different rules, because they are three different kinds of claim:

    `void`     The member's own unsettled attempt, and only their own. Cancelling something you
               started needs no authority beyond starting it. Posts nothing, because nothing ever
               arrived; what it does is release their slot, which the freeze rule would otherwise
               hold indefinitely. C-S2.

    `verify`   Money has arrived. **Admin only, and never on the admin's own contribution.**
               This is the transition the pot grows on, so leaving it open to any member means
               anyone can mark money in as received without a cedi ever moving — and then the pot
               fills and a payout fires to the receiver. A member asserting their own payment is
               received is self-attestation, which is the whole thing the payment rail exists to
               replace; `mark_verified` will eventually be called by a verification worker from a
               provider response, and until that worker exists this endpoint is the manual
               fallback, not the primary path. It refuses self-verification because an admin who
               can verify their own contribution is the one case where the check approves itself.

    `reverse`  Money that was counted has gone back. Admin only, and never their own: reversing
               your own payment is the withdrawal a group cannot see, and it is the fastest route
               to draining a pot that has not yet been paid out.

    There is deliberately no `fail`. Marking a payment failed asserts that the provider never
    confirmed money, and a member who could say that about their own payment could walk away from
    cedi they actually sent. That transition belongs to the verification worker, where it is made
    from a provider response rather than a request. P2, P-S1.
    """

    #: Transitions only a group admin may perform, mapped to whether they may touch their own
    #: contribution. Read as a table rather than as branches so the whole authorisation surface is
    #: visible in one place and a new transition cannot default to "open".
    ADMIN_ONLY = {"verify", "reverse"}

    def post(self, request, pk, transition):
        try:
            contribution = Contribution.objects.select_related(
                "round", "membership", "membership__account"
            ).get(pk=pk)
        except (Contribution.DoesNotExist, ValueError):
            return Response({"detail": "No such contribution."}, status=status.HTTP_404_NOT_FOUND)

        group_id = contribution.round.group_id
        is_admin = contribution.membership.role == Membership.Role.ADMIN
        is_own = contribution.membership.account_id == request.user.pk

        if transition in self.ADMIN_ONLY:
            _, refused = self.admin_or_403(request, group_id)
            if refused:
                return refused
            if is_own:
                return Response(
                    {
                        "detail": (
                            "You cannot confirm or reverse your own payment. "
                            "It is checked against the payment provider instead."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            _, refused = self.membership_or_403(request, group_id)
            if refused:
                return refused
            if transition == "void":
                # Only your own unsettled attempt. Somebody else's is not yours to cancel.
                if not is_own:
                    return Response(
                        {"detail": "That is not your payment."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            elif transition != "reverse":
                return Response(
                    {"detail": "Unknown transition."}, status=status.HTTP_404_NOT_FOUND
                )

        reason = request.data.get("reason", "")

        if transition == "void":
            apply_transition = contribution.mark_void
        elif transition == "verify":
            apply_transition = contribution.mark_verified
        elif transition == "reverse":
            apply_transition = contribution.mark_reversed
        else:
            return Response({"detail": "Unknown transition."}, status=status.HTTP_404_NOT_FOUND)

        try:
            apply_transition(actor=request.user, reason=reason)
        except DjangoValidationError as exc:
            return Response(
                {"detail": exc.messages[0] if exc.messages else "That change was refused."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Run AML/CFT monitoring on verified contributions
        if transition == "verify" and contribution.status == Contribution.Status.VERIFIED:
            evaluate_contribution(contribution)

        round_ = Round.objects.get(pk=contribution.round_id)
        return Response({
            "contribution": ContributionSerializer(contribution).data,
            "round": RoundDetailSerializer(round_, context={"request": request}).data,
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


class GroupJoinView(APIView):
    """`POST /api/groups/join/`

    Redeems an invite code for the caller. The code is a capability to join one group and nothing
    more: it cannot add a member, change the rotation, or reach any other group. That restraint
    is the point. A join endpoint that accepted an account would let anyone seat a stranger in
    someone else's rotation, which is the impersonation the security rules exist to prevent. I51.

    Slot assignment is the next free `order`, and never a reindex: `order` is assigned once and a
    removal leaves it alone, so an order is not reused by a later join and the rotation a round
    froze cannot be reshuffled underneath it. G3, G4, T1.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        payload = GroupJoinSerializer(data=request.data)
        if not payload.is_valid():
            return Response(payload.errors, status=status.HTTP_400_BAD_REQUEST)
        code = payload.validated_data["invite_code"].upper()

        try:
            group = SusuGroup.objects.get(invite_code=code)
        except SusuGroup.DoesNotExist:
            # Same answer as an ended group, and deliberately vague: confirming which codes exist
            # would turn this endpoint into a way to enumerate real groups.
            return Response(
                {"detail": "That invite code is not valid."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if group.status != SusuGroup.Status.ACTIVE:
            return Response(
                {"detail": "That group is not accepting new members."},
                status=status.HTTP_409_CONFLICT,
            )

        if group.memberships.filter(account=request.user, active=True).exists():
            return Response(
                {"detail": "You are already in this group."},
                status=status.HTTP_409_CONFLICT,
            )

        active_count = group.memberships.filter(active=True).count()
        if active_count >= MAX_GROUP_MEMBERS:
            return Response(
                {"detail": f"A group can hold at most {MAX_GROUP_MEMBERS} members."},
                status=status.HTTP_409_CONFLICT,
            )

        next_order = (
            group.memberships.order_by("-order").values_list("order", flat=True).first() or 0
        ) + 1

        try:
            with transaction.atomic():
                membership = Membership.objects.create(
                    group=group, account=request.user, order=next_order
                )
        except IntegrityError:
            # The unique constraints on (group, account) and (group, order) are the real
            # guarantee. Two phones racing on the same code both compute the same next slot; one
            # wins, and the other is told the truth rather than being allowed a duplicate order.
            return Response(
                {"detail": "You are already in this group."},
                status=status.HTTP_409_CONFLICT,
            )

        AuditEvent.record(
            actor=request.user,
            action="membership.joined",
            target=membership,
            to_state="active",
        )
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)


def group_payload(group):
    """One group, as the group list and the member summary both show it.

    One function rather than two inline dicts, because two copies of a
    payload shape is a payload shape that drifts: the home tab reads the
    summary, the groups screen reads the list, and a field added to one
    and not the other is a screen showing a stale contract.
    """
    return {
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


class GroupListView(APIView):
    """`GET /api/groups/` — the groups this account belongs to, and nothing else."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        groups = SusuGroup.objects.filter(
            memberships__account=request.user, memberships__active=True
        ).distinct()
        return Response([group_payload(group) for group in groups])


class MemberSummaryView(APIView):
    """`GET /api/members/me/summary/` — the caller's whole position, once.

    The home tab needs numbers the group list does not carry: what a
    member has paid in, what has been paid out to them, what they still
    owe, which rounds are waiting on them, and how many of their
    attempts need attention. Every one of those is a question about
    money, so every one is answered here rather than added up on a
    phone from a list of groups — a total the client computes itself is
    a total the server never agreed to (C-S1).

    `due` asks the same question the round screen answers, through the
    same methods: a round is waiting on this member when it is open,
    they hold no unsettled attempt, and nothing of theirs has been
    verified into it. A pending attempt is in flight, not due; a
    verified payment is paid, not due.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = Membership.objects.filter(
            account=request.user, active=True
        ).select_related("group")

        groups = []
        pot_total = 0
        admin_of = 0
        for membership in memberships:
            group = membership.group
            if group.status != SusuGroup.Status.ACTIVE:
                continue
            pot_total += group.target_pesewas
            if membership.role == Membership.Role.ADMIN:
                admin_of += 1
            payload = group_payload(group)
            payload["myRole"] = membership.role
            groups.append(payload)

        contributed = (
            Contribution.objects.filter(
                membership__account=request.user,
                status=Contribution.Status.VERIFIED,
            ).aggregate(total=Sum("amount_pesewas"))["total"]
            or 0
        )

        received = (
            Payout.objects.filter(
                receiver__account=request.user,
                status=Payout.Status.COMPLETED,
            ).aggregate(total=Sum("amount_pesewas"))["total"]
            or 0
        )

        debt = memberships.aggregate(total=Sum("debt_pesewas"))["total"] or 0

        # Pending and queued attempts are the ones a member is waiting on
        # themselves; flagged and disputed are the ones a group is waiting
        # on an admin for. Failed, void and reversed are settled, and
        # verified is done — none of those needs a member's eye.
        attention = Contribution.objects.filter(
            membership__account=request.user,
            status__in=[
                Contribution.Status.PENDING,
                Contribution.Status.QUEUED,
                Contribution.Status.FLAGGED,
                Contribution.Status.DISPUTED,
            ],
        ).count()

        due = []
        for membership in memberships:
            group = membership.group
            if group.status != SusuGroup.Status.ACTIVE:
                continue
            round_ = Round.objects.filter(
                group=group, outcome=Round.Outcome.OPEN
            ).first()
            if round_ is None:
                continue
            if round_.open_slot_for(membership) is not None:
                continue
            if round_.paid_pesewas_for(membership) > 0:
                continue
            due.append({
                "groupId": group.id,
                "groupName": group.name,
                "roundId": round_.id,
                "roundNumber": round_.number,
                "dueAt": round_.due_at,
                "sharePesewas": round_.share_for(membership) or 0,
            })
        due.sort(key=lambda entry: entry["dueAt"])

        return Response({
            "groupCount": memberships.count(),
            "activeGroupCount": len(groups),
            "adminOfCount": admin_of,
            "potTotalPesewas": pot_total,
            "contributedPesewas": contributed,
            "receivedPesewas": received,
            "debtPesewas": debt,
            "attentionCount": attention,
            "due": due,
            "groups": groups,
        })


class GroupCreateView(GroupListView):
    """`POST /api/groups/`

    Subclasses the list view rather than sitting beside it, because both are the same URL. Two
    `path()` entries for one URL would resolve to whichever came first regardless of method, and
    `POST` would be answered by the list view with a 405 — a refusal that reads as "this app
    cannot create groups" rather than as a routing mistake.

    Creates a group and installs the caller as its admin at rotation position 1, so a group can
    never exist without an admin who is in it. That install happens inside `create_group` rather
    than here, because it was left to callers once and produced groups whose own admin was
    absent from the rotation. G2.

    No round is opened. The first round opens on first read by `CurrentRoundView`, which is
    idempotent — so a client that creates a group and immediately reads its round cannot end up
    with two rounds if the create is retried, and an abandoned group leaves no half-built round.
    """

    def post(self, request):
        payload = GroupCreateSerializer(data=request.data)
        if not payload.is_valid():
            return Response(payload.errors, status=status.HTTP_400_BAD_REQUEST)
        data = payload.validated_data

        try:
            with transaction.atomic():
                group = SusuGroup.objects.create_group(
                    name=data["name"],
                    description=data["description"],
                    target_pesewas=data["target_pesewas"],
                    collection_day=data["collection_day"],
                    fee_pesewas=data.get("fee_pesewas", 0),
                    admin=request.user,
                    invite_code=generate_invite_code(),
                )
        except DjangoValidationError as exc:
            return Response(
                {"detail": exc.messages[0] if exc.messages else "That group was refused."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        AuditEvent.record(
            actor=request.user, action="group.created", target=group, to_state=group.status
        )
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)