import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { ChevronLeft, Shield, FileText, Database, Share2, Clock, UserCheck, Lock, RefreshCw, Mail, AlertTriangle, Globe } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openEmail as openMailClient } from "../utils/openEmail";
import { fetchNotice, noticeSections, noticeContacts, PRIVACY_CONTACT_EMAIL } from "../services/privacy";

/**
 * The privacy notice, fetched from the server rather than typed in here.
 *
 * This screen used to carry a paragraph per section written by nobody in particular, including
 * a claim that the app uses cookies and collects device data — neither of which is true, both of
 * which are the kind of sentence that costs more to explain than to remove. It also said nothing
 * about the one thing a member of a savings group actually needs to know: that the other members
 * of their group can see what they paid, and that we never hold the money.
 *
 * Act 843 s.27(2) requires nine specific items, and they come from the same module the
 * registration application quotes. One copy, versioned, served to both.
 */
const ICONS = [Shield, Database, FileText, UserCheck, AlertTriangle, Share2, Globe, Lock, Clock];

export default function PrivacyPolicy() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [notice, setNotice] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      setNotice(await fetchNotice());
      setState("ready");
    } catch (err) {
      // A notice that cannot be fetched is a support problem, not a licence to show a different
      // notice. Say so, and give the member the one address that always reaches a person.
      setError(err?.offline ? "We could not reach the server." : "We could not load the notice.");
      setState("failed");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const contacts = noticeContacts(notice);
  const contactEmail = contacts.dpoEmail || PRIVACY_CONTACT_EMAIL;
  const sections = noticeSections(notice);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Shield size={30} color="#16171b" />
          </View>
          <Text style={styles.title}>Privacy Notice</Text>
          {notice?.version ? <Text style={styles.version}>Version {notice.version}</Text> : null}
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Read this before you join a circle</Text>
          <Text style={styles.introText}>
            Growl keeps the record of your contributions. It never holds your money: your payment
            goes from your mobile money to your group on your operator's rail, and we only write
            down what happened.
          </Text>
        </View>

        {state === "loading" ? <ActivityIndicator color="#fbb81c" style={styles.loader} /> : null}

        {state === "failed" ? (
          <View style={styles.errorCard}>
            <AlertTriangle size={18} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load} accessibilityRole="button">
              <Text style={styles.retry}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {state === "ready" && notice?.draft ? (
          <View style={styles.draftCard}>
            <AlertTriangle size={18} color="#fbb81c" />
            <Text style={styles.draftText}>
              This notice is still being completed. Our contact details are being finalised, and
              anything missing is listed on our website.
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionsList}>
          {sections.map((section, index) => {
            const Icon = ICONS[index] || Shield;
            return (
              <View key={section.key} style={styles.sectionCard}>
                <View style={styles.sectionIcon}>
                  <Icon size={22} color="#16171b" />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionText}>{section.body}</Text>
                  <Text style={styles.sectionAct}>{section.act}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {notice?.recipients ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionIcon}>
              <Share2 size={22} color="#16171b" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Who else sees it</Text>
              {Object.entries(notice.recipients).map(([who, what]) => (
                <Text key={who} style={styles.sectionText}>{`${who.replace(/_/g, " ")}. ${what}`}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {notice?.retention ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionIcon}>
              <Clock size={22} color="#16171b" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>How long we keep it</Text>
              {Object.entries(notice.retention).map(([what, howLong]) => (
                <Text key={what} style={styles.sectionText}>{`${what.replace(/_/g, " ")}. ${howLong}`}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {notice?.rights ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionIcon}>
              <UserCheck size={22} color="#16171b" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Your rights</Text>
              {Object.entries(notice.rights).map(([right, text]) => (
                <Text key={right} style={styles.sectionText}>{`${right.replace(/_/g, " ")}. ${text}`}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {notice?.version ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionIcon}>
              <RefreshCw size={22} color="#16171b" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>If this notice changes</Text>
              <Text style={styles.sectionText}>
                We publish a new version here with a new date, and ask you to agree to it. What you
                agreed to, and when, is recorded on our side, so we can always show you which
                version applied.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Data protection officer</Text>
          <Text style={styles.contactText}>{contacts.dpoName}</Text>
          {contacts.name !== "Growl" ? <Text style={styles.contactText}>{contacts.name}</Text> : null}
          {contacts.registration ? (
            <Text style={styles.contactText}>DPC registration {contacts.registration}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => openMailClient(contactEmail)}
            accessibilityRole="button"
            accessibilityLabel={`Email the data protection officer at ${contactEmail}`}
          >
            <Mail size={18} color="#16171b" />
            <Text style={styles.contactButtonText}>{contactEmail}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  scrollContent: { padding: 20, paddingBottom: 48 },
  backButton: { padding: 4, marginBottom: 20 },
  header: { alignItems: "center", marginBottom: 28 },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { color: "#ffffff", fontSize: 28, fontWeight: "bold" },
  version: { color: "#8e8e93", fontSize: 13, marginTop: 6 },
  introCard: {
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fbb81c",
  },
  introTitle: { color: "#fbb81c", fontSize: 13, fontWeight: "bold", textTransform: "uppercase" },
  introText: { color: "#ffffff", fontSize: 14, lineHeight: 21, marginTop: 8 },
  loader: { marginVertical: 20 },
  errorCard: {
    backgroundColor: "#3a1f22",
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  errorText: { color: "#ef4444", fontSize: 14 },
  retry: { color: "#ffffff", fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  draftCard: {
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#fbb81c",
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    gap: 10,
  },
  draftText: { color: "#c2a989", fontSize: 13, lineHeight: 19, flex: 1 },
  sectionsList: { gap: 12 },
  sectionCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 16,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: "#ffffff", fontSize: 16, fontWeight: "bold", marginBottom: 6 },
  sectionText: { color: "#8e8e93", fontSize: 14, lineHeight: 21 },
  sectionAct: { color: "#5a5a5e", fontSize: 11, marginTop: 8 },
  contactCard: {
    backgroundColor: "#1e1f24",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a2b30",
    padding: 18,
    marginTop: 20,
  },
  contactTitle: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  contactText: { color: "#8e8e93", fontSize: 14, marginTop: 4 },
  contactButton: {
    minHeight: 48,
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: "#fbb81c",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  contactButtonText: { color: "#16171b", fontSize: 15, fontWeight: "bold" },
});
