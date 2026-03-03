# Comandos del Proyecto (WISAND Core)

Guia rapida para backend, base de datos, git y pruebas.

## 1) PowerShell (Windows)

Ver version de `psql`:

```powershell
psql --version
```

Generar hash bcrypt:

```powershell
cd C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\server
node -e "const b=require('bcryptjs'); b.hash('TU_CLAVE',10).then(h=>console.log(h))"
```

Instalar dependencias backend:

```powershell
cd C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\server
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
cd C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\server
npm run dev
```

Ejecutar migracion:

```powershell
cd C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\server
npm run migrate
```

Ejecutar prueba automatica multi-tenant:

```powershell
cd C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core\server
npm run test:multitenant
```

## 5) Navegador (F12)

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

## 6) Advertencias

- No subas secretos reales (`.env`, keys privadas).
- Usa `TRUNCATE` solo si entiendes el impacto.
- Mantener aislamiento por `tenant_id` en toda query nueva.
