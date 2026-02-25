import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { checkHealth } from "../../api/modules/health";
import { listOrders } from "../../api/modules/orders";
import { listProducts } from "../../api/modules/products";
import { listReviews } from "../../api/modules/reviews";
import { listSales } from "../../api/modules/sales";
import { listUsers } from "../../api/modules/users";
import { ActionButton } from "../../components/ActionButton";
import { KpiCard } from "../../components/KpiCard";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { ENV } from "../../config/env";
import { theme } from "../../constants/theme";
import { formatCurrencyCOP, formatDateTime } from "../../lib/format";
import { getActivePushToken } from "../../lib/push-session";
import { computeSalesRevenueSummary } from "../../lib/sales-metrics";
import { AdminTabParamList } from "../../navigation/types";
import { useAuthStore } from "../../store/auth-store";
import { InAppAlert, useSyncStore } from "../../store/sync-store";
import { Product, Sale } from "../../types/domain";

interface DashboardState {
  products: number;
  orders: number;
  pendingOrders: number;
  sales: number;
  salesRevenue: number;
  salesRevenueToday: number;
  salesRevenueMonth: number;
  salesRevenueYear: number;
  lowStockProducts: number;
  productsNoRotation30d: number;
  users: number;
  reviews: number;
  healthOk: boolean;
  healthTime?: string;
}

interface NoRotationProductRow {
  key: string;
  nombre: string;
  categoria: string;
  stockCajas: number;
  lastSoldAt: string | null;
  daysWithoutRotation: number | null;
}

type MetricKey = keyof Omit<DashboardState, "healthOk" | "healthTime">;
type MetricTone = "primary" | "success" | "warning" | "danger" | "neutral";
type MetricIcon =
  | "cube-outline"
  | "receipt-outline"
  | "time-outline"
  | "alert-circle-outline"
  | "cash-outline"
  | "today-outline"
  | "calendar-outline"
  | "trending-up-outline"
  | "star-outline"
  | "people-outline";

type ActionIcon = keyof typeof Ionicons.glyphMap;

const metricLabels: Array<{
  key: MetricKey;
  title: string;
  tone: MetricTone;
  icon: MetricIcon;
}> = [
  { key: "products", title: "Productos", tone: "primary", icon: "cube-outline" },
  { key: "orders", title: "Pedidos", tone: "primary", icon: "receipt-outline" },
  { key: "pendingOrders", title: "Pendientes", tone: "warning", icon: "time-outline" },
  { key: "lowStockProducts", title: "Stock Bajo", tone: "danger", icon: "alert-circle-outline" },
  {
    key: "productsNoRotation30d",
    title: "Sin rotacion 30d",
    tone: "warning",
    icon: "time-outline",
  },
  { key: "sales", title: "Ventas", tone: "success", icon: "cash-outline" },
  { key: "salesRevenueToday", title: "Ingresos Hoy", tone: "success", icon: "today-outline" },
  { key: "salesRevenueMonth", title: "Ingresos Mes", tone: "success", icon: "calendar-outline" },
  { key: "salesRevenueYear", title: "Ingresos Ano", tone: "success", icon: "trending-up-outline" },
  { key: "salesRevenue", title: "Ingresos Total", tone: "success", icon: "cash-outline" },
  { key: "reviews", title: "Resenas", tone: "neutral", icon: "star-outline" },
  { key: "users", title: "Usuarios", tone: "neutral", icon: "people-outline" },
];

const quickActions: Array<{
  label: string;
  helper: string;
  tab: keyof AdminTabParamList;
  icon: ActionIcon;
}> = [
  { label: "Ver pedidos", helper: "Gestion operativa", tab: "Pedidos", icon: "receipt-outline" },
  { label: "Revisar stock", helper: "Inventario", tab: "Productos", icon: "cube-outline" },
  { label: "Ver ventas", helper: "Ingresos", tab: "Ventas", icon: "cash-outline" },
];

const priorityMetrics: MetricKey[] = [
  "pendingOrders",
  "lowStockProducts",
  "productsNoRotation30d",
  "salesRevenueToday",
];

const LOW_STOCK_LIMIT = 3;
const NO_ROTATION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const NO_ROTATION_PREVIEW_LIMIT = 8;

const normalizeRef = (value: unknown) => String(value || "").trim().toLowerCase();

const getProductIdentity = (product: Product) => {
  const externalKey = normalizeRef(product.externalId);
  if (externalKey) return externalKey;
  return normalizeRef(product.id);
};

const toSaleTime = (sale: Sale) => {
  const raw = String(sale.fechaISO || sale.createdAt || "").trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveSaleItemProductKey = (
  item: { id?: unknown; nombre?: unknown },
  aliasesByProductKey: Map<string, string>,
  uniqueNameToProductKey: Map<string, string | null>
) => {
  const itemId = normalizeRef(item?.id);
  if (itemId) {
    const fromId = aliasesByProductKey.get(itemId);
    if (fromId) return fromId;
  }
  const itemName = normalizeRef(item?.nombre);
  if (!itemName) return "";
  const byName = uniqueNameToProductKey.get(itemName);
  return byName || "";
};

const buildNoRotationReport = (products: Product[], sales: Sale[]) => {
  const productByKey = new Map<string, Product>();
  const aliasesByProductKey = new Map<string, string>();
  const nameToProductKeys = new Map<string, string[]>();

  products.forEach((product) => {
    const key = getProductIdentity(product);
    if (!key) return;

    productByKey.set(key, product);
    const aliases = [normalizeRef(product.id), normalizeRef(product.externalId)];
    aliases.forEach((alias) => {
      if (!alias) return;
      aliasesByProductKey.set(alias, key);
    });

    const nameKey = normalizeRef(product.nombre);
    if (!nameKey) return;
    const existing = nameToProductKeys.get(nameKey) || [];
    existing.push(key);
    nameToProductKeys.set(nameKey, existing);
  });

  const uniqueNameToProductKey = new Map<string, string | null>();
  nameToProductKeys.forEach((keys, nameKey) => {
    const unique = [...new Set(keys)];
    uniqueNameToProductKey.set(nameKey, unique.length === 1 ? unique[0] : null);
  });

  const now = Date.now();
  const cutoff = now - NO_ROTATION_DAYS * DAY_MS;
  const soldInWindow = new Set<string>();
  const lastSoldAtByProductKey = new Map<string, number>();

  sales.forEach((sale) => {
    const saleTime = toSaleTime(sale);
    if (!saleTime) return;
    const items = Array.isArray(sale.items) ? sale.items : [];
    items.forEach((rawItem) => {
      const item = (rawItem || {}) as { id?: unknown; nombre?: unknown };
      const productKey = resolveSaleItemProductKey(
        item,
        aliasesByProductKey,
        uniqueNameToProductKey
      );
      if (!productKey) return;

      const prevTime = lastSoldAtByProductKey.get(productKey) || 0;
      if (saleTime > prevTime) {
        lastSoldAtByProductKey.set(productKey, saleTime);
      }
      if (saleTime >= cutoff) {
        soldInWindow.add(productKey);
      }
    });
  });

  const items: NoRotationProductRow[] = [];
  productByKey.forEach((product, key) => {
    if (soldInWindow.has(key)) return;
    const lastTime = lastSoldAtByProductKey.get(key) || 0;
    const stockCajas = Number(product.stockCajas) || 0;
    items.push({
      key,
      nombre: String(product.nombre || "Producto"),
      categoria: String(product.categoria || "Sin categoria"),
      stockCajas,
      lastSoldAt: lastTime ? new Date(lastTime).toISOString() : null,
      daysWithoutRotation: lastTime ? Math.floor((now - lastTime) / DAY_MS) : null,
    });
  });

  items.sort((left, right) => {
    if (!left.lastSoldAt && right.lastSoldAt) return -1;
    if (left.lastSoldAt && !right.lastSoldAt) return 1;
    if (!left.lastSoldAt && !right.lastSoldAt) {
      const stockDiff = right.stockCajas - left.stockCajas;
      if (stockDiff !== 0) return stockDiff;
      return left.nombre.localeCompare(right.nombre);
    }
    const leftMs = Date.parse(String(left.lastSoldAt || "")) || 0;
    const rightMs = Date.parse(String(right.lastSoldAt || "")) || 0;
    if (leftMs !== rightMs) return leftMs - rightMs;
    return left.nombre.localeCompare(right.nombre);
  });

  return {
    count: items.length,
    items,
  };
};

const getAlertDestinationTab = (alert: InAppAlert): keyof AdminTabParamList | null => {
  if (alert.type === "orders") {
    return "Pedidos";
  }
  if (alert.type === "stock") {
    return "Productos";
  }
  return null;
};

export const DashboardScreen = () => {
  const role = useAuthStore((state) => state.user?.role ?? "staff");
  const navigation = useNavigation<BottomTabNavigationProp<AdminTabParamList>>();
  const syncTick = useSyncStore((state) => state.syncTick);
  const triggerSync = useSyncStore((state) => state.triggerSync);
  const lastManualSyncAt = useSyncStore((state) => state.lastManualSyncAt);
  const lastAutoSyncAt = useSyncStore((state) => state.lastAutoSyncAt);
  const autoSyncEnabled = useSyncStore((state) => state.autoSyncEnabled);
  const setAutoSyncEnabled = useSyncStore((state) => state.setAutoSyncEnabled);
  const inAppAlerts = useSyncStore((state) => state.inAppAlerts);
  const pushInAppAlert = useSyncStore((state) => state.pushInAppAlert);
  const dismissInAppAlert = useSyncStore((state) => state.dismissInAppAlert);
  const clearInAppAlerts = useSyncStore((state) => state.clearInAppAlerts);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const previousSnapshotRef = useRef<{ pendingOrders: number; lowStockProducts: number } | null>(
    null
  );
  const [state, setState] = useState<DashboardState>({
    products: 0,
    orders: 0,
    pendingOrders: 0,
    sales: 0,
    salesRevenue: 0,
    salesRevenueToday: 0,
    salesRevenueMonth: 0,
    salesRevenueYear: 0,
    lowStockProducts: 0,
    productsNoRotation30d: 0,
    users: 0,
    reviews: 0,
    healthOk: false,
  });
  const [noRotationProducts, setNoRotationProducts] = useState<NoRotationProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, productsRes, ordersRes, salesRes, reviewsRes, usersRes] =
        await Promise.allSettled([
          checkHealth(),
          listProducts(),
          listOrders("all"),
          listSales(),
          listReviews(),
          role === "owner" ? listUsers() : Promise.resolve([]),
        ]);

      const noRotationReport =
        productsRes.status === "fulfilled" && salesRes.status === "fulfilled"
          ? buildNoRotationReport(productsRes.value, salesRes.value)
          : { count: 0, items: [] as NoRotationProductRow[] };

      const newState: DashboardState = {
        ...(salesRes.status === "fulfilled"
          ? (() => {
              const revenue = computeSalesRevenueSummary(salesRes.value);
              return {
                salesRevenueToday: revenue.today,
                salesRevenueMonth: revenue.month,
                salesRevenueYear: revenue.year,
              };
            })()
          : {
              salesRevenueToday: 0,
              salesRevenueMonth: 0,
              salesRevenueYear: 0,
            }),
        products: productsRes.status === "fulfilled" ? productsRes.value.length : 0,
        orders: ordersRes.status === "fulfilled" ? ordersRes.value.length : 0,
        pendingOrders:
          ordersRes.status === "fulfilled"
            ? ordersRes.value.filter(
                (order) => String(order.estado).toLowerCase() === "pendiente"
              ).length
            : 0,
        sales: salesRes.status === "fulfilled" ? salesRes.value.length : 0,
        salesRevenue:
          salesRes.status === "fulfilled"
            ? salesRes.value.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0)
            : 0,
        lowStockProducts:
          productsRes.status === "fulfilled"
            ? productsRes.value.filter((product) => {
                const stock = Number(product.stockCajas) || 0;
                return stock > 0 && stock <= LOW_STOCK_LIMIT;
              }).length
            : 0,
        productsNoRotation30d: noRotationReport.count,
        reviews: reviewsRes.status === "fulfilled" ? reviewsRes.value.length : 0,
        users:
          usersRes.status === "fulfilled" && Array.isArray(usersRes.value)
            ? usersRes.value.length
            : 0,
        healthOk: healthRes.status === "fulfilled" ? !!healthRes.value.ok : false,
        healthTime: healthRes.status === "fulfilled" ? healthRes.value.time : undefined,
      };
      setState(newState);
      setNoRotationProducts(noRotationReport.items);

      const previous = previousSnapshotRef.current;
      if (previous) {
        const hasActivePushToken = !!getActivePushToken();
        const lowStockDelta = newState.lowStockProducts - previous.lowStockProducts;
        if (!hasActivePushToken && lowStockDelta > 0) {
          pushInAppAlert({
            type: "stock",
            title: "Alerta de stock bajo",
            message:
              lowStockDelta === 1
                ? "1 producto adicional quedo en stock bajo."
                : `${lowStockDelta} productos adicionales quedaron en stock bajo.`,
            dedupeKey: `local:stock_low:${newState.lowStockProducts}`,
          });
        }
      }
      previousSnapshotRef.current = {
        pendingOrders: newState.pendingOrders,
        lowStockProducts: newState.lowStockProducts,
      };

      const failed = [healthRes, productsRes, ordersRes, salesRes].some(
        (result) => result.status === "rejected"
      );
      if (failed) {
        setError("Algunos datos no pudieron cargarse. Usa sincronizar para reintentar.");
      }
    } finally {
      setLoading(false);
    }
  }, [role, pushInAppAlert]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard, syncTick]);

  const formatMetricValue = (key: MetricKey) =>
    key === "salesRevenue"
    || key === "salesRevenueToday"
    || key === "salesRevenueMonth"
    || key === "salesRevenueYear"
      ? formatCurrencyCOP(Number(state[key]) || 0)
      : String(state[key]);
  const autoSyncSeconds = Math.round(ENV.autoSyncIntervalMs / 1000);

  const onOpenAlert = (alert: InAppAlert) => {
    const destinationTab = getAlertDestinationTab(alert);
    if (!destinationTab) {
      return;
    }
    navigation.navigate(destinationTab);
    dismissInAppAlert(alert.id);
  };

  const onRefreshDashboard = useCallback(async () => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboard, refreshing]);

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={() => void onRefreshDashboard()}>
      <SectionCard title="Centro operativo">
        <View style={styles.topRow}>
          <View>
            <Text style={styles.heading}>Estado API</Text>
            <Text style={styles.subtle}>
              Ultima respuesta: {formatDateTime(state.healthTime)}
            </Text>
          </View>
          <StatusBadge
            text={state.healthOk ? "online" : "offline"}
            tone={state.healthOk ? "success" : "danger"}
          />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="shield-checkmark-outline" size={13} color={theme.colors.primaryStrong} />
            <Text style={styles.metaPillText}>Rol: {role}</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="link-outline" size={13} color={theme.colors.primaryStrong} />
            <Text style={styles.metaPillText} numberOfLines={1}>
              API: {ENV.apiBaseUrl}
            </Text>
          </View>
        </View>
        <View style={styles.autoSyncRow}>
          <View style={styles.autoSyncTextBlock}>
            <Text style={styles.autoSyncLabel}>Auto-sync cada {autoSyncSeconds}s</Text>
            <Text style={styles.subtle}>
              {autoSyncEnabled ? "Activo" : "Pausado"} (solo app abierta)
            </Text>
          </View>
          <Switch
            value={autoSyncEnabled}
            onValueChange={setAutoSyncEnabled}
            trackColor={{ false: "rgba(98,108,113,0.3)", true: "rgba(33,128,141,0.4)" }}
            thumbColor={autoSyncEnabled ? theme.colors.primaryStrong : "#f3f4f6"}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {error ? (
          <ActionButton
            label="Reintentar carga"
            variant="secondary"
            onPress={() => void onRefreshDashboard()}
            disabled={refreshing}
          />
        ) : null}
        <ActionButton label="Sincronizar ahora" onPress={triggerSync} />
        {lastManualSyncAt ? (
          <Text style={styles.syncLabel}>
            Ultima sync manual: {formatDateTime(lastManualSyncAt)}
          </Text>
        ) : null}
        {lastAutoSyncAt ? (
          <Text style={styles.syncLabel}>
            Ultima auto-sync: {formatDateTime(lastAutoSyncAt)}
          </Text>
        ) : null}
      </SectionCard>

      <SectionCard title="Alertas operativas">
        <View style={styles.alertHeaderRow}>
          <Text style={styles.subtle}>Notificaciones internas (app abierta)</Text>
          {inAppAlerts.length ? (
            <Pressable style={styles.clearAlertsButton} onPress={clearInAppAlerts}>
              <Text style={styles.clearAlertsButtonText}>Limpiar</Text>
            </Pressable>
          ) : null}
        </View>
        {!inAppAlerts.length ? (
          <Text style={styles.subtle}>Sin alertas nuevas.</Text>
        ) : (
          inAppAlerts.map((alert) => {
            const destinationTab = getAlertDestinationTab(alert);
            const icon =
              alert.type === "orders"
                ? "notifications-outline"
                : alert.type === "stock"
                ? "alert-circle-outline"
                : "information-circle-outline";
            const tone =
              alert.type === "orders"
                ? styles.alertCardOrder
                : alert.type === "stock"
                ? styles.alertCardStock
                : styles.alertCardSystem;
            return (
              <View key={alert.id} style={[styles.alertCard, tone]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.alertCardMain,
                    destinationTab && styles.alertCardMainInteractive,
                    destinationTab && pressed && styles.alertCardMainPressed,
                  ]}
                  onPress={() => onOpenAlert(alert)}
                  disabled={!destinationTab}
                >
                  <Ionicons name={icon} size={16} color={theme.colors.primaryStrong} />
                  <View style={styles.alertTextWrap}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertText}>{alert.message}</Text>
                    <Text style={styles.alertMeta}>{formatDateTime(alert.createdAt)}</Text>
                    {destinationTab ? (
                      <Text style={styles.alertLinkText}>Abrir {destinationTab}</Text>
                    ) : null}
                  </View>
                </Pressable>
                <Pressable
                  style={styles.alertDismissButton}
                  onPress={() => dismissInAppAlert(alert.id)}
                >
                  <Ionicons name="close-outline" size={16} color={theme.colors.textMuted} />
                </Pressable>
              </View>
            );
          })
        )}
      </SectionCard>

      <SectionCard title="Foco del dia">
        <View style={styles.metricsGrid}>
          {priorityMetrics.map((metricKey) => {
            const metric = metricLabels.find((item) => item.key === metricKey);
            if (!metric) {
              return null;
            }
            return (
              <View style={styles.metricCardWrap} key={metric.key}>
                <KpiCard
                  label={metric.title}
                  tone={metric.tone}
                  icon={metric.icon}
                  compact
                  value={formatMetricValue(metric.key)}
                />
              </View>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="Productos sin rotacion (30 dias)">
        <Text style={styles.subtle}>
          Productos sin ventas registradas en los ultimos {NO_ROTATION_DAYS} dias.
        </Text>
        {!noRotationProducts.length ? (
          <Text style={styles.subtle}>Sin alertas. Todo el catalogo tuvo movimiento reciente.</Text>
        ) : (
          <>
            {noRotationProducts.slice(0, NO_ROTATION_PREVIEW_LIMIT).map((item) => (
              <View key={item.key} style={styles.noRotationRow}>
                <View style={styles.noRotationInfo}>
                  <Text style={styles.noRotationName}>{item.nombre}</Text>
                  <Text style={styles.noRotationMeta}>
                    {item.categoria} · Stock cajas: {item.stockCajas}
                  </Text>
                  <Text style={styles.noRotationMeta}>
                    {item.lastSoldAt
                      ? `Ultima venta: ${formatDateTime(item.lastSoldAt)}`
                      : "Sin ventas historicas"}
                  </Text>
                </View>
                <View style={styles.noRotationBadge}>
                  <Text style={styles.noRotationBadgeText}>
                    {item.daysWithoutRotation == null
                      ? `>${NO_ROTATION_DAYS}d`
                      : `${item.daysWithoutRotation}d`}
                  </Text>
                </View>
              </View>
            ))}
            {noRotationProducts.length > NO_ROTATION_PREVIEW_LIMIT ? (
              <Text style={styles.noRotationMore}>
                +{noRotationProducts.length - NO_ROTATION_PREVIEW_LIMIT} productos adicionales.
              </Text>
            ) : null}
            <ActionButton
              label="Abrir inventario"
              variant="secondary"
              onPress={() => navigation.navigate("Productos")}
            />
          </>
        )}
      </SectionCard>

      <SectionCard title="Atajos">
        <View style={styles.quickActionRow}>
          {quickActions.map((action) => (
            <Pressable
              key={action.tab}
              style={styles.quickActionButton}
              onPress={() => navigation.navigate(action.tab)}
            >
              <View style={styles.quickActionTop}>
                <Ionicons name={action.icon} size={14} color={theme.colors.primaryStrong} />
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </View>
              <Text style={styles.quickActionHelper}>{action.helper}</Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.subtle}>Actualizando metricas...</Text>
        </View>
      ) : null}

      <SectionCard title="Resumen completo">
        <View style={styles.metricsGrid}>
          {metricLabels.map((metric) => (
            <View style={styles.metricCardWrap} key={metric.key}>
              <KpiCard
                label={metric.title}
                tone={metric.tone}
                icon={metric.icon}
                compact
                value={formatMetricValue(metric.key)}
              />
            </View>
          ))}
        </View>
      </SectionCard>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  heading: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 17,
  },
  subtle: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(33,128,141,0.24)",
    backgroundColor: "rgba(33,128,141,0.08)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  metaPillText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCardWrap: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  loadingBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  error: {
    color: "#b91c1c",
    backgroundColor: "rgba(239,68,68,0.12)",
    padding: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  syncLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  autoSyncRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  autoSyncTextBlock: {
    flex: 1,
    gap: 2,
  },
  autoSyncLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  alertHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  clearAlertsButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  clearAlertsButtonText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  alertCardOrder: {
    borderColor: "rgba(11,99,208,0.24)",
    backgroundColor: "rgba(11,99,208,0.05)",
  },
  alertCardStock: {
    borderColor: "rgba(245,158,11,0.3)",
    backgroundColor: "rgba(245,158,11,0.08)",
  },
  alertCardSystem: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  alertCardMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flex: 1,
  },
  alertCardMainInteractive: {
    borderRadius: theme.radius.sm,
    paddingRight: 4,
  },
  alertCardMainPressed: {
    opacity: 0.75,
  },
  alertTextWrap: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  alertText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  alertMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  alertLinkText: {
    color: theme.colors.primaryStrong,
    fontSize: 11,
    fontWeight: "800",
  },
  alertDismissButton: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    minWidth: 110,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4,
  },
  quickActionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  quickActionLabel: {
    color: theme.colors.primaryStrong,
    fontSize: 13,
    fontWeight: "800",
  },
  quickActionHelper: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  noRotationRow: {
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    backgroundColor: "rgba(245,158,11,0.08)",
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  noRotationInfo: {
    flex: 1,
    gap: 2,
  },
  noRotationName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  noRotationMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  noRotationBadge: {
    borderWidth: 1,
    borderColor: "rgba(180,83,9,0.3)",
    backgroundColor: "rgba(180,83,9,0.12)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  noRotationBadgeText: {
    color: "#92400e",
    fontSize: 11,
    fontWeight: "900",
  },
  noRotationMore: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
});
