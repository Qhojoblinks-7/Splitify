import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Camera, Mail, Phone, Calendar, User as UserIcon, Pencil } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john@example.com");
  const [phone, setPhone] = useState("+233 244 ***567");
  const [dob, setDob] = useState(new Date("1995-01-15"));
  const [gender, setGender] = useState("Male");
  const [avatarUri, setAvatarUri] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDob(selectedDate);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestCameraLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.cancelled) {
      setAvatarUri(result.uri);
    }
  };

  const handleSave = () => {
    router.push("/(tabs)/account");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <TouchableOpacity style={styles.avatar} onPress={pickImage}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{name.charAt(0)}{name.split(" ")[1]?.charAt(0) || ""}</Text>
            )}
            <View style={styles.editPencil}>
              <Camera size={16} color="#16171b" />
            </View>
          </TouchableOpacity>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Name</Text>
            <View style={styles.inputWrap}>
              <UserIcon size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                style={styles.formInput}
                value={name}
                onChangeText={setName}
                placeholder="Full name"
              />
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Email</Text>
            <View style={styles.inputWrap}>
              <Mail size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                style={styles.formInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Phone</Text>
            <View style={styles.inputWrap}>
              <Phone size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                style={styles.formInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Date of Birth</Text>
            <TouchableOpacity style={styles.inputWrap} onPress={() => setShowDatePicker(true)}>
              <Calendar size={20} color="#8e8e93" style={styles.inputIcon} />
              <Text style={styles.formInput}>{formatDate(dob)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dob}
                mode="date"
                display="default"
                themeVariant="dark"
                onChange={onDateChange}
              />
            )}
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Gender</Text>
            <View style={styles.inputWrap}>
              <UserIcon size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                style={styles.formInput}
                value={gender}
                onChangeText={setGender}
                placeholder="Gender"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar with Save Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  scrollContent: { padding: 20, paddingBottom: 100 },
  backBtn: { padding: 4, marginBottom: 16 },
  avatarWrap: { alignItems: "center", paddingVertical: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#fbb81c", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#16171b", fontSize: 28, fontWeight: "bold" },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  editPencil: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#16171b",
  },
  email: { color: "#8e8e93", fontSize: 14, marginTop: 8 },
  formSection: { marginTop: 20 },
  formGroup: { marginBottom: 16 },
  formLabel: { color: "#8e8e93", fontSize: 14, marginBottom: 8 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  formInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    paddingVertical: 12,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#16171b",
    borderTopWidth: 1,
    borderTopColor: "#2a2b30",
    flexDirection: "row",
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  saveButtonText: { color: "#16171b", fontSize: 16, fontWeight: "bold" },
});