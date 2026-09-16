import React from "react";
import { Alert } from "react-native";
import { LogOut, Building2, Smartphone, WalletCards } from "lucide-react-native";
import { useRouter } from "expo-router";
import TransactionForm from "../components/molecule/TransactionForm";

const methods = [
  {
    id: "bank",
    label: "GCB Bank ending 8890",
    description: "Bank transfer",
    icon: <Building2 size={20} color="#fbb81c" />,
  },
  {
    id: "momo",
    label: "MTN MoMo ending 5678",
    description: "Mobile Money",
    icon: <Smartphone size={20} color="#fbb81c" />,
  },
  {
    id: "balance",
    label: "Splitify Balance",
    description: "Withdraw from available balance",
    icon: <WalletCards size={20} color="#fbb81c" />,
  },
];

export default function Withdraw() {
  const router = useRouter();

  const handleWithdraw = ({ amount, note, method }) => {
    Alert.alert(
      "Withdrawal requested",
      `GHC ${amount} will be withdrawn to ${method.label}.${note ? `\nNote: ${note}` : ""}`,
      [
        { text: "Done", style: "default", onPress: () => router.replace("/History") },
      ]
    );
  };

  return (
    <TransactionForm
      title="Withdraw"
      subtitle="Move money from your balance to your account"
      headerIcon={<LogOut size={28} color="#16171b" />}
      actionLabel="Withdraw Funds"
      actionIcon={<LogOut size={20} color="#16171b" />}
      methodOptions={methods}
      quickAmounts={[50, 100, 250, 500]}
      balance="1,250.00"
      notePlaceholder="Add a withdrawal reference"
      onAction={handleWithdraw}
    />
  );
}
