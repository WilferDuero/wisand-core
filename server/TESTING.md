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

## Variables utiles para el script

Por defecto toma:
- `MASTER_KEY` desde `server/.env`
- API base `http://localhost:3001`
- tenant 2 id `2`

Opcionales:
- `TEST_API_BASE`
- `TEST_TENANT2_ID`
- `TEST_TENANT2_NAME`
- `TEST_TENANT2_CODE`
- `TEST_TENANT2_OWNER`
- `TEST_TENANT2_PASSWORD`
- `TEST_TENANT1_ID`
- `TEST_TENANT1_CODE`
- `TEST_TENANT1_USERNAME`
- `TEST_TENANT1_PASSWORD`

## Resultado esperado

- Salida con lineas `[PASS]` en cada paso.
- Exit code `0` en exito.
- Exit code `1` si falla algun control.


## 3) Verificar historial de movimientos de inventario

Con un usuario autenticado (owner/staff) consulta:

`GET /inventory/movements?limit=20`

Filtros opcionales:
- `productId`
- `externalId`
- `type` (`entrada`, `salida`, `ajuste`)

Ejemplo rapido en PowerShell:

```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3001/auth/login" -Body (@{
  tenantCode = "negocio-dos"
  username = "owner2"
  password = "123456"
} | ConvertTo-Json) -ContentType "application/json"

Invoke-RestMethod -Method Get -Uri "http://localhost:3001/inventory/movements?limit=5" -Headers @{
  Authorization = "Bearer $($login.token)"
}
```
