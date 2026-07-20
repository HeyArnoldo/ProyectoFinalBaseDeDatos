# Checklist de demo

## Antes de abrir al publico

- [ ] Tengo autorizacion para acceder al host o a Coolify y a las consolas de MongoDB y Cassandra.
- [ ] No se mostraran credenciales, cookies, variables de entorno, datos reales ni terminales con historial sensible.
- [ ] El pedido de demostracion usara un nombre, telefono y direccion completamente ficticios.
- [ ] Tengo una ventana privada para el operador y las credenciales listas fuera de la pantalla compartida.
- [ ] `https://restaurante.cloud.groowtech.com/health` responde `ok`.
- [ ] `https://restaurante.cloud.groowtech.com/api/health` responde `{"status":"ok"}`.
- [ ] Abrí las pestañas: `/`, `/operador/login`, `/operador/proyeccion` y las dos consolas autorizadas.
- [ ] Preparé este directorio y los valores vacios: `ORDER_ID`, `EVENT_ID` y el dia UTC.

## Recorrido en vivo

- [ ] El profesor crea un pedido con datos ficticios y anota el `orderId` de la confirmacion.
- [ ] MongoDB muestra el pedido sin `guest`, `requestHash` ni `idempotencyKey`.
- [ ] MongoDB muestra el evento `ORDER_CREATED` del outbox y se anota su `eventId`.
- [ ] El operador cambia solo de `PENDING` a `CONFIRMED`.
- [ ] Se espera la proyeccion y se confirma un segundo evento `ORDER_STATUS_CHANGED`.
- [ ] Cassandra muestra ambos eventos en el timeline del pedido.
- [ ] Cassandra muestra los mismos eventos en la actividad del restaurante para el dia UTC.
- [ ] El `eventId` del outbox coincide con `event_id` en las dos consultas Cassandra.

## Capturas y cierre

- [ ] Captura 1: confirmacion con `orderId`, sin datos personales visibles.
- [ ] Captura 2: MongoDB con pedido proyectado y eventos del outbox.
- [ ] Captura 3: tablero del operador con `CONFIRMED`.
- [ ] Captura 4: timeline y actividad diaria en Cassandra o en la pantalla de proyeccion.
- [ ] Si falla la demo, se muestran las capturas y se explica el recorrido; no se reinicia, reprocesa ni modifica infraestructura ante el publico.
