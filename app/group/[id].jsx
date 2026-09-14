import {useLocalSearchParams} from "expo-router";
import { View, Text, StyleSheet , FlatList} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActivityCard from "../../components/molecule/ActivityCard";

export default function GroupDetailes() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  const bills = [
    { id: "1", title: "Dinner", amount: "45.00 GHC", receipientName: "Jane Smith", senderName: "John Doe", initialStatus: "pay" },
    { id: "2", title: "Groceries", amount: "120.00 GHC", receipientName: "Kofi", senderName: "John Doe", initialStatus: "request" },
    { id: "3", title: "Transport", amount: "30.00 GHC", receipientName: "Ama", senderName: "Jane Smith", initialStatus: "paid" },
  ];

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
                    senderName={item.senderName}
                    initialStatus={item.initialStatus}
                />
            )}
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16171b', paddingHorizontal: 16 },
  header: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#2a2b30' },
  groupName: { color: '#fbb81c', fontSize: 24, fontWeight: 'bold' },
  memberCount: { color: '#8e8e93', fontSize: 14, marginTop: 4 },
  list: { flex: 1, marginTop: 16 },
});