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
4. Agregar al carrito.
5. Registrar venta (`POST /sales`).
6. Imprimir ticket A4 o termica.
7. Revisar cierre de caja diario por metodo de pago.
8. Definir rango horario (desde/hasta) para cierre por turno o usar botones rapidos (manana/tarde/noche/todo).
9. Definir caja inicial y efectivo real contado (arqueo).
10. Exportar cierre a CSV.

## Atajos de teclado

- `F2`: buscar producto
- `F4`: registrar venta
- `F8`: imprimir cierre diario
- `F9`: exportar cierre CSV
- `Esc`: limpiar carrito

## Nota

Este POS web comparte el mismo backend y aislamiento por `tenant_id` de la app movil.

