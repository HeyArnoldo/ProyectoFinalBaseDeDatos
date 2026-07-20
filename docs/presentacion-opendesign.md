# Presentacion OpenDesign: La Brasa | Base de Datos 2

## Instrucciones de renderizado

Crear una presentacion academica de **10 diapositivas**, formato **16:9**, para una exposicion de **6 minutos 45 segundos** sobre el dominio `https://restaurante.cloud.groowtech.com`.

- Renderizar solo las secciones `Diapositiva 1` a `Diapositiva 10`.
- Mostrar unicamente `Texto visible` y el recurso definido en `Visual`.
- Enviar `Notas del presentador` y `Transicion` a las notas; nunca mostrarlas en pantalla.
- Usar las capturas reales indicadas. Si una captura no esta lista, usar un marco identificado y reemplazarlo antes del ensayo final; no inventar pantallas.
- Mantener el pie `La Brasa | Base de Datos 2 | Grupo 1`, numero de diapositiva y dominio discreto.

## Direccion visual

- Estilo: editorial tecnico, sobrio y universitario. Priorizar diagramas de datos, claves y flujos antes que pantallas de programacion.
- Paleta: carbon `#1E1D1A`, crema `#F7EFDF`, brasa `#C94A2F`, azafran `#D89B2B` y verde hierba `#4F6B45`.
- Tipografia: una sans legible para titulos y cuerpo; monoespaciada solo para colecciones, tablas, claves y consultas.
- Usar espacio en blanco, lineas finas y un maximo de cuatro ideas visibles por diapositiva.
- Diferenciar con linea continua la escritura operacional y con linea punteada la proyeccion eventual.
- Evitar fotos de stock, iconos decorativos, fondos con degradado, bloques extensos de codigo y logotipos de tecnologias como elemento principal.

## Mensaje central

> Una compra, dos modelos de datos y una sola fuente de verdad.

## Cronograma

| Tiempo | Diapositivas | Responsable |
|---|---:|---|
| 0:00-0:55 | 1-2 | Amir Alviery Cardenas Chancan |
| 0:55-1:35 | 3 | Fabricio Sebastian Gomez Ore |
| 1:35-3:05 | 4-5 | Alex Esteefano Apolinarez Salvatierra |
| 3:05-3:55 | 6 | Rodrigo Raul Povis Zavala |
| 3:55-5:25 | 7-8 | Adriano Joao Souza Reyna |
| 5:25-6:15 | 9 | Jose Mauricio Terrazos Espinal |
| 6:15-6:45 | 10 | Amir Alviery Cardenas Chancan |

---

## Diapositiva 1: La Brasa y la pregunta de datos

**Responsable:** Amir Alviery Cardenas Chancan | **Tiempo:** 25 segundos

### Texto visible

**La Brasa: pedidos de restaurante con persistencia poliglota**

`https://restaurante.cloud.groowtech.com`

**Una compra, dos modelos de datos y una sola fuente de verdad.**

### Visual

Una composicion minimalista: un ticket de pedido en el centro, una flecha continua hacia `MongoDB` y, debajo, una flecha punteada posterior hacia `Cassandra`. Etiquetar la primera como `operacion` y la segunda como `proyeccion`. No dibujar una escritura simultanea del cliente hacia ambas bases.

### Notas del presentador

> Buenos dias. Presentamos La Brasa, una plataforma de pedidos cuyo objetivo academico es justificar dos modelos de datos con responsabilidades distintas. La idea central es simple: una compra se confirma en un unico origen operacional y luego se representa en una vista de consultas. Mostraremos el modelo, el flujo y consultas reales sobre ambas bases.

### Transicion

> Antes de ver los componentes, definimos que significa una sola fuente de verdad.

---

## Diapositiva 2: Una compra no se escribe dos veces

**Responsable:** Amir Alviery Cardenas Chancan | **Tiempo:** 30 segundos

### Texto visible

- La operacion se confirma en MongoDB.
- Cassandra recibe una representacion derivada.
- Si la proyeccion se demora, el pedido sigue confirmado.
- Las consultas determinan el modelo de cada base.

### Visual

Dos columnas. En `MongoDB`, resaltar `estado operativo`, `transaccion` y `recuperacion`. En `Cassandra`, resaltar `lecturas previstas` y `consistencia eventual`. Entre ambas, un bloque `outbox` dentro de MongoDB y una flecha punteada que sale despues de confirmar la operacion.

