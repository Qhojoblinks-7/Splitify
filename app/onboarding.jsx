import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  useWindowDimensions,
} from "react-native";
import { Svg, Path } from "react-native-svg";
import { useRouter } from "expo-router";
import NextButton from "../components/atoms/NextButton";
import SkipButton from "../components/atoms/SkipButton";

const ONBOARDING_DATA = [
  {
    id: "1",
    title: "Seamless Payments, Effortless Splits", // Fixed typo here
    description:
      "With Splitify, you can easily split bills and expenses with friends, family, or roommates. No more awkward calculations or forgotten payments!",
    color: "#e74c3c",
  },
  {
    id: "2",
    title: "Share Bills, Share Moments",
    description:
      "Splitify not only simplifies bill splitting but also helps you create shared expenses for trips, dinners, or any group activity. Keep track of who owes what and settle up with ease.",
    color: "#2ecc71",
  },
  {
    id: "3",
    title: "Stay Connected, Split Confidently",
    description:
      "Splitify keeps you connected with your group, sending reminders and notifications to ensure everyone stays on top of their payments. Say goodbye to awkward conversations about money and hello to hassle-free splitting!",
    color: "#3498db",
  },
];

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
              <View style={[styles.imagePlaceholder, { backgroundColor: item.color }]} />
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
                    backgroundColor: index === currentIndex ? "#ffcc00" : "#464646",
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
    backgroundColor: "#ffcc00", // Using your premium yellow canvas background
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
  imagePlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 110,
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