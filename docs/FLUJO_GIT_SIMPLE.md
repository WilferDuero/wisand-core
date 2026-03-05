# Flujo Git Simple (App Movil + Backend)

## 1) Estado actual del proyecto
- Repositorio unico: `wisand-core` (monorepo).
- Backend unico (Render): lo consume la app movil admin.
- Front activo:
  - App movil admin: `apps/admin-mobile`

## 2) Flujo recomendado para cada cambio
```powershell
cd "C:\Users\Wilfer Duero\Desktop\WISAND\wisand-core"
git checkout main
git pull origin main
git checkout -b <tipo>/<modulo>-<resumen-corto>
```

## 3) Nombres de ramas (plantilla)
- App movil: `fix/admin-mobile-pedidos-filtro`
- Backend: `feat/backend-notificaciones-push`
- Documentacion: `docs/actualizar-manual-qa`

## 4) Commits profesionales (plantilla)
```powershell
git add .
git commit -m "feat(admin-mobile): mejorar dashboard"
git commit -m "fix(backend): validar telefono en /orders"
git commit -m "docs: actualizar checklist de pruebas"
```

## 5) Subir y abrir PR
```powershell
git push -u origin <tu-rama>
```
Luego en GitHub:
- `Compare & pull request`
- Revisar archivos cambiados
- `Create pull request`
- `Merge pull request`

## 6) Regla para no confundirte
- Si el cambio es visual/UX en celular: tocar solo `apps/admin-mobile`.
- Si el cambio es datos/API/logica (pedidos/stock/ventas): tocar `server` y validar en app movil.

## 7) Comandos rapidos de salud
```powershell
git status
git branch --show-current
git log --oneline -5
```
