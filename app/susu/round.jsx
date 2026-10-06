/**
 * The round, as the server knows it.
 *
 * This is the pilot screen for the API-backed frontend. It exists to prove one thing end to end:
 * that a member's phone can render the backend's money without ever doing arithmetic on it. The
 * screen is deliberately thin. It asks for a round, hands the payload to `toRoundView`, and draws
 * what comes back. There is no total computed here, no debt allocated here, no float derived
 * here — because the moment a screen does that, the group has two answers to "how much is in the
 * pot" and only one of them is audited.
 *
 * What replaced it: `app/susu/[id].jsx`, which reads a zustand store and recomputes the pot,
 * float and debt on the device. That screen is still in the app and still uses the legacy path.
 * This one is the destination, not a rewrite of it.
 *
 * Errors are split the way `ApiError` splits them, because they mean different things to a member
 * and the distinction decides what the screen offers. `offline` is worth retrying and says so; a
 * `refused` is the server's considered answer — this member may not see this group — and is shown
 * as a refusal rather than as something to try again.
 */

import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react-native";

import { ApiError } from "../../services/api";
import { toPesewas } from "../../services/money";
import { mutations, queries } from "../../services/query";
import { toRoundView } from "../../services/roundView";
import colors from "../../theme/colors";

/** GH¢ label. The figures themselves are already formatted by the view model. */
const GH = "GH¢";

function Amount({ children, tone = "default", size = "body" }) {
  return (
    <Text style={[styles.amount, size === "large" && styles.amountLarge, tone === "muted" && styles.amountMuted]}>
      {GH}
      {children}
    </Text>
  );
}

function Row({ label, value, tone = "default" }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Amount tone={tone}>{value}</Amount>
    </View>
  );
}

/**
 * Shown when the ledger does not agree with itself.
 *
 * A non-zero residual means the backend's books are wrong, and no amount of tidy layout makes
 * that acceptable to show as a normal round. The screen says so in plain words instead. Z7.
 */
function LedgerWarning({ view }) {
  return (
    <View style={styles.warning}>
      <AlertTriangle size={18} color={colors.danger} />
      <View style={styles.warningBody}>
        <Text style={styles.warningTitle}>This round does not balance</Text>
        <Text style={styles.warningText}>
          The ledger disagrees with itself by {view.ledger.residual}, and the round's own totals
          are out by {view.conservationResidual}. Please report this to the group admin rather
          than paying against these figures.
        </Text>
      </View>
    </View>
  );
}

function RosterRow({ entry }) {
  return (
    <View style={[styles.rosterRow, entry.isReceiver && styles.rosterRowReceiver]}>
      <View style={styles.rosterMain}>
        <Text style={styles.rosterName}>
          {entry.name}
          {entry.isReceiver ? "  ·  receiving" : ""}
          {entry.isMe ? "  ·  you" : ""}
        </Text>
        <Text style={styles.rosterMeta}>
          share {entry.share}
          {entry.hasPaid ? `  ·  paid ${entry.paid}` : ""}
          {entry.owes ? `  ·  owes ${entry.charged}` : ""}
        </Text>
      </View>
      <View
        style={[
          styles.badge,
          entry.hasPaid
            ? styles.badgePaid
            : entry.openStatus
              ? styles.badgePending
              : styles.badgeUnpaid,
        ]}
      >
        <Text style={styles.badgeText}>{entry.hasPaid ? "paid" : entry.openStatus ?? "not yet"}</Text>
      </View>
    </View>
  );
}

/**
 * Paying, or taking back an attempt that was never sent.
 *
 * The button is drawn from `canContribute`, which is the server's answer and not this device's.
 * The freeze rule means a member holding an unsettled attempt must not be able to open a second
 * one (C-S2), and the screen has no way to know what is unsettled without asking. So it asks,
 * and it believes the answer either way — including when the server says no.
 *
 * Nothing here adds to the pot locally. The write records an attempt; the pot, the float and the
 * collection account move only when the server says the payment is verified. A logged payment is
 * not yet money, and a screen that showed it in the total would be showing a promise. C-S1.
 */
