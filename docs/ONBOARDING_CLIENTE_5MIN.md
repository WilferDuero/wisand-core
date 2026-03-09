# Onboarding Cliente en 5 Minutos

Flujo recomendado para dar de alta un negocio nuevo sin tocar codigo.

## 1) Prerrequisitos

- API arriba (`npm --prefix server run dev`)
- `MASTER_KEY` configurada en `server/.env`

## 2) Alta completa (tenant + owner + staff)

```powershell
npm --prefix server run onboard:client -- --name "Ferreteria Central" --code "ferreteria-central" --owner-user "owner_ferre" --owner-pass "ClaveSegura123" --staff-user "staff_ferre" --staff-pass "ClaveSegura123"
```

## 3) Alta con branding personalizado

```powershell
npm --prefix server run onboard:client -- --name "Drogueria Renacer" --code "drogueria-renacer" --owner-user "owner_renacer" --owner-pass "ClaveSegura123" --staff-user "staff_renacer" --staff-pass "ClaveSegura123" --display-name "Drogueria Renacer" --primary-color "#0B63D0" --secondary-color "#0F172A" --accent-color "#FF7A18"
```

## 4) Alta contra API remota

```powershell
npm --prefix server run onboard:client -- --api "https://tu-api.com" --name "Mini Market Norte" --code "mini-market-norte" --owner-user "owner_mini" --owner-pass "ClaveSegura123" --staff-user "staff_mini" --staff-pass "ClaveSegura123"
```

## 5) Checklist operativo (post alta)

1. Login owner con `codigo + usuario + clave`.
2. Login staff y validar permisos (debe vender, no administrar productos).
3. Cargar catalogo base y registrar una venta de prueba.
4. Ejecutar backup:

```powershell
npm --prefix server run backup:db
```

5. Validar salud final:

```powershell
npm --prefix server run ops:first-client
```

O en modo manual:

```powershell
npm --prefix server run check:golive
npm --prefix server run test:multitenant
npm --prefix server run test:readiness
```

## 6) Notas utiles

- Si el tenant ya existe, el script no rompe: intenta login con owner y continua.
- Si `staff-user` ya existe en ese tenant, lo reporta como `existing`.
- Si no quieres tocar branding en el alta, agrega `--skip-branding`.
- Formato de colores valido: `#RRGGBB`.
