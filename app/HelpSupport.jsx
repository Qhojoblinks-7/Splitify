import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ChevronDown,
  ChevronLeft,
  HelpCircle,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet from "../components/molecule/BottomSheet";
import { Alert } from "../utils/alert";
import colors from "../theme/colors";

const frequentlyAskedQuestions = [
  {
    id: "create-susu",
    question: "How do I create a susu group?",
    answer: "Tap Susu, then Start a new susu. Add the group name, the pot per round, and the members in rotation order. You become the admin and go first in the rotation.",
  },
  {
    id: "contribute",
    question: "How do I contribute?",
    answer: "Open the group and tap Log your contribution. Enter the amount you paid, the mobile money you used, and the transaction reference from your confirmation message.",
  },
  {
    id: "verified",
    question: "Why is my contribution still verifying?",
    answer: "Every contribution is checked against its mobile money reference. If the group admin has not verified it yet, or the reference cannot be confirmed, the payout stays blocked for that round.",
  },
  {
    id: "payout",
    question: "When is the pot paid out?",
    answer: "Once the round is fully funded and every contribution is verified, the pot is released to the member whose turn it is. If you are the collector, the amount goes straight to your mobile money.",
  },
  {
    id: "missed",
    question: "What happens if a member misses a round?",
    answer: "One miss is allowed. The turn moves on and they pay their missed share plus the current round next time. A second miss removes them from the rotation.",
  },
  {
    id: "account-security",
    question: "How do I manage account security?",
    answer: "Open Account to review your profile and sign out of the app. Your contributions and mobile money details are only used to run your susu groups.",
  },
];

export default function HelpSupport() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [isContactVisible, setContactVisible] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const filteredQuestions = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    if (!searchTerm) {
      return frequentlyAskedQuestions;
    }

    return frequentlyAskedQuestions.filter((item) => (
      item.question.toLowerCase().includes(searchTerm)
      || item.answer.toLowerCase().includes(searchTerm)
    ));
  }, [query]);

  const toggleQuestion = (id) => {
    setExpandedQuestion((current) => current === id ? null : id);
  };

  const submitMessage = () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert(
        "Missing information",
        "Add a subject and message before sending your request.",
        undefined,
        { variant: "warning" }
      );
      return;
    }

    Alert.alert(
      "Request received",
      "Your support request has been recorded. We will get back to you as soon as possible.",
      [{ text: "Done" }],
      { variant: "success" }
    );
    setSubject("");
    setMessage("");
    setContactVisible(false);
  };

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
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <HelpCircle size={30} color={colors.background} />
          </View>
          <Text style={styles.title}>Help & Support</Text>
        </View>

        <View style={styles.searchBox}>
          <Search size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search help topics"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Search help topics"
          />
        </View>

        <Text style={styles.sectionTitle}>Frequently asked questions</Text>

        {filteredQuestions.length > 0 ? (
          <View style={styles.faqList}>
            {filteredQuestions.map((item) => {
              const isExpanded = expandedQuestion === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
                  onPress={() => toggleQuestion(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.question}. ${isExpanded ? "Collapse" : "Expand"}`}
                  accessibilityState={{ expanded: isExpanded }}
                >
                  <View style={styles.faqQuestionRow}>
                    <Text style={styles.faqQuestion}>{item.question}</Text>
                    <View style={[styles.chevronBox, isExpanded && styles.chevronBoxExpanded]}>
                      <ChevronDown
                        size={18}
                        color={isExpanded ? colors.background : colors.textMuted}
                        style={isExpanded ? styles.expandedChevron : null}
                      />
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={styles.faqAnswerWrap}>
                      <View style={styles.faqAnswerDivider} />
                      <Text style={styles.faqAnswer}>{item.answer}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Search size={28} color={colors.textMuted} />
            <Text style={styles.emptyStateTitle}>No answers found</Text>
            <Text style={styles.emptyStateText}>Try a different search term.</Text>
          </View>
        )}

        <View style={styles.supportCard}>
          <View style={styles.supportCardContent}>
            <View style={styles.supportIcon}>
              <MessageCircle size={24} color={colors.background} />
            </View>
            <View style={styles.supportCopy}>
              <Text style={styles.supportTitle}>Still need help?</Text>
              <Text style={styles.supportText}>Send our team a message and we will help you get things sorted.</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => setContactVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Send a message to support"
          >
            <MessageCircle size={18} color={colors.background} />
            <Text style={styles.contactButtonText}>Send a message</Text>
          </TouchableOpacity>

          <View style={styles.supportLinks}>
            <TouchableOpacity
              style={styles.supportLink}
              onPress={() => router.push("/PrivacyPolicy")}
              accessibilityRole="button"
              accessibilityLabel="Read the privacy policy"
            >
              <ShieldCheck size={18} color={colors.gold} />
              <Text style={styles.supportLinkText}>Privacy &amp; data</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.supportLink}
              onPress={() => setContactVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Email support"
            >
              <Mail size={18} color={colors.gold} />
              <Text style={styles.supportLinkText}>Email support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        isVisible={isContactVisible}
        onClose={() => setContactVisible(false)}
        title="Contact support"
      >
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetDescription}>Tell us what you need help with.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="What can we help with?"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Support request subject"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the issue"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Support request message"
            />
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={submitMessage}
            accessibilityRole="button"
            accessibilityLabel="Send support request"
          >
            <Text style={styles.submitButtonText}>Send request</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  backButton: {
    padding: 4,
    marginBottom: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.gold,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "bold",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 14,
  },
  faqList: {
    gap: 10,
  },
  faqItem: {
    backgroundColor: colors.borderSubtle,
    borderRadius: 14,
    padding: 16,
  },
  faqItemExpanded: {
    borderColor: colors.gold,
    borderWidth: 1,
  },
  faqQuestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  faqQuestion: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    lineHeight: 21,
  },
  chevronBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  chevronBoxExpanded: {
    backgroundColor: colors.gold,
  },
  expandedChevron: {
    transform: [{ rotate: "180deg" }],
  },
  faqAnswerWrap: {
    marginTop: 14,
  },
  faqAnswerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surfaceElevated,
    marginBottom: 12,
  },
  faqAnswer: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 36,
    backgroundColor: colors.borderSubtle,
    borderRadius: 14,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyStateText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  supportCard: {
    backgroundColor: colors.borderSubtle,
    borderRadius: 18,
    padding: 20,
    marginTop: 28,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
  },
  supportCardContent: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 18,
  },
  supportIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  supportCopy: {
    flex: 1,
  },
  supportTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "bold",
  },
  supportText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  contactButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  contactButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "bold",
  },
  supportLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  supportLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  supportLinkText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "600",
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  sheetDescription: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    minHeight: 50,
    backgroundColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  messageInput: {
    minHeight: 130,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "bold",
  },
});
