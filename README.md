# WISAND Core

`wisand-core` es la base de producto para WISAND: una plataforma multi-tenant (multiempresa) para operaciones comerciales, con backend API, panel web y app movil admin.

## Componentes

- API (`server/`): Node.js + Express + SQL manual (sin ORM).
- Web Admin + Store (raiz + `js/`): interfaz web existente.
- Mobile Admin (`apps/admin-mobile/`): app Expo + TypeScript para owner/staff.

## Stack

- Backend: Node.js, Express, JWT, bcryptjs
- DB: SQLite y PostgreSQL compatibles
- Acceso a datos: SQL manual con `db.get/db.all/db.run`
- Mobile: Expo SDK 54, React Native, TypeScript, Zustand

## Quickstart local

### 1) Backend

```bash
npm --prefix server install
npm --prefix server run migrate
npm --prefix server run dev
```

### 2) Web

Abre `index.html` o `admin_login.html` en tu flujo local habitual.

### 3) Mobile

```bash
npm --prefix apps/admin-mobile install
npm --prefix apps/admin-mobile run typecheck
npm --prefix apps/admin-mobile run start
```

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

## Nota de contexto

Este repositorio es el **core de producto WISAND**. Implementaciones anteriores de una drogueria son solo referencia/demo de tenant y no definen el branding final del core.

## Autor y licencia

- Autor: Wilfer Duero
- Licencia: ISC
