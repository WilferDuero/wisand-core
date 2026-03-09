# Backend remoto estable (URL unica)

Objetivo: que API, POS Web, app movil y web cliente apunten a la misma URL de backend para evitar desalineaciones.

## Opcion A (recomendada): Render + Neon Postgres

### 1) Base de datos (Neon)

1. Crear proyecto en Neon.
2. Copiar `DATABASE_URL` (incluye SSL).

### 2) API en Render

1. Crear `Web Service`.
2. Conectar repo `wisand-core`.
3. Configuracion:
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm run start`
- Plan: el que definas (`free` o pago)

4. Variables obligatorias:
- `NODE_ENV=production`
- `DATABASE_URL=<postgres_url_neon>`
- `JWT_SECRET=<secreto_largo_32+>`
- `MASTER_KEY=<secreto_largo_24+>`

5. Owner inicial (opcional por bootstrap):
- `ADMIN_USER=admin`
- `ADMIN_PASS=<clave_segura>`
- `ADMIN_ROLE=owner`

6. Endpoint de validacion:
- `https://<tu-api>.onrender.com/health`

## Opcion B: Railway + Postgres gestionado

1. Crear proyecto en Railway.
2. Crear servicio Postgres y copiar `DATABASE_URL`.
3. Crear servicio Node para `server/`.
4. Configurar variables:
- `NODE_ENV=production`
- `DATABASE_URL=<postgres_url_railway>`
- `JWT_SECRET=<secreto_largo_32+>`
- `MASTER_KEY=<secreto_largo_24+>`

5. Validar:
- `https://<tu-api-railway>.up.railway.app/health`

## URL unica (obligatorio)

Define una sola URL de backend, por ejemplo:

`https://api-wisand.tudominio.com`

Y usala en todos los clientes:

1. POS Web (`apps/pos-web/.env`)
```env
POS_API_BASE_URL=https://api-wisand.tudominio.com
```

2. App movil (`apps/admin-mobile/.env`)
```env
EXPO_PUBLIC_API_BASE_URL=https://api-wisand.tudominio.com
```

3. Web cliente/tienda (si aplica)
- Configurar su variable/API base equivalente al mismo host.

## Validacion tecnica post deploy

Desde raiz del repo (contra backend remoto):

```bash
npm --prefix server run check:golive
npm --prefix server run test:multitenant
npm --prefix server run test:readiness
```

O comando unico:

```bash
npm --prefix server run ops:first-client
```

## Crear negocio real en produccion

```bash
npm --prefix server run onboard:client -- --api "https://api-wisand.tudominio.com" --name "Negocio Demo" --code "negocio-demo" --owner-user "owner_demo" --owner-pass "ClaveSegura123" --staff-user "staff_demo" --staff-pass "ClaveSegura123"
```
