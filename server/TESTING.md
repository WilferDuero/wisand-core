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
- Crea tenant (si no existe) con `/internal/tenants`
- Login de tenant 2 (`owner2`/`123456`)
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
- `TEST_TENANT2_OWNER`
- `TEST_TENANT2_PASSWORD`
- `TEST_TENANT1_ID`
- `TEST_TENANT1_USERNAME`
- `TEST_TENANT1_PASSWORD`

## Resultado esperado

- Salida con lineas `[PASS]` en cada paso.
- Exit code `0` en exito.
- Exit code `1` si falla algun control.
