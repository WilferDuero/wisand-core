# Entrega Primer Cliente (Owner + Staff)

Documento corto para operar WISAND en negocio real desde el primer dia.

## 1) Datos de acceso (completar antes de entregar)

- Codigo negocio: `__________`
- Usuario owner: `__________`
- Clave owner: `__________`
- Usuario staff 1: `__________`
- Clave staff 1: `__________`
- URL POS Web (PC): `http://localhost:3030`
- API base: `http://localhost:3001`

## 2) Manual rapido (dueno)

1. Inicia sesion con codigo + usuario + clave.
2. Carga catalogo desde CSV (`Importar CSV`) o crea productos manualmente.
3. Ajusta stock con boton `Ajuste stock` cuando entre/salga mercancia.
4. Revisa panel owner: sin rotacion, top vendidos, stock critico, movimientos inventario.
5. Al final del turno usa `Cierre de caja` y guarda cierre.

## 3) Manual rapido (staff)

1. Inicia sesion con codigo + usuario + clave.
2. Busca o escanea productos.
3. Registra venta y entrega ticket.
4. Ejecuta cierre de caja al final del turno.

Nota: staff puede vender, pero no puede crear/editar/eliminar productos.

## 4) Checklist diario operativo

Apertura:
- Validar login owner/staff.
- Confirmar API activa.
- Verificar que scanner escribe codigo + Enter.

Durante el dia:
- Registrar ventas solo por flujo normal de carrito.
- Ajustar stock con motivo si hay diferencias.

Cierre:
- Guardar cierre de caja.
- Exportar CSV de cierre (opcional).
- Ejecutar backup diario.

## 5) Backup diario (obligatorio)

Desde raiz del repo:

```bash
npm --prefix server run backup:db
```

Salida esperada:
- SQLite: carpeta `server/backups/sqlite-YYYYMMDD-HHMMSS/`
- Postgres: archivo `server/backups/postgres-YYYYMMDD-HHMMSS.dump`

## 6) Restore rapido (emergencia)

SQLite:
1. Detener API.
2. Copiar `app.db` del backup sobre `server/data/app.db`.
3. Levantar API.

Postgres:
1. Restaurar dump con `pg_restore`.
2. Validar login y ventas recientes.

## 7) Soporte y control tecnico

Comandos recomendados:

```bash
npm --prefix server run ops:first-client
```

Tambien puedes ejecutar individualmente:

```bash
npm --prefix server run check:golive
npm --prefix server run test:readiness
```

Si pasan, la operacion queda en estado saludable.
