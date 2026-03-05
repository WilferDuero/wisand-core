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
5. `owner` puede eliminar productos del catalogo desde la misma tabla.
6. Agregar al carrito.
7. Registrar venta (`POST /sales`).
8. Imprimir ticket A4 o termica.
9. Revisar cierre de caja diario por metodo de pago.
10. Definir rango horario (desde/hasta) para cierre por turno o usar botones rapidos (manana/tarde/noche/todo).
11. Definir caja inicial y efectivo real contado (arqueo).
12. Exportar cierre a CSV.
13. Guardar cierre en historial del tenant y consultar cierres recientes.

## Atajos de teclado

- `F2`: buscar producto
- `F4`: registrar venta
- `F8`: imprimir cierre diario
- `F9`: exportar cierre CSV
- `Esc`: limpiar carrito

## Nota

Este POS web comparte el mismo backend y aislamiento por `tenant_id` de la app movil.