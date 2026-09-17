import {useLocalSearchParams} from "expo-router";
import { View, Text, StyleSheet , FlatList} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActivityCard from "../../components/molecule/ActivityCard";
import BottomSheet from "../../components/molecule/BottomSheet";
import { useState } from "react";
import { useTabBarStore } from "../../store/tabBar";

const initialBills = [
    { id: "1", title: "Dinner", amount: "45.00 GHC", receipientName: "Jane Smith", receipientEmail: "jane.smith@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "2", title: "Groceries", amount: "120.00 GHC", receipientName: "Kofi", receipientEmail: "kofi@example.com", senderName: "John Doe", initialStatus: "request" },
    { id: "3", title: "Transport", amount: "30.00 GHC", receipientName: "Ama", receipientEmail: "ama@example.com", senderName: "Jane Smith", initialStatus: "paid" },
];

export default function GroupDetailes() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [bills, setBills] = useState(initialBills);
  const [isPaymentVisible, setPaymentVisible] = useState(false);
  const [paymentCard, setPaymentCard] = useState(null);
  const { setMode, setCustomButtons } = useTabBarStore();

  const handlePayPress = (card) => {
    setPaymentCard(card);
    setPaymentVisible(true);
    setMode('custom');
    setCustomButtons([
      { label: 'Cancel', variant: 'cancel', onPress: () => { setPaymentVisible(false); setPaymentCard(null); setMode('tabs'); setCustomButtons([]); } },
      { label: 'Pay Now', variant: 'primary', onPress: () => {
        setBills(prev => prev.map(a => a.id === card.id ? { ...a, initialStatus: 'paid' } : a));
        setPaymentVisible(false);
        setPaymentCard(null);
        setMode('tabs');
        setCustomButtons([]);
      } },
    ]);
  };

  const handlePaymentClose = () => {
    setPaymentVisible(false);
    setPaymentCard(null);
    setMode('tabs');
    setCustomButtons([]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
        {/*Group header */}
        <View style={styles.header}>
            <Text style={styles.groupName}>Group Name: {bills.id}</Text>
            <Text style={styles.memberCount}>3 members</Text>
        </View>

        <FlatList
            data={bills}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
                <ActivityCard
                    title={item.title}
                    amount={item.amount}
                    receipientName={item.receipientName}
                    receipientEmail={item.receipientEmail}
                    senderName={item.senderName}
                    initialStatus={item.initialStatus}
                    onPayPress={handlePayPress}
                />
            )}
        />

        {paymentCard && (
            <BottomSheet
                isVisible={isPaymentVisible}
                onClose={handlePaymentClose}
                title="Pay"
            >
                <View style={styles.paymentSheetContent}>
                    <View style={styles.divider} />

                    <Text style={styles.paymentLabel}>Amount</Text>
                    <Text style={styles.paymentAmount}>{paymentCard.amount}</Text>

                    <View style={styles.payToRow}>
                        <Text style={styles.payToLabel}>Pay to</Text>
                        <View style={styles.payToLine} />
                    </View>

                    <View style={styles.receiverRow}>
                        <View style={styles.receiverAvatar}>
                            <Text style={styles.receiverAvatarText}>
                                {(paymentCard.receipientName || 'R').charAt(0)}
                            </Text>
                        </View>
                        <View style={styles.receiverInfo}>
                            <Text style={styles.receiverName}>{paymentCard.receipientName || 'Receiver'}</Text>
                            <Text style={styles.receiverEmail}>{paymentCard.receipientEmail || 'receiver@example.com'}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />
                </View>
            </BottomSheet>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16171b', paddingHorizontal: 16 },
  header: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#2a2b30' },
  groupName: { color: '#fbb81c', fontSize: 24, fontWeight: 'bold' },
  memberCount: { color: '#8e8e93', fontSize: 14, marginTop: 4 },
  list: { flex: 1, marginTop: 16 },
  paymentSheetContent: {
      paddingHorizontal: 20,
      paddingBottom: 84,
  },
  divider: {
      height: 1,
      backgroundColor: '#33353b',
      marginVertical: 16,
  },
  paymentLabel: {
      color: '#8e8e93',
      fontSize: 14,
      fontWeight: '600',
  },
  paymentAmount: {
      color: '#ffffff',
      fontSize: 30,
      fontWeight: 'bold',
      marginVertical: 4,
  },
  payToRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 18,
  },
  payToLabel: {
      color: '#8e8e93',
      fontSize: 14,
      fontWeight: '600',
      marginRight: 10,
  },
  payToLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#33353b',
  },
  receiverRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
  },
  receiverAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#fbb81c',
      justifyContent: 'center',
      alignItems: 'center',
  },
  receiverAvatarText: {
      color: '#16171b',
      fontSize: 16,
      fontWeight: 'bold',
  },
  receiverInfo: {
      marginLeft: 14,
      flex: 1,
  },
  receiverName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
  },
  receiverEmail: {
      color: '#8e8e93',
      fontSize: 13,
      marginTop: 3,
  },
});