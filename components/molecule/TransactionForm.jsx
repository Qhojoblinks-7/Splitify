import React, { useState, useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Text, StyleSheet } from "react-native";
import { ChevronLeft, ChevronDown, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet from "./BottomSheet";

export default function TransactionForm({
  title,
  headerIcon,
  actionLabel,
  actionIcon,
  recipients = [],
  showRecipient = false,
  showMethod = true,
  methodOptions = [],
  quickAmounts = [],
  notePlaceholder = "Add a note",
  summaryPrefix = "Sending to",
  onAction,
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState(
    recipients[0]?.id
  );
  const [selectedMethod, setSelectedMethod] = useState(
    methodOptions[0]?.id
  );
  const [recipientSearch, setRecipientSearch] = useState("");
  const [showMethodSheet, setShowMethodSheet] = useState(false);
  const [showRecipientSheet, setShowRecipientSheet] = useState(false);
  const [error, setError] = useState("");

  const selectedRecipientData = recipients.find(
    (recipient) => recipient.id === selectedRecipient
  );
  const selectedMethodData = methodOptions.find(
    (method) => method.id === selectedMethod
  );
  const numericAmount = Number(amount.replace(/[^0-9.]/g, ""));
  const formattedAmount = Number.isFinite(numericAmount)
    ? numericAmount.toFixed(2)
    : "0.00";

  const filteredRecipients = useMemo(() => {
    if (!recipientSearch.trim()) return recipients;
    const query = recipientSearch.toLowerCase();
    return recipients.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.handle.toLowerCase().includes(query)
    );
  }, [recipients, recipientSearch]);

  const handleAction = () => {
    if (!amount.trim() || numericAmount <= 0) {
      setError("Enter an amount greater than GHC 0.00.");
      return;
    }

    if (showRecipient && !selectedRecipientData) {
      setError("Select a recipient before continuing.");
      return;
    }

    if (showMethod && !selectedMethodData) {
      setError("Select a payment method before continuing.");
      return;
    }

    setError("");
    onAction({
      amount: formattedAmount,
      note: note.trim(),
      recipient: selectedRecipientData || null,
      method: selectedMethodData || null,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={28} color="#ffffff" />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showMethod && methodOptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment method</Text>
            <Pressable
              onPress={() => setShowMethodSheet(true)}
              style={({ pressed }) => [
                styles.methodDropdown,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Select payment method"
            >
              <View style={styles.methodDropdownInner}>
                <View style={styles.methodIcon}>{selectedMethodData?.icon}</View>
                <View style={styles.methodDropdownDetails}>
                  <Text style={styles.methodDropdownName}>
                    {selectedMethodData?.label || "Select method"}
                  </Text>
                  <Text style={styles.methodDropdownDesc}>
                    {selectedMethodData?.description || ""}
                  </Text>
                </View>
              </View>
              <ChevronDown size={20} color="#8e8e93" />
            </Pressable>
          </View>
        )}

        {showRecipient && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipient</Text>
            <View style={styles.recipientField}>
              <TextInput
                value={
                  recipientSearch ||
                  (selectedRecipientData ? selectedRecipientData.name : "")
                }
                onChangeText={(text) => {
                  setRecipientSearch(text);
                }}
                placeholder="Search or select recipient"
                placeholderTextColor="#666666"
                style={styles.recipientInput}
                accessibilityLabel="Recipient"
              />
              <Pressable
                onPress={() => setShowRecipientSheet(true)}
                style={styles.phonebookIcon}
                accessibilityRole="button"
                accessibilityLabel="Show contacts"
              >
                <Users size={20} color="#8e8e93" />
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount</Text>
          <View style={styles.amountInput}>
            <Text style={styles.currencyLabel}>GHC</Text>
            <TextInput
              value={amount}
              onChangeText={(value) => {
                setAmount(value);
                setError("");
              }}
              placeholder="0.00"
              placeholderTextColor="#666666"
              keyboardType="decimal-pad"
              maxLength={12}
              style={styles.amountInputText}
              accessibilityLabel="Amount"
            />
          </View>
          {quickAmounts.length > 0 && (
            <View style={styles.quickAmounts}>
              {quickAmounts.map((quickAmount) => (
                <Pressable
                  key={quickAmount}
                  onPress={() => {
                    setAmount(String(quickAmount));
                    setError("");
                  }}
                  style={({ pressed }) => [
                    styles.quickAmount,
                    numericAmount === quickAmount && styles.quickAmountSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.quickAmountText,
                      numericAmount === quickAmount &&
                        styles.quickAmountTextSelected,
                    ]}
                  >
                    +{quickAmount}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note</Text>
          <TextInput
            value={note}
            onChangeText={(value) => {
              setNote(value);
              setError("");
            }}
            placeholder={notePlaceholder}
            placeholderTextColor="#666666"
            multiline
            numberOfLines={3}
            maxLength={120}
            style={styles.noteInput}
            accessibilityLabel="Note"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={handleAction}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          {actionIcon}
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </Pressable>

        <Text style={styles.summaryText}>
          {showRecipient && selectedRecipientData
            ? `${summaryPrefix} ${selectedRecipientData.name}`
            : title}{" "}
          {" — GHC "}
          {formattedAmount}
        </Text>
      </ScrollView>

      {showMethod && (
        <BottomSheet
          isVisible={showMethodSheet}
          onClose={() => setShowMethodSheet(false)}
          title="Select payment method"
        >
          <View style={styles.sheetList}>
            {methodOptions.map((method) => (
              <Pressable
                key={method.id}
                onPress={() => {
                  setSelectedMethod(method.id);
                  setShowMethodSheet(false);
                  setError("");
                }}
                style={({ pressed }) => [
                  styles.methodItem,
                  selectedMethod === method.id && styles.methodItemSelected,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="radio"
                accessibilityLabel={`Select ${method.label}`}
                accessibilityState={{ selected: selectedMethod === method.id }}
              >
                <View style={styles.methodIcon}>{method.icon}</View>
                <View style={styles.methodDetails}>
                  <Text style={styles.methodName}>{method.label}</Text>
                  <Text style={styles.methodDescription}>
                    {method.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.methodCheck,
                    selectedMethod === method.id && styles.methodCheckSelected,
                  ]}
                />
              </Pressable>
            ))}
          </View>
        </BottomSheet>
      )}

      {showRecipient && (
        <BottomSheet
          isVisible={showRecipientSheet}
          onClose={() => {
            setShowRecipientSheet(false);
            setRecipientSearch("");
          }}
          title="Select recipient"
        >
          <TextInput
            value={recipientSearch}
            onChangeText={setRecipientSearch}
            placeholder="Search by name or handle..."
            placeholderTextColor="#666666"
            style={styles.searchInput}
            accessibilityLabel="Search recipients"
          />
          <View style={styles.sheetList}>
            {filteredRecipients.map((recipient) => (
              <Pressable
                key={recipient.id}
                onPress={() => {
                  setSelectedRecipient(recipient.id);
                  setRecipientSearch("");
                  setShowRecipientSheet(false);
                  setError("");
                }}
                style={({ pressed }) => [
                  styles.recipientItem,
                  selectedRecipient === recipient.id &&
                    styles.recipientItemSelected,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${recipient.name}`}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{recipient.initials}</Text>
                </View>
                <View style={styles.recipientDetails}>
                  <Text style={styles.recipientName}>{recipient.name}</Text>
                  <Text style={styles.recipientHandle}>{recipient.handle}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </BottomSheet>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16171b",
  },
  headerContainer: {
    backgroundColor: "#16171b",
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backButton: {
    padding: 4,
    marginBottom: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "bold",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  methodDropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  methodDropdownInner: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  methodDropdownDetails: {
    flex: 1,
    marginLeft: 12,
  },
  methodDropdownName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  methodDropdownDesc: {
    color: "#8e8e93",
    fontSize: 13,
    marginTop: 2,
  },
  recipientField: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  recipientInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingVertical: 14,
  },
  phonebookIcon: {
    padding: 4,
  },
  searchInput: {
    color: "#ffffff",
    fontSize: 15,
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  sheetList: {
    gap: 10,
  },
  amountInput: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  currencyLabel: {
    color: "#fbb81c",
    fontSize: 20,
    fontWeight: "bold",
    marginRight: 10,
  },
  amountInputText: {
    flex: 1,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
    paddingVertical: 14,
  },
  quickAmounts: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  quickAmount: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  quickAmountSelected: {
    backgroundColor: "#fbb81c",
    borderColor: "#fbb81c",
  },
  quickAmountText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  quickAmountTextSelected: {
    color: "#16171b",
  },
  methodItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  methodItemSelected: {
    borderColor: "#fbb81c",
    backgroundColor: "#302f27",
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#16171b",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  methodDetails: {
    flex: 1,
  },
  methodName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  methodDescription: {
    color: "#8e8e93",
    fontSize: 13,
    marginTop: 2,
  },
  methodCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#666666",
  },
  methodCheckSelected: {
    backgroundColor: "#fbb81c",
    borderColor: "#fbb81c",
  },
  noteInput: {
    minHeight: 52,
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#33353b",
    textAlignVertical: "top",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    marginBottom: 12,
  },
  actionButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: "#fbb81c",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  actionButtonText: {
    color: "#16171b",
    fontSize: 16,
    fontWeight: "bold",
  },
  summaryText: {
    color: "#8e8e93",
    fontSize: 13,
    textAlign: "center",
    marginTop: 14,
  },
  recipientItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  recipientItemSelected: {
    borderColor: "#fbb81c",
    backgroundColor: "#302f27",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#16171b",
    fontSize: 14,
    fontWeight: "bold",
  },
  recipientDetails: {
    flex: 1,
  },
  recipientName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  recipientHandle: {
    color: "#8e8e93",
    fontSize: 13,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.78,
  },
});