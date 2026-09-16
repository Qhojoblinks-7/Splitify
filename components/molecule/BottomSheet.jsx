import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const SNAP_HEIGHT = SCREEN_HEIGHT * 0.9;

export default function BottomSheet({
  isVisible,
  onClose,
  title,
  children,
}) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - SNAP_HEIGHT,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }).start();
    } else {
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }).start();
    }
  }, [isVisible, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        const nextPosition = Math.max(
          SCREEN_HEIGHT - SNAP_HEIGHT,
          Math.min(SCREEN_HEIGHT, SCREEN_HEIGHT - SNAP_HEIGHT + gesture.dy)
        );
        translateY.setValue(nextPosition);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80 || gesture.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: SCREEN_HEIGHT - SNAP_HEIGHT,
            useNativeDriver: true,
            friction: 8,
            tension: 100,
          }).start();
        }
      },
    })
  ).current;

  const overlayOpacity = translateY.interpolate({
    inputRange: [SCREEN_HEIGHT - SNAP_HEIGHT, SCREEN_HEIGHT],
    outputRange: [0.5, 0],
  });

  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View style={[styles.backdropInner, { opacity: overlayOpacity }]} />
      </TouchableOpacity>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: translateY }] }]}
        {...panResponder.panHandlers}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetContent}
        >
          <View style={styles.handle} />

          {title && <Text style={styles.title}>{title}</Text>}

          {children}
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  backdropInner: {
    flex: 1,
    backgroundColor: "#000000",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    width: SCREEN_WIDTH,
    height: SNAP_HEIGHT,
    backgroundColor: "#16171b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#33353b",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 16,
    textAlign: "center",
  },
  sheetContent: {
    flex: 1,
  },
});