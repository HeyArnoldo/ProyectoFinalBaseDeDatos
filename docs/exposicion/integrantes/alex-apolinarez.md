# Alex Esteefano Apolinarez Salvatierra

**Curso:** Base de Datos 2  
**Rol:** Integración MongoDB, colecciones y transacción durante la demostración.  
**Objetivo:** Operar el recorrido y explicar cómo se comprueba que un pedido se persiste junto con su evento de salida, sin atribuirme programación.

## Guion hablado (60-90 segundos)

> En esta parte voy a operar el recorrido que integra la aplicación con MongoDB. Primero, desde el catálogo elegimos productos activos y enviamos cantidades; el cliente no decide el total final. La API consulta el catálogo, toma una instantánea de cada producto, calcula los subtotales y el total, y crea el pedido con estado `PENDING`. En la misma transacción también inserta un documento en la colección `outbox`. MongoDB tiene tres colecciones principales: `catalog_items`, `orders` y `outbox`. Sus validadores exigen los campos esperados y sus índices incluyen una clave única de idempotencia para no crear otro pedido si se repite la misma solicitud equivalente. Para verificarlo no basta con mirar la pantalla: como operador revisaré el pedido creado y, con la consulta preparada, veremos que existen el pedido y su evento. Después el trabajador podrá proyectarlo a Cassandra. Mi responsabilidad es ejecutar y validar este flujo con evidencia real.

## ¿Qué hiciste tú?

Tras cumplir esta ficha, puedo decir: me encargué de preparar y ejecutar la demostración, estudié la relación entre `catalog_items`, `orders` y `outbox`, y validé el pedido y el evento resultante.

## Antes de poder decirlo

- [ ] Levantar el entorno con `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml -f infra/compose.local.yaml up -d --build --wait`.
- [ ] Abrir `http://127.0.0.1:18080`, verificar productos activos y crear un pedido de prueba con una clave de idempotencia nueva.
- [ ] Guardar el identificador del pedido mostrado por la aplicación sin exponer datos personales en la proyección.
- [ ] Como operador, comprobar el pedido y avanzar solo una transición válida para generar un segundo evento.
- [ ] Ejecutar `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml exec mongodb mongosh --quiet 'mongodb://127.0.0.1:27017/restaurant?replicaSet=rs0' --eval "db.orders.countDocuments(); db.outbox.countDocuments()"` y registrar que ambas colecciones tienen documentos.
- [ ] Revisar `apps/api/src/orders/checkout.service.ts` antes de ensayar para poder explicar que el total se calcula en el servidor.

## Evidencia verificable

- `apps/api/src/database/bootstrap.service.ts:9-75` define validadores e índices de `catalog_items`, `orders` y `outbox`.
- `apps/api/src/orders/checkout.service.ts:70-126` consulta catálogo activo, calcula el total e inserta pedido y salida dentro de una transacción.
- `apps/api/src/orders/transition.service.ts:32-70` agrega historial y un nuevo evento de salida en otra transacción.
- Consulta de verificación: `db.orders.findOne({}, { _id: 1, status: 1, totalCents: 1 })` y `db.outbox.findOne({}, { orderId: 1, status: 1, type: 1 })` en `mongosh`.

## Concepto central

**Transacción operación-salida:** el pedido y el evento `outbox` se confirman juntos en MongoDB; no hay pedido confirmado sin el evento que permite su proyección.

## Pregunta principal del profesor

**¿Cómo evitan que el cliente altere el precio de un pedido?**  
La API recibe artículos y cantidades, vuelve a consultar productos activos y calcula en el servidor los precios, subtotales y total que guarda como instantánea.

## Repreguntas

**¿Qué colecciones son relevantes para crear un pedido?**  
`catalog_items` aporta el precio vigente; `orders` conserva el pedido; `outbox` conserva el evento de proyección.

**¿Qué garantiza la transacción?**  
Que el pedido y su evento se confirman juntos o no se confirma ninguno.

**¿Cómo tratan un reintento con la misma clave?**  
Buscan la clave de idempotencia; si la solicitud coincide, devuelven el pedido existente.

**¿Qué ocurre si la misma clave trae otra solicitud?**  
La API devuelve conflicto, porque la huella de la solicitud no coincide.

## Acción de demo

Crear un pedido desde el catálogo, anotar su identificador, ingresar como operador y mostrar el pedido o su transición. Luego ejecutar la consulta de conteo preparada en MongoDB solo si ya fue probada antes de la exposición.

## Errores que no debe decir

- No decir que implementé las colecciones, los validadores, los índices o la transacción.
- No decir que el total enviado por el navegador se acepta como verdadero.
- No decir que `outbox` es Cassandra ni que Cassandra participa en la transacción MongoDB.
- No afirmar que la transacción elimina todos los fallos posibles fuera de MongoDB.

## Checklist de ensayo

- [ ] Creé un pedido de prueba con una clave de idempotencia nueva.
- [ ] Sé localizar su identificador y no mostrar información personal.
- [ ] Puedo describir las tres colecciones en una frase cada una.
- [ ] Puedo responder qué ocurre con un reintento equivalente.
- [ ] Mi guion dura entre 60 y 90 segundos.
