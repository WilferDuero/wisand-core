# Prueba Dia Real (primer cliente)

Objetivo: validar operacion completa en negocio real antes de cobro definitivo.

## 1) Antes de abrir (10 min)

1. Backend arriba y saludable (`/health`).
2. Ejecutar comando integral:

```bash
npm --prefix server run ops:first-client
```

3. Confirmar que POS y app movil usan la misma API base.
4. Confirmar tenant correcto en login (`codigo negocio`).

## 2) Flujo operativo minimo (en vivo)

1. Login owner (POS y app movil).
2. Login staff (al menos una vez).
3. Crear producto de prueba.
4. Registrar venta en efectivo.
5. Registrar venta en transferencia (Nequi/Daviplata).
6. Registrar venta mixta (efectivo + transferencia).
7. Crear pedido desde web cliente (si aplica) y confirmar que llega al POS.
8. Aceptar/cerrar pedido y validar que crea venta.
9. Imprimir ticket.
10. Cambiar contrasena del owner desde panel usuarios.

## 3) Cierre de caja (fin del turno)

1. Calcular cierre por rango horario.
2. Guardar cierre en historial.
3. Exportar CSV de cierre.
4. Verificar diferencia de arqueo (esperado vs real).

## 4) Aislamiento multi-tenant

1. Entrar a otro tenant de prueba.
2. Confirmar que no ve productos/ventas/pedidos del cliente real.

## 5) Respaldo final del dia

```bash
npm --prefix server run backup:db
```

Guardar referencia de backup generado (carpeta/archivo y hora).

## 6) Criterio de aprobado

- No hay errores bloqueantes de login/venta/pedido/cierre.
- No hay mezcla de datos entre tenants.
- Backup generado correctamente.
- Cliente confirma flujo basico de trabajo.