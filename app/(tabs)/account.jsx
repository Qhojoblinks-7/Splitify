import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Alert, toast } from "../../utils/alert";
import {
  ChevronRight,
  FileText,
  Info,
  ScrollText,
  HelpCircle,
  LogOut,
  Bell,
  CloudOff,
  IdCard,
  Phone,
} from "lucide-react-native";
import { useSessionStore } from "../../store/session";
import { useNetworkStore } from "../../store/network";
import { useQueueStore } from "../../store/queue";
import { useSusuStore } from "../../store/susu";
import { initialsOf } from "../../services/susu";

export default function Account() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);
  const notificationsEnabled = useSessionStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSessionStore((s) => s.setNotificationsEnabled);

  const isOnline = useNetworkStore((s) => s.isOnline);
  const override = useNetworkStore((s) => s.override);
  const setOverride = useNetworkStore((s) => s.setOverride);

  const queued = useQueueStore((s) => s.items.length);
  const groups = useSusuStore((s) => s.groups);
  const userId = useSusuStore((s) => s.userId);

  const stats = React.useMemo(() => {
    const mine = groups.filter((g) => g.members.some((m) => m.id === userId));
    const adminOf = mine.filter((g) =>
      g.members.some((m) => m.id === userId && m.role === "admin")
    );
    return { total: mine.length, adminOf: adminOf.length };
  }, [groups, userId]);

  const initials = user?.initials || initialsOf(user?.name || "G");

  const onSignOut = () => {
    Alert.alert(
      "Sign out?",
      "You will need to log in again to see your susu groups.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          onPress: () => {
            signOut();
            router.replace("/Auth/Login");
          },
        },
      ],
      { variant: "warning" }
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, user?.avatarColor && { backgroundColor: user.avatarColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || "Member"}</Text>
            <Text style={styles.profileEmail}>{user?.phone || user?.email || "No number on file"}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <Stat value={stats.total} label="susus" />
          <View style={styles.statDivider} />
          <Stat value={stats.adminOf} label="as admin" />
          <View style={styles.statDivider} />
          <Stat value={queued} label="unsynced" />
        </View>

        <View style={styles.brandCard}>
          <Text style={styles.brand}>Growl</Text>
          <Text style={styles.brandTagline}>Grow Your Wealth Together</Text>
          <Text style={styles.brandCopy}>
            Growl helps your circle save together — fixed weekly contributions, a clear rotation,
            and no more counting who paid what. Growl keeps the record of your contributions. It
            never holds your money.
          </Text>
        </View>

        <SectionLabel>Verification</SectionLabel>
        <MenuItem
          icon={IdCard}
          label={user?.ghanaCardVerified ? "Ghana Card verified" : "Verify your Ghana Card"}
          hint={user?.ghanaCardVerified ? "Verified" : "Required before your first payout"}
          onPress={() =>
            toast.info(
              user?.ghanaCardVerified
                ? "Your Ghana Card is already verified."
                : "Ghana Card verification needs the identity service, which is not connected yet."
            )
          }
        />
        <MenuItem
          icon={Phone}
          label="Mobile money number"
          hint={user?.phone || "Not set"}
          onPress={() =>
            toast.info("Editing your number needs a verified session, which is not connected yet.")
          }
        />

        <SectionLabel>Notifications</SectionLabel>
        <View style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Bell size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Turn collection reminders</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: "#2a2b30", true: "#4a3a10" }}
            thumbColor={notificationsEnabled ? "#fbb81c" : "#666666"}
          />
        </View>

        <SectionLabel>Connection</SectionLabel>
        <View style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <CloudOff size={20} color={isOnline ? "#4ade80" : "#ef4444"} />
            <View>
              <Text style={styles.menuText}>{isOnline ? "Online" : "Offline"}</Text>
              {queued > 0 ? (
                <Text style={styles.menuHint}>
                  {queued} contribution{queued === 1 ? "" : "s"} waiting to sync
                </Text>
              ) : null}
            </View>
          </View>
          <Switch
            value={override === null ? isOnline : override}
            onValueChange={(next) => setOverride(next)}
            trackColor={{ false: "#2a2b30", true: "#4a3a10" }}
            thumbColor={isOnline ? "#4ade80" : "#ef4444"}
          />
        </View>
        <Text style={styles.debugHint}>
          The switch simulates losing signal so you can check the offline contribution flow.
        </Text>

        <SectionLabel>Support</SectionLabel>
        <MenuItem icon={HelpCircle} label="Help & Support" onPress={() => router.push("/HelpSupport")} />
        <MenuItem icon={FileText} label="Privacy Policy" onPress={() => router.push("/PrivacyPolicy")} />
        <MenuItem icon={ScrollText} label="Terms of Service" onPress={() => router.push("/TermsOfService")} />
        <MenuItem icon={Info} label="About Growl" onPress={() => router.push("/AboutUs")} />

        <TouchableOpacity style={styles.signOut} onPress={onSignOut}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Growl v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function MenuItem({ icon: Icon, label, hint, onPress }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Icon size={20} color="#fbb81c" />
        <View style={styles.menuTextWrap}>
          <Text style={styles.menuText}>{label}</Text>
          {hint ? <Text style={styles.menuHint}>{hint}</Text> : null}
        </View>
      </View>
      <ChevronRight size={20} color="#8e8e93" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  body: { paddingBottom: 60 },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#16171b", fontSize: 22, fontWeight: "800" },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  profileEmail: { color: "#8e8e93", fontSize: 14, marginTop: 2 },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1f24",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2a2b30",
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { color: "#ffffff", fontSize: 19, fontWeight: "800" },
  statLabel: { color: "#8e8e93", fontSize: 11 },
  statDivider: { width: 1, height: 34, backgroundColor: "#2a2b30" },
  sectionLabel: {
    color: "#8e8e93",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 6,
  },
  menuTextWrap: { flex: 1 },
  menuHint: { color: "#8e8e93", fontSize: 12, marginTop: 2 },
  debugHint: {
    color: "#5a5a5e",
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 20,
    marginTop: 6,
  },
  brandCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#1e1f24",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2a2b30",
    padding: 18,
  },
  brand: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  brandTagline: { color: "#fbb81c", fontSize: 14, fontWeight: "600", marginTop: 2 },
  brandCopy: { color: "#8e8e93", fontSize: 13, lineHeight: 19, marginTop: 12 },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuText: { color: "#ffffff", fontSize: 16 },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 28,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingVertical: 14,
  },
  signOutText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
  version: { color: "#5a5a5e", fontSize: 12, textAlign: "center", marginTop: 24 },
});