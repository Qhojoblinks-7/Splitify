import React from "react";
import { Alert } from "react-native";
import { Upload, CreditCard, Building2, Smartphone } from "lucide-react-native";
import { useRouter } from "expo-router";
import TransactionForm from "../components/molecule/TransactionForm";

const methods = [
  {
    id: "visa",
    label: "Visa ending in 4242",
    description: "Debit card",
    icon: <CreditCard size={20} color="#fbb81c" />,
  },
  {
    id: "mastercard",
    label: "Mastercard ending in 5555",
    description: "Debit card",
    icon: <CreditCard size={20} color="#fbb81c" />,
  },
  {
    id: "bank",
    label: "Bank transfer",
    description: "GCB Bank ending 8890",
    icon: <Building2 size={20} color="#fbb81c" />,
  },
  {
    id: "momo",
    label: "Mobile Money",
    description: "MTN MoMo ending 5678",
    icon: <Smartphone size={20} color="#fbb81c" />,
  },
];

export default function TopUp() {
  const router = useRouter();

  const handleTopUp = ({ amount, note, method }) => {
    Alert.alert(
      "Top up successful",
      `GHC ${amount} was added to your Splitify balance using ${method.label}.${note ? `\nNote: ${note}` : ""}`,
      [
        { text: "View History", style: "default", onPress: () => router.replace("/History") },
      ]
    );
  };

  return (
    <TransactionForm
      title="Top Up"
      headerIcon={<Upload size={28} color="#16171b" />}
      actionLabel="Top Up Balance"
      actionIcon={<Upload size={20} color="#16171b" />}
      methodOptions={methods}
      quickAmounts={[50, 100, 250, 500]}
      notePlaceholder="Add a reference for this top up"
      onAction={handleTopUp}
    />
  );
}
