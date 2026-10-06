import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { ChevronLeft, Mail, AlertTriangle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openEmail as openMailClient } from "../utils/openEmail";
import { fetchNotice, noticeSections, noticeContacts, PRIVACY_CONTACT_EMAIL } from "../services/privacy";
import colors from "../theme/colors";

/**
 * The privacy notice, fetched from the server rather than typed in here.
 *
 * Rendered as a plain legal document: numbered sections, left-aligned body
 * text, horizontal rules. No icon tiles or coloured cards — the content must
 * read like it was written by a lawyer, not dressed up as UI.
 *
 * Act 843 s.27(2) requires nine specific items. They come from the same
 * module the registration application quotes — one copy, versioned, served
 * to both.
 */
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

  const effectiveDate = notice?.effectiveAt ? new Date(notice.effectiveAt).toLocaleDateString() : null;

  return (
    <View style={[styles.paper, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.document}
        showsVerticalScrollIndicator={false}
      >
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
          <Text style={styles.title}>Privacy Notice</Text>
          {notice?.version ? <Text style={styles.version}>Version {notice.version} · Effective {effectiveDate}</Text> : null}
          <View style={styles.rule} />
        </View>

        <Text style={styles.lead}>
          Ntuboa keeps the record of your contributions. It never holds your money: your payment
          goes from your mobile money to your group on your operator's rail, and we only write down
          what happened.
        </Text>

        {state === "loading" ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}

        {state === "failed" ? (
          <View style={styles.errorBox}>
            <AlertTriangle size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load} accessibilityRole="button">
              <Text style={styles.retry}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {state === "ready" && notice?.draft ? (
          <View style={[styles.noteBox, styles.noteBoxDraft]}>
            <AlertTriangle size={16} color={colors.gold} />
            <Text style={styles.noteBoxText}>
              This notice is still being completed. Anything missing is listed on our website, and
              our contact details are being finalised.
            </Text>
          </View>
        ) : null}

        {sections.map((section, index) => (
          <View key={section.key} style={styles.section}>
            <Text style={styles.sectionNumber}>{index + 1}</Text>
            <Text style={styles.sectionHeading}>{section.title}</Text>
            {section.act ? <Text style={styles.sectionAct}>{section.act}</Text> : null}
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}

        {notice?.recipients ? (
          <View style={styles.section}>
            <Text style={styles.sectionNumber}>a</Text>
            <Text style={styles.sectionHeading}>Who else sees it</Text>
            {Object.entries(notice.recipients).map(([who, what]) => (
              <View key={who} style={styles.subItem}>
                <Text style={styles.subHeading}>{who.replace(/_/g, " ")}</Text>
                <Text style={styles.body}>{what}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {notice?.retention ? (
          <View style={styles.section}>
            <Text style={styles.sectionNumber}>b</Text>
            <Text style={styles.sectionHeading}>How long we keep it</Text>
            {Object.entries(notice.retention).map(([what, howLong]) => (
              <View key={what} style={styles.subItem}>
                <Text style={styles.subHeading}>{what.replace(/_/g, " ")}</Text>
                <Text style={styles.body}>{howLong}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {notice?.rights ? (
          <View style={styles.section}>
            <Text style={styles.sectionNumber}>c</Text>
            <Text style={styles.sectionHeading}>Your rights</Text>
            {Object.entries(notice.rights).map(([right, text]) => (
              <View key={right} style={styles.subItem}>
                <Text style={styles.subHeading}>{right.replace(/_/g, " ")}</Text>
                <Text style={styles.body}>{text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {notice?.version ? (
          <View style={styles.section}>
            <Text style={styles.sectionNumber}>d</Text>
            <Text style={styles.sectionHeading}>If this notice changes</Text>
            <Text style={styles.body}>
              We publish a new version here with a new date, and ask you to agree to it. What you
              agreed to, and when, is recorded on our side, so we can always show you which version
              applied.
            </Text>
          </View>
        ) : null}

        <View style={styles.rule} />

        <View style={styles.footer}>
          <Text style={styles.footerHeading}>Data controller</Text>
          <Text style={styles.footerBody}>{contacts.name}</Text>
          {contacts.registration ? (
            <Text style={styles.footerBody}>DPC registration {contacts.registration}</Text>
          ) : null}
          <Text style={styles.footerBody}>Email: {contacts.email}</Text>
        </View>

        <View style={[styles.footer, { marginTop: 16 }]}>
          <Text style={styles.footerHeading}>Data protection officer</Text>
          {contacts.dpoName !== "Our data protection officer" ? (
            <Text style={styles.footerBody}>{contacts.dpoName}</Text>
          ) : null}
          <TouchableOpacity
            onPress={() => openMailClient(contactEmail)}
            accessibilityRole="button"
            accessibilityLabel={`Email the data protection officer at ${contactEmail}`}
            style={styles.emailLink}
          >
            <Mail size={14} color={colors.gold} />
            <Text style={styles.footerLink}>{contactEmail}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const SECTION_NUMBER_WIDTH = 32;

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
  version: {
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ["small-caps"],
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 22,
    marginLeft: "50%",
    width: "50%",
  },
  lead: {
    color: colors.textBody,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 24,
  },
  loader: {
    marginVertical: 20,
    alignSelf: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
  },
  retry: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
    marginTop: 4,
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    marginBottom: 16,
  },
  noteBoxDraft: {
    paddingHorizontal: 4,
  },
  noteBoxText: {
    color: colors.textBodyAlt,
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
  },
  section: {
    marginBottom: 22,
  },
  sectionNumber: {
    position: "absolute",
    left: -SECTION_NUMBER_WIDTH,
    top: 0,
    width: SECTION_NUMBER_WIDTH,
    fontSize: 15,
    fontWeight: "700",
    color: colors.gold,
    textAlign: "right",
  },
  sectionHeading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
    paddingLeft: 4,
  },
  sectionAct: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 6,
    paddingLeft: 4,
  },
  body: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 20,
  },
  subItem: {
    marginBottom: 14,
    paddingLeft: 4,
  },
  subHeading: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  footer: {
    marginTop: 4,
    paddingLeft: 4,
  },
  footerHeading: {
    color: colors.textMuted,
    fontSize: 11,
    fontVariant: ["small-caps"],
    marginBottom: 4,
  },
  footerBody: {
    color: colors.textBodyAlt,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 2,
  },
  footerLink: {
    color: colors.textBodyAlt,
    fontSize: 13,
    lineHeight: 19,
    textDecorationLine: "underline",
  },
  emailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
});
