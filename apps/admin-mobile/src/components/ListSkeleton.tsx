import { StyleSheet, View } from "react-native";
import { useBrandTheme } from "../providers/BrandingProvider";

interface ListSkeletonProps {
  rows?: number;
}

export const ListSkeleton = ({ rows = 3 }: ListSkeletonProps) => {
  const theme = useBrandTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.wrap}>
      {Array.from({ length: Math.max(1, rows) }).map((_, index) => (
        <View key={`sk-row-${index}`} style={styles.card}>
          <View style={[styles.bar, styles.barLg]} />
          <View style={[styles.bar, styles.barMd]} />
          <View style={[styles.bar, styles.barSm]} />
        </View>
      ))}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useBrandTheme>) =>
  StyleSheet.create({
    wrap: {
      gap: 10,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: "rgba(255,255,255,0.84)",
      padding: 12,
      gap: 8,
    },
    bar: {
      borderRadius: 999,
      backgroundColor: "rgba(15,23,42,0.08)",
      height: 11,
    },
    barLg: {
      width: "62%",
    },
    barMd: {
      width: "84%",
    },
    barSm: {
      width: "48%",
    },
  });