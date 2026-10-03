import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Modal } from "react-native";
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

const CANCEL = "cancel";
const DESTRUCTIVE = "destructive";

export default function GrowlDialog({ visible, title, message, variant = "info", buttons, onClose }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      opacity.setValue(0);
      scale.setValue(0.92);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 90,
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.94, duration: 140, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, rendered, opacity, scale]);

  if (!rendered) return null;

  const { color, Icon, tint } = VARIANTS[variant] || VARIANTS.info;
  const actions = buttons && buttons.length ? buttons : [{ text: "Done" }];
  const hasCancel = actions.some((b) => b.style === CANCEL);
  const stacked = actions.length > 2;

  const handleAction = (button) => {
    onClose();
    if (typeof button.onPress === "function") {
      setTimeout(() => button.onPress(), 10);
    }
  };

  const buttonStyle = (button) => {
    if (button.style === CANCEL) return [styles.btn, styles.btnCancel, styles.btnCancelText];
    if (button.style === DESTRUCTIVE) return [styles.btn, styles.btnDestructive, styles.btnDestructiveText];
    return [styles.btn, styles.btnPrimary, styles.btnPrimaryText];
  };

  const buttonTextStyle = (button) => {
    if (button.style === CANCEL) return styles.btnCancelText;
    if (button.style === DESTRUCTIVE) return styles.btnDestructiveText;
    return styles.btnPrimaryText;
  };

  const buttonPressStyle = (button) => {
    if (button.style === CANCEL) return styles.btnCancelPressed;
    if (button.style === DESTRUCTIVE) return styles.btnDestructivePressed;
    return styles.btnPrimaryPressed;
  };

  return (
    <Modal
      visible={rendered}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable
          style={styles.backdropPress}
          activeOpacity={1}
          onPress={hasCancel ? onClose : undefined}
          accessibilityLabel="Dismiss"
        />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: tint }]}>
            <Icon size={24} color={color} strokeWidth={2.2} />
          </View>

          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {actions.map((button, index) => (
              <Pressable
                key={`${button.text}-${index}`}
                onPress={() => handleAction(button)}
                style={({ pressed }) => [
                  buttonStyle(button),
                  stacked && styles.btnStacked,
                  !stacked && styles.btnFlex,
                  pressed && buttonPressStyle(button),
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, buttonTextStyle(button)]} numberOfLines={1}>
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  backdropPress: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 22,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  message: {
    color: colors.textBody,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
    alignSelf: "stretch",
  },
  actionsStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  btn: {
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  btnFlex: {
    flex: 1,
  },
  btnStacked: {
    alignSelf: "stretch",
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  btnPrimary: {
    backgroundColor: colors.gold,
  },
  btnPrimaryText: {
    color: colors.onGold,
  },
  btnPrimaryPressed: {
    opacity: 0.78,
  },
  btnDestructive: {
    backgroundColor: colors.danger,
  },
  btnDestructiveText: {
    color: colors.text,
  },
  btnDestructivePressed: {
    opacity: 0.78,
  },
  btnCancel: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnCancelText: {
    color: colors.textBody,
  },
  btnCancelPressed: {
    backgroundColor: colors.borderSubtle,
  },
});
