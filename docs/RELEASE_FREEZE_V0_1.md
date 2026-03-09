# Release Freeze v0.1.0

Fecha de congelacion: 2026-03-09

Objetivo: mantener estable la version para primer cliente y evitar cambios funcionales durante la semana de salida.

## Regla de freeze

- No agregar features nuevas.
- Solo se permiten:
  - correcciones criticas de bug,
  - ajustes de configuracion/deploy,
  - documentacion operativa,
  - parches de seguridad.

## Gate obligatorio antes de tocar produccion

```bash
npm --prefix server run ops:first-client
```

Debe finalizar con `PASS` y `FAIL:0`.

## Version de referencia

- Tag de congelacion: `v0.1.0`
- Rama base: `main`

## Checklist minimo por hotfix

1. Reproducir el problema.
2. Aplicar parche minimo.
3. Ejecutar `ops:first-client`.
4. Crear commit con mensaje claro.
5. Etiquetar hotfix (`v0.1.0-hotfix.X`) si aplica.