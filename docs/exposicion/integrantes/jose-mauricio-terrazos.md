# José Mauricio Terrazos Espinal

**Curso:** Base de Datos 2  
**Rol:** Consultas Cassandra, particiones y CQL.  
**Objetivo:** Explicar las dos tablas Cassandra desde las consultas que atienden, validar sus particiones y ejecutar CQL de lectura sin afirmar que programé el modelo.

## Guion hablado (60-90 segundos)

> Cassandra se modeló desde dos consultas concretas, no como una copia completa de MongoDB. La primera tabla, `order_timeline_by_order`, responde el historial de un pedido. Su partición es `order_id`; dentro de ella ordena por `occurred_at` ascendente y `event_id`. La segunda, `restaurant_activity_by_day`, responde la actividad de un restaurante en un día. Su partición compuesta es `restaurant_id` y `day`; sus filas se ordenan por fecha descendente y luego por evento. Por eso las consultas de la API siempre incluyen la clave de partición completa: para la línea temporal, el identificador del pedido; para la actividad, restaurante y día. No usan `ALLOW FILTERING`. El trabajador inserta en ambas tablas cada evento de salida y usa el mismo identificador del evento en las claves para que repetir una escritura represente la misma fila lógica. Puedo demostrarlo con `DESCRIBE TABLES` y dos `SELECT` preparados en `cqlsh`. Esto verifica el modelo y el resultado local; no demuestra rendimiento, escalabilidad ni alta disponibilidad, porque el entorno usa un nodo con replicación uno.

## ¿Qué hiciste tú?

Al cumplir esta ficha, puedo decir: me encargué de estudiar las particiones y el CQL, preparé las consultas seguras de lectura, validé las tablas levantadas y ejecuté la parte de consultas de la demostración.

## Antes de poder decirlo

- [ ] Levantar la pila con `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml -f infra/compose.local.yaml up -d --build --wait`.
- [ ] Crear un pedido y al menos una transición válida; esperar el estado `IDLE` en la proyección antes de consultar Cassandra.
- [ ] Ejecutar `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml exec cassandra cqlsh --request-timeout 15 127.0.0.1 9042 -e "DESCRIBE KEYSPACE restaurant_projection;"`.
- [ ] Obtener el identificador del pedido creado y ejecutar en `cqlsh` `SELECT * FROM restaurant_projection.order_timeline_by_order WHERE order_id = <UUID_DEL_PEDIDO>;`.
- [ ] Usar el identificador de restaurante y un día real del evento para ejecutar `SELECT * FROM restaurant_projection.restaurant_activity_by_day WHERE restaurant_id = <UUID_DEL_RESTAURANTE> AND day = '<AAAA-MM-DD>';`.
- [ ] Verificar que ninguna consulta de ensayo use `ALLOW FILTERING` y ocultar datos personales en capturas.

## Evidencia verificable

- `apps/api/src/projections/cql.bootstrap.ts:8-28` define las tablas, claves primarias y ordenamientos.
- `apps/api/src/projections/projection.worker.ts:25-28` contiene los `SELECT` que usa la API con sus claves de partición completas.
- `apps/api/src/projections/projection.worker.ts:199-216` inserta un evento en ambas vistas.
- Consulta: `DESCRIBE KEYSPACE restaurant_projection;` muestra las tablas creadas en la instancia local.

## Concepto central

**Modelado orientado a consulta:** la clave de partición se elige para la consulta que se debe resolver; cada tabla representa una vista específica y no un modelo relacional general.

## Pregunta principal del profesor

**¿Por qué existen dos tablas Cassandra para los eventos?**  
Porque atienden dos consultas distintas: historial de un pedido y actividad diaria de un restaurante. Cada una usa una partición adecuada para su lectura.

## Repreguntas

**¿Cuál es la partición de la línea temporal?**  
`order_id`; permite leer todos los eventos de un pedido con una consulta por su identificador.

**¿Cuál es la partición de actividad?**  
La combinación `restaurant_id, day`; limita la consulta a un restaurante en una fecha.

**¿Por qué no usan `ALLOW FILTERING`?**  
Porque las consultas suministran las claves de partición y las tablas fueron diseñadas para esas lecturas.

**¿Qué orden tiene la línea temporal?**  
Por `occurred_at` ascendente y, ante empate, por `event_id` ascendente.

## Acción de demo

Con el identificador de un pedido ya proyectado, ejecutar el `SELECT` de `order_timeline_by_order`; luego mostrar la actividad por restaurante y día usando valores reales ya preparados. No improvisar UUID ni fecha durante la exposición.

## Errores que no debe decir

- No decir que diseñé o programé las tablas, el CQL o el trabajador.
- No decir que Cassandra guarda todos los datos operacionales del pedido.
- No usar ni recomendar `ALLOW FILTERING` para estas consultas.
- No afirmar que una tabla por consulta prueba escalabilidad o alta disponibilidad.

## Checklist de ensayo

- [ ] Ejecuté `DESCRIBE KEYSPACE` sobre la pila local.
- [ ] Probé ambos `SELECT` con identificadores y fecha reales.
- [ ] Puedo nombrar la partición y el orden de cada tabla.
- [ ] Sé explicar por qué hay dos vistas sin hablar de réplica completa.
- [ ] Mi guion dura entre 60 y 90 segundos.
