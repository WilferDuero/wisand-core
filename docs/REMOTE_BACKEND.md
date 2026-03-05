# Backend remoto (Render + Neon)

Guia minima para operar WISAND Core con backend remoto para la app movil.

## Stack recomendado (free)

- API: Render Web Service (Free)
- DB Postgres: Neon (Free)

## 1) Crear base de datos en Neon

1. Crea proyecto en Neon.
2. Copia la cadena `DATABASE_URL`.

## 2) Desplegar API en Render

1. En Render crea `New -> Web Service`.
2. Conecta el repo `wisand-core`.
3. Configura:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm run start`
   - Plan: `Free`
4. Variables obligatorias:
   - `NODE_ENV=production`
   - `DATABASE_URL=<url neon>`
   - `JWT_SECRET=<secreto largo>`
   - `MASTER_KEY=<secreto largo>`
5. Variables para owner inicial:
   - `ADMIN_USER=admin`
   - `ADMIN_PASS=<clave segura>`
   - `ADMIN_ROLE=owner`

Tambien puedes crear el servicio desde `render.yaml` en la raiz del repo.

## 3) Verificar API remota

Prueba:

- `https://tu-api.onrender.com/health`

Debe responder `ok: true`.

## 4) Crear tenant real

Con el backend ya desplegado:

```bash
npm --prefix server run tenant:create -- --api "https://tu-api.onrender.com" --name "Negocio Demo" --code "negocio-demo" --owner "owner_demo" --password "ClaveSegura123"
```

## 5) Apuntar app movil al backend remoto

En `apps/admin-mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://tu-api.onrender.com
```

Luego inicia sesion en la app con:
- codigo de negocio
- usuario
- contrasena

## 6) Limites free a tener en cuenta

- Render Free: sleep por inactividad (cold start)
- Neon Free: limites de almacenamiento/compute del plan

## 7) Referencias oficiales

- Render Free: `https://render.com/docs/free`
- Neon pricing: `https://neon.com/pricing`
