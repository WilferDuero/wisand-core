import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useBrandTheme } from "../providers/BrandingProvider";

type BannerTone = "error" | "info" | "success" | "warning";

interface NoticeBannerProps {
  tone?: BannerTone;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const NoticeBanner = ({
  tone = "info",
  title,
  message,
  actionLabel,
  onAction,
}: NoticeBannerProps) => {
  const theme = useBrandTheme();
  const styles = createStyles(theme);

  const toneMap: Record<
    BannerTone,
    { icon: keyof typeof Ionicons.glyphMap; border: string; bg: string; iconColor: string; textColor: string }
  > = {
    error: {
      icon: "alert-circle-outline",
      border: "rgba(239,68,68,0.3)",
      bg: "rgba(239,68,68,0.1)",
      iconColor: "#b91c1c",
      textColor: "#991b1b",
    },
    info: {
      icon: "information-circle-outline",
      border: "rgba(33,128,141,0.3)",
      bg: "rgba(33,128,141,0.1)",
      iconColor: theme.colors.primaryStrong,
      textColor: theme.colors.text,
    },
    success: {
      icon: "checkmark-circle-outline",
      border: "rgba(16,185,129,0.3)",
      bg: "rgba(16,185,129,0.1)",
      iconColor: "#047857",
      textColor: theme.colors.text,
    },
    warning: {
      icon: "warning-outline",
      border: "rgba(245,158,11,0.35)",
      bg: "rgba(245,158,11,0.12)",
      iconColor: "#b45309",
      textColor: theme.colors.text,
    },
  };

  const cfg = toneMap[tone];

  return (
    <View style={[styles.container, { borderColor: cfg.border, backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={16} color={cfg.iconColor} style={styles.icon} />
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: cfg.textColor }]}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useBrandTheme>) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 9,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    icon: {
      marginTop: 1,
    },
    textWrap: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 13,
      fontWeight: "800",
    },
    message: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    actionButton: {
      borderWidth: 1,
      borderColor: "rgba(33,128,141,0.28)",
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: "rgba(255,255,255,0.78)",
    },
    actionLabel: {
      color: theme.colors.primaryStrong,
      fontSize: 11,
      fontWeight: "800",
    },
  });