import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getApiBaseUrl, setApiBaseUrl } from "../../api/client";
import { ActionButton } from "../../components/ActionButton";
import { FormField } from "../../components/FormField";
import { ScreenContainer } from "../../components/ScreenContainer";
import { buildApiBaseCandidates, resolveReachableApiBase } from "../../lib/api-base-resolver";
import { tenantCodeStorage } from "../../lib/tenant-code-storage";
import { AppTheme } from "../../constants/theme";
import { useBrandTheme, useBranding } from "../../providers/BrandingProvider";
import { useAuthStore } from "../../store/auth-store";

export const LoginScreen = () => {
  const login = useAuthStore((state) => state.login);
  const authNotice = useAuthStore((state) => state.authNotice);
  const consumeAuthNotice = useAuthStore((state) => state.consumeAuthNotice);
  const isLoginPending = useAuthStore((state) => state.isLoginPending);
  const { branding, loadBrandingByCode, isLoading: isBrandingLoading } = useBranding();
  const theme = useBrandTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [tenantCode, setTenantCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logoFallback, setLogoFallback] = useState(false);

  useEffect(() => {
    setLogoFallback(false);
  }, [branding.logo_url]);

  useEffect(() => {
    let active = true;
    const loadTenantCode = async () => {
      const stored = await tenantCodeStorage.get();
      if (active && stored) {
        setTenantCode(stored);
      }
    };
    void loadTenantCode();
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async () => {
    const company = tenantCode.trim().toLowerCase();
    const user = username.trim();
    const pass = password.trim();
    if (!company || !user || !pass) {
      setErrorMessage("Codigo de empresa, usuario y contrasena son obligatorios.");
      return;
    }

    try {
      setErrorMessage(null);

      const candidates = buildApiBaseCandidates();
      const resolvedApiBase = await resolveReachableApiBase(candidates, 1500);
      if (!resolvedApiBase) {
        throw new Error(
          "No se pudo conectar con la API. Revisa backend en puerto 3001 y conexion USB/LAN."
        );
      }
      setApiBaseUrl(resolvedApiBase);

      await loadBrandingByCode(company);
      await login(user, pass, company);
      await tenantCodeStorage.set(company);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "No fue posible iniciar sesion.";
      const normalized = rawMessage.toLowerCase();
      const needsApiHint =
        normalized.includes("network")
        || normalized.includes("fetch")
        || normalized.includes("timeout")
        || normalized.includes("conectar");

      const message = needsApiHint
        ? `${rawMessage} (API actual: ${getApiBaseUrl()})`
        : rawMessage;
      setErrorMessage(message);
    }
  };

  const isPending = isLoginPending || isBrandingLoading;
  const logoSource: ImageSourcePropType =
    branding.logo_url && !logoFallback
      ? { uri: branding.logo_url }
      : require("../../../assets/brand/wisand_logo_main.png");

  return (
    <ScreenContainer scrollable={false} contentContainerStyle={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={logoSource}
          style={styles.logo}
          resizeMode="contain"
          onError={() => setLogoFallback(true)}
        />
        <Text style={styles.brandName}>{branding.display_name}</Text>
        <Text style={styles.subtitle}>Panel Admin Movil</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>Acceso</Text>
        {authNotice ? (
          <View style={styles.noticeRow}>
            <Text style={styles.noticeText}>{authNotice}</Text>
            <Pressable onPress={consumeAuthNotice} style={styles.noticeCloseButton}>
              <Text style={styles.noticeCloseText}>X</Text>
            </Pressable>
          </View>
        ) : null}
        <FormField
          label="Codigo de empresa"
          value={tenantCode}
          onChangeText={setTenantCode}
          placeholder="ej: wisand-demo"
        />
        <FormField label="Usuario" value={username} onChangeText={setUsername} placeholder="owner o staff" />
        <FormField
          label="Contrasena"
          value={password}
          onChangeText={setPassword}
          placeholder="********"
          secureTextEntry
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <ActionButton
          label="Ingresar"
          onPress={() => void handleLogin()}
          loading={isPending}
          disabled={isPending}
        />
      </View>

      {isPending ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={theme.colors.primaryStrong} size="large" />
        </View>
      ) : null}
    </ScreenContainer>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.white,
      paddingHorizontal: 24,
      justifyContent: "center",
      gap: 0,
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: 40,
    },
    logo: {
      width: 240,
      height: 64,
    },
    brandName: {
      marginTop: 8,
      fontSize: 22,
      fontWeight: "800",
      color: theme.colors.text,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 14,
      color: theme.colors.textMuted,
      fontWeight: "500",
    },
    formContainer: {
      width: "100%",
      gap: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      padding: 16,
      backgroundColor: theme.colors.white,
    },
    formTitle: {
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 18,
    },
    error: {
      color: "#991B1B",
      backgroundColor: "rgba(239,68,68,0.12)",
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: "rgba(239,68,68,0.25)",
    },
    noticeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.35)",
      backgroundColor: "rgba(245,158,11,0.1)",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    noticeText: {
      color: "#854D0E",
      fontSize: 12,
      fontWeight: "800",
      flex: 1,
    },
    noticeCloseButton: {
      minWidth: 20,
      minHeight: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    noticeCloseText: {
      color: "#854D0E",
      fontSize: 12,
      fontWeight: "900",
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(15,23,42,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
  });


