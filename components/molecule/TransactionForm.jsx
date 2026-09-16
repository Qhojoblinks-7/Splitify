import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Text, StyleSheet } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TransactionForm({
  title,
  subtitle,
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
  balance,
  onAction,
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState(recipients[0]?.id);
  const [selectedMethod, setSelectedMethod] = useState(methodOptions[0]?.id);
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
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={28} color="#ffffff" />
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerIcon}>{headerIcon}</View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {balance !== undefined && (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceCurrency}>GHC</Text>
              <Text style={styles.balanceValue}>{balance}</Text>
            </View>
          </View>
        )}

        {showRecipient && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipient</Text>
            <View style={styles.recipientList}>
              {recipients.map((recipient) => (
                <Pressable
                  key={recipient.id}
                  onPress={() => {
                    setSelectedRecipient(recipient.id);
                    setError("");
                  }}
                  style={({ pressed }) => [
                    styles.recipientItem,
                    selectedRecipient === recipient.id && styles.recipientItemSelected,
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
                      numericAmount === quickAmount && styles.quickAmountTextSelected,
                    ]}
                  >
                    +{quickAmount}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {showMethod && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment method</Text>
            <View style={styles.methodList}>
              {methodOptions.map((method) => (
                <Pressable
                  key={method.id}
                  onPress={() => {
                    setSelectedMethod(method.id);
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
                    <Text style={styles.methodDescription}>{method.description}</Text>
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
          </View>
        )}

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16171b",
  },
  scrollContent: {
    padding: 20,
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
  subtitle: {
    color: "#8e8e93",
    fontSize: 15,
    marginTop: 5,
    textAlign: "center",
    lineHeight: 21,
  },
  balanceCard: {
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  balanceLabel: {
    color: "#8e8e93",
    fontSize: 13,
    marginBottom: 6,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  balanceCurrency: {
    color: "#fbb81c",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 6,
  },
  balanceValue: {
    color: "#ffffff",
    fontSize: 32,
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
  recipientList: {
    gap: 10,
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
  amountInput: {
    minHeight: 66,
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
    fontSize: 28,
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
  methodList: {
    gap: 10,
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
    minHeight: 92,
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
  pressed: {
    opacity: 0.78,
  },
});
