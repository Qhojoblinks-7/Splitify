import {View, Text, StyleSheet, ScrollView} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SquareExclamationPoint, Bell, Clock, Shield, Settings } from 'lucide-react-native';
import { getDayLabel, makeDate, makeMonthAgo } from '../../utils/dayLabel';

const allNotifications = [
  { id: '1', date: makeDate(0), icon: SquareExclamationPoint, iconColor: '#fbb81c', title: 'New Feature Available!', description: 'Check out the new Splitify feature that allows you to split bills with friends more easily.' },
  { id: '2', date: makeDate(0), icon: Bell, iconColor: '#4ade80', title: 'Payment Received', description: 'You received a payment of 1,500.00 GHC from Jane Smith.' },
  { id: '3', date: makeDate(1), icon: Clock, iconColor: '#fbb81c', title: 'Bill Reminder', description: "Don't forget to settle your dinner bill with John Doe." },
  { id: '4', date: makeDate(3), icon: Shield, iconColor: '#60a5fa', title: 'Security Update', description: 'Review your recent login activity in Security settings.' },
  { id: '5', date: makeMonthAgo(15), icon: SquareExclamationPoint, iconColor: '#ff6b6b', title: 'Security Alert', description: 'A new login was detected from an unrecognized device.' },
];

export default function Notifications() {
  const inserts = useSafeAreaInsets();
  const router = useRouter();

  const onPressSettings = () => {
    router.push('/Settings');
  };

  const sorted = [...allNotifications].sort((a, b) => b.date - a.date);

  const grouped = sorted.reduce((acc, item) => {
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
    <View style={[styles.container, { paddingTop: inserts.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Notifications</Text>
        <Settings size={20} color="#fbb81c" style={styles.settingsIcon} onPress={onPressSettings} />
      </View>

      <ScrollView
        style={styles.notificationsList}
        showsVerticalScrollIndicator={false}
      >
        {grouped.map(group => (
          <View key={group.day} style={styles.dayGroup}>
            <View style={styles.dayDivider}>
              <Text style={styles.dayLabel}>{group.day}</Text>
              <View style={styles.dayLine} />
            </View>
            {group.items.map(item => (
              <View key={item.id} style={styles.notificationItem}>
                <item.icon size={24} color={item.iconColor} />
                <View style={styles.notificationItemTextContainer}>
                  <Text style={styles.notificationItemTitle}>{item.title}</Text>
                  <Text style={styles.notificationItemDescription}>
                    {item.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16171b',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    color: '#fbb81c',
    fontSize: 24,
    fontWeight: 'bold',
  },
  settingsIcon: {
    color: '#fbb81c',
    padding: 4,
  },
  notificationsList: {
    flex: 1,
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
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1f25',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  notificationItemTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  notificationItemTitle: {
    color: '#fbb81c',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationItemDescription: {
    color: '#ffffff',
    fontSize: 14,
  },
});
