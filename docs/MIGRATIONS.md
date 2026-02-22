# Migraciones Multi-Tenant (WISAND)

Este documento cubre la migracion incremental para convertir una base existente de single-tenant a multi-tenant sin ORM, manteniendo compatibilidad SQLite/PostgreSQL.

## Requisitos

- Backend en `server/`
- Variables de entorno listas en `server/.env`
- Node.js instalado

Motor detectado por `server/db.js`:
- SQLite: cuando `DATABASE_URL` no esta definida
- PostgreSQL: cuando `DATABASE_URL` esta definida

## Script de migracion

Ruta: `server/scripts/migrate.js`

Ejecuta:

```bash
cd server
npm run migrate
```

El script:
- Detecta engine (`sqlite` o `postgres`)
- Inicializa/actualiza esquema multi-tenant
- Verifica columnas `tenant_id` en:
  - `users`
  - `products`
  - `orders`
  - `reviews`
  - `sales`
  - `push_tokens`
- Verifica `sales.order_id`
- Confirma tenant por defecto:
  - `id = 1`
  - `name = "Default Tenant"`
- Imprime conteos por tabla para `tenant_id=1`

## Cambios de esquema aplicados

- Tabla `tenants`
  - `id`
  - `name`
  - `created_at`
- Columna `tenant_id` (NOT NULL, default `1`) en:
  - `users`, `products`, `orders`, `reviews`, `sales`, `push_tokens`
- Columna `sales.order_id` nullable
- Columna `push_tokens.userId` (si no existia)
- Backfill de datos existentes a `tenant_id = 1`
- Indices multi-tenant, incluyendo:
  - `UNIQUE (tenant_id, order_id)` para `sales` cuando `order_id IS NOT NULL`

## Flujo recomendado

1. Respaldar base de datos (obligatorio en produccion).
2. Configurar `.env` del backend.
3. Ejecutar migracion:
   - `npm --prefix server run migrate`
4. Levantar API:
   - `npm --prefix server run dev`
5. Validar login y aislamiento tenant.

## Crear tenant + owner (herramienta interna)

Endpoint:
- `POST /internal/tenants`

Proteccion:
- Header `X-Master-Key: <MASTER_KEY>`
- Alternativa: `Authorization: Bearer <MASTER_KEY>`

Body:

```json
{
  "name": "Empresa 2",
  "ownerUsername": "owner2",
  "ownerPassword": "123456",
  "ownerRole": "owner"
}
```

Respuesta esperada:
- `201` con `tenant.id` y `owner.id`

## Validacion manual minima

- Login devuelve JWT con `tenant_id`.
- Tenant 1 solo ve sus datos.
- Tenant 2 arranca vacio.
- Al cerrar pedido en tenant 2, se crea venta en tenant 2.
- No hay mezcla de datos entre tenants.