function ContributeCard({ view, pay, withdraw }) {
  const mine = view.roster.find((entry) => entry.isMe);
  const reference = useRef("");

  if (!mine) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardMeta}>
          You are not in this rotation, so there is nothing for you to pay here.
        </Text>
      </View>
    );
  }

  const busy = pay.isPending || withdraw.isPending;
  const refusal = pay.error instanceof ApiError ? pay.error : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Your contribution</Text>
      <Row label="Your share" value={mine.share} />
      {mine.hasPaid && <Row label="Paid" value={mine.paid} />}
      {mine.owes && <Row label="Owed back to group" value={mine.charged} />}

      {view.openContributionId ? (
        <>
          <Text style={styles.cardMeta}>
            You have an attempt marked {mine.openStatus ?? "open"}. It only counts once Ntuboa has
            verified it, and the pot has not moved yet.
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.buttonQuiet, busy && styles.buttonBusy]}
            disabled={busy}
            onPress={() =>
              withdraw.mutate({ contributionId: view.openContributionId, reason: "withdrawn" })
            }
          >
            <Text style={styles.buttonText}>Withdraw this attempt</Text>
          </TouchableOpacity>
        </>
      ) : view.canContribute ? (
        <PayForm pay={pay} share={mine.share} reference={reference} busy={busy} roundId={view.id} />
      ) : (
        <Text style={styles.cardMeta}>
          You cannot log a payment for this round right now.
        </Text>
      )}

      {refusal && <Text style={styles.refusal}>{refusal.message}</Text>}
    </View>
  );
}

/**
 * The amount is the frozen share by default and may be overridden, because a member paying a
 * different amount is a real thing that happens. It is parsed to integer pesewas by
 * `toPesewas`, which throws on a float or on more than two decimals rather than rounding — the
 * same rule the server applies, so an amount that looks valid here is valid there.
 */
function PayForm({ pay, share, reference, busy, roundId }) {
  const [amount, setAmount] = useState("");
  const [localError, setLocalError] = useState(null);
  const shown = amount.trim() === "" ? share : amount.trim();

  const submit = () => {
    setLocalError(null);
    let pesewas;
    try {
      pesewas = toPesewas(shown);
    } catch (error) {
      setLocalError(error.message);
      return;
    }
    if (pesewas <= 0) {
      setLocalError("Enter an amount greater than zero.");
      return;
    }
    // A reference makes a retried submission the same payment rather than a second one, which
    // is what the idempotency key is for (C-S5). Held in a ref so it survives a re-render.
    if (!reference.current) reference.current = `app-${Date.now()}`;
    pay.mutate({ roundId, amountPesewas: pesewas, reference: reference.current });
  };

  return (
    <>
      <View style={styles.amountRow}>
        <Text style={styles.currency}>GH¢</Text>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          placeholder={share}
          placeholderTextColor={colors.placeholder}
          keyboardType="decimal-pad"
          accessibilityLabel="Amount in cedis"
        />
      </View>
      <TouchableOpacity
        style={[styles.button, busy && styles.buttonBusy]}
        disabled={busy}
        onPress={submit}
      >
        <Text style={styles.buttonText}>{busy ? "Sending…" : "Log my payment"}</Text>
      </TouchableOpacity>
      <Text style={styles.cardMeta}>
        This records that you sent it. The pot grows only once Ntuboa verifies the payment against
        your mobile money reference.
      </Text>
      {localError && <Text style={styles.refusal}>{localError}</Text>}
    </>
  );
}

function RoundScreen() {
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const groupId = Number(id);

  const { data, error, isPending, refetch, isRefetching } = useQuery({
    ...queries.currentRound(groupId),
    enabled: Number.isInteger(groupId),
  });

  // Logging a payment is a mutation, never an optimistic local edit. The pot, the float and the
  // collection account all move together on the server and only one of them can be wrong here,
  // so the screen refetches after the write instead of guessing what the new numbers are. C-S1.
  const pay = useMutation({ ...mutations.logContribution(queryClient) });
  const withdraw = useMutation({ ...mutations.voidContribution(queryClient) });

  // A missing group id is our own bug, not the server's, so it is never sent as a request.
  if (!Number.isInteger(groupId)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>No group was specified</Text>
      </View>
    );
  }

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (error instanceof ApiError && error.refused) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Not available</Text>
        <Text style={styles.errorBody}>{error.message}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not reach Ntuboa</Text>
        <Text style={styles.errorBody}>
          The round could not be loaded. Nothing has been lost — try again when you have signal.
        </Text>
        <Text style={styles.retry} onPress={() => refetch()}>
          Try again
        </Text>
      </View>
    );
  }

  const view = toRoundView(data);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.gold}
        />
      }
    >
      <Text style={styles.title}>Round {view.number}</Text>
      <Text style={styles.subtitle}>
        Cycle {view.cycle} · {view.outcome} · due {new Date(view.dueAt).toLocaleDateString()}
      </Text>

      {!view.balanced && <LedgerWarning view={view} />}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Collected</Text>
        <Amount size="large">{view.verified}</Amount>
        <Text style={styles.cardMeta}>of {view.target} target</Text>
        <View style={styles.divider} />
        <Row label="Still owed" value={view.shortfall} tone={view.shortfall === "0.00" ? "muted" : "default"} />
        <Row label="Float held" value={view.float} tone="muted" />
        <Row label="Fee" value={view.fee} tone="muted" />
      </View>

      <ContributeCard view={view} pay={pay} withdraw={withdraw} />

      {view.payout && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payout</Text>
          <Row label="Status" value={view.payout.status} />
          <Row label="Amount" value={view.payout.amount} />
          <Row label="Fee" value={view.payout.fee} tone="muted" />
          <Text style={styles.readOnlyNote}>
            A payout is sent by the payment provider, never from a phone. This is a record of one
            that already happened.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Frozen roster</Text>
        {view.roster.map((entry) => (
          <RosterRow key={entry.membershipId} entry={entry} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ledger</Text>
        <Row label="Debits" value={view.ledger.debits} tone="muted" />
        <Row label="Credits" value={view.ledger.credits} tone="muted" />
        <Row label="Residual" value={view.ledger.residual} />
        <View style={styles.divider} />
        <Row label="Collection account" value={view.ledger.partnerBalance} />
        <Row label="Group pot" value={view.ledger.groupPot} />
        <Row label="Owed back to group" value={view.ledger.debtReceivable} />
        <Row label="Fee payable" value={view.ledger.feePayable} tone="muted" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.background,
  },

  title: { color: colors.text, fontSize: 26, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 18,
    gap: 10,
  },
  cardTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  cardMeta: { color: colors.textMuted, fontSize: 13 },

  amount: { color: colors.text, fontSize: 16, fontWeight: "600" },
  amountLarge: { color: colors.gold, fontSize: 34, fontWeight: "700" },
  amountMuted: { color: colors.textMuted, fontWeight: "500" },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { color: colors.textBody, fontSize: 14 },

  divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: 4 },

  rosterRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  rosterRowReceiver: { borderTopColor: colors.gold },
  rosterMain: { flex: 1, gap: 2 },
  rosterName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  rosterMeta: { color: colors.textMuted, fontSize: 13 },

  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "center",
  },
  badgePaid: { backgroundColor: colors.successSoft },
  badgePending: { backgroundColor: colors.amberSoft },
  badgeUnpaid: { backgroundColor: colors.surfaceAlt },
  badgeText: { color: colors.textBody, fontSize: 11, fontWeight: "700" },

  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currency: { color: colors.gold, fontSize: 18, fontWeight: "700" },
  amountInput: { flex: 1, color: colors.text, fontSize: 18, paddingVertical: 12 },

  button: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonQuiet: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonBusy: { opacity: 0.6 },
  buttonText: { color: colors.onGold, fontSize: 15, fontWeight: "700" },

  refusal: { color: colors.danger, fontSize: 13, lineHeight: 19 },

  warning: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    padding: 16,
  },
  warningBody: { flex: 1, gap: 4 },
  warningTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  warningText: { color: colors.textBody, fontSize: 13, lineHeight: 19 },

  readOnlyNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },

  errorTitle: { color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  errorBody: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  retry: { color: colors.gold, fontSize: 15, fontWeight: "700", marginTop: 20 },
});

export default RoundScreen;