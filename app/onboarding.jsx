import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  useWindowDimensions,
} from "react-native";
import { Svg, Path } from "react-native-svg";
import { ShieldCheck, CloudOff, Users, TrendingUp } from "lucide-react-native";
import { useRouter } from "expo-router";
import NextButton from "../components/atoms/NextButton";
import SkipButton from "../components/atoms/SkipButton";

const ROSTER = [
  { name: "Ama", color: "#4ade80" },
  { name: "Kofi", color: "#3b82f6" },
  { name: "You", color: "#fbb81c" },
  { name: "Efua", color: "#ec4899" },
];

const ONBOARDING_DATA = [
  {
    id: "1",
    title: "Save Together, Grow Together",
    description:
      "Growl turns your usual group susu into a digital one. Everyone contributes the same amount each week, and each member takes the full pot in turn.",
    color: "#fbb81c",
    visual: "pot",
  },
  {
    id: "2",
    title: "Whose Turn Is Clear",
    description:
      "Your week in the rotation is fixed. Growl always shows who is collecting next, how much is still needed, and when the pot is full and ready to be paid out.",
    color: "#4ade80",
    visual: "rotation",
  },
  {
    id: "3",
    title: "Every Cedi Verified",
    description:
      "Each contribution is checked against your mobile money reference before the pot moves. Everyone can see who paid, and when. No more arguing over the book.",
    color: "#3b82f6",
    visual: "verified",
  },
  {
    id: "4",
    title: "It Works Without Signal",
    description:
      "In the market with no network, log your contribution anyway. It is saved on your phone and verified the moment you are back online. Growl never holds your money.",
    color: "#a855f7",
    visual: "offline",
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
                  borderColor: isYou ? "#ffffff" : "transparent",
                  borderWidth: isYou ? 2 : 0,
                },
              ]}
            >
              <Text style={styles.rotationInitial}>{person.name.charAt(0)}</Text>
            </View>
          );
        })}
        <View style={styles.rotationCenter}>
          <TrendingUp size={22} color="#ffffff" />
        </View>
      </View>
    );
  }

  const Icon = kind === "verified" ? ShieldCheck : kind === "offline" ? CloudOff : Users;
  const caption = kind === "verified" ? "MP260114.0932" : kind === "offline" ? "Saved offline" : "4 members";

  return (
    <View style={styles.visualCard}>
      <View style={[styles.visualIcon, { backgroundColor: color }]}>
        <Icon size={30} color="#16171b" />
      </View>
      <View style={styles.visualLines}>
        <View style={[styles.visualLine, { width: "70%", backgroundColor: color }]} />
        <View style={[styles.visualLine, { width: "45%", backgroundColor: "#4b4b52" }]} />
      </View>
      <Text style={[styles.visualCaption, kind !== "verified" && { color: color }]}>{caption}</Text>
    </View>
  );
}

export default function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const router = useRouter();
  const { width } = useWindowDimensions();

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const handleSkip = () => {
    router.replace("/Auth/Auth");
  };

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace("/Auth/Auth");
    }
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
          <Path d={pathData} fill="#16171b" />
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
                    backgroundColor: index === currentIndex ? "#fbb81c" : "#464646",
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
    backgroundColor: "#fbb81c",
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
  rotationInitial: { color: "#16171b", fontSize: 14, fontWeight: "800" },
  rotationCenter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#1e1f24",
    borderWidth: 1,
    borderColor: "#2a2b30",
    alignItems: "center",
    justifyContent: "center",
  },
  visualCard: {
    width: 250,
    backgroundColor: "#1e1f24",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2a2b30",
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
    color: "#8e8e93",
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
    backgroundColor: "#16171b",
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
    color: "#ffffff",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#9aa0a6",
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
});