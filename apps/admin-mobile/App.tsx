import { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { usePushNotifications } from "./src/features/notifications/usePushNotifications";
import { useAuthStore } from "./src/store/auth-store";
import { ENV } from "./src/config/env";
import { AppTheme } from "./src/constants/theme";
import { BrandingProvider, useBrandTheme, useBranding } from "./src/providers/BrandingProvider";

const AppContent = () => {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const logout = useAuthStore((state) => state.logout);
  const status = useAuthStore((state) => state.status);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const { hydrateFromCache } = useBranding();
  const theme = useBrandTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const backgroundAtRef = useRef<number | null>(null);
  usePushNotifications();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    void hydrateFromCache();
  }, [hydrateFromCache]);

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "background" || nextState === "inactive") {
        backgroundAtRef.current = Date.now();
        return;
      }

      if (nextState === "active" && status === "authenticated") {
        const backgroundAt = backgroundAtRef.current;
        backgroundAtRef.current = null;
        if (!backgroundAt) {
          return;
        }
        const elapsed = Date.now() - backgroundAt;
        if (elapsed >= ENV.sessionIdleTimeoutMs) {
          Alert.alert(
            "Sesion expirada",
            "Por seguridad se cerro la sesion por inactividad."
          );
          void logout();
        }
      }
    };

    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, [logout, status]);

  if (isBootstrapping || status === "checking") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text style={styles.loadingText}>Cargando panel admin...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <AppNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <BrandingProvider>
        <AppContent />
      </BrandingProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
    },
    loadingText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
  });
