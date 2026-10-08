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
  ShieldCheck,
  User,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useSessionStore } from "../../store/session";
import { useSecurityStore } from "../../store/security";
import { useNetworkStore } from "../../store/network";
import { useQueueStore } from "../../store/queue";
import { initialsOf } from "../../services/susu";
import { queries } from "../../services/query";
import colors from "../../theme/colors";

export default function Account() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);
  const notificationsEnabled = useSessionStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSessionStore((s) => s.setNotificationsEnabled);
  const settings = useSecurityStore();

  const isOnline = useNetworkStore((s) => s.isOnline);
  const override = useNetworkStore((s) => s.override);
  const setOverride = useNetworkStore((s) => s.setOverride);

  const queued = useQueueStore((s) => s.items.length);

  // The counts are the server's, not a count of rows some
  // screen happened to keep: how many groups this account
  // is in, and of those, how many it administers.
  const { data: summary } = useQuery(queries.memberSummary());

  const stats = {
    total: summary?.groupCount ?? 0,
    adminOf: summary?.adminOfCount ?? 0,
  };

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
          <Text style={styles.brand}>Ntuboa</Text>
          <Text style={styles.brandTagline}>Grow Your Wealth Together</Text>
          <Text style={styles.brandCopy}>
            Ntuboa helps your circle save together — fixed weekly contributions, a clear rotation,
            and no more counting who paid what. Ntuboa keeps the record of your contributions. It
            never holds your money.
          </Text>
        </View>

         <SectionLabel>Verification</SectionLabel>
         <MenuItem
           icon={User}
           label="Edit profile"
           hint={user?.full_name || user?.name || "Tap to edit"}
           onPress={() => router.push("/EditProfile")}
         />
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

        <SectionLabel>Security</SectionLabel>
        <MenuItem
          icon={ShieldCheck}
          label="App lock"
          hint={settings.appLockEnabled ? "On" : "Off"}
          onPress={() => router.push("/Security")}
        />

        <SectionLabel>Notifications</SectionLabel>
        <View style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Bell size={20} color={colors.gold} />
            <Text style={styles.menuText}>Turn collection reminders</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: colors.borderSubtle, true: colors.goldSoft }}
            thumbColor={notificationsEnabled ? colors.gold : colors.placeholder}
          />
        </View>

        <SectionLabel>Connection</SectionLabel>
        <View style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <CloudOff size={20} color={isOnline ? colors.success : colors.danger} />
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
            trackColor={{ false: colors.borderSubtle, true: colors.goldSoft }}
            thumbColor={isOnline ? colors.success : colors.danger}
          />
        </View>
        <Text style={styles.debugHint}>
          The switch simulates losing signal so you can check the offline contribution flow.
        </Text>

        <SectionLabel>Support</SectionLabel>
        <MenuItem icon={HelpCircle} label="Help & Support" onPress={() => router.push("/HelpSupport")} />
        <MenuItem
          icon={ShieldCheck}
          label="Your privacy"
          hint="See what we hold, ask us to correct or delete it"
          onPress={() => router.push("/PrivacyRights")}
        />
        <MenuItem icon={FileText} label="Privacy Policy" onPress={() => router.push("/PrivacyPolicy")} />
        <MenuItem icon={ScrollText} label="Terms of Service" onPress={() => router.push("/TermsOfService")} />
        <MenuItem icon={Info} label="About Ntuboa" onPress={() => router.push("/AboutUs")} />

        <TouchableOpacity style={styles.signOut} onPress={onSignOut}>
          <LogOut size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Ntuboa v1.0.0</Text>
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
        <Icon size={20} color={colors.gold} />
        <View style={styles.menuTextWrap}>
          <Text style={styles.menuText}>{label}</Text>
          {hint ? <Text style={styles.menuHint}>{hint}</Text> : null}
        </View>
      </View>
      <ChevronRight size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: colors.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: colors.background, fontSize: 22, fontWeight: "800" },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { color: colors.text, fontSize: 18, fontWeight: "700" },
  profileEmail: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { color: colors.text, fontSize: 19, fontWeight: "800" },
  statLabel: { color: colors.textMuted, fontSize: 11 },
  statDivider: { width: 1, height: 34, backgroundColor: colors.borderSubtle },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 6,
  },
  menuTextWrap: { flex: 1 },
  menuHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  debugHint: {
    color: colors.muted2,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 20,
    marginTop: 6,
  },
  brandCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 18,
  },
  brand: { color: colors.text, fontSize: 24, fontWeight: "800" },
  brandTagline: { color: colors.gold, fontSize: 14, fontWeight: "600", marginTop: 2 },
  brandCopy: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 12 },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuText: { color: colors.text, fontSize: 16 },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 28,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 14,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: "700" },
  version: { color: colors.muted2, fontSize: 12, textAlign: "center", marginTop: 24 },
});