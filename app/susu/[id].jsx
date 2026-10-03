import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "../../utils/alert";
import {
  ChevronLeft,
  HandCoins,
  ShieldCheck,
  UserPlus,
  RefreshCw,
  Ban,
  Users,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  ArrowDownLeft,
  Clock,
  Copy,
  Share2,
  FileText,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { Share } from "react-native";
import BottomSheet from "../../components/molecule/BottomSheet";
import OfflineBanner, { PendingSyncBanner } from "../../components/molecule/OfflineBanner";
import SusuRotationIndicator from "../../components/molecule/SusuRotationIndicator";
import SusuContributionRow from "../../components/molecule/SusuContributionRow";
import { useSusuStore } from "../../store/susu";
import { useNetworkStore } from "../../store/network";
import { useQueueStore } from "../../store/queue";
import { getDayLabel } from "../../utils/dayLabel";
import {
  PROVIDERS,
  DAY_NAMES,
  MIN_CONTRIBUTION,
  activeMembers,
  currentReceiver,
  memberShare,
  roundCollected,
  roundContributions,
  memberContribution,
  isPayoutReady,
  validateContribution,
} from "../../services/susu";
import { canDispute, canAdminResolve, hasOpenDispute } from "../../services/dispute";
import StatementSheet from "../../components/molecule/StatementSheet";
import DisputeSheet from "../../components/molecule/DisputeSheet";

export default function SusuGroupDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const group = useSusuStore((s) => s.groups.find((g) => g.id === id));
  const userId = useSusuStore((s) => s.userId);
  const logContribution = useSusuStore((s) => s.logContribution);
  const verifyContribution = useSusuStore((s) => s.verifyContribution);
  const failContribution = useSusuStore((s) => s.failContribution);
  const flagContribution = useSusuStore((s) => s.flagContribution);
  const releasePayout = useSusuStore((s) => s.releasePayout);
  const confirmPayout = useSusuStore((s) => s.confirmPayout);
  const failPayout = useSusuStore((s) => s.failPayout);
  const closeRound = useSusuStore((s) => s.closeRound);
  const restartCycle = useSusuStore((s) => s.restartCycle);
  const endGroup = useSusuStore((s) => s.endGroup);
  const addMember = useSusuStore((s) => s.addMember);
  const regenerateInviteCode = useSusuStore((s) => s.regenerateInviteCode);
  const removeMember = useSusuStore((s) => s.removeMember);
  const enqueue = useQueueStore((s) => s.enqueue);
  const openDispute = useSusuStore((s) => s.openDispute);
  const resolveDispute = useSusuStore((s) => s.resolveDispute);
  const [statementVisible, setStatementVisible] = useState(false);
  const [disputeVisible, setDisputeVisible] = useState(false);
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [disputeMode, setDisputeMode] = useState("open");

  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState(null);
  const [reference, setReference] = useState("");
  const [contributeVisible, setContributeVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [formError, setFormError] = useState(null);

  const roster = useMemo(() => (group ? activeMembers(group) : []), [group]);
  const receiver = useMemo(() => (group ? currentReceiver(group) : null), [group]);
  const myTurn = receiver?.id === userId;
  const isAdmin = group?.members.find((m) => m.id === userId)?.role === "admin";

  const ledger = useMemo(() => {
    if (!group) return [];
    const nameOf = (memberId) => group.members.find((m) => m.id === memberId)?.name || "Member";
    const entries = [
      ...group.contributions.map((c) => ({
        id: c.id,
        kind: "contribution",
        memberName: nameOf(c.memberId),
        roundNumber: c.roundNumber,
        amount: c.amount,
        status: c.status,
        reference: c.reference,
        at: c.paidAt || 0,
      })),
      ...group.payouts.map((p) => ({
        id: p.id,
        kind: "payout",
        memberName: p.memberId ? nameOf(p.memberId) : "Round",
        roundNumber: p.roundNumber,
        amount: p.amount,
        status: p.status,
        reference: p.reference,
        at: p.completedAt || p.startedAt || 0,
      })),
    ];
    return entries.sort((a, b) => b.at - a.at);
  }, [group]);

  if (!group) {
    return (
      <View style={[styles.flex, styles.center]}>
        <Text style={styles.headerTitle}>This susu group no longer exists.</Text>
        <TouchableOpacity style={styles.submit} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.submitText}>Back to my susus</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const contributions = roundContributions(group, group.currentRound).slice().reverse();
  const verifiedCount = contributions.filter((c) => c.status === "verified").length;
  const collected = roundCollected(group, group.currentRound);
  const remaining = Math.max(0, group.targetAmount - collected);
  const payoutReady = isPayoutReady(group);
  const myContribution = memberContribution(group, userId);
  const share = memberShare(group);
  const me = group.members.find((m) => m.id === userId);
  const activePayout = group.payouts.find((p) => p.status === "processing");
  const failedPayout = group.payouts.find((p) => p.status === "failed");
  const trustScore = group.adminTrustScore ?? 100;
  const debtors = group.members.filter((m) => m.missedShare > 0);
  const roundBlocked = hasOpenDispute(group, group.currentRound);

  const isOnline = useNetworkStore((s) => s.isOnline);

  const submitContribution = () => {
    const result = validateContribution(group, { amount, provider, reference });
    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    // A member in a market with no signal still has to be able to record the
    // payment. It is stored locally as unverified and queued, never confirmed.
    if (!isOnline) {
      enqueue({ groupId: group.id, payload: { amount, provider, reference } });
    } else {
      logContribution(group.id, { amount, provider, reference });
    }

    setAmount("");
    setReference("");
    setProvider(null);
    setFormError(null);
    setContributeVisible(false);
    Alert.alert(
      isOnline ? "Contribution logged" : "Saved on this phone",
      isOnline
        ? "We are verifying your mobile money reference now. The pot is paid out once every contribution is verified."
        : "You are offline, so this is recorded but not yet verified. We will check it with your mobile money provider as soon as you have signal.",
      undefined,
      { variant: isOnline ? "success" : "warning" }
    );
  };

  const onReleasePayout = () => {
    Alert.alert(
      "Release the pot?",
      `GHC ${group.targetAmount.toLocaleString()} will be sent to ${receiver?.name}'s mobile money.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Release",
          onPress: () => {
            const result = releasePayout(group.id);
            if (result) {
              Alert.alert(
                "Transfer started",
                `GHC ${group.targetAmount.toLocaleString()} is being sent to ${result.receiver.name}.`,
                undefined,
                { variant: "info" }
              );
            }
          },
        },
      ],
      { variant: "confirm" }
    );
  };

  const onConfirmPayout = () => {
    Alert.alert(
      "Confirm the transfer?",
      "Mark this transfer as delivered only if the receiver has actually received it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delivered",
          onPress: () => {
            const result = confirmPayout(group.id, activePayout.id);
            if (result) {
              Alert.alert(
                "Pot released",
                result.finished
                  ? "That was the final round. The cycle is complete."
                  : "The next collector has been notified.",
                undefined,
                { variant: "success" }
              );
            }
          },
        },
      ],
      { variant: "confirm" }
    );
  };

  const onFailPayout = () => {
    Alert.alert(
      "Report a failed transfer?",
      "The round stays open and the transfer can be retried.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report failure",
          onPress: () => failPayout(group.id, activePayout.id, "Mobile money transfer was rejected"),
        },
      ],
      { variant: "warning" }
    );
  };

  const onRetryPayout = () => {
    const result = releasePayout(group.id);
    if (result) {
      Alert.alert(
        "Retry started",
        `Retrying the transfer to ${result.receiver.name}.`,
        undefined,
        { variant: "info" }
      );
    }
  };

  const onCloseRound = () => {
    const nonContributors = roster.filter((m) => !memberContribution(group, m.id));
    Alert.alert(
      "Close this round?",
      nonContributors.length
        ? `${nonContributors.length} member(s) did not contribute. They will owe GHC ${share} each. A second miss removes them from the rotation.`
        : "Everyone contributed. The round will move to the next collector.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close round",
          onPress: () => {
            const result = closeRound(group.id);
            if (result) {
              Alert.alert(
                "Round closed",
                result.missedCount
                  ? `${result.missedCount} missed contribution(s) recorded.`
                  : "Moving to the next round.",
                undefined,
                { variant: result.missedCount ? "warning" : "success" }
              );
            }
          },
        },
      ],
      { variant: nonContributors.length ? "warning" : "confirm" }
    );
  };

  const onFlag = (contribution) => {
    Alert.alert(
      "Flag as a fake transaction?",
      "The round will be blocked, the admin's trust score drops by 25, and two flags strip the admin's privileges.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Flag",
          style: "destructive",
          onPress: () => {
            const result = flagContribution(group.id, contribution.id);
            if (result?.adminRevoked) {
              const successor = group.members.find((m) => m.id === result.newAdminId);
              Alert.alert(
                "Admin removed",
                successor
                  ? `Two fake transactions were logged. The admin lost their privileges and ${successor.name} has taken over.`
                  : "Two fake transactions were logged and the admin has lost their privileges.",
                undefined,
                { variant: "warning" }
              );
            }
          },
        },
      ],
      { variant: "danger" }
    );
  };

  const onRestart = () => {
    Alert.alert(
      "Restart the cycle?",
      "Rounds reset to 1 and everyone returns to their turn.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Restart", onPress: () => restartCycle(group.id) },
      ],
      { variant: "confirm" }
    );
  };

  const onEnd = () => {
    Alert.alert(
      "End this susu group?",
      "Contributions and payout history are kept for reference.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "End group", style: "destructive", onPress: () => endGroup(group.id) },
      ],
      { variant: "danger" }
    );
  };

  const onAddMember = () => {
    if (!newName.trim()) {
      setFormError("Enter the member's name.");
      return;
    }
    addMember(group.id, { name: newName.trim(), phone: newPhone.trim() });
    setNewName("");
    setNewPhone("");
    setFormError(null);
    setAddVisible(false);
  };

  const onRegenerateCode = () => {
    Alert.alert(
      "Generate a new code?",
      "The current code stops working immediately.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "New code", onPress: () => regenerateInviteCode(group.id) },
      ],
      { variant: "warning" }
    );
  };

  const onCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(group.inviteCode);
      Alert.alert("Code copied", `${group.inviteCode} is on your clipboard.`, undefined, {
        variant: "success",
      });
    } catch {
      Alert.alert("Could not copy", `Your code is ${group.inviteCode}.`, undefined, {
        variant: "error",
      });
    }
  };

  const onShareCode = () => {
    Share.share({
      message: `Join my susu "${group.name}" on Growl. Use invite code ${group.inviteCode} to join ${group.totalRounds} members saving together.`,
    }).catch(() => {});
  };

  const onRaiseDispute = ({ reason, note }) => {
    const result = canDispute(group, disputeTarget, userId);
    if (!result.ok) return { ok: false, message: result.message };
    openDispute(group.id, disputeTarget.id, { reason, note, openedBy: userId });
    Alert.alert("Dispute raised", "The admin has been asked to settle it. The round is blocked until then.", undefined, {
      variant: "warning",
    });
    return { ok: true };
  };

  const onSettleDispute = ({ resolution }) => {
    const result = canAdminResolve(group, disputeTarget, userId);
    if (!result.ok) return { ok: false, message: result.message };

    const outcome = resolveDispute(group.id, disputeTarget.id, { resolution, resolvedBy: userId });
    if (!outcome) return { ok: false, message: "That dispute is no longer open." };

    Alert.alert(
      resolution === "dismissed" ? "Dispute dismissed" : "Dispute upheld",
      resolution === "dismissed"
        ? "The contribution stands and the round can move again."
        : `GHC ${outcome.owed.toLocaleString()} was added to what the member owes.`,
      undefined,
      { variant: resolution === "dismissed" ? "success" : "warning" }
    );
    return { ok: true };
  };

  const onRemoveMember = (member) => {
    Alert.alert(
      `Remove ${member.name}?`,
      "They will be dropped from the rotation.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeMember(group.id, member.id) },
      ],
      { variant: "danger" }
    );
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#fbb81c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{group.name}</Text>
        <View style={styles.backBtn} />
      </View>

      <OfflineBanner />
      <PendingSyncBanner />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {group.description ? <Text style={styles.description}>{group.description}</Text> : null}

        <View style={styles.potCard}>
          <Text style={styles.potLabel}>Round {group.currentRound} of {group.totalRounds} · Cycle {group.cycle}</Text>
          <Text style={styles.potValue}>GHC {group.targetAmount.toLocaleString()}</Text>
          <Text style={styles.potMeta}>
            {group.isActive
              ? remaining > 0
                ? `${collected.toLocaleString()} collected · ${remaining.toLocaleString()} still needed`
                : "Pot is full and ready for payout"
              : "This group has ended"}
          </Text>

          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.min(100, (collected / group.targetAmount) * 100)}%` },
                remaining === 0 && styles.fillReady,
              ]}
            />
          </View>

          <View style={styles.turnBanner}>
            <Users size={16} color="#16171b" />
            <Text style={styles.turnText}>
              {myTurn ? "It is your turn to collect the pot" : `${receiver?.name || "—"} collects the pot this round`}
            </Text>
          </View>

          <View style={styles.cadenceRow}>
            <CalendarClock size={14} color="#8e8e93" />
            <Text style={styles.cadenceText}>
              Collects every {DAY_NAMES[group.collectionDay]} · share is GHC {share}
              {group.currentRoundDueAt
                ? ` · round ${group.currentRound} closes ${new Date(group.currentRoundDueAt).toLocaleDateString()}`
                : ""}
            </Text>
          </View>

          {me?.missedShare > 0 ? (
            <View style={styles.debtBanner}>
              <AlertTriangle size={16} color="#16171b" />
              <Text style={styles.debtText}>
                You owe GHC {me.missedShare.toLocaleString()} from a missed round. Pay it with your next contribution.
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, (!group.isActive || myContribution) && styles.primaryBtnDisabled]}
          disabled={!group.isActive || !!myContribution}
          onPress={() => setContributeVisible(true)}
        >
          <HandCoins size={20} color="#16171b" />
          <Text style={styles.primaryBtnText}>
            {myContribution ? "You contributed this round" : "Log your contribution"}
          </Text>
        </TouchableOpacity>

        {activePayout ? (
          <View style={styles.payoutPendingCard}>
            <View style={styles.payoutPendingHeader}>
              <Text style={styles.payoutPendingTitle}>Transfer in progress</Text>
              <Text style={styles.payoutPendingAmount}>GHC {activePayout.amount.toLocaleString()}</Text>
            </View>
            <Text style={styles.payoutPendingMeta}>
              Sending to {group.members.find((m) => m.id === activePayout.memberId)?.name} · {activePayout.reference}
            </Text>
            <View style={styles.payoutPendingActions}>
              <TouchableOpacity style={styles.confirmBtn} onPress={onConfirmPayout}>
                <CheckCircle2 size={16} color="#16171b" />
                <Text style={styles.confirmBtnText}>Mark delivered</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.failBtn} onPress={onFailPayout}>
                <XCircle size={16} color="#ef4444" />
                <Text style={styles.failBtnText}>Failed</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {failedPayout ? (
          <View style={styles.payoutFailedCard}>
            <View style={styles.payoutPendingHeader}>
              <Text style={styles.payoutFailedTitle}>Last transfer failed</Text>
              <Text style={styles.payoutFailedAmount}>GHC {failedPayout.amount.toLocaleString()}</Text>
            </View>
            <Text style={styles.payoutPendingMeta}>{failedPayout.failedReason}</Text>
            {isAdmin && group.isActive && (
              <TouchableOpacity style={styles.retryBtn} onPress={onRetryPayout}>
                <RefreshCw size={16} color="#16171b" />
                <Text style={styles.confirmBtnText}>Retry transfer</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {isAdmin && group.isActive && roundBlocked && (
          <View style={styles.disputeBanner}>
            <AlertTriangle size={16} color="#fbb81c" />
            <Text style={styles.disputeBannerText}>
              This round is blocked by an open dispute. Settle it above before the pot moves.
            </Text>
          </View>
        )}

        {isAdmin && group.isActive && (
          <TouchableOpacity
            style={[styles.payoutBtn, !payoutReady && styles.payoutBtnDisabled]}
            disabled={!payoutReady || !!activePayout}
            onPress={onReleasePayout}
          >
            <ShieldCheck size={20} color={payoutReady && !activePayout ? "#4ade80" : "#8e8e93"} />
            <Text style={[styles.payoutBtnText, (!payoutReady || activePayout) && styles.payoutBtnTextDisabled]}>
              {activePayout
                ? "Transfer already in progress"
                : roundBlocked
                  ? "Payout locked by an open dispute"
                  : payoutReady
                    ? `Release GHC ${group.targetAmount.toLocaleString()} to ${receiver?.name}`
                    : "Payout locked until the pot is full"}
            </Text>
          </TouchableOpacity>
        )}

        {isAdmin && group.isActive && (
          <TouchableOpacity style={styles.closeRoundBtn} onPress={onCloseRound}>
            <CalendarClock size={18} color="#fbb81c" />
            <Text style={styles.closeRoundText}>Close round {group.currentRound} and move on</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Rotation</Text>
        <SusuRotationIndicator
          members={roster}
          currentTurnIndex={group.currentTurnIndex % Math.max(1, roster.length)}
          payouts={group.payouts}
          userId={userId}
        />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Round {group.currentRound} contributions</Text>
          <Text style={styles.sectionCount}>{verifiedCount}/{roster.length} verified</Text>
        </View>
        <View style={styles.stack}>
          {contributions.length === 0 ? (
            <Text style={styles.empty}>Nobody has contributed yet for this round.</Text>
          ) : (
            contributions.map((contribution) => {
              const member = group.members.find((m) => m.id === contribution.memberId);
              const providerMeta = PROVIDERS.find((p) => p.id === contribution.provider);
              return (
                <View key={contribution.id}>
                  <SusuContributionRow
                    contribution={contribution}
                    memberName={member?.name}
                    memberInitials={member?.initials}
                    avatarColor={member?.avatarColor}
                    providerLabel={providerMeta?.short || contribution.provider}
                  />
                  {contribution.status === "disputed" ? (
                    <View style={styles.disputeRow}>
                      <Text style={styles.disputeNote}>
                        Dispute open — this round cannot be paid out until the admin settles it.
                      </Text>
                      <TouchableOpacity
                        style={styles.disputeBtn}
                        disabled={!isAdmin}
                        onPress={() => {
                          setDisputeTarget(contribution);
                          setDisputeMode("resolve");
                          setDisputeVisible(true);
                        }}
                      >
                        <Text style={styles.disputeBtnText}>
                          {isAdmin ? "Settle dispute" : "Awaiting admin"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {isAdmin && contribution.status !== "verified" && contribution.status !== "disputed" && (
                    <View style={styles.verifyRow}>
                      {contribution.status === "pending" && (
                        <>
                          <TouchableOpacity
                            style={styles.verifyBtn}
                            onPress={() => verifyContribution(group.id, contribution.id)}
                          >
                            <Text style={styles.verifyBtnText}>Verify payment</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.failSmallBtn}
                            onPress={() =>
                              failContribution(
                                group.id,
                                contribution.id,
                                "Reference could not be confirmed by the provider"
                              )
                            }
                          >
                            <Text style={styles.failSmallBtnText}>Mark failed</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity style={styles.flagBtn} onPress={() => onFlag(contribution)}>
                        <Text style={styles.flagBtnText}>Flag as fake</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {contribution.status !== "pending" &&
                    contribution.status !== "disputed" &&
                    (contribution.memberId === userId || isAdmin) && (
                      <TouchableOpacity
                        style={styles.disputeLink}
                        onPress={() => {
                          setDisputeTarget(contribution);
                          setDisputeMode("open");
                          setDisputeVisible(true);
                        }}
                      >
                        <Text style={styles.disputeLinkText}>
                          {contribution.memberId === userId ? "Dispute this payment" : "Dispute this entry"}
                        </Text>
                      </TouchableOpacity>
                    )}
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.sectionTitle}>Payout history</Text>
        <View style={styles.stack}>
          {group.payouts.length === 0 ? (
            <Text style={styles.empty}>No payouts yet.</Text>
          ) : (
            group.payouts
              .slice()
              .reverse()
              .map((payout) => {
                const member = group.members.find((m) => m.id === payout.memberId);
                const skipped = payout.status === "skipped";
                const failed = payout.status === "failed";
                const statusColor = skipped || failed ? "#ef4444" : "#4ade80";
                return (
                  <View key={payout.id} style={styles.payoutRow}>
                    <View style={styles.payoutInfo}>
                      <Text style={styles.payoutName}>{member?.name || (skipped ? "Round skipped" : "Member")}</Text>
                      <Text style={styles.payoutRef}>
                        Round {payout.roundNumber} · {payout.reference || payout.reason || "no reference"}
                      </Text>
                      {failed && payout.failedReason ? (
                        <Text style={styles.payoutFailedReason}>{payout.failedReason}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.payoutAmount, { color: statusColor }]}>
                      {payout.amount > 0 ? `GHC ${payout.amount.toLocaleString()}` : "—"}
                    </Text>
                  </View>
                );
              })
          )}
        </View>

        <Text style={styles.sectionTitle}>All activity</Text>
        <Text style={styles.sectionNote}>Every contribution and payout, newest first.</Text>
        <View style={styles.stack}>
          {ledger.length === 0 ? (
            <Text style={styles.empty}>Nothing has happened yet.</Text>
          ) : (
            ledger.map((entry) => (
              <View key={entry.id} style={styles.ledgerRow}>
                <View style={styles.ledgerIconWrap}>
                  {entry.kind === "payout" ? (
                    <ArrowDownLeft size={14} color="#4ade80" />
                  ) : entry.status === "verified" ? (
                    <CheckCircle2 size={14} color="#4ade80" />
                  ) : entry.status === "failed" || entry.status === "flagged" ? (
                    <XCircle size={14} color="#ef4444" />
                  ) : (
                    <Clock size={14} color="#fbb81c" />
                  )}
                </View>
                <View style={styles.ledgerInfo}>
                  <Text style={styles.ledgerTitle}>
                    {entry.kind === "payout" ? `Payout to ${entry.memberName}` : `${entry.memberName} contributed`}
                  </Text>
                  <Text style={styles.ledgerMeta} numberOfLines={1}>
                    Round {entry.roundNumber} · {getDayLabel(new Date(entry.at))}
                    {entry.kind === "contribution" && entry.reference ? ` · ${entry.reference}` : ""}
                    {entry.kind === "payout" && entry.status !== "completed" ? ` · ${entry.status}` : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.ledgerAmount,
                    { color: entry.kind === "payout" ? "#4ade80" : "#ffffff" },
                    entry.kind === "contribution" && entry.status !== "verified" && styles.ledgerAmountMuted,
                  ]}
                >
                  {entry.amount > 0 ? `GHC ${entry.amount.toLocaleString()}` : "—"}
                </Text>
              </View>
            ))
          )}
        </View>

        {debtors.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Missed contributions</Text>
            <Text style={styles.sectionNote}>These members owe their missed share and get one free skip.</Text>
            <View style={styles.stack}>
              {debtors.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <View>
                    <Text style={styles.memberName}>
                      {member.name}{member.id === userId ? " (you)" : ""}
                    </Text>
                    <Text style={styles.debtMeta}>
                      {member.active
                        ? `${member.missedStreak} miss — one more and they are removed`
                        : "Removed from the rotation after 2 misses"}
                    </Text>
                  </View>
                  <Text style={styles.debtAmount}>GHC {member.missedShare.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Admin trust</Text>
        <View style={styles.trustCard}>
          <View style={styles.trustHeader}>
            <Text style={styles.trustLabel}>Admin trust score</Text>
            <Text style={[styles.trustValue, trustScore < 50 && styles.trustValueLow]}>
              {trustScore}/100
            </Text>
          </View>
          <View style={styles.trustTrack}>
            <View
              style={[
                styles.trustFill,
                { width: `${trustScore}%` },
                trustScore < 50 && styles.trustFillLow,
              ]}
            />
          </View>
          <Text style={styles.trustHint}>
            Each fake transaction logged costs 25 points and blocks the round. Two flags strip the
            admin's privileges for this group.
          </Text>
        </View>

        {isAdmin && (
          <View>
            <Text style={styles.sectionTitle}>Invite members</Text>
            <Text style={styles.sectionNote}>
              Share this code so members can join. It also works over a phone call.
            </Text>
            <View style={styles.inviteCard}>
              <Text style={styles.inviteCode}>{group.inviteCode}</Text>
              <View style={styles.inviteActions}>
                <TouchableOpacity style={styles.inviteBtn} onPress={onCopyCode}>
                  <Copy size={15} color="#16171b" />
                  <Text style={styles.inviteBtnText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.inviteBtn} onPress={onShareCode}>
                  <Share2 size={15} color="#16171b" />
                  <Text style={styles.inviteBtnText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.inviteBtnAlt} onPress={onRegenerateCode}>
                  <RefreshCw size={15} color="#fbb81c" />
                  <Text style={styles.inviteBtnAltText}>New code</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Admin actions</Text>
            <View style={styles.adminActions}>
              <TouchableOpacity style={styles.adminBtn} onPress={() => setAddVisible(true)}>
                <UserPlus size={18} color="#fbb81c" />
                <Text style={styles.adminBtnText}>Add member</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminBtn} onPress={() => setStatementVisible(true)}>
                <FileText size={18} color="#fbb81c" />
                <Text style={styles.adminBtnText}>Statement</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminBtn} onPress={onRestart}>
                <RefreshCw size={18} color="#fbb81c" />
                <Text style={styles.adminBtnText}>Restart cycle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminBtn} onPress={onEnd}>
                <Ban size={18} color="#ef4444" />
                <Text style={[styles.adminBtnText, styles.adminBtnDanger]}>End group</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subtleLabel}>Members</Text>
            <View style={styles.stack}>
              {group.members.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <Text style={styles.memberName}>
                    {member.name}{member.id === userId ? " (you)" : ""}
                  </Text>
                  {member.id !== userId && group.members.length > 2 && (
                    <TouchableOpacity onPress={() => onRemoveMember(member)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <BottomSheet
        isVisible={contributeVisible}
        onClose={() => { setContributeVisible(false); setFormError(null); }}
        title="Log your contribution"
      >
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetLabel}>Amount (GHC) *</Text>
          <TextInput
            style={styles.input}
            placeholder="100"
            placeholderTextColor="#666666"
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
          />
          <Text style={styles.sheetHint}>
            Put in what you can — minimum GHC {MIN_CONTRIBUTION}. The pot needs GHC{" "}
            {group.targetAmount.toLocaleString()} in total.
            {me?.missedShare > 0
              ? ` You owe GHC ${me.missedShare.toLocaleString()} from a missed round — add it to this payment.`
              : ""}
          </Text>

          <Text style={styles.sheetLabel}>You paid with *</Text>
          <View style={styles.providerRow}>
            {PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.providerChip, provider === p.id && styles.providerChipActive]}
                onPress={() => setProvider(p.id)}
              >
                <Text style={[styles.providerText, provider === p.id && styles.providerTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sheetLabel}>Transaction reference *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. MP260114.0932"
            placeholderTextColor="#666666"
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
            maxLength={24}
          />

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          {!isOnline ? (
            <View style={styles.offlineNote}>
              <Text style={styles.offlineNoteText}>
                You are offline. This contribution will be saved on your phone and verified later.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={submitContribution}>
            <Text style={styles.primaryBtnText}>
              {isOnline ? "Submit contribution" : "Save on this phone"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>

      <StatementSheet
        group={group}
        userId={userId}
        isVisible={statementVisible}
        onClose={() => setStatementVisible(false)}
      />

      <DisputeSheet
        contribution={disputeTarget}
        memberName={group.members.find((m) => m.id === disputeTarget?.memberId)?.name}
        isAdmin={isAdmin}
        mode={disputeMode}
        isVisible={disputeVisible}
        onClose={() => {
          setDisputeVisible(false);
          setDisputeTarget(null);
        }}
        onOpen={onRaiseDispute}
        onResolve={onSettleDispute}
      />

      <BottomSheet
        isVisible={addVisible}
        onClose={() => { setAddVisible(false); setFormError(null); }}
        title="Add a member"
      >
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetLabel}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Member name"
            placeholderTextColor="#666666"
            value={newName}
            onChangeText={setNewName}
          />
          <Text style={styles.sheetLabel}>Mobile number</Text>
          <TextInput
            style={styles.input}
            placeholder="+233 ..."
            placeholderTextColor="#666666"
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
          />
          <Text style={styles.sheetHint}>They join at the end of the rotation.</Text>
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <TouchableOpacity style={styles.primaryBtn} onPress={onAddMember}>
            <Text style={styles.primaryBtnText}>Add to group</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#16171b" },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  headerTitle: { color: "#ffffff", fontSize: 20, fontWeight: "700", flex: 1, textAlign: "center" },
  backBtn: { width: 40 },
  body: { padding: 20, paddingBottom: 60 },
  description: { color: "#8e8e93", fontSize: 14, lineHeight: 20, marginBottom: 16 },
  potCard: {
    backgroundColor: "#1e1f24",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2a2b30",
    padding: 18,
  },
  potLabel: { color: "#8e8e93", fontSize: 12 },
  potValue: { color: "#ffffff", fontSize: 32, fontWeight: "800", marginTop: 4 },
  potMeta: { color: "#8e8e93", fontSize: 13, marginTop: 4 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2a2b30",
    marginTop: 16,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: "#fbb81c", borderRadius: 4 },
  fillReady: { backgroundColor: "#4ade80" },
  turnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fbb81c",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
  },
  turnText: { color: "#16171b", fontSize: 13, fontWeight: "700", flex: 1 },
  cadenceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  cadenceText: { color: "#8e8e93", fontSize: 11, flex: 1, lineHeight: 16 },
  debtBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f97316",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  debtText: { color: "#16171b", fontSize: 12, fontWeight: "600", flex: 1 },
  payoutPendingCard: {
    backgroundColor: "#1e1f24",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fbb81c",
    padding: 16,
    marginTop: 16,
  },
  payoutFailedCard: {
    backgroundColor: "#1e1f24",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ef4444",
    padding: 16,
    marginTop: 16,
  },
  payoutPendingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  payoutPendingTitle: { color: "#fbb81c", fontSize: 14, fontWeight: "700" },
  payoutFailedTitle: { color: "#ef4444", fontSize: 14, fontWeight: "700" },
  payoutPendingAmount: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  payoutFailedAmount: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  payoutPendingMeta: { color: "#8e8e93", fontSize: 12, marginTop: 4 },
  payoutPendingActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fbb81c",
    borderRadius: 12,
    paddingVertical: 12,
  },
  confirmBtnText: { color: "#16171b", fontSize: 13, fontWeight: "700" },
  failBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  failBtnText: { color: "#ef4444", fontSize: 13, fontWeight: "700" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fbb81c",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  closeRoundBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fbb81c",
    paddingVertical: 14,
    marginTop: 12,
  },
  closeRoundText: { color: "#fbb81c", fontSize: 14, fontWeight: "700" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 16,
  },
  primaryBtnDisabled: { backgroundColor: "#2a2b30" },
  primaryBtnText: { color: "#16171b", fontSize: 15, fontWeight: "700" },
  payoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#4ade80",
    paddingVertical: 16,
    marginTop: 12,
  },
  payoutBtnDisabled: { borderColor: "#33353b" },
  payoutBtnText: { color: "#4ade80", fontSize: 14, fontWeight: "700", textAlign: "center" },
  payoutBtnTextDisabled: { color: "#8e8e93" },
  sectionTitle: { color: "#ffffff", fontSize: 16, fontWeight: "700", marginTop: 24, marginBottom: 12 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionCount: { color: "#8e8e93", fontSize: 13, marginBottom: 12 },
  stack: { gap: 10 },
  empty: { color: "#8e8e93", fontSize: 14 },
  verifyRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  verifyBtn: {
    flex: 1,
    backgroundColor: "#4ade80",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  verifyBtnText: { color: "#16171b", fontSize: 13, fontWeight: "700" },
  failSmallBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f97316",
    paddingVertical: 10,
    alignItems: "center",
  },
  failSmallBtnText: { color: "#f97316", fontSize: 13, fontWeight: "700" },
  flagBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingVertical: 10,
    alignItems: "center",
  },
  flagBtnText: { color: "#ef4444", fontSize: 13, fontWeight: "700" },
  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2a2b30",
  },
  payoutInfo: { flex: 1, marginRight: 10 },
  payoutName: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  payoutRef: { color: "#8e8e93", fontSize: 12, marginTop: 3 },
  payoutFailedReason: { color: "#ef4444", fontSize: 11, marginTop: 3 },
  payoutAmount: { color: "#4ade80", fontSize: 15, fontWeight: "800" },
  sectionNote: { color: "#8e8e93", fontSize: 12, marginTop: -6, marginBottom: 12 },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2b30",
  },
  ledgerIconWrap: { width: 28, alignItems: "center" },
  ledgerInfo: { flex: 1, marginLeft: 8, marginRight: 8 },
  ledgerTitle: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  ledgerMeta: { color: "#8e8e93", fontSize: 11, marginTop: 2 },
  ledgerAmount: { fontSize: 13, fontWeight: "700" },
  ledgerAmountMuted: { color: "#8e8e93" },
  debtMeta: { color: "#f97316", fontSize: 11, marginTop: 3 },
  debtAmount: { color: "#f97316", fontSize: 14, fontWeight: "800" },
  trustCard: {
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2b30",
    padding: 16,
  },
  trustHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  trustLabel: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  trustValue: { color: "#4ade80", fontSize: 18, fontWeight: "800" },
  trustValueLow: { color: "#ef4444" },
  trustTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2a2b30",
    marginTop: 12,
    overflow: "hidden",
  },
  trustFill: { height: "100%", backgroundColor: "#4ade80", borderRadius: 4 },
  trustFillLow: { backgroundColor: "#ef4444" },
  trustHint: { color: "#8e8e93", fontSize: 11, marginTop: 10, lineHeight: 16 },
  adminActions: { flexDirection: "row", gap: 10 },
  inviteCard: {
    backgroundColor: "#1e1f24",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fbb81c",
    padding: 18,
    alignItems: "center",
  },
  inviteCode: {
    color: "#fbb81c",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 8,
  },
  inviteActions: { flexDirection: "row", gap: 8, marginTop: 16 },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fbb81c",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inviteBtnText: { color: "#16171b", fontSize: 13, fontWeight: "700" },
  inviteBtnAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fbb81c",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inviteBtnAltText: { color: "#fbb81c", fontSize: 13, fontWeight: "700" },
  adminBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2b30",
    paddingVertical: 14,
  },
  adminBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  adminBtnDanger: { color: "#ef4444" },
  subtleLabel: { color: "#8e8e93", fontSize: 13, fontWeight: "600", marginTop: 24, marginBottom: 10 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e1f24",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  memberName: { color: "#ffffff", fontSize: 14 },
  removeText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },
  sheet: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 60, gap: 10 },
  sheetLabel: { color: "#ffffff", fontSize: 14, fontWeight: "600", marginTop: 8 },
  sheetHint: { color: "#8e8e93", fontSize: 12, lineHeight: 18 },
  input: {
    backgroundColor: "#222327",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33353b",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 15,
  },
  providerRow: { flexDirection: "row", gap: 8 },
  providerChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33353b",
    paddingVertical: 12,
    alignItems: "center",
  },
  providerChipActive: { backgroundColor: "#fbb81c", borderColor: "#fbb81c" },
  providerText: { color: "#ffffff", fontSize: 12, fontWeight: "600", textAlign: "center" },
  providerTextActive: { color: "#16171b" },
  error: { color: "#ef4444", fontSize: 13, marginTop: 4 },
  disputeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#fbb81c",
    padding: 12,
    marginTop: 14,
  },
  disputeBannerText: { color: "#c9c9ce", fontSize: 12, lineHeight: 17, flex: 1 },
  disputeRow: {
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#fbb81c",
    padding: 12,
    marginTop: 8,
  },
  disputeNote: { color: "#c9c9ce", fontSize: 12, lineHeight: 17 },
  disputeBtn: {
    backgroundColor: "#fbb81c",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  disputeBtnText: { color: "#16171b", fontSize: 13, fontWeight: "700" },
  disputeLink: { alignSelf: "flex-start", marginTop: 6, marginLeft: 4 },
  disputeLinkText: { color: "#8e8e93", fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },
  offlineNote: {
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#fbb81c",
    padding: 12,
    marginTop: 12,
  },
  offlineNoteText: { color: "#c9c9ce", fontSize: 12, lineHeight: 17 },
});