import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "../../components/ActionButton";
import { FormField } from "../../components/FormField";
import { ScreenContainer } from "../../components/ScreenContainer";
import { tenantCodeStorage } from "../../lib/tenant-code-storage";
import { useAuthStore } from "../../store/auth-store";

export const LoginScreen = () => {
  const login = useAuthStore((state) => state.login);
  const authNotice = useAuthStore((state) => state.authNotice);
  const consumeAuthNotice = useAuthStore((state) => state.consumeAuthNotice);
  const isLoginPending = useAuthStore((state) => state.isLoginPending);
  const [tenantCode, setTenantCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      await login(user, pass, company);
      await tenantCodeStorage.set(company);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible iniciar sesion.";
      setErrorMessage(message);
    }
  };

  return (
    <ScreenContainer scrollable={false} contentContainerStyle={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require("../../../assets/brand/wisand_logo_main.png")}
          style={styles.logo}
          resizeMode="contain"
        />
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
          loading={isLoginPending}
          disabled={isLoginPending}
        />
      </View>

      {isLoginPending ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#0f172a" size="large" />
        </View>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  formContainer: {
    width: "100%",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  formTitle: {
    color: "#0F172A",
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