### Notas del presentador

> No usamos dos bases para guardar la misma verdad con dos escrituras independientes. MongoDB conserva el catalogo, el pedido y el evento pendiente dentro de la operacion principal. Cassandra no decide precios, estados ni existencia de pedidos: ofrece lecturas derivadas que pueden tardar brevemente en reflejar una actualizacion. Esa separacion evita que una falla de la proyeccion invalide una compra ya confirmada.

### Transicion

> Fabricio ubicara este flujo dentro de los contenedores y limites del sistema.

---

## Diapositiva 3: Arquitectura acotada: cuatro contenedores

**Responsable:** Fabricio Sebastian Gomez Ore | **Tiempo:** 40 segundos

### Texto visible

```text
Navegador -> Web -> API -> MongoDB
                         | outbox
                         v
                       Worker -> Cassandra
```

- Web, API, MongoDB y Cassandra.
- El worker se ejecuta dentro de la API.
- Las bases no estan expuestas publicamente.
- Cassandra: nodo unico, `RF=1`.

### Visual

Diagrama de cuatro bloques, con el navegador fuera del limite de la aplicacion. La flecha de la operacion llega primero a MongoDB. Desde `outbox`, una flecha punteada pasa al worker embebido y luego a Cassandra. Marcar `nodo unico / RF=1` junto a Cassandra como limite de alcance, no como ventaja.

### Notas del presentador

> El entorno se limita deliberadamente a cuatro contenedores: web, API, MongoDB y Cassandra. El worker vive en la API y procesa eventos del outbox; por eso no existe un servicio adicional entre las dos bases. Las bases quedan en la red interna. Cassandra corre como nodo unico con factor de replicacion uno. Por honestidad tecnica, esto demuestra modelado y proyeccion, no alta disponibilidad.

**Responsabilidad de exposicion:** Fabricio debe validar este diagrama contra el entorno activo, documentar los cuatro contenedores y ejecutar su explicacion con el flujo visible.

### Transicion

> Alex explicara ahora por que la operacion inicia y termina en MongoDB.

---

## Diapositiva 4: MongoDB: fuente operacional

**Responsable:** Alex Esteefano Apolinarez Salvatierra | **Tiempo:** 45 segundos

### Texto visible

| Coleccion | Responsabilidad |
|---|---|
| `catalog_items` | productos activos y precio vigente |
| `orders` | pedido, instantanea, total y estado |
| `outbox` | evento pendiente de proyectar |

**MongoDB es la fuente operacional de verdad.**

### Visual

Tres documentos conectados. `catalog_items` aporta precio al documento `orders`; `orders` genera un documento en `outbox`. Resaltar que `orders` conserva una instantanea de precio y cantidad, no una referencia que recalcula el pasado.

### Notas del presentador

> MongoDB concentra las decisiones que modifican el negocio. `catalog_items` aporta solo productos activos y precios vigentes; al crear el pedido, esos valores se copian como instantanea en `orders`, junto con el total calculado por el servidor. `outbox` registra el evento que debera proyectarse. Asi, la consulta de Cassandra no puede alterar ni reemplazar el estado operacional.

**Responsabilidad de exposicion:** Alex debe analizar las tres colecciones, validar sus campos e indices en el entorno y documentar la evidencia que mostrara.

### Transicion

> La siguiente diapositiva muestra como el pedido y su evento se vuelven inseparables.

---

## Diapositiva 5: Transaccion e idempotencia en MongoDB

**Responsable:** Alex Esteefano Apolinarez Salvatierra | **Tiempo:** 45 segundos

### Texto visible

```text
validar catalogo -> calcular total
        -> transaccion: orders + outbox
```

- Indices unicos protegen claves operacionales.
- La misma `Idempotency-Key` no crea dos pedidos.
- Solicitud distinta con la misma clave: conflicto.
- Un reintento equivalente devuelve el pedido existente.

### Visual

Un contenedor marcado `transaccion MongoDB` que encierra dos inserciones: `orders` y `outbox`. A un lado, una llave `Idempotency-Key` entra a un indice unico de `orders`; mostrar dos reintentos que convergen en el mismo `order_id`.

### Notas del presentador

