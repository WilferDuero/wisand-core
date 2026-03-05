import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { useBrandTheme } from "../providers/BrandingProvider";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export const EmptyState = ({
  title,
  subtitle,
  icon = "layers-outline",
}: EmptyStateProps) => {
  const theme = useBrandTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={theme.colors.primaryStrong} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useBrandTheme>) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: "rgba(255,255,255,0.86)",
      padding: 14,
      gap: 10,
      flexDirection: "row",
      alignItems: "flex-start",
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(33,128,141,0.24)",
      backgroundColor: "rgba(33,128,141,0.1)",
      alignItems: "center",
      justifyContent: "center",
    },
    textWrap: {
      flex: 1,
      gap: 4,
    },
    title: {
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 15,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });