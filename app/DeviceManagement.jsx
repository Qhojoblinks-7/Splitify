import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { ChevronLeft, Smartphone, Laptop, Tablet, Shield, CheckCircle, XCircle, Trash2, MapPin, Clock } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet from "../components/molecule/BottomSheet";

export default function DeviceManagement() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isRemoveVisible, setIsRemoveVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const devices = [
    {
      id: 1,
      name: "iPhone 15 Pro",
      type: "mobile",
      location: "San Francisco, CA",
      lastActive: "Now",
      isCurrent: true,
      icon: Smartphone,
    },
    {
      id: 2,
      name: "MacBook Pro M3",
      type: "desktop",
      location: "San Francisco, CA",
      lastActive: "2 hours ago",
      isCurrent: false,
      icon: Laptop,
    },
    {
      id: 3,
      name: "iPad Pro 12.9\"",
      type: "tablet",
      location: "New York, NY",
      lastActive: "1 day ago",
      isCurrent: false,
      icon: Tablet,
    },
    {
      id: 4,
      name: "Windows PC",
      type: "desktop",
      location: "London, UK",
      lastActive: "3 days ago",
      isCurrent: false,
      icon: Laptop,
    },
  ];

  const handleRemove = (device) => {
    setSelectedDevice(device);
    setIsRemoveVisible(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Smartphone size={32} color="#fbb81c" />
          <Text style={styles.title}>Device Management</Text>
          <Text style={styles.subtitle}>Manage your account on the devices you own</Text>
        </View>

        {/* Current Device */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Device</Text>
          {devices.filter((d) => d.isCurrent).map((device) => (
            <View key={device.id} style={styles.deviceCardCurrent}>
              <View style={styles.deviceLeft}>
                <View style={styles.deviceIcon}>
                  <device.icon size={24} color="#fbb81c" />
                </View>
                <View>
                  <View style={styles.deviceHeader}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <View style={styles.currentBadge}>
                      <CheckCircle size={14} color="#fbb81c" />
                      <Text style={styles.currentText}>This Device</Text>
                    </View>
                  </View>
                  <View style={styles.deviceDetails}>
                    <View style={styles.detailRow}>
                      <MapPin size={14} color="#8e8e93" />
                      <Text style={styles.detailText}>{device.location}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Clock size={14} color="#8e8e93" />
                      <Text style={styles.detailText}>Active now</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.deviceStatus}>
                <View style={styles.statusDotActive} />
                <Text style={styles.statusTextActive}>Active</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Other Devices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other Devices</Text>
          {devices.filter((d) => !d.isCurrent).map((device) => (
            <View key={device.id} style={styles.deviceCard}>
              <View style={styles.deviceLeft}>
                <View style={styles.deviceIcon}>
                  <device.icon size={24} color="#fbb81c" />
                </View>
                <View>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <View style={styles.deviceDetails}>
                    <View style={styles.detailRow}>
                      <MapPin size={14} color="#8e8e93" />
                      <Text style={styles.detailText}>{device.location}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Clock size={14} color="#8e8e93" />
                      <Text style={styles.detailText}>{device.lastActive}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(device)}>
                <XCircle size={20} color="#ff6b6b" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Security Info */}
        <View style={styles.infoCard}>
          <Shield size={24} color="#fbb81c" style={styles.infoIcon} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Secure your account</Text>
            <Text style={styles.infoText}>
              Remove devices you don't recognize. You'll be signed out on those devices.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* REMOVE DEVICE BOTTOM SHEET */}
      <BottomSheet
        isVisible={isRemoveVisible}
        onClose={() => setIsRemoveVisible(false)}
        title="Remove Device"
      >
        <View style={styles.sheetContent}>
          <XCircle size={48} color="#ff6b6b" style={styles.alertIcon} />
          <Text style={styles.sheetTitle}>Remove Device</Text>
          <Text style={styles.sheetSubtitle}>
            Are you sure you want to remove <Text style={styles.deviceNameText}>{selectedDevice?.name}</Text>?
          </Text>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>• You will be signed out on this device</Text>
            <Text style={styles.warningText}>• You'll need to sign in again to access your account</Text>
            <Text style={styles.warningText}>• This device will lose access to your data</Text>
          </View>
          <TouchableOpacity style={styles.sheetBtnDestructive} onPress={() => { setIsRemoveVisible(false); }}>
            <Text style={styles.sheetBtnText}>Remove Device</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetBtnCancel} onPress={() => setIsRemoveVisible(false)}>
            <Text style={styles.sheetBtnCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  backBtn: { padding: 4, marginBottom: 20 },
  header: { alignItems: "center", marginBottom: 30 },
  title: { color: "#ffffff", fontSize: 28, fontWeight: "bold", marginTop: 12 },
  subtitle: { color: "#8e8e93", fontSize: 16, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { color: "#ffffff", fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  deviceCardCurrent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#fbb81c",
  },
  deviceCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  deviceLeft: { flexDirection: "row", alignItems: "center", gap: 16, flex: 1 },
  deviceIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#fbb81c", justifyContent: "center", alignItems: "center" },
  deviceHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  deviceName: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
  currentBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fbb81c", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  currentText: { color: "#16171b", fontSize: 11, fontWeight: "bold" },
  deviceDetails: { gap: 6 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { color: "#8e8e93", fontSize: 14 },
  deviceStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ade80" },
  statusTextActive: { color: "#4ade80", fontSize: 14, fontWeight: "600" },
  removeBtn: { padding: 8 },
  infoCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#fbb81c",
  },
  infoIcon: { marginTop: 2 },
  infoContent: { flex: 1 },
  infoTitle: { color: "#ffffff", fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  infoText: { color: "#8e8e93", fontSize: 14, lineHeight: 20 },
  // Sheet styles
  sheetContent: { paddingVertical: 10, gap: 16, alignItems: "center" },
  alertIcon: { marginBottom: 12 },
  sheetTitle: { color: "#ffffff", fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
  sheetSubtitle: { color: "#8e8e93", fontSize: 15, textAlign: "center", marginBottom: 8 },
  deviceNameText: { color: "#ff6b6b", fontWeight: "bold" },
  warningBox: { backgroundColor: "#2a2b30", borderRadius: 12, padding: 16, width: "100%" },
  warningText: { color: "#ff6b6b", fontSize: 14, marginBottom: 4 },
  sheetBtnDestructive: { backgroundColor: "#ff6b6b", borderRadius: 16, padding: 16, alignItems: "center", width: "100%", marginTop: 8 },
  sheetBtnCancel: { backgroundColor: "transparent", borderRadius: 16, padding: 16, alignItems: "center", width: "100%", marginTop: 8, borderWidth: 1, borderColor: "#3a3b40" },
  sheetBtnText: { color: "#16171b", fontSize: 16, fontWeight: "bold" },
  sheetBtnCancelText: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
});