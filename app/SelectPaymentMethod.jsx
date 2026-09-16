import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { ChevronLeft, CreditCard, Plus, Check, Trash2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet from "../components/molecule/BottomSheet";

export default function SelectPaymentMethod() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [cards, setCards] = useState([
    { id: 1, brand: "Visa", last4: "4242", expiry: "12/28", isDefault: true },
    { id: 2, brand: "Mastercard", last4: "5555", expiry: "06/27", isDefault: false },
  ]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({ number: "", expiry: "", cvc: "", name: "" });

  const addCard = () => {
    const id = Date.now();
    setCards([...cards, { id, brand: "Visa", last4: newCard.number.slice(-4), expiry: newCard.expiry, isDefault: cards.length === 0 }]);
    setNewCard({ number: "", expiry: "", cvc: "", name: "" });
    setShowAddCard(false);
  };

  const selectCard = (id) => {
    setCards(cards.map((c) => ({ ...c, isDefault: c.id === id })));
  };

  const removeCard = (id) => {
    setCards(cards.filter((c) => c.id !== id));
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
          <CreditCard size={32} color="#fbb81c" />
          <Text style={styles.title}>Payment Method</Text>
          <Text style={styles.subtitle}>Select or add a payment method</Text>
        </View>

        {/* Saved Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Cards</Text>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[styles.cardItem, card.isDefault && styles.cardItemSelected]}
              onPress={() => selectCard(card.id)}
            >
              <View style={styles.cardLeft}>
                <View style={styles.cardBrand}>
                  <Text style={styles.cardBrandText}>{card.brand}</Text>
                </View>
                <View style={styles.cardDetails}>
                  <Text style={styles.cardNumber}>**** **** **** {card.last4}</Text>
                  <Text style={styles.cardExpiry}>Expires {card.expiry}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                {card.isDefault ? (
                  <View style={styles.defaultBadge}><Text style={styles.defaultText}>Default</Text></View>
                ) : (
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeCard(card.id); }} style={styles.removeBtn}>
                    <Trash2 size={20} color="#ff6b6b" />
                  </TouchableOpacity>
                )}
                <Check size={24} color={card.isDefault ? "#fbb81c" : "#2a2b30"} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add New Card */}
        <TouchableOpacity style={styles.addCardBtn} onPress={() => setShowAddCard(true)}>
          <Plus size={24} color="#fbb81c" />
          <Text style={styles.addCardText}>Add New Card</Text>
        </TouchableOpacity>

        {/* Continue Button */}
        <TouchableOpacity style={styles.continueBtn} onPress={() => router.push("/ReviewSummary")} disabled={cards.length === 0}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Card Bottom Sheet */}
      <BottomSheet isVisible={showAddCard} onClose={() => setShowAddCard(false)} title="Add New Card">
        <View style={styles.sheetContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Card Number</Text>
            <TextInput
              style={styles.input}
              value={newCard.number}
              onChangeText={(v) => setNewCard({ ...newCard, number: v.replace(/\D/g, "").replace(/(\d{4})/g, "$1 ").trim() })}
              placeholder="1234 5678 9012 3456"
              keyboardType="numeric"
              maxLength={19}
            />
          </View>
          <View style={styles.inputRow}>
            <View style={styles.inputGroupFlex}>
              <Text style={styles.inputLabel}>Expiry</Text>
              <TextInput
                style={styles.input}
                value={newCard.expiry}
                onChangeText={(v) => setNewCard({ ...newCard, expiry: v.replace(/\D/g, "").replace(/(\d{2})/g, "$1/").trim() })}
                placeholder="MM/YY"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={styles.inputGroupFlex}>
              <Text style={styles.inputLabel}>CVC</Text>
              <TextInput
                style={styles.input}
                value={newCard.cvc}
                onChangeText={(v) => setNewCard({ ...newCard, cvc: v.replace(/\D/g, "") })}
                placeholder="123"
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name on Card</Text>
            <TextInput
              style={styles.input}
              value={newCard.name}
              onChangeText={(v) => setNewCard({ ...newCard, name: v })}
              placeholder="John Doe"
            />
          </View>
          <TouchableOpacity style={styles.sheetBtn} onPress={addCard} disabled={!newCard.number || !newCard.expiry || !newCard.cvc || !newCard.name}>
            <Text style={styles.sheetBtnText}>Add Card</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  scrollContent: { padding: 20, paddingBottom: 100 },
  backBtn: { padding: 4, marginBottom: 20 },
  header: { alignItems: "center", marginBottom: 30 },
  title: { color: "#ffffff", fontSize: 28, fontWeight: "bold", marginTop: 12 },
  subtitle: { color: "#8e8e93", fontSize: 16, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { color: "#ffffff", fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  cardItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardItemSelected: { borderColor: "#fbb81c" },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  cardBrand: { width: 48, height: 30, borderRadius: 6, backgroundColor: "#fbb81c", justifyContent: "center", alignItems: "center" },
  cardBrandText: { color: "#16171b", fontSize: 12, fontWeight: "bold" },
  cardDetails: { gap: 2 },
  cardNumber: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  cardExpiry: { color: "#8e8e93", fontSize: 13 },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  defaultBadge: { backgroundColor: "#fbb81c", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  defaultText: { color: "#16171b", fontSize: 11, fontWeight: "bold" },
  removeBtn: { padding: 4 },
  addCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#fbb81c",
    borderStyle: "dashed",
  },
  addCardText: { color: "#fbb81c", fontSize: 16, fontWeight: "600" },
  continueBtn: {
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  continueBtnText: { color: "#16171b", fontSize: 16, fontWeight: "bold" },
  // Sheet styles
  sheetContent: { paddingVertical: 10, gap: 16 },
  inputGroup: { gap: 8 },
  inputGroupFlex: { flex: 1 },
  inputRow: { flexDirection: "row", gap: 12 },
  inputLabel: { color: "#8e8e93", fontSize: 14 },
  input: {
    backgroundColor: "#2a2b30",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 16,
  },
  sheetBtn: {
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  sheetBtnText: { color: "#16171b", fontSize: 16, fontWeight: "bold" },
});