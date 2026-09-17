import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MessageCircle } from "lucide-react-native";

const ContactCard = ({ name, handle, initials, onPress }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        {handle && <Text style={styles.handle}>{handle}</Text>}
      </View>
      <MessageCircle size={18} color="#33353b" />
    </TouchableOpacity>
  );
};

export default ContactCard;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#16171b",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#16171b",
    fontSize: 14,
    fontWeight: "bold",
  },
  info: { flex: 1 },
  name: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  handle: { color: "#8e8e93", fontSize: 13, marginTop: 2 },
});