> En el checkout, la API valida los productos activos, calcula subtotales y total con precios del catalogo, y dentro de una misma transaccion inserta el pedido y su evento en outbox. Los indices unicos incluyen la idempotencia del pedido y el identificador del evento; tambien hay indice para recuperar pedidos por restaurante y fecha. Si llega la misma clave con el mismo contenido, se devuelve el pedido original. Si cambia el contenido, se rechaza porque esa clave ya representa otra operacion.

### Transicion

> Rodrigo comprobara en vivo esa fuente operacional con consultas MongoDB.

---

## Diapositiva 6: MongoDB en vivo: evidencia operacional

**Responsable:** Rodrigo Raul Povis Zavala | **Tiempo:** 50 segundos

### Texto visible

**Demostracion MongoDB**

1. `catalog_items`: precio activo
2. `orders`: instantanea y estado
3. `outbox`: evento del mismo `order_id`
4. Indices y plan de una consulta real

### Visual

Usar una captura real del resultado de `mongosh` o una terminal ampliada y legible, con un pedido preparado para la demo. Resaltar con color un mismo `order_id` en `orders` y `outbox`, y el indice elegido por `explain`. No mostrar secretos ni datos personales.

### Notas del presentador

> Ahora verificamos la evidencia directamente en MongoDB. Primero ubicamos un producto activo del catalogo. Luego mostramos el pedido: sus items ya contienen precio y subtotal historicos, total y estado. Con el mismo `order_id`, mostramos en outbox el evento pendiente o procesado. Finalmente inspeccionamos los indices y el plan de una consulta representativa. La idempotencia se explica desde su indice unico y el flujo implementado, sin crear otra compra durante la demostracion.

**Responsabilidad de exposicion:** Rodrigo Raul debe ejecutar las consultas, validar los resultados antes de exponer y conservar capturas reales como contingencia.

### Transicion

> Con la operacion confirmada, Adriano Joao presentara las vistas que Cassandra necesita leer.

---

## Diapositiva 7: Cassandra: tablas desde las consultas

**Responsable:** Adriano Joao Souza Reyna | **Tiempo:** 50 segundos

### Texto visible

| Pregunta | Tabla |
|---|---|
| Historial de un pedido | `order_timeline_by_order` |
| Actividad de un restaurante en un dia | `restaurant_activity_by_day` |

- Particiones: `order_id` y `(restaurant_id, day)`.
- Lecturas con la particion completa.
- Sin `ALLOW FILTERING`.

### Visual

Dos tarjetas de tabla. En la primera, destacar `PRIMARY KEY ((order_id), occurred_at, event_id)` y orden ascendente. En la segunda, destacar `PRIMARY KEY ((restaurant_id, day), occurred_at, event_id)` y orden descendente. Conectar cada tarjeta a su pregunta, no a una entidad generica.

### Notas del presentador

> Cassandra no es una copia documental de MongoDB. Sus dos tablas nacen de dos preguntas concretas. `order_timeline_by_order` lee el historial de un pedido usando `order_id` como particion. `restaurant_activity_by_day` lee la actividad de un restaurante para una fecha usando la particion compuesta por restaurante y dia. Los tiempos y `event_id` ordenan y distinguen eventos. Como cada consulta incluye su particion completa, no dependemos de filtrado posterior.

**Responsabilidad de implementacion:** Adriano Joao integro la proyeccion Cassandra. En la exposicion debe mostrar el modelo CQL, validar las claves primarias y explicar por que cada tabla responde una consulta concreta.

### Transicion

> La siguiente parte explica como esas vistas reciben eventos sin competir con MongoDB.

---

## Diapositiva 8: Outbox, worker y consistencia eventual

**Responsable:** Adriano Joao Souza Reyna | **Tiempo:** 40 segundos

### Texto visible

```text
outbox PENDING -> lease -> upserts Cassandra -> PROCESSED
                         \-> error: reintento
```

- Primero se confirma MongoDB; despues se proyecta.
- Los upserts usan claves estables e idempotencia.
- Una falla deja el evento recuperable.
- La lectura puede tener demora temporal.

### Visual

Linea de estados en cuatro pasos: `PENDING`, `PROCESSING` con etiqueta `lease`, dos escrituras Cassandra y `PROCESSED`. Agregar una rama de error que vuelve a `PENDING`. Colocar `consistencia eventual` sobre la flecha punteada hacia Cassandra.

### Notas del presentador

> El worker reclama un evento pendiente con una lease temporal. Escribe el mismo evento en ambas tablas de Cassandra mediante upserts idempotentes y solo despues lo marca como procesado en el outbox. Si Cassandra falla o el worker se interrumpe, el evento vuelve a estar disponible para reintento. Por eso una confirmacion puede aparecer primero en MongoDB y unos segundos despues en Cassandra: es consistencia eventual, no perdida de la compra.

**Responsabilidad de implementacion:** Adriano Joao debe demostrar la integracion del worker y explicar el estado del outbox con evidencia del entorno activo.

### Transicion

> Jose Mauricio ejecutara las dos consultas Cassandra que justifican este modelo.

---

## Diapositiva 9: Cassandra en vivo: dos lecturas permitidas

**Responsable:** Jose Mauricio Terrazos Espinal | **Tiempo:** 50 segundos

### Texto visible

```sql
WHERE order_id = ?
WHERE restaurant_id = ? AND day = ?
```

- Timeline ordenado por pedido.
- Actividad diaria ordenada por evento.
- Mismo `event_id`, misma fila logica.
- Ninguna consulta usa `ALLOW FILTERING`.

### Visual

Dos capturas reales de `cqlsh` o del tablero de proyecciones: una timeline y una actividad diaria. En ambas, resaltar la clave de particion y un `event_id` que tambien aparezca en la evidencia MongoDB. No usar datos inventados.

### Notas del presentador

> Ejecutamos dos consultas y ambas especifican la particion completa. La primera recupera el historial ordenado del pedido mostrado antes. La segunda recupera actividad para un restaurante y una fecha. El `event_id` estable permite repetir un evento sin crear otra fila logica. No consultamos Cassandra como si fuera una tabla relacional general: las tablas y las claves existen para estas lecturas definidas.

**Responsabilidad de exposicion:** Jose Mauricio debe ejecutar ambas consultas en vivo, comprobar que usan los parametros preparados y mantener capturas reales para el plan de contingencia.

### Transicion

> Amir cerrara con lo que el proyecto demuestra y con sus limites reales.

---

## Diapositiva 10: La decision y sus limites

**Responsable:** Amir Alviery Cardenas Chancan | **Tiempo:** 30 segundos

### Texto visible

**MongoDB**
Operacion, transaccion, indices, idempotencia

**Cassandra**
Consultas predefinidas, proyecciones, consistencia eventual

**Una compra, dos modelos de datos y una sola fuente de verdad.**

`Nodo unico | RF=1 | Sin afirmacion de alta disponibilidad`

### Visual

Volver al ticket de la primera diapositiva. Mostrar MongoDB como bloque principal y Cassandra como vista derivada. Cerrar con la frase central en tipografia grande y el limite `nodo unico / RF=1` claramente separado como alcance academico.

### Notas del presentador

> La decision no fue duplicar una compra, sino asignar responsabilidades. MongoDB mantiene la verdad operacional: catalogo, pedidos, transacciones, indices e idempotencia. Cassandra resuelve dos lecturas conocidas mediante proyecciones que pueden reconstruirse desde el outbox. El alcance es un nodo Cassandra con factor de replicacion uno; no afirmamos alta disponibilidad. Con esto cerramos: una compra, dos modelos de datos y una sola fuente de verdad. Gracias.

---

# Apoyo de preparacion

> Esta seccion no se renderiza como diapositiva.

## Capturas reales requeridas

- MongoDB: `catalog_items`, un `orders` y su `outbox` con el mismo `order_id`.
- MongoDB: indices y plan de una consulta representativa, sin datos personales.
- Cassandra: resultado de timeline por pedido y actividad por restaurante y fecha.
- Aplicacion: tablero de proyeccion con estado de pendientes/procesados, si se usa como apoyo visual.

## Plan de contingencia

1. Si una consulta en vivo no responde en 15 segundos, mostrar su captura real preparada.
2. Decir con precision que la captura corresponde al mismo escenario preparado, sin afirmar que es una ejecucion en vivo.
3. Continuar con el siguiente responsable; no reiniciar infraestructura durante la exposicion.
4. Mantener visibles solo datos semilla o anonimizados y nunca credenciales, secretos ni terminales no preparadas.
