import React from "react";
import { Alert } from "react-native";
import { Download } from "lucide-react-native";
import { useRouter } from "expo-router";
import TransactionForm from "../components/molecule/TransactionForm";

const recipients = [
  { id: "ama", name: "Ama Boateng", handle: "@amab", initials: "AB" },
  { id: "kofi", name: "Kofi Mensah", handle: "@kofim", initials: "KM" },
  { id: "jane", name: "Jane Smith", handle: "@janes", initials: "JS" },
];

export default function RequestMoney() {
  const router = useRouter();

  const handleRequest = ({ amount, note, recipient }) => {
    Alert.alert(
      "Request sent",
      `A request for GHC ${amount} was sent to ${recipient.name}.${note ? `\nNote: ${note}` : ""}`,
      [
        { text: "Done", style: "default", onPress: () => router.replace("/History") },
      ]
    );
  };

  return (
    <TransactionForm
      title="Request Money"
      headerIcon={<Download size={28} color="#16171b" />}
      actionLabel="Send Request"
      actionIcon={<Download size={20} color="#16171b" />}
      recipients={recipients}
      showRecipient
      showMethod={false}
      quickAmounts={[20, 50, 100, 250]}
      notePlaceholder="Add a reason for this request"
      summaryPrefix="Requesting from"
      onAction={handleRequest}
    />
  );
}
