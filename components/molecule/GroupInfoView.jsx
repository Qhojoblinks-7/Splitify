import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { UserPlus, Users } from "lucide-react-native";
import EmptyState from "./EmptyState";

export default function GroupInfoView({ groupInfo, members }) {
  return (
    <FlatList
      style={styles.list}
      data={members}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.memberRow}>
          <View style={[styles.memberAvatar, { backgroundColor: item.avatarColor }]}>
            <Text style={styles.memberAvatarText}>{item.initials}</Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.name}</Text>
            <Text style={styles.memberHandle}>{item.handle}</Text>
          </View>
          <View style={styles.memberRole}>
            <View style={[
              styles.roleBadge,
              item.role === "Admin" && styles.roleBadgeAdmin,
            ]}>
              <Text style={[
                styles.roleBadgeText,
                item.role === "Admin" && styles.roleBadgeTextAdmin,
              ]}>
                {item.role}
              </Text>
            </View>
          </View>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.memberSeparator} />}
      ListEmptyComponent={
        <EmptyState
          icon={Users}
          iconColor="#33353b"
          title="No members found"
          subtitle="This group doesn't have any members yet"
        />
      }
      ListHeaderComponent={
        <View style={styles.infoContent}>
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>About this group</Text>
            <Text style={styles.infoText}>{groupInfo.description || "No description provided"}</Text>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{groupInfo.category}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Members</Text>
              <Text style={styles.infoValue}>{groupInfo.members} people</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>{groupInfo.created}</Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoSectionHeader}>
              <Text style={styles.infoSectionTitle}>Members</Text>
              <TouchableOpacity style={styles.addMemberBtn}>
                <UserPlus size={18} color="#fbb81c" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      }
      ListFooterComponentStyle={styles.memberListFooter}
    />
  );
}

const styles = StyleSheet.create({
  infoContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 20 },
  infoSection: { gap: 12 },
  infoSectionTitle: { color: "#fbb81c", fontSize: 14, fontWeight: "600", textTransform: "uppercase" },
  infoText: { color: "#ffffff", fontSize: 15, lineHeight: 22 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#2a2b30" },
  infoLabel: { color: "#8e8e93", fontSize: 15 },
  infoValue: { color: "#ffffff", fontSize: 15, fontWeight: "500" },
  infoSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addMemberBtn: { padding: 8 },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginRight: 12 },
  memberAvatarText: { color: "#16171b", fontSize: 15, fontWeight: "bold" },
  memberInfo: { flex: 1 },
  memberName: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  memberHandle: { color: "#8e8e93", fontSize: 12, marginTop: 2 },
  memberRole: { marginLeft: 12 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "#2a2b30" },
  roleBadgeAdmin: { backgroundColor: "#fbb81c" },
  roleBadgeText: { color: "#ffffff", fontSize: 11, fontWeight: "600" },
  roleBadgeTextAdmin: { color: "#16171b" },
  memberSeparator: { height: 1, backgroundColor: "#2a2b30", marginLeft: 56 },
  memberListFooter: { paddingBottom: 40 },
  list: { flex: 1 },
});
