# GO LIVE Checklist (Primer Cliente)

Checklist operativo para salir a produccion con `wisand-core` y dar de alta clientes sin tocar codigo.

## 1) Seguridad minima (obligatorio)

En `server/.env` de produccion:

- `NODE_ENV=production`
- `JWT_SECRET=<secret-largo-32+>`
- `MASTER_KEY=<secret-largo-24+>`
- `DATABASE_URL=<postgres-url>` (recomendado en produccion)

Generar secretos en PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 2) Migracion y validacion tecnica

Desde raiz del repo:

```bash
npm --prefix server run migrate
npm --prefix server run check:golive
npm --prefix server run test:multitenant
```

Criterio de salida:
- `check:golive` sin `FAIL`
- `test:multitenant` con salida `[PASS]`

## 3) Backup y restore

Comando recomendado (SQLite y Postgres):

```bash
npm --prefix server run backup:db
```

### SQLite (si usas sqlite)

El script crea carpeta:

`server/backups/sqlite-YYYYMMDD-HHMMSS/`

Con archivos:
- `app.db`
- `app.db-wal` (si existe)
- `app.db-shm` (si existe)
- `backup-meta.json`

Restore rapido:

```powershell
Copy-Item "server/backups/sqlite-YYYYMMDD-HHMMSS/app.db" "server/data/app.db" -Force
```

### PostgreSQL (produccion recomendado)

El script crea dump:

`server/backups/postgres-YYYYMMDD-HHMMSS.dump`

Si `pg_dump` no esta en PATH, define `PG_DUMP_BIN` con ruta completa.

## 4) Alta de un cliente nuevo (sin tocar codigo)

Con backend arriba y `MASTER_KEY` configurada:

```bash
npm --prefix server run tenant:create -- --name "Ferreteria Central" --code "ferreteria-central" --owner "owner_fc" --password "ClaveSegura123"
```

El script usa por defecto `http://localhost:3001`.
Para API remota:

```bash
npm --prefix server run tenant:create -- --api "https://tu-api.com" --name "Ferreteria Central" --code "ferreteria-central" --owner "owner_fc" --password "ClaveSegura123"
```

## 5) Branding opcional por cliente

Si cliente quiere identidad visual propia:

1. Login owner en la app universal con su `code`.
2. Actualizar branding del tenant (`display_name`, `logo_url`, colores) via endpoint `/branding`.

Si no quiere branding propio, queda fallback WISAND automaticamente.

## 6) Smoke test final (antes de cobrar)

- Login con tenant real (`code + username + password`).
- Crear producto.
- Crear pedido y cerrar a venta.
- Verificar que otro tenant NO vea esos datos.
- Verificar notificaciones/push (si aplica).

## 7) Publicacion movil

Para clientes con app universal:
- no recompilas por cada cliente (solo alta tenant + branding).

Para white-label real (icono/splash/nombre nativo distinto):
- crear build EAS separado por perfil.

---

## Resumen rapido de comando diario

```bash
npm --prefix server run dev
npm --prefix server run check:golive
npm --prefix server run tenant:create -- --name "Cliente X" --code "cliente-x" --owner "owner_x" --password "ClaveSegura123"
```
