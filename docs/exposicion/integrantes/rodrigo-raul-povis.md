# Rodrigo Raul Povis Zavala

**Curso:** Base de Datos 2  
**Rol:** Consultas MongoDB, índices y `explain`.  
**Objetivo:** Verificar cómo los índices y las consultas usadas por la aplicación apoyan la operación, sin afirmar que los implementé ni inventar métricas.

## Guion hablado (60-90 segundos)

> MongoDB es la base operacional del proyecto y sus índices se declaran al iniciar la aplicación. En `catalog_items` existe un índice único por restaurante y SKU. En `orders` existe un índice único por `idempotencyKey`, que respalda la prevención de duplicados, y un índice compuesto por restaurante, fecha de creación descendente e identificador. La salida tiene un índice único por `eventId` y dos índices compuestos para reclamar eventos pendientes o recuperar reclamos vencidos. Las consultas deben leerse junto con su intención: la API busca pedidos por clave de idempotencia y el trabajador ordena eventos por fecha e identificador para procesarlos. Durante la exposición no voy a prometer tiempos de respuesta. Lo verificable es ejecutar `getIndexes()` y usar `explain('executionStats')` sobre una consulta representativa para observar el plan elegido en los datos locales actuales. Si el plan muestra un índice, eso demuestra el plan de esa ejecución local, no una prueba general de rendimiento. Mi aporte es preparar, ejecutar y estudiar estas verificaciones.

## ¿Qué hiciste tú?

Cuando complete las validaciones, puedo afirmar: me encargué de estudiar los índices definidos, preparé las consultas de verificación, ejecuté `explain` con datos locales y documenté lo observado.

## Antes de poder decirlo

- [ ] Levantar la pila con `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml -f infra/compose.local.yaml up -d --build --wait`.
- [ ] Crear al menos un pedido de prueba desde la interfaz para que exista una consulta representativa.
- [ ] Ejecutar `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml exec mongodb mongosh --quiet 'mongodb://127.0.0.1:27017/restaurant?replicaSet=rs0' --eval "db.orders.getIndexes(); db.outbox.getIndexes()"`.
- [ ] Ejecutar `db.orders.find({ restaurantId: '11111111-1111-4111-8111-111111111111' }).sort({ createdAt: -1, _id: -1 }).limit(10).explain('executionStats')` en `mongosh` y leer el campo `winningPlan` sin anunciar cifras como resultados generales.
- [ ] Ejecutar `db.outbox.find({ status: 'PENDING', cleanupProtected: { $ne: true } }).sort({ occurredAt: 1, _id: 1 }).explain('executionStats')` y comparar el filtro con el índice declarado.
- [ ] Guardar una captura o transcripción de las salidas, sin datos de clientes ni secretos.

## Evidencia verificable

- `apps/api/src/database/bootstrap.service.ts:67-75` declara los índices con sus nombres y campos.
- `apps/api/src/orders/checkout.service.ts:70-88, 129-134` consulta `idempotencyKey` antes y después de un posible duplicado.
- `apps/api/src/projections/projection.worker.ts:171-196` muestra el filtro y orden de reclamo de `outbox`.
- Consulta: `db.orders.getIndexes()` y `db.outbox.getIndexes()` confirma los índices creados en la instancia levantada.

## Concepto central

**Índice alineado con consulta:** un índice sirve cuando sus campos y orden responden al filtro y ordenamiento que realmente ejecuta la aplicación; `explain` permite inspeccionar el plan local.

## Pregunta principal del profesor

**¿Para qué sirve `explain` en MongoDB?**  
Permite inspeccionar el plan que MongoDB eligió para una consulta concreta, por ejemplo si usa un índice o examina documentos; no reemplaza una prueba de rendimiento.

## Repreguntas

**¿Qué protege el índice único de `idempotencyKey`?**  
Evita dos pedidos con la misma clave incluso si hay una condición de carrera.

**¿Por qué `orders` usa un índice compuesto con fecha descendente?**  
Respalda consultas por restaurante ordenadas desde los pedidos más recientes.

**¿Para qué hay índices de salida pendientes y vencidas?**  
Apoyan la selección ordenada de eventos nuevos y la recuperación de reclamos cuyo plazo expiró.

**¿Si `explain` usa un índice ya está probado que escala?**  
No. Solo describe el plan y las estadísticas de esa ejecución con esos datos locales.

## Acción de demo

Mostrar primero `db.orders.getIndexes()`; luego ejecutar una sola consulta `explain('executionStats')` previamente ensayada y señalar el plan, sin hacer comparaciones de tiempo ni volumen.

## Errores que no debe decir

- No decir que diseñé, programé o optimicé los índices.
- No presentar el uso de un índice como prueba de rendimiento o escalabilidad.
- No afirmar que todos los filtros de `outbox` están cubiertos de forma idéntica por un único índice.
- No ejecutar consultas destructivas ni mostrar documentos con datos de clientes.

## Checklist de ensayo

- [ ] Puedo distinguir índice único de índice compuesto.
- [ ] Ejecuté `getIndexes()` en la pila local levantada.
- [ ] Ejecuté y entendí un `explain('executionStats')` real.
- [ ] No menciono números de rendimiento que no medí.
- [ ] Mi guion dura entre 60 y 90 segundos.
