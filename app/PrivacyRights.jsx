import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { ChevronLeft, ShieldCheck, Download, Trash2, FileText, Clock, Mail, AlertTriangle } from "lucide-react-native";
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
} from "../services/privacy";
import { formatGHC } from "../services/money";

/**
 * What the member can actually do about their data, from inside the app.
 *
 * This screen exists because a data subject right that can only be exercised by emailing an
 * address is a right in theory. Act 843 s.32-35 and s.44 all assume the request is made; none of
 * them say the only way to make it is a letter.
 *
 * The erasure button does not promise deletion. It says exactly what will happen: the account is
 * anonymised straight away, the group's payment record stays because the other members are
 * entitled to it and the law holds it for seven years. A member who is told "delete" and then
 * finds their history still there has been lied to, and the notice says this before they ask —
 * the screen repeating it is the point.
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
      // The contact block has a default, so a failed notice fetch is not worth an error the
      // member has to dismiss before reaching the buttons that matter.
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
        `Sent. We answer within 21 days, by ${due.toLocaleDateString()}.`
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        <Text style={styles.title}>Your privacy</Text>
        <Text style={styles.subtitle}>
          Growl keeps the record of your contributions. It never holds your money.
        </Text>

        {loading ? <ActivityIndicator color="#fbb81c" style={styles.loader} /> : null}

        {summary ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <ShieldCheck size={20} color="#fbb81c" />
              <Text style={styles.cardTitle}>What we hold about you</Text>
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

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <FileText size={20} color="#fbb81c" />
            <Text style={styles.cardTitle}>Read the full notice</Text>
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

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Download size={20} color="#fbb81c" />
            <Text style={styles.cardTitle}>Ask us something</Text>
          </View>
          <Text style={styles.note}>
            We answer every request in writing within 21 days, and we tell you the date when you
            send it.
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
            hint="Anonymises your account straight away. The group's payment record is kept — it is theirs, and the law holds it for seven years."
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
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <AlertTriangle size={20} color="#fbb81c" />
              <Text style={styles.cardTitle}>Your consent</Text>
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

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Clock size={20} color="#fbb81c" />
            <Text style={styles.cardTitle}>Your requests</Text>
          </View>
          {requests.length === 0 ? (
            <Text style={styles.note}>You have not asked us anything yet.</Text>
          ) : (
            requests.map((row) => (
              <View key={row.id} style={styles.request}>
                <Text style={styles.requestKind}>{row.kind.replace(/_/g, " ")}</Text>
                <Text style={styles.requestStatus}>
                  {row.status}
                  {row.overdue ? " — overdue" : row.status === "received" ? ` — due ${new Date(row.dueAt).toLocaleDateString()}` : ""}
                </Text>
                {row.responseSummary ? <Text style={styles.note}>{row.responseSummary}</Text> : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Mail size={20} color="#fbb81c" />
            <Text style={styles.cardTitle}>Complain</Text>
          </View>
          <Text style={styles.note}>
            If we do not answer properly, you can complain to the Data Protection Commission —
            Registration 0256301533, Compliance 0256302031 — or write to {contacts.dpoName}.
          </Text>
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => openMailClient(contacts.dpoEmail)}
            accessibilityRole="button"
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
      {danger ? <Trash2 size={18} color="#ef4444" /> : null}
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, danger && styles.actionTitleDanger]}>{title}</Text>
        <Text style={styles.actionHint}>{hint}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  body: { padding: 20, paddingBottom: 48 },
  backButton: { padding: 4, marginBottom: 16 },
  title: { color: "#ffffff", fontSize: 26, fontWeight: "bold" },
  subtitle: { color: "#8e8e93", fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 18 },
  loader: { marginVertical: 18 },
  card: {
    backgroundColor: "#1e1f24",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a2b30",
    padding: 16,
    marginBottom: 14,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  cardTitle: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  rowLabel: { color: "#8e8e93", fontSize: 14 },
  rowValue: { color: "#ffffff", fontSize: 14, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  note: { color: "#8e8e93", fontSize: 13, lineHeight: 19, marginTop: 8 },
  action: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#2a2b30",
  },
  actionDanger: {},
  actionCopy: { flex: 1 },
  actionTitle: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  actionTitleDanger: { color: "#ef4444" },
  actionHint: { color: "#8e8e93", fontSize: 12, lineHeight: 18, marginTop: 3 },
  secondary: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fbb81c",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: { color: "#fbb81c", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  request: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#2a2b30" },
  requestKind: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  requestStatus: { color: "#c2a989", fontSize: 13, marginTop: 2 },
});
