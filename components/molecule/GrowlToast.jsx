import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, XCircle, AlertTriangle, Info, Ban } from "lucide-react-native";
import colors from "../../theme/colors";

const VARIANTS = {
  success: { color: colors.success, Icon: CheckCircle2, tint: "rgba(74, 222, 128, 0.14)" },
  error: { color: colors.danger, Icon: XCircle, tint: "rgba(239, 68, 68, 0.14)" },
  warning: { color: colors.warning, Icon: AlertTriangle, tint: "rgba(251, 184, 28, 0.14)" },
  danger: { color: colors.danger, Icon: Ban, tint: "rgba(239, 68, 68, 0.14)" },
  info: { color: colors.gold, Icon: Info, tint: "rgba(251, 184, 28, 0.14)" },
  confirm: { color: colors.gold, Icon: Info, tint: "rgba(251, 184, 28, 0.14)" },
};

const DEFAULT_DURATION = { success: 3200, info: 3200, confirm: 3200, warning: 4000, danger: 4500, error: 4500 };

export default function GrowlToast({ toast, onExited }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  const closing = useRef(false);

  useEffect(() => {
    if (!toast) return undefined;

    closing.current = false;
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();

    const duration = toast.duration ?? DEFAULT_DURATION[toast.variant] ?? 3200;
    timer.current = setTimeout(requestClose, duration);

    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast && toast.id, progress]);

  function requestClose() {
    if (!toast || closing.current) return;
    const id = toast.id;
    closing.current = true;
    clearTimeout(timer.current);
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onExited(id));
  }

  if (!toast) return null;

  const { color, Icon, tint } = VARIANTS[toast.variant] || VARIANTS.info;

  return (
    <View style={[styles.host, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toast,
          { borderLeftColor: color },
          {
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-28, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable
          style={styles.pressable}
          onPress={requestClose}
          accessibilityRole="alert"
          accessibilityLabel={toast.message}
        >
          <View style={[styles.iconWrap, { backgroundColor: tint }]}>
            <Icon size={17} color={color} strokeWidth={2.4} />
          </View>
          <View style={styles.body}>
            {toast.title ? (
              <Text style={styles.title} numberOfLines={1}>
                {toast.title}
              </Text>
            ) : null}
            {toast.message ? (
              <Text style={styles.message} numberOfLines={3}>
                {toast.message}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 24,
  },
  toast: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 14,
  },
  pressable: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Platform.OS === "android" ? 1 : 0,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  message: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 19,
  },
});
