# WISAND POS Web (PC)

Interfaz de escritorio para caja/ventas conectada al backend multi-tenant de WISAND.

## Ejecutar

```bash
npm install
npm start
```

Abrir en navegador: `http://localhost:3030`

## Login

- API Base URL: `http://localhost:3001`
- Codigo negocio: `tenant code` del cliente
- Usuario / contrasena: credenciales owner o staff del tenant

## Flujo actual

1. Cargar branding por codigo de negocio.
2. Iniciar sesion multi-tenant.
3. Buscar o escanear productos.
4. Si el codigo escaneado no existe, `owner` puede abrir modal de alta rapida y crearlo al vuelo.
5. `owner` puede crear producto manual, editar, ajustar stock rapido y eliminar desde la tabla del catalogo.
6. Seleccionar presentacion por producto (unidad/sobre/caja) y agregar al carrito.
7. Registrar venta (`POST /sales`).
8. Imprimir ticket A4 o termica.
9. Revisar cierre de caja diario por metodo de pago.
10. Definir rango horario (desde/hasta) para cierre por turno o usar botones rapidos (manana/tarde/noche/todo).
11. Definir caja inicial y efectivo real contado (arqueo).
12. Exportar cierre a CSV.
13. Guardar cierre en historial del tenant y consultar cierres recientes.
14. Ver panel de indicadores owner: sin rotacion, top vendidos, stock critico y movimientos de inventario.

## Importacion CSV (solo owner)

Desde el boton `Importar CSV` puedes cargar productos masivo.

Encabezados recomendados:

`codigo,nombre,categoria,precio_caja,precio_sobre,precio_unidad,sobres_x_caja,unidades_x_sobre,stock_cajas`

Plantilla lista para usar:

`apps/pos-web/examples/catalogo_template.csv`

## Scanner (Barcode to PC)

1. En PC habilita `Keyboard Emulation`.
2. En plantilla de salida usa: `BARCODE` + `ENTER`.
3. En POS, enfoca `Escanear codigo de barras y Enter`.
4. Si el codigo no existe, owner puede crearlo rapido con ese mismo codigo.

## Atajos de teclado

- `F2`: buscar producto
- `F4`: registrar venta
- `F6`: nuevo producto rapido (solo owner)
- `F8`: imprimir cierre diario
- `F9`: exportar cierre CSV
- `Esc`: limpiar carrito

## Nota

Este POS web comparte el mismo backend y aislamiento por `tenant_id` de la app movil.
