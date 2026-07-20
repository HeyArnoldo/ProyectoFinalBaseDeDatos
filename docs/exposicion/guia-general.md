# Guia general de exposicion: La Brasa | Base de Datos 2

## Objetivo

Presentar La Brasa como una decision de persistencia poliglota verificable, no como una demostracion de programacion generica.

**Mensaje central:** `Una compra, dos modelos de datos y una sola fuente de verdad.`

**Dominio de demostracion:** `https://restaurante.cloud.groowtech.com`

## Hilo narrativo

1. Una compra requiere un estado operacional confiable.
2. MongoDB confirma la operacion y conserva `catalog_items`, `orders` y `outbox`.
3. La transaccion `orders + outbox`, los indices y la idempotencia protegen la operacion.
4. El worker procesa el outbox despues de la confirmacion y genera proyecciones en Cassandra.
5. Cassandra responde dos preguntas concretas con `order_timeline_by_order` y `restaurant_activity_by_day`.
6. La demora entre la operacion y la vista es consistencia eventual, no una segunda fuente de verdad.
7. El alcance es un nodo Cassandra con `RF=1`; no se afirma alta disponibilidad.

## Reparto obligatorio

| Integrante | Tramo | Responsabilidad de exposicion |
|---|---|---|
| Amir Alviery Cardenas Chancan | Introduccion y cierre | Unificar el mensaje central, explicar la separacion de responsabilidades y declarar los limites reales. |
| Fabricio Sebastian Gomez Ore | Arquitectura de software y contenedores | Analizar el diagrama de cuatro contenedores, validar el entorno y documentar el flujo entre componentes. |
| Alex Esteefano Apolinarez Salvatierra | Integracion MongoDB | Analizar colecciones, transaccion, indices e idempotencia; validar su evidencia y explicarla. |
| Rodrigo Raul Povis Zavala | Consultas MongoDB en vivo | Ejecutar las consultas preparadas, validar resultados y mostrar la evidencia operacional. |
| Adriano Joao Souza Reyna | Integracion Cassandra | Explicar e integrar la proyeccion Cassandra, el worker, las claves y la consistencia eventual. |
| Jose Mauricio Terrazos Espinal | Consultas Cassandra en vivo | Ejecutar las dos consultas orientadas a particion, validar sus resultados y demostrar que no usan filtrado. |

La asignacion describe responsabilidades de analisis, validacion, documentacion y demostracion. No atribuir implementacion individual a integrantes distintos de Adriano Joao.

## Guion por tramos

| Tiempo | Quien | Idea que debe quedar clara |
|---|---|---|
| 0:00-0:55 | Amir | MongoDB confirma una compra; Cassandra la representa para lecturas concretas. |
| 0:55-1:35 | Fabricio | Hay cuatro contenedores; el worker esta dentro de la API y las bases son internas. |
| 1:35-3:05 | Alex | MongoDB es la fuente operacional: catalogo, pedido y outbox protegidos por transaccion, indices e idempotencia. |
| 3:05-3:55 | Rodrigo Raul | La evidencia MongoDB conecta producto, pedido, evento, indices y plan de consulta. |
| 3:55-5:25 | Adriano Joao | Cassandra modela dos consultas; outbox y worker permiten una proyeccion idempotente y eventual. |
| 5:25-6:15 | Jose Mauricio | Cada consulta Cassandra incluye su particion completa y devuelve una vista derivada. |
| 6:15-6:45 | Amir | La separacion de responsabilidades funciona dentro de un alcance de nodo unico y `RF=1`. |

## Demostracion en vivo

### Secuencia

1. Abrir el dominio y crear o seleccionar un pedido de demostracion con datos semilla.
2. Rodrigo Raul consulta `catalog_items`, luego el documento de `orders` y su evento en `outbox` usando el mismo `order_id`.
3. Rodrigo Raul muestra los indices y el plan de una consulta representativa, sin crear una segunda compra.
4. Adriano Joao muestra el estado de proyeccion: pendiente, en proceso o procesado, segun el momento del recorrido.
5. Jose Mauricio ejecuta la consulta de `order_timeline_by_order` con `order_id`.
6. Jose Mauricio ejecuta la consulta de `restaurant_activity_by_day` con `restaurant_id` y `day`.

### Datos y seguridad

- Usar solamente datos semilla o anonimizados.
- Preparar un `order_id`, el `restaurant_id` y la fecha antes de iniciar.
- Ocultar credenciales, variables de entorno, secretos y pestañas ajenas a la demostracion.
- Tener capturas reales de cada paso y declarar cuando se use una captura de contingencia.

## Ensayo

1. Realizar un ensayo tecnico: verificar el dominio, los cuatro contenedores, el pedido de muestra y las consultas antes de hablar.
2. Realizar un ensayo cronometrado completo: objetivo de 6:45; cada cambio de expositor debe durar menos de cinco segundos.
3. Realizar un ensayo de contingencia: simular que falla una consulta y reemplazarla por su captura real en menos de 15 segundos.
4. Cada responsable debe explicar la evidencia sin leer la diapositiva y ejecutar su parte real de la demo.
5. Amir debe controlar el tiempo, evitar desviar la exposicion hacia tecnologia no relacionada con bases de datos y reservar detalles adicionales para preguntas.

## Reglas de honestidad tecnica

- Decir que MongoDB es la fuente operacional de verdad; Cassandra es una proyeccion derivada.
- Decir que `orders + outbox` se escriben en una transaccion de MongoDB y que la idempotencia evita duplicar una misma solicitud equivalente.
- Decir que los indices protegen unicidad y acceso operacional; no inventar garantias no verificadas.
- Decir que Cassandra responde dos consultas predefinidas y que ambas usan la clave de particion completa, sin `ALLOW FILTERING`.
- Decir que el worker usa outbox, lease, reintentos y upserts idempotentes; la proyeccion puede demorarse temporalmente.
- No afirmar que Cassandra es fuente de verdad, que se escribe directamente desde el cliente ni que reemplaza la operacion MongoDB.
- No afirmar alta disponibilidad, tolerancia a fallos distribuida ni replicacion productiva: Cassandra opera con nodo unico y `RF=1`.
- Adriano Joao puede atribuirse la implementacion completa; durante su tramo debe concentrarse en la integracion Cassandra. Para el resto, describir responsabilidades reales de analisis, validacion, documentacion y demo.
- No mencionar tecnologias de mensajeria fuera del proyecto ni comparar el sistema con herramientas que no forman parte de su implementacion.

## Preguntas probables

| Pregunta | Respuesta breve |
|---|---|
| Por que dos bases? | MongoDB confirma la operacion; Cassandra responde dos lecturas temporales derivadas. |
| Cual es la fuente de verdad? | MongoDB. Cassandra puede reconstruirse desde los eventos del outbox. |
| Que evita dos pedidos iguales? | La `Idempotency-Key`, su indice unico y la comparacion del contenido de la solicitud. |
| Que pasa si Cassandra se demora? | MongoDB ya conserva el pedido; el worker reintenta el evento hasta que la proyeccion converge. |
| Por que no hay `ALLOW FILTERING`? | Las tablas se modelaron desde las consultas y cada lectura entrega la clave de particion completa. |
| Es alta disponibilidad? | No. El alcance usa nodo unico y factor de replicacion uno. |
