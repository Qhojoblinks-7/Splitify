import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import { ChevronLeft, MessageCircle, Globe, AtSign, Mail, Smartphone, Camera, Send, HelpCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const contactMethods = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    subtitle: "Chat with us on WhatsApp",
    icon: MessageCircle,
    iconColor: "#25D366",
    detail: "+233 244 123 4567",
    url: "https://wa.me/2332441234567",
  },
  {
    id: "facebook",
    label: "Facebook",
    subtitle: "Message our Facebook page",
    icon: Globe,
    iconColor: "#1877F2",
    detail: "facebook.com/Splitify",
    url: "https://www.facebook.com/Splitify",
  },
  {
    id: "x",
    label: "X (Twitter)",
    subtitle: "Follow and tweet us",
    icon: AtSign,
    iconColor: "#ffffff",
    detail: "@Splitify",
    url: "https://x.com/Splitify",
  },
  {
    id: "email",
    label: "Email",
    subtitle: "Send us an email",
    icon: Mail,
    iconColor: "#fbb81c",
    detail: "support@splitify.com",
    url: "mailto:support@splitify.com",
  },
  {
    id: "phone",
    label: "Phone",
    subtitle: "Call us directly",
    icon: Smartphone,
    iconColor: "#25D366",
    detail: "+233 244 123 4567",
    url: "tel:+2332441234567",
  },
  {
    id: "instagram",
    label: "Instagram",
    subtitle: "Follow our updates",
    icon: Camera,
    iconColor: "#E1306C",
    detail: "@splitify",
    url: "https://instagram.com/splitify",
  },
  {
    id: "telegram",
    label: "Telegram",
    subtitle: "Join our Telegram community",
    icon: Send,
    iconColor: "#0088CC",
    detail: "t.me/splitify",
    url: "https://t.me/splitify",
  },
];

export default function ContactSupport() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [copied, setCopied] = useState(null);

  const onPressBack = () => router.back();

  const onPressContact = (method) => {
    if (method.id === "email") {
      Linking.openURL(method.url).catch(() => {
        Alert.alert("Unable to open email", "Please open your email app manually.");
      });
      return;
    }
    if (method.id === "phone") {
      Linking.openURL(method.url).catch(() => {
        Alert.alert("Unable to call", "Please dial the number manually.");
      });
      return;
    }
    Linking.openURL(method.url).catch(() => {
      Alert.alert("Unable to open", `Please open ${method.label} manually.`);
    });
  };

  const onCopyDetail = (id, detail) => {
    if (copied === id) return;
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={onPressBack}>
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <HelpCircle size={30} color="#16171b" />
          </View>
          <Text style={styles.title}>Contact Support</Text>
          <Text style={styles.subtitle}>Reach us through any of these channels</Text>
        </View>

        <Text style={styles.sectionTitle}>Contact Methods</Text>

        <View style={styles.contactList}>
          {contactMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={styles.contactCard}
              onPress={() => onPressContact(method)}
              activeOpacity={0.8}
            >
              <View style={[styles.contactIcon, { backgroundColor: method.iconColor + "20" }]}>
                <method.icon size={22} color={method.iconColor} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>{method.label}</Text>
                <Text style={styles.contactSubtitle}>{method.subtitle}</Text>
                <Text style={styles.contactDetail}>{method.detail}</Text>
              </View>
              <View style={styles.contactRight}>
                <Text style={styles.contactAction}>Open</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Other ways to reach us</Text>
          <Text style={styles.noteText}>
            Our support team is available Monday through Friday, 9am - 6pm GMT.
            Response times may vary by channel.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16171b",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  backButton: {
    padding: 4,
    marginBottom: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#8e8e93",
    fontSize: 15,
    marginTop: 5,
    textAlign: "center",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 14,
  },
  contactList: {
    gap: 10,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  contactSubtitle: {
    color: "#8e8e93",
    fontSize: 12,
    marginTop: 1,
  },
  contactDetail: {
    color: "#fbb81c",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  contactRight: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#16171b",
    borderRadius: 8,
  },
  contactAction: {
    color: "#fbb81c",
    fontSize: 12,
    fontWeight: "bold",
  },
  noteCard: {
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#3a3b40",
  },
  noteTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  noteText: {
    color: "#8e8e93",
    fontSize: 13,
    lineHeight: 19,
  },
});
