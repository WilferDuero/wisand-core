# WISAND Core

`wisand-core` es la base de producto para WISAND: una plataforma multi-tenant (multiempresa) para operaciones comerciales, con backend API, app movil admin y POS web para PC.

## Componentes

- API (`server/`): Node.js + Express + SQL manual (sin ORM).
- Mobile Admin (`apps/admin-mobile/`): app Expo + TypeScript para owner/staff.
- POS Web PC (`apps/pos-web/`): interfaz de caja/ventas para navegador de escritorio.

## Stack

- Backend: Node.js, Express, JWT, bcryptjs
- DB: SQLite y PostgreSQL compatibles
- Acceso a datos: SQL manual con `db.get/db.all/db.run`
- Mobile: Expo SDK 54, React Native, TypeScript, Zustand
- POS Web: HTML, CSS, JavaScript (sin framework)

## Estructura operativa actual

- Activo: `server/` + `apps/admin-mobile/` + `apps/pos-web/`

## Quickstart local

### 1) Backend

```bash
npm --prefix server install
npm --prefix server run migrate
npm --prefix server run dev
```

### 2) Mobile

```bash
npm --prefix apps/admin-mobile install
npm --prefix apps/admin-mobile run typecheck
npm --prefix apps/admin-mobile run start
```

### 3) POS Web (PC)

```bash
npm --prefix apps/pos-web install
npm --prefix apps/pos-web run start
```

Abre: `http://localhost:3030`

## Acceso owner WISAND

Para crear/actualizar tu acceso interno como dueno de la app (separado de clientes):

```bash
npm --prefix server run owner:create -- --username "tu_usuario" --password "TuClaveSegura"
```

Login en app movil o POS web:
- codigo de empresa: `wisand`
- usuario: el que definiste
- contrasena: la que definiste

## Multi-tenant (resumen)

- Tabla `tenants`.
- Tablas operativas con `tenant_id`:
  - `users`, `products`, `orders`, `reviews`, `sales`, `push_tokens`
- JWT incluye `tenant_id`.
- Cada query de lectura/escritura valida tenant.
- `orders -> sales` conserva `tenant_id` y evita duplicados por `order_id`.
- Login soporta `tenant_code` (slug de empresa) para separar acceso por negocio.

## Migraciones y testing

- Migraciones: `docs/MIGRATIONS.md`
- Testing backend: `server/TESTING.md`
- Test automatizado multi-tenant:

```bash
npm --prefix server run test:multitenant
```

## Autor y licencia

- Autor: Wilfer Duero
- Licencia: ISC

## Operacion Go Live

- Checklist primer cliente: `docs/GO_LIVE_CHECKLIST.md`
