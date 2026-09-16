import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Search } from 'lucide-react-native';
import ActivityCard from '../components/molecule/ActivityCard';
import { useState } from 'react';
import { getDayLabel, makeDate, makeMonthAgo } from '../utils/dayLabel';

const allActivities = [
  { id: '1', date: makeDate(0), title: 'Dinner at Restaurant', amount: '45.00 GHC', receipientName: 'John Doe', receipientEmail: 'john.doe@example.com', initialStatus: 'pay' },
  { id: '2', date: makeDate(0), title: 'Movie Night', amount: '35.00 GHC', receipientName: 'Kofi Mensah', receipientEmail: 'kofi.mensah@example.com', initialStatus: 'paid' },
  { id: '3', date: makeDate(1), title: 'Grocery Shopping', amount: '120.50 GHC', receipientName: 'Alex Johnson', receipientEmail: 'alex.johnson@example.com', initialStatus: 'paid' },
  { id: '4', date: makeDate(1), title: 'Salary for June', amount: '1500.00 GHC', senderName: 'Jane Smith', initialStatus: 'request' },
  { id: '5', date: makeDate(3), title: 'Freelance Project', amount: '600.00 GHC', senderName: 'Emily Davis', initialStatus: 'request' },
  { id: '6', date: makeDate(3), title: 'Internet Bundle', amount: '150.00 GHC', receipientName: 'MTN Ghana', receipientEmail: 'support@mtnghana.com', initialStatus: 'paid' },
  { id: '7', date: makeMonthAgo(15), title: 'Old Bank Transfer', amount: '75.00 GHC', receipientName: 'Bob Wilson', receipientEmail: 'bob.wilson@example.com', initialStatus: 'paid' },
];

export default function Activity() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activePill, setActivePill] = useState('All');

  const handleBack = () => router.back();

  const filtered = allActivities
    .filter(item => {
      if (activePill === 'All') return true;
      if (activePill === 'You Owe') return item.initialStatus === 'pay';
      if (activePill === 'Owe to You') return item.initialStatus === 'request';
      return true;
    })
    .sort((a, b) => b.date - a.date);

  const grouped = filtered.reduce((acc, item) => {
    const label = getDayLabel(item.date);
    const group = acc.find(g => g.day === label);
    if (group) {
      group.items.push(item);
    } else {
      acc.push({ day: label, items: [item] });
    }
    return acc;
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <ChevronLeft size={28} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle}>Activity</Text>
        <Pressable style={styles.searchBtn}>
          <Search size={24} color="#ffffff" />
        </Pressable>
      </View>

      <View style={styles.pillsRow}>
        {['All', 'You Owe', 'Owe to You'].map(pill => (
          <Pressable
            key={pill}
            onPress={() => setActivePill(pill)}
            style={({ pressed }) => [
              styles.pill,
              activePill === pill && styles.pillActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.pillText, activePill === pill && styles.pillTextActive]}>
              {pill}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.activityList}
        showsVerticalScrollIndicator={false}
      >
        {grouped.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No activities found</Text>
          </View>
        ) : (
          grouped.map(group => (
            <View key={group.day} style={styles.dayGroup}>
              <View style={styles.dayDivider}>
                <Text style={styles.dayLabel}>{group.day}</Text>
                <View style={styles.dayLine} />
              </View>
              {group.items.map(item => (
                <ActivityCard
                  key={item.id}
                  title={item.title}
                  amount={item.amount}
                  receipientName={item.receipientName}
                  receipientEmail={item.receipientEmail}
                  senderName={item.senderName}
                  initialStatus={item.initialStatus}
                />
              ))}
            </View>
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16171b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 48,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  searchBtn: {
    padding: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#2a2b30',
    borderWidth: 1,
    borderColor: '#33353b',
  },
  pillActive: {
    backgroundColor: '#fbb81c',
  },
  pillText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#16171b',
  },
  activityList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dayGroup: {
    marginBottom: 16,
  },
  dayDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayLabel: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dayLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2b30',
    marginLeft: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: '#8e8e93',
    fontSize: 16,
  },
});
