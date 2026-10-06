import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  useWindowDimensions,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Svg, Path } from "react-native-svg";
import { ShieldCheck, CloudOff, Users, TrendingUp, Shield, AlertCircle, Info, ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import NextButton from "../components/atoms/NextButton";
import SkipButton from "../components/atoms/SkipButton";
import { useSessionStore } from "../store/session";
import colors from "../theme/colors";

const ROSTER = [
  { name: "Ama", color: colors.success },
  { name: "Kofi", color: colors.avatarBlue },
  { name: "You", color: colors.gold },
  { name: "Efua", color: colors.avatarPink },
];

const ONBOARDING_DATA = [
  {
    id: "1",
    title: "Save Together, Grow Together",
    description:
      "Ntuboa turns your usual group susu into a digital one. Everyone contributes the same amount each week, and each member takes the full pot in turn.",
    color: colors.gold,
    visual: "pot",
  },
  {
    id: "2",
    title: "Whose Turn Is Clear",
    description:
      "Your week in the rotation is fixed. Ntuboa always shows who is collecting next, how much is still needed, and when the pot is full and ready to be paid out.",
    color: colors.success,
    visual: "rotation",
  },
  {
    id: "3",
    title: "Every Cedi Verified",
    description:
      "Each contribution is checked against your mobile money reference before the pot moves. Everyone can see who paid, and when. No more arguing over the book.",
    color: colors.avatarBlue,
    visual: "verified",
  },
  {
    id: "4",
    title: "It Works Without Signal",
    description:
      "In the market with no network, log your contribution anyway. It is saved on your phone and verified the moment you are back online. Ntuboa never holds your money.",
    color: colors.avatarPurple,
    visual: "offline",
  },
];

const DISCLAIMERS = [
  {
    icon: Shield,
    title: "We never hold your money",
    body:
      "Ntuboa is a record-keeping tool. Your contributions move directly between members via mobile money (MoMo, Vodafone Cash, AirtelTigo Money). Ntuboa never receives, holds, invests, or transfers funds. We only write down what happened.",
  },
  {
    icon: AlertCircle,
    title: "You rely on other members",
    body:
      "A susu is an informal rotating savings group. Ntuboa cannot guarantee that every member will pay on time, that groups will complete every cycle, or that disputes will be resolved in your favour. Participate only with people you trust.",
  },
];

/**
 * Illustrative panels for the carousel. These are deliberately not image files:
 * a real rotation diagram teaches the concept faster than a stock screenshot,
 * and it stays crisp at any screen size.
 */
function OnboardingVisual({ kind, color, size }) {
  if (kind === "rotation") {
    return (
      <View style={[styles.visualCircle, { borderColor: color, width: size, height: size, borderRadius: size / 2 }]}>
        {ROSTER.map((person, index) => {
          const angle = (index / ROSTER.length) * Math.PI * 2 - Math.PI / 2;
          const radius = size / 2 - 26;
          const cx = size / 2 + radius * Math.cos(angle);
          const cy = size / 2 + radius * Math.sin(angle);
          const isYou = person.name === "You";
          return (
            <View
              key={person.name}
              style={[
                styles.rotationNode,
                {
                  left: cx - 19,
                  top: cy - 19,
                  backgroundColor: person.color,
                  borderColor: isYou ? colors.text : "transparent",
                  borderWidth: isYou ? 2 : 0,
                },
              ]}
            >
              <Text style={styles.rotationInitial}>{person.name.charAt(0)}</Text>
            </View>
          );
        })}
        <View style={styles.rotationCenter}>
          <TrendingUp size={22} color={colors.text} />
        </View>
      </View>
    );
  }

  const Icon = kind === "verified" ? ShieldCheck : kind === "offline" ? CloudOff : Users;
  const caption = kind === "verified" ? "MP260114.0932" : kind === "offline" ? "Saved offline" : "4 members";

  return (
    <View style={styles.visualCard}>
      <View style={[styles.visualIcon, { backgroundColor: color }]}>
        <Icon size={30} color={colors.background} />
      </View>
      <View style={styles.visualLines}>
        <View style={[styles.visualLine, { width: "70%", backgroundColor: color }]} />
        <View style={[styles.visualLine, { width: "45%", backgroundColor: colors.dividerMuted }]} />
      </View>
      <Text style={[styles.visualCaption, kind !== "verified" && { color: color }]}>{caption}</Text>
    </View>
  );
}

function DisclaimerScreen({ onAccept, onBack }) {
  const [accepted, setAccepted] = useState(false);

  return (
    <SafeAreaView style={styles.disclaimerContainer}>
      <ScrollView contentContainerStyle={styles.disclaimerContent} showsVerticalScrollIndicator={false}>
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.textMuted} />
        </Pressable>

        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Important Information</Text>
          <Text style={styles.documentSubtitle}>Please read before using Ntuboa</Text>
          <View style={styles.documentRule} />
        </View>

        <Text style={styles.leadText}>
          Ntuboa is a record-keeping tool for susu groups. It does not hold, transfer, or invest your money. The two points below explain what this means for you.
        </Text>

        {DISCLAIMERS.map((item, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionNumber}>{index + 1}.</Text>
            <View style={styles.sectionBody}>
              <Text style={styles.sectionTitle}>{item.title}</Text>
              <Text style={styles.sectionText}>{item.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.documentRule} />

        <Pressable
          style={({ pressed }) => [
            styles.checkboxWrap,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => setAccepted((v) => !v)}
          hitSlop={16}
        >
          <View
            style={[
              styles.checkbox,
              accepted && styles.checkboxChecked,
            ]}
          >
            {accepted && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I have read and understand the above
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.continueBtn,
            !accepted && styles.continueBtnDisabled,
          ]}
          onPress={() => accepted && onAccept()}
          disabled={!accepted}
          hitSlop={12}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>

        <Text style={styles.footerNote}>
          By continuing, you agree to our{" "}
          <Pressable
            onPress={() => router.push("/PrivacyPolicy")}
            style={styles.link}
          >
            <Text style={styles.linkText}>Privacy Notice</Text>
          </Pressable>
          {" (Act 843)"}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const flatListRef = useRef(null);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const completeOnboarding = useSessionStore((s) => s.completeOnboarding);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  /**
   * Record that this device has seen the intro, then hand the
   * member to wherever they belong: their groups if they hold a
   * session, the auth screen if they don't. The flag is what
   * keeps the root layout from steering every cold start back
   * here — writing it is the whole point of finishing.
   */
  const finish = () => {
    completeOnboarding();
    const { isAuthenticated } = useSessionStore.getState();
    router.replace(isAuthenticated ? "/(tabs)" : "/Auth/Auth");
  };

  const handleSkip = () => {
    finish();
  };

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      setShowDisclaimer(true);
    }
  };

  const handleDisclaimerBack = () => {
    setShowDisclaimer(false);
  };

  const handleDisclaimerAccept = () => {
    finish();
  };

  const isLastSlide = currentIndex === ONBOARDING_DATA.length - 1;
  const currentSlideData = ONBOARDING_DATA[currentIndex];

  const curveHeight = 60;
  const pathData = `
        M 0 ${curveHeight}
        Q ${width / 2} 0 ${width} ${curveHeight}
        L ${width} ${curveHeight}
        L 0 ${curveHeight}
        Z
    `;

  const visualSize = Math.min(width - 120, 250);

  if (showDisclaimer) {
    return (
      <DisclaimerScreen
        onAccept={handleDisclaimerAccept}
        onBack={handleDisclaimerBack}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. TOP CAROUSEL ZONE: Handled by FlatList (swiping images/mockups) */}
      <View style={styles.carouselZone}>
        <FlatList
          ref={flatListRef}
          data={ONBOARDING_DATA}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          renderItem={({ item }) => (
            <View style={[styles.imageSlide, { width }]}>
              <OnboardingVisual kind={item.visual} color={item.color} size={visualSize} />
            </View>
          )}
          keyExtractor={(item) => item.id}
        />
      </View>

      {/* 2. FIXED BOTTOM LAYER ZONE: Extracted out of the FlatList */}
      <View style={styles.bottomSheetWrapper}>
        <Svg width={width} height={curveHeight} viewBox={`0 0 ${width} ${curveHeight}`} style={styles.curveSvg}>
          <Path d={pathData} fill={colors.background} />
        </Svg>

        <View style={styles.bottomSheetContent}>
          {/* Text transitions cleanly as index changes */}
          <View style={styles.textGroup}>
            <Text style={styles.title}>{currentSlideData.title}</Text>
            <Text style={styles.description}>{currentSlideData.description}</Text>
          </View>

          {/* Pagination Indicators */}
          <View style={styles.indicatorContainer}>
            {ONBOARDING_DATA.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  {
                    backgroundColor: index === currentIndex ? colors.gold : colors.surfaceAlt2,
                    width: index === currentIndex ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Action Row */}
          <View style={styles.buttonsContainer}>
            {!isLastSlide && <SkipButton onPress={handleSkip} />}
            <View style={isLastSlide ? styles.fullWidthButtonWrapper : styles.standardButtonWrapper}>
              <NextButton onPress={handleNext} isLastSlide={isLastSlide} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gold,
  },
  carouselZone: {
    flex: 1, // Balanced 50/50 split with the bottom wrapper
    justifyContent: "center",
  },
  imageSlide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  visualCircle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  rotationNode: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rotationInitial: { color: colors.background, fontSize: 14, fontWeight: "800" },
  rotationCenter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  visualCard: {
    width: 250,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  visualIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  visualLines: { flex: 1, gap: 8 },
  visualLine: { height: 10, borderRadius: 5 },
  visualCaption: {
    position: "absolute",
    bottom: -26,
    alignSelf: "center",
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  bottomSheetWrapper: {
    flex: 1, // Balanced 50/50 split, giving the sheet plenty of room to expand safely
    width: "100%",
  },
  curveSvg: {
    marginBottom: -1,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 32,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  textGroup: {
    alignItems: "center",
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: colors.textMuted2,
    textAlign: "center",
    lineHeight: 22,
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 15,
    gap: 6,
  },
  indicator: {
    height: 8,
    borderRadius: 4,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  fullWidthButtonWrapper: {
    flex: 1,
    width: "100%",
  },
  standardButtonWrapper: {
    flex: 0,
  },
  // Disclaimer styles
  disclaimerContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  disclaimerContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  backButton: {
    padding: 4,
    marginBottom: 24,
    alignSelf: "flex-start",
  },
  documentHeader: {
    marginBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: 20,
  },
  documentTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 6,
  },
  documentSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  documentRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 22,
    marginLeft: "25%",
    width: "50%",
  },
  leadText: {
    color: colors.textBody,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: "justify",
  },
  section: {
    flexDirection: "row",
    marginBottom: 22,
  },
  sectionNumber: {
    position: "absolute",
    left: -28,
    top: 0,
    width: 24,
    fontSize: 15,
    fontWeight: "700",
    color: colors.gold,
    textAlign: "right",
  },
  sectionBody: {
    flex: 1,
    paddingLeft: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  sectionText: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 20,
  },
  checkboxWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 28,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  checkMark: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 14,
  },
  checkboxLabel: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  continueBtn: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  continueBtnDisabled: {
    backgroundColor: colors.borderSubtle,
  },
  continueBtnText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "700",
  },
  footerNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 28,
  },
  link: {
    marginHorizontal: 2,
  },
  linkText: {
    color: colors.gold,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});