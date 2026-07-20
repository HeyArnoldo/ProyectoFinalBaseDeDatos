# Adriano Joao Souza Reyna

**Curso:** Base de Datos 2  
**Rol:** Integración Cassandra, `outbox` y trabajador.  
**Objetivo:** Explicar la implementación de punta a punta de la arquitectura y programación del proyecto, en especial la proyección desde MongoDB hacia Cassandra.

## Guion hablado (60-90 segundos)

> Implementé la arquitectura y la programación completa de la plataforma. Para integrar Cassandra sin convertirla en una segunda base operacional, implementé el patrón `outbox` dentro de MongoDB. Al crear un pedido o cambiar su estado, la API guarda el cambio y un evento de salida en la misma transacción. El trabajador embebido se ejecuta al iniciar la API y revisa eventos pendientes cada dos segundos. Reclama un evento con un identificador de préstamo y un vencimiento de treinta segundos; luego escribe dos filas Cassandra: la línea temporal por pedido y la actividad por restaurante y día. Las escrituras usan claves estables e idempotencia. Solo después de las dos escrituras, el evento pasa a `PROCESSED`. Si ocurre un error, se libera para reintento con una demora calculada; si un trabajador se interrumpe, un préstamo vencido puede volver a reclamarse. También implementé la operación de repetición de proyecciones, que restablece los eventos a pendientes para reconstruir las vistas. Así MongoDB mantiene la verdad operacional y Cassandra se limita a consultas derivadas. No afirmamos rendimiento probado ni alta disponibilidad: el entorno Cassandra usa un nodo y factor de replicación uno.

## ¿Qué hiciste tú?

Implementé la arquitectura y la programación completa del proyecto, incluida la integración de MongoDB, Cassandra, el registro `outbox`, el trabajador de proyección, las consultas, la API, la interfaz, la infraestructura Docker y las pruebas. Antes de afirmarlo en la exposición, debo ejecutar y validar el recorrido de esta ficha para respaldarlo con evidencia actual.

## Antes de poder decirlo

- [ ] Ejecutar `pnpm typecheck` y `pnpm test` desde la raíz; registrar si ambos finalizan correctamente.
- [ ] Levantar el entorno con `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml -f infra/compose.local.yaml up -d --build --wait`.
- [ ] Ejecutar `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml -f infra/compose.local.yaml ps` y confirmar los cuatro servicios saludables.
- [ ] Crear un pedido y una transición válida; como operador, esperar a que el estado de proyección indique `IDLE`.
- [ ] Verificar la línea temporal del pedido y la actividad del restaurante desde la interfaz de operador o los endpoints protegidos.
- [ ] Revisar la repetición de proyección en el código y las pruebas; no ejecutarla durante la exposición ni contra producción.
- [ ] Ensayar la recuperación explicando una falla hipotética sin afirmar pruebas que no se hayan ejecutado.

## Evidencia verificable

- `apps/api/src/orders/checkout.service.ts:70-126` y `apps/api/src/orders/transition.service.ts:32-71` implementan transacciones de operación y salida.
- `apps/api/src/projections/projection.worker.ts:21-28, 62-67, 157-250` implementa sondeo, préstamo, escrituras Cassandra, marcado y reintento.
- `apps/api/src/projections/projection.worker.ts:112-136` implementa la repetición de eventos de salida.
- `apps/api/src/projections/cql.bootstrap.ts:5-34` crea el espacio y las dos tablas Cassandra.
- `infra/compose.yaml:26-100` configura API, MongoDB y Cassandra para el entorno reproducible.

## Concepto central

**Proyección recuperable:** una transacción MongoDB deja una operación y un evento duradero; el trabajador puede reintentar ese evento hasta que las vistas Cassandra reflejen la información derivada.

## Pregunta principal del profesor

**¿Cómo evitas perder un cambio si Cassandra falla después de confirmar un pedido?**  
Confirmo el pedido y su evento de salida juntos en MongoDB. Si Cassandra falla, el evento queda pendiente o se libera para reintento; la operación no depende de que Cassandra responda en ese instante.

## Repreguntas

**¿Cuándo queda procesado un evento?**  
Después de escribir las dos proyecciones Cassandra y actualizar su estado a `PROCESSED` en MongoDB.

**¿Cómo evita el trabajador procesar permanentemente un evento bloqueado?**  
Usa un préstamo con vencimiento; un evento en proceso cuyo plazo expiró puede reclamarse de nuevo.

**¿Por qué las escrituras Cassandra son idempotentes?**  
Repiten claves estables para la misma fila lógica, de modo que un reintento no agrega otro evento lógico.

**¿Qué hace la repetición de proyecciones?**  
Restablece los eventos de salida a pendientes para que el trabajador vuelva a construir las vistas. No es necesaria para la demo y no debe ejecutarse contra producción.

## Acción de demo

Crear o transicionar un pedido, abrir el estado de proyección como operador, esperar `IDLE` y mostrar la línea temporal. La demostración no ejecuta la repetición de proyecciones.

## Errores que no debe decir

- No decir que Cassandra participa en la misma transacción que MongoDB.
- No decir que un reintento distribuido es una transacción global.
- No afirmar que se probó carga, escalabilidad o alta disponibilidad.
- No ejecutar la repetición contra datos públicos o de producción.

## Checklist de ensayo

- [ ] Ejecuté `typecheck` y pruebas antes de presentar resultados.
- [ ] Verifiqué pedido, transición, estado `IDLE` y línea temporal.
- [ ] Puedo explicar préstamo, reintento e idempotencia con precisión.
- [ ] Distingo reconstruir proyecciones de recuperar el pedido operacional.
- [ ] Mi guion dura entre 60 y 90 segundos.
