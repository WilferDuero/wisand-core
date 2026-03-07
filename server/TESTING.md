# Testing Manual y Script

## 1) Levantar API

Desde la raiz del repo:

```bash
npm --prefix server run dev
```

La API debe quedar en `http://localhost:3001` (o el `PORT` configurado).

## 2) Ejecutar prueba automatica multi-tenant

En otra terminal:

```bash
npm --prefix server run test:multitenant
```

El script hace:
- Crea tenant (si no existe) con `/internal/tenants` y `code`
- Login de tenant 2 (`owner2`/`123456`) por `tenant_code`
- Crea producto en tenant 2
- Verifica que tenant 2 si lo vea
- Si defines credenciales tenant 1, valida aislamiento cruzado

## 3) Ejecutar readiness 4-en-1 (recomendado)

```bash
npm --prefix server run test:readiness
```

Valida en una sola corrida:
- Flujo owner: crear producto, ajustar stock, revisar movimiento
- Flujo staff: listar catalogo y registrar venta
- Seguridad roles: staff bloqueado para crear/editar/eliminar productos (`403`)
- Presencia de plantilla CSV operativa (`apps/pos-web/examples/catalogo_template.csv`)
- Chequeo tecnico go-live (`scripts/go-live-check.js`)

Variables opcionales:
- `TEST_API_BASE`
- `READINESS_TENANT_NAME`
- `READINESS_TENANT_CODE`
- `READINESS_OWNER_USERNAME`
- `READINESS_OWNER_PASSWORD`
- `READINESS_STAFF_PASSWORD`

## 4) Verificar historial de movimientos de inventario

Con un usuario autenticado (owner/staff) consulta:

`GET /inventory/movements?limit=20`

Filtros opcionales:
- `productId`
- `externalId`
- `type` (`entrada`, `salida`, `ajuste`)

Ejemplo rapido en PowerShell:

```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3001/auth/login" -Body (@{
  tenant_code = "ready-demo"
  username = "owner_ready"
  password = "123456"
} | ConvertTo-Json) -ContentType "application/json"

Invoke-RestMethod -Method Get -Uri "http://localhost:3001/inventory/movements?limit=5" -Headers @{
  Authorization = "Bearer $($login.token)"
}
```
