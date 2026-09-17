import React, { useMemo, useState } from "react";
import {
  Alert,
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

const frequentlyAskedQuestions = [
  {
    id: "split-bill",
    question: "How do I split a bill?",
    answer: "Open a group, add a bill, then choose an equal or custom split before sending it.",
  },
  {
    id: "request-money",
    question: "How do I request money?",
    answer: "Use the request action in a group, select the people involved, and enter the amount.",
  },
  {
    id: "edit-bill",
    question: "Can I edit a bill after sending it?",
    answer: "You can update a bill while it is pending. Settled bills remain available in your activity history.",
  },
  {
    id: "receipts",
    question: "Where can I find my receipts?",
    answer: "Open the group or activity history and select the bill to view its details.",
  },
  {
    id: "account-security",
    question: "How do I manage account security?",
    answer: "Open Account, then choose Account & Security to review sign-in and device settings.",
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
      Alert.alert("Missing information", "Add a subject and message before sending your request.");
      return;
    }

    Alert.alert(
      "Request received",
      "Your support request has been recorded. We will get back to you as soon as possible.",
      [{ text: "Done" }]
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
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <HelpCircle size={30} color="#16171b" />
          </View>
          <Text style={styles.title}>Help & Support</Text>
        </View>

        <View style={styles.searchBox}>
          <Search size={20} color="#8e8e93" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search help topics"
            placeholderTextColor="#8e8e93"
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
                        color={isExpanded ? "#16171b" : "#8e8e93"}
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
            <Search size={28} color="#8e8e93" />
            <Text style={styles.emptyStateTitle}>No answers found</Text>
            <Text style={styles.emptyStateText}>Try a different search term.</Text>
          </View>
        )}

        <View style={styles.supportCard}>
          <View style={styles.supportCardContent}>
            <View style={styles.supportIcon}>
              <MessageCircle size={24} color="#16171b" />
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
            <MessageCircle size={18} color="#16171b" />
            <Text style={styles.contactButtonText}>Send a message</Text>
          </TouchableOpacity>

          <View style={styles.supportLinks}>
            <TouchableOpacity
              style={styles.supportLink}
              onPress={() => router.push("/Security")}
              accessibilityRole="button"
              accessibilityLabel="Open account security help"
            >
              <ShieldCheck size={18} color="#fbb81c" />
              <Text style={styles.supportLinkText}>Account security</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.supportLink}
              onPress={() => setContactVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Email support"
            >
              <Mail size={18} color="#fbb81c" />
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
              placeholderTextColor="#8e8e93"
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
              placeholderTextColor="#8e8e93"
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
    backgroundColor: "#16171b",
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
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "bold",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingVertical: 14,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 14,
  },
  faqList: {
    gap: 10,
  },
  faqItem: {
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    padding: 16,
  },
  faqItemExpanded: {
    borderColor: "#fbb81c",
    borderWidth: 1,
  },
  faqQuestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  faqQuestion: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    lineHeight: 21,
  },
  chevronBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#16171b",
    justifyContent: "center",
    alignItems: "center",
  },
  chevronBoxExpanded: {
    backgroundColor: "#fbb81c",
  },
  expandedChevron: {
    transform: [{ rotate: "180deg" }],
  },
  faqAnswerWrap: {
    marginTop: 14,
  },
  faqAnswerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3b40",
    marginBottom: 12,
  },
  faqAnswer: {
    color: "#8e8e93",
    fontSize: 14,
    lineHeight: 21,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 36,
    backgroundColor: "#2a2b30",
    borderRadius: 14,
  },
  emptyStateTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyStateText: {
    color: "#8e8e93",
    fontSize: 14,
    marginTop: 4,
  },
  supportCard: {
    backgroundColor: "#2a2b30",
    borderRadius: 18,
    padding: 20,
    marginTop: 28,
    borderWidth: 1,
    borderColor: "#3a3b40",
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
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
  },
  supportCopy: {
    flex: 1,
  },
  supportTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
  },
  supportText: {
    color: "#8e8e93",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  contactButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#fbb81c",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  contactButtonText: {
    color: "#16171b",
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
    color: "#fbb81c",
    fontSize: 14,
    fontWeight: "600",
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  sheetDescription: {
    color: "#8e8e93",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: "#8e8e93",
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    minHeight: 50,
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 15,
  },
  messageInput: {
    minHeight: 130,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#fbb81c",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitButtonText: {
    color: "#16171b",
    fontSize: 16,
    fontWeight: "bold",
  },
});
