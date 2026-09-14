import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Settings, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";

/**
 * Pefile.jsx
 *
 * This component displays the user's profile information and provides navigation to various settings and account management screens.
 * It includes a header with the user's name and email, as well as a list of options for managing the account.
 */

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const onPressSettings = () => {
    router.push("/Settings");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Hearder Section */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>JD</Text>
        </View>
        <View style={styles.userInfo}>
       <Text style={styles.name}>John Doe</Text>
       <Text style={styles.email}>+1 (555) 123-4567</Text>
        </View>
        <Settings style={styles.settingsIcon} onPress={onPressSettings} />
      </View>

      {/* Linked Phone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Linked Phone</Text>
        <View style={styles.sectionContent}>
          <Text style={styles.sectionText}>+1 (555) 123-4567</Text>
          <TouchableOpacity
            onPress={() => router.push("/Settings/LinkedPhone")}
          >
            <ChevronRight size={24} color="#fbb81c" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu Items */}
      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuText}>Analytics</Text>
        <ChevronRight size={24} color="#fbb81c" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuText}>Savings</Text>
        <ChevronRight size={24} color="#8e8e93" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuText}>Notifications</Text>
        <ChevronRight size={24} color="#8e8e93" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuText}>Help & Support</Text>
        <ChevronRight size={24} color="#8e8e93" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuText}>Settings</Text>
        <ChevronRight size={24} color="#8e8e93" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16171b', paddingHorizontal: 20 },
  header: { alignItems: 'center', paddingVertical: 30 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fbb81c', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#16171b', fontSize: 28, fontWeight: 'bold' },
  name: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginTop: 12 },
  email: { color: '#8e8e93', fontSize: 14, marginTop: 4 },
  section: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2a2b30' },
  sectionTitle: { color: '#8e8e93', fontSize: 12, textTransform: 'uppercase' },
  sectionValue: { color: '#ffffff', fontSize: 16, marginTop: 4 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2a2b30' },
  menuText: { color: '#ffffff', fontSize: 16 },
});