import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import colors from "../../theme/colors";

export default function EmptyState({
  icon: Icon,
  iconName = "default",
  iconSize = 64,
  iconColor = colors.border,
  title,
  subtitle,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        {Icon ? <Icon size={iconSize} color={iconColor} /> : null}
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
          {ActionIcon ? <ActionIcon size={20} color={colors.background} /> : null}
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
});
