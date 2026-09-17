import React from "react";
import { Alert } from "react-native";
import { Send, UserRound, CreditCard, WalletCards } from "lucide-react-native";
import { useRouter } from "expo-router";
import TransactionForm from "../components/molecule/TransactionForm";

const recipients = [
  { id: "ama", name: "Ama Boateng", handle: "@amab", initials: "AB" },
  { id: "kofi", name: "Kofi Mensah", handle: "@kofim", initials: "KM" },
  { id: "jane", name: "Jane Smith", handle: "@janes", initials: "JS" },
];

const methods = [
  {
    id: "balance",
    label: "Splitify Balance",
    description: "Available balance",
    icon: <WalletCards size={20} color="#fbb81c" />,
  },
  {
    id: "visa",
    label: "Visa ending in 4242",
    description: "Default card",
    icon: <CreditCard size={20} color="#fbb81c" />,
  },
  {
    id: "contact",
    label: "Add recipient",
    description: "Choose from contacts",
    icon: <UserRound size={20} color="#fbb81c" />,
  },
];

export default function SendMoney() {
  const router = useRouter();

  const handleSend = ({ amount, note, recipient, method }) => {
    Alert.alert(
      "Send money",
      `You are sending GHC ${amount} to ${recipient.name} with ${method.label}.${note ? `\nNote: ${note}` : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => router.replace("/History"),
        },
      ]
    );
  };

  return (
    <TransactionForm
      title="Send Money"
      headerIcon={<Send size={28} color="#16171b" />}
      actionLabel="Send Money"
      actionIcon={<Send size={20} color="#16171b" />}
      recipients={recipients}
      showRecipient
      methodOptions={methods}
      quickAmounts={[20, 50, 100, 200]}
      notePlaceholder="What is this payment for?"
      onAction={handleSend}
    />
  );
}
