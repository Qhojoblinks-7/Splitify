import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "../../theme/colors";

const DEFAULT_MAX_HEIGHT = "92%";

const BACKDROP_MAX_OPACITY = 0.6;
const DISMISS_DISTANCE_RATIO = 0.3;
const DISMISS_VELOCITY = 0.6;
const VELOCITY_PROJECTION = 180;
const MIN_BOTTOM_GAP = 12;

const SPRING_CONFIG = {
  damping: 26,
  stiffness: 240,
  mass: 0.85,
  overshootClamping: true,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 2,
};

function resolveMaxHeight(value, viewport) {
  if (!viewport) return 0;
  const ratio = typeof value === "number" ? value : parseFloat(String(value).replace("%", "")) / 100;
  const safeRatio = Number.isFinite(ratio) && ratio > 0 && ratio <= 1 ? ratio : 0.92;
  return Math.min(viewport * safeRatio, viewport);
}

export default function BottomSheet({
  isVisible,
  onClose,
  title,
  children,
  maxHeight = DEFAULT_MAX_HEIGHT,
  bottomInset = 0,
}) {
  const insets = useSafeAreaInsets();
  const { height: viewport } = useWindowDimensions();

  // `bottomInset` covers chrome that overlays this surface from below, such as
  // a tab navigator bar, which the safe-area inset alone does not describe.
  const bottomPadding = Math.max(insets.bottom + bottomInset, MIN_BOTTOM_GAP);

  const heightCeiling = useMemo(() => resolveMaxHeight(maxHeight, viewport), [maxHeight, viewport]);

  const [isRendered, setIsRendered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const [isMeasuring, setIsMeasuring] = useState(false);

  const offsetRef = useRef(null);
  if (offsetRef.current === null) {
    offsetRef.current = new Animated.Value(0);
  }
  const offset = offsetRef.current;

  const offsetRefValue = useRef(0);
  const dragStartRef = useRef(0);
  const isDragging = useRef(false);
  const isOpenRef = useRef(false);
  const panelHeightRef = useRef(0);

  const animate = useCallback(
    (toValue, velocity = 0, onComplete) => {
      const clamped = Math.max(toValue, 0);
      offsetRefValue.current = clamped;
      Animated.spring(offset, {
        toValue: clamped,
        velocity,
        useNativeDriver: false,
        ...SPRING_CONFIG,
      }).start(({ finished }) => {
        if (finished && onComplete) onComplete();
      });
    },
    [offset],
  );

  const requestClose = useCallback(() => {
    if (isDragging.current) return;
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (isVisible) {
      // Guarded so a viewport change while open (rotation, or an Android
      // resize when the keyboard shows) does not restart the entry animation.
      if (isOpenRef.current) return;
      isOpenRef.current = true;
      setIsRendered(true);
      setIsOpen(true);
      // Measure afresh on every open: content can change between openings. The
      // previous height is kept so the sheet still has a value to animate from.
      setIsMeasuring(true);
      offsetRefValue.current = viewport;
      offset.setValue(viewport);
    } else if (isOpenRef.current) {
      isOpenRef.current = false;
      setIsOpen(false);
      setIsMeasuring(false);
      const target = panelHeightRef.current || viewport;
      animate(target, 0, () => setIsRendered(false));
    }
  }, [animate, isVisible, offset, viewport]);

  const handlePanelLayout = useCallback((event) => {
    const measured = event.nativeEvent.layout.height;
    if (measured <= 0) return;
    panelHeightRef.current = measured;
    setPanelHeight(measured);
    setIsMeasuring(false);
  }, []);

  useEffect(() => {
    if (!isOpen || isMeasuring || panelHeight <= 0) return;
    animate(0);
  }, [animate, isMeasuring, isOpen, panelHeight]);

  const settle = useCallback(
    (velocity) => {
      const projected = offsetRefValue.current + velocity * VELOCITY_PROJECTION;
      if (velocity > DISMISS_VELOCITY || projected > panelHeight * DISMISS_DISTANCE_RATIO) {
        requestClose();
        return;
      }
      animate(0, velocity);
    },
    [animate, panelHeight, requestClose],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderGrant: () => {
          offset.stopAnimation();
          dragStartRef.current = offsetRefValue.current;
          isDragging.current = true;
        },
        onPanResponderMove: (_, gesture) => {
          const next = Math.max(
            Math.min(dragStartRef.current + gesture.dy, panelHeight),
            0,
          );
          offsetRefValue.current = next;
          offset.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          isDragging.current = false;
          settle(gesture.vy);
        },
        onPanResponderTerminate: () => {
          isDragging.current = false;
          settle(0);
        },
      }),
    [animate, offset, panelHeight, settle],
  );

  const backdropOpacity = useMemo(
    () =>
      offset.interpolate({
        inputRange: [0, Math.max(panelHeight, 1)],
        outputRange: [BACKDROP_MAX_OPACITY, 0],
        extrapolate: "clamp",
      }),
    [offset, panelHeight],
  );

  if (!isRendered || (!isMeasuring && panelHeight <= 0)) {
    return null;
  }

  return (
    <View style={styles.root} pointerEvents={isOpen ? "box-none" : "none"}>
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        accessibilityViewIsModal={isOpen}
        importantForAccessibility={isOpen ? "yes" : "no-hide-descendants"}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        onLayout={isMeasuring ? handlePanelLayout : undefined}
        style={[
          styles.sheet,
          { paddingBottom: bottomPadding, transform: [{ translateY: offset }] },
          // While measuring the sheet is free to take its natural content height,
          // capped only by the ceiling. Afterwards the height is pinned so the
          // content scrolls inside it rather than growing without bound.
          isMeasuring ? { maxHeight: heightCeiling } : { height: panelHeight },
        ]}
        accessibilityViewIsModal={isOpen}
        importantForAccessibility="yes"
      >
        <View {...panResponder.panHandlers} style={styles.grabberArea}>
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={isMeasuring ? styles.bodyMeasuring : styles.bodyPinned}
        >
          {children}
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 24,
  },
  grabberArea: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
    alignSelf: "center",
  },
  title: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  bodyMeasuring: {
    flexGrow: 0,
    flexShrink: 0,
  },
  bodyPinned: {
    flex: 1,
  },
});