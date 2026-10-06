import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { ChevronLeft, Download, Trash2, FileText, Clock, Mail, AlertTriangle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert, toast } from "../utils/alert";
import { openEmail as openMailClient } from "../utils/openEmail";
import {
  REQUEST_KINDS,
  createRequest,
  fetchConsent,
  fetchMyData,
  fetchNotice,
  listRequests,
  summariseReport,
  noticeContacts,
  withdrawConsent,
  RESPONSE_DAYS,
} from "../services/privacy";
import { formatGHC } from "../services/money";
import colors from "../theme/colors";

/**
 * What the member can do about their data, from inside the app.
 * Rendered as a legal document: numbered items in the margin, plain body text.
 *
 * A data subject right that can only be exercised by emailing an address is a
 * right in theory. Act 843 s.32-35 and s.44 all assume the request is made; none
 * of them say the only way to make it is a letter.
 *
 * The erasure button does not promise deletion. It says exactly what will
 * happen: the account is anonymised straight away, the group's payment record
 * stays because the other members are entitled to it and the law holds it for
 * seven years.
 */
export default function PrivacyRights() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [summary, setSummary] = useState(null);
  const [consent, setConsent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [contacts, setContacts] = useState({ dpoName: "Our data protection officer", dpoEmail: "privacy@growl.app" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [report, consentState, queue] = await Promise.allSettled([
      fetchMyData(),
      fetchConsent(),
      listRequests(),
    ]);
    if (report.status === "fulfilled") setSummary(summariseReport(report.value));
    if (consentState.status === "fulfilled") setConsent(consentState.value);
    if (queue.status === "fulfilled") setRequests(queue.value);
    try {
      setContacts(noticeContacts(await fetchNotice()));
    } catch {
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ask = async (kind, confirmation) => {
    setBusy(true);
    try {
      if (kind === REQUEST_KINDS.ERASE) {
        const proceed = await new Promise((resolve) =>
          Alert.alert(
            "Delete my data?",
            confirmation,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Send the request", style: "destructive", onPress: () => resolve(true) },
            ],
            { variant: "warning" }
          )
        );
        if (!proceed) return;
      }
      const created = await createRequest(kind, "");
      const due = new Date(created.dueAt);
      toast.success(
        `Sent. We answer within ${RESPONSE_DAYS} days, by ${due.toLocaleDateString()}.`
      );
      setRequests(await listRequests());
    } catch (err) {
      toast.error(err?.message || "That request could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  const onWithdraw = async () => {
    setBusy(true);
    try {
      await withdrawConsent();
      const state = await fetchConsent();
      setConsent(state);
      toast.success("Your consent is withdrawn. Your group record is unchanged, and still there.");
    } catch (err) {
      toast.error(err?.message || "That could not be recorded.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.paper, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.document} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Your privacy</Text>
          <Text style={styles.subtitle}>
            Ntuboa keeps the record of your contributions. It never holds your money.
          </Text>
          <View style={styles.rule} />
        </View>

        {loading ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}

        {summary ? (
          <View style={styles.block}>
            <View style={styles.blockHead}>
              <FileText size={18} color={colors.gold} />
              <Text style={styles.blockTitle}>What we hold about you</Text>
            </View>
            <Row label="Name" value={summary.name} />
            <Row label="Number" value={summary.phone || "none on file"} />
            <Row label="Email" value={summary.email} />
            <Row label="Groups" value={`${summary.groupCount}`} />
            <Row label="Payments recorded" value={`${summary.contributionCount}`} />
            <Row label="Paid in, verified" value={formatGHC(summary.contributedPesewas)} />
            <Row label="Received from a round" value={formatGHC(summary.receivedPesewas)} />
            {summary.debtPesewas > 0 ? (
              <Row label="Owed to the group" value={formatGHC(summary.debtPesewas)} />
            ) : null}
            {summary.anonymised ? <Row label="Account" value="anonymised" /> : null}
            {summary.whoElseSeesIt.map((line) => (
              <Text key={line} style={styles.note}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <FileText size={18} color={colors.gold} />
            <Text style={styles.blockTitle}>Read the full notice</Text>
          </View>
          <Text style={styles.note}>
            Every purpose we have for your data, with its own lawful basis, and who else receives
            it. Version {consent?.currentNoticeVersion || "—"}.
          </Text>
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => router.push("/PrivacyPolicy")}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Open the privacy notice</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Mail size={18} color={colors.gold} />
            <Text style={styles.blockTitle}>Ask us something</Text>
          </View>
          <Text style={styles.note}>
            We answer every request in writing within {RESPONSE_DAYS} days, and we tell you the
            date when you send it.
          </Text>

          <Action
            title="See everything you hold"
            hint="The full report, including the ledger entries and the log of your actions."
            onPress={() => ask(REQUEST_KINDS.ACCESS)}
          />
          <Action
            title="Correct something that is wrong"
            hint="Your name, your number, or a payment recorded against the wrong person."
            onPress={() => ask(REQUEST_KINDS.RECTIFY)}
          />
          <Action
            title="Delete my data"
            hint="Anonymises your account straight away. The group's payment history is kept — it is theirs, and the law holds it for seven years."
            danger
            onPress={() =>
              ask(
                REQUEST_KINDS.ERASE,
                "Your name, number, email and login will be removed and your account will stop working immediately.\n\nThe group's payment history stays. The other members are entitled to see it, and we are required to keep it for seven years. It will no longer identify you to them.\n\nSend the request?"
              )
            }
          />
          <Action
            title="Stop a use I object to"
            hint="Tell us which processing you object to, and we will answer in writing."
            onPress={() => ask(REQUEST_KINDS.OBJECT)}
          />
        </View>

        {consent?.inForce ? (
          <View style={styles.block}>
            <View style={styles.blockHead}>
              <AlertTriangle size={18} color={colors.gold} />
              <Text style={styles.blockTitle}>Your consent</Text>
            </View>
            <Text style={styles.note}>
              You agreed to version {consent.inForce.noticeVersion}. Withdrawing it does not undo
              what was already done lawfully, and it does not remove you from a group you are in.
            </Text>
            <TouchableOpacity
              style={[styles.secondary, busy && styles.disabled]}
              onPress={busy ? undefined : onWithdraw}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Withdraw my consent</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Clock size={18} color={colors.gold} />
            <Text style={styles.blockTitle}>Your requests</Text>
          </View>
          {requests.length === 0 ? (
            <Text style={styles.note}>You have not asked us anything yet.</Text>
          ) : (
            requests.map((row) => (
              <View key={row.id} style={styles.request}>
                <View style={styles.requestHead}>
                  <Text style={styles.requestKind}>{row.kind.replace(/_/g, " ")}</Text>
                  <Text style={styles.requestStatus}>
                    {row.status}
                    {row.overdue
                      ? " — overdue"
                      : row.status === "received"
                      ? ` — due ${new Date(row.dueAt).toLocaleDateString()}`
                      : ""}
                  </Text>
                </View>
                {row.responseSummary ? (
                  <Text style={styles.note}>{row.responseSummary}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Mail size={18} color={colors.gold} />
            <Text style={styles.blockTitle}>Complain</Text>
          </View>
          <Text style={styles.note}>
            If we do not answer properly, you can complain to the Data Protection Commission —
            Registration 0256301533, Compliance 0256302031 — or write to {contacts.dpoName}.
          </Text>
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => openMailClient(contacts.dpoEmail)}
            accessibilityRole="button"
            accessibilityLabel={`Email the data protection officer at ${contacts.dpoEmail}`}
          >
            <Text style={styles.secondaryText}>Email the data protection officer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Action({ title, hint, onPress, danger }) {
  return (
    <TouchableOpacity
      style={[styles.action, danger && styles.actionDanger]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {danger ? <Trash2 size={16} color={colors.danger} /> : null}
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, danger && styles.actionTitleDanger]}>{title}</Text>
        <Text style={styles.actionHint}>{hint}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  paper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  document: {
    paddingHorizontal: 22,
    paddingBottom: 48,
  },
  backButton: {
    padding: 4,
    marginBottom: 24,
    alignSelf: "flex-start",
  },
  header: {
    marginBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textBody,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 6,
    marginBottom: 22,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 22,
  },
  loader: {
    marginVertical: 18,
    alignSelf: "center",
  },
  block: {
    marginBottom: 26,
  },
  blockHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  note: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  rowValue: {
    color: colors.textBodyAlt,
    fontSize: 13,
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  secondary: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignSelf: "flex-start",
  },
  secondaryText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
  action: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actionDanger: {},
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  actionTitleDanger: {
    color: colors.danger,
  },
  actionHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  request: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  requestHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  requestKind: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  requestStatus: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
