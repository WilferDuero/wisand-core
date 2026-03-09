# Comandos del Proyecto (WISAND Core)

Guia rapida para backend, base de datos, app movil, POS web y git.

## 1) PowerShell (Windows)

Ver version de `psql`:

```powershell
psql --version
```

Generar hash bcrypt:

```powershell
cd "C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\server"
node -e "const b=require('bcryptjs'); b.hash('TU_CLAVE',10).then(h=>console.log(h))"
```

Instalar dependencias backend:

```powershell
cd "C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\server"
npm install
```

## 2) PostgreSQL (`psql`)

Conectarse (reemplaza placeholders):

```powershell
$env:PGPASSWORD="<TU_PASSWORD>"
psql -h <TU_HOST> -U <TU_USUARIO> <TU_DB>
```

Ver usuarios:

```sql
SELECT id, tenant_id, username, role, createdAt FROM users ORDER BY id;
```

Actualizar clave de usuario:

```sql
UPDATE users
SET passwordhash = 'HASH_GENERADO'
WHERE tenant_id = 1 AND username = 'admin';
```

Salir de `psql`:

```sql
\q
```

## 3) Git

Estado:

```powershell
git status -sb
```

Agregar cambios:

```powershell
git add <archivo_o_carpeta>
```

Commit:

```powershell
git commit -m "Mensaje claro"
```

Push:

```powershell
git push
```

## 4) Backend local

Levantar API:

```powershell
cd "C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\server"
npm run dev
```

Ejecutar migracion:

```powershell
cd "C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\server"
npm run migrate
```

Ejecutar prueba automatica multi-tenant:

```powershell
cd "C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\server"
npm run test:multitenant
```

## 5) App movil (Expo)

```powershell
cd "C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\apps\admin-mobile"
npm install
npm run typecheck
npm run start:usb
```

## 6) POS Web para PC

```powershell
cd "C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\apps\pos-web"
npm install
npm start
```

Abrir en navegador:

```text
http://localhost:3030
```

Login POS:
- API Base URL: `http://localhost:3001`
- Codigo negocio: ejemplo `drogueria-renacer`
- Usuario: owner/staff del tenant
- Contrasena: la del usuario

## 7) Navegador (F12)

Forzar API remota:

```js
localStorage.setItem("API_BASE", "https://wisand.onrender.com");
localStorage.setItem("API_ENABLED", "true");
location.reload();
```

Ver configuracion:

```js
console.log({
  apiBase: localStorage.getItem("API_BASE"),
  apiEnabled: localStorage.getItem("API_ENABLED"),
});
```

## 8) Advertencias

- No subas secretos reales (`.env`, keys privadas).
- Usa `TRUNCATE` solo si entiendes el impacto.
- Mantener aislamiento por `tenant_id` en toda query nueva.

## 9) Go Live y Alta de Clientes

Chequeo pre-produccion:

```powershell
npm --prefix server run check:golive
```

Chequeo integral recomendado (go-live + multi-tenant + readiness + backup):

```powershell
npm --prefix server run ops:first-client
```

Crear un negocio nuevo en 1 comando:

```powershell
npm --prefix server run tenant:create -- --name "Cliente X" --code "cliente-x" --owner "owner_x" --password "ClaveSegura123"
```

Crear negocio contra API remota:

```powershell
npm --prefix server run tenant:create -- --api "https://tu-api.com" --name "Cliente X" --code "cliente-x" --owner "owner_x" --password "ClaveSegura123"
```

Alta completa con owner + staff + branding opcional (recomendado):

```powershell
npm --prefix server run onboard:client -- --name "Cliente X" --code "cliente-x" --owner-user "owner_x" --owner-pass "ClaveSegura123" --staff-user "staff_x" --staff-pass "ClaveSegura123"
```

Guia corta:
- `docs/ONBOARDING_CLIENTE_5MIN.md`
