# Demo segura: un pedido, dos lecturas

Esta demostracion crea deliberadamente un unico pedido ficticio en `https://restaurante.cloud.groowtech.com` y hace visibles sus lecturas operacionales en MongoDB y Cassandra. Todo lo posterior a crear el pedido y cambiarlo a `CONFIRMED` es de solo lectura.

## Regla de seguridad

- Requiere acceso autorizado al host o a Coolify. MongoDB y Cassandra no publican puertos en Compose; no intentar acceder a ellas desde Internet ni asumir nombres generados de contenedor.
- Usar solamente datos ficticios. El pedido persiste nombre, telefono y direccion: no usar PII real, no compartir capturas con esos campos y no abrir documentos sin proyeccion.
- No mostrar credenciales, `OPERATOR_PASSWORD_HASH_B64`, `JWT_SECRET`, cookies ni variables de entorno. La sesion del operador dura 15 minutos.
- No ejecutar acciones de reproceso, infraestructura ni pruebas durante la exposicion. En particular, no pulsar **Reprocesar eventos** en `/operador/proyeccion`.

## Preparacion de 2 minutos

Abrir estas cuatro superficies antes de compartir pantalla:

1. Navegador publico: `https://restaurante.cloud.groowtech.com/`.
2. Navegador privado del operador: `https://restaurante.cloud.groowtech.com/operador/login`, luego `/operador/pedidos` y `/operador/proyeccion`.
3. Terminal autorizada de MongoDB con `mongodb-readonly.js` disponible para pegar o ejecutar.
4. Terminal autorizada de Cassandra con `cassandra-readonly.cql` disponible para pegar o ejecutar.

Comprobar las rutas HTTP de solo lectura desde una terminal sin secretos:

```sh
curl --fail --silent --show-error https://restaurante.cloud.groowtech.com/health
curl --fail --silent --show-error https://restaurante.cloud.groowtech.com/api/health
```

La primera debe devolver `ok`; la segunda, `{"status":"ok"}`. Si una falla, no crear el pedido: pasar al plan B.

## Recorrido de 90 segundos

### 1. Crear y capturar el identificador

El profesor abre la carta publica, agrega un producto activo y confirma con datos claramente ficticios, por ejemplo `Demo Aula`, `000 000 000` y `Direccion ficticia 123`. La pantalla de confirmacion muestra el `orderId`; copiarlo en una nota local y en `ORDER_ID`.

El estado inicial es `PENDING`. La aplicacion calcula el total con el catalogo en el servidor y crea el pedido junto con un evento `ORDER_CREATED` en MongoDB.

### 2. Mostrar MongoDB sin PII

Ejecutar `mongodb-readonly.js` con el `ORDER_ID`. El resultado muestra:

- Las colecciones e indices de `orders` y `outbox`.
- El pedido con una proyeccion que excluye `guest`, `requestHash` e `idempotencyKey`.
- Los eventos del outbox para ese pedido y su `eventId`.
- El plan de consulta del pedido por su clave primaria, sin modificar datos.

Anotar el `eventId` de `outbox`. Es el valor que debe aparecer como `event_id` en Cassandra. No usar `orders.history.eventId` para esta correlacion: es un identificador de historial distinto.

### 3. Cambiar un unico estado como operador

En la ventana privada, iniciar sesion en `/operador/login`. En la columna **Pendiente** de `/operador/pedidos`, ubicar el ticket ficticio y pulsar **Confirmado** una sola vez. La transicion permitida es `PENDING -> CONFIRMED` y crea un segundo evento `ORDER_STATUS_CHANGED`.

No avanzar mas estados: una sola transicion mantiene la demo corta y permite ver dos eventos ordenados.

### 4. Esperar y consultar las proyecciones

El worker consulta pendientes cada 2 segundos. Normalmente bastan de 5 a 15 segundos para que los eventos aparezcan; esperar hasta 45 segundos antes de considerar que hay un problema. En `/operador/proyeccion`, confirmar que el resumen ya no muestra trabajo pendiente para el flujo y consultar:

- **Timeline por pedido**: pegar `orderId`. Deben aparecer `ORDER_CREATED/PENDING` y `ORDER_STATUS_CHANGED/CONFIRMED`.
- **Actividad diaria**: usar el dia UTC actual que aparece en `occurredAt` y el restaurante `11111111-1111-4111-8111-111111111111` configurado por defecto. Deben aparecer los mismos eventos.

Luego ejecutar `cassandra-readonly.cql` para evidenciar las dos consultas fisicas. Ambas incluyen toda la particion: `order_id` para el timeline y `(restaurant_id, day)` para actividad. No se usa `ALLOW FILTERING`.

## Correlacion que se debe narrar

| Evidencia | Valor a comparar |
|---|---|
| Confirmacion publica | `orderId` |
| MongoDB `orders._id` y `outbox.orderId` | El mismo `orderId` |
| MongoDB `outbox.eventId` | Cassandra `event_id` |
| MongoDB `outbox.occurredAt` | Dia UTC de `restaurant_activity_by_day.day` |
| MongoDB `outbox.payload.status` | Cassandra `status` |

El primer evento corresponde a la creacion y el segundo al cambio de estado. Cassandra es una lectura derivada; MongoDB conserva el registro operacional.

## Consola autorizada: Coolify o terminal del contenedor

1. En Coolify, abrir la terminal del recurso de MongoDB autorizado, no la de la aplicacion web.
2. Definir el identificador sin imprimir otros valores: `export ORDER_ID='<ORDER_UUID_V4>'`.
3. Abrir `mongosh --quiet 'mongodb://127.0.0.1:27017/restaurant?replicaSet=rs0'` y pegar el contenido de `mongodb-readonly.js`.
4. En la terminal del recurso de Cassandra autorizado, abrir `cqlsh 127.0.0.1 9042` y pegar `cassandra-readonly.cql` tras sustituir sus tres placeholders.

No se presupone ningun nombre de contenedor. Seleccionar los recursos de MongoDB y Cassandra por su servicio en la interfaz autorizada. Estas consolas quedan dentro de la red del despliegue porque las bases no exponen puertos.

## Alternativa local: Docker Compose

Desde una copia local autorizada del repositorio, sustituir los placeholders por los valores reales. `mongodb` y `cassandra` son los nombres de servicio definidos por Compose, no nombres generados de contenedor.

```sh
export ORDER_ID='<ORDER_UUID_V4>'
docker compose --project-directory '<PROJECT_DIRECTORY>' \
  -f '<PROJECT_DIRECTORY>/infra/compose.yaml' \
  -p '<COMPOSE_PROJECT>' \
  exec -T -e ORDER_ID="$ORDER_ID" mongodb \
  mongosh --quiet 'mongodb://127.0.0.1:27017/restaurant?replicaSet=rs0' --file /dev/stdin \
  < docs/exposicion/demo/mongodb-readonly.js
```

Para Cassandra, sustituir los placeholders en el archivo o pegarlos en `cqlsh`; no hay parametros de sesion en CQL para esos literales.

```sh
docker compose --project-directory '<PROJECT_DIRECTORY>' \
  -f '<PROJECT_DIRECTORY>/infra/compose.yaml' \
  -p '<COMPOSE_PROJECT>' \
  exec -T cassandra cqlsh 127.0.0.1 9042 \
  -f /dev/stdin < docs/exposicion/demo/cassandra-readonly.cql
```

Si la ruta actual no es la raiz del repositorio, reemplazar los dos `docs/exposicion/demo/...` por su ruta real. Estos comandos solo abren clientes y ejecutan lecturas.

## Plan B local y capturas

Si la instancia remota, la sesion o una proyeccion no responde en 45 segundos, no diagnosticar ante el publico. Mostrar, en este orden, cuatro capturas preparadas: confirmacion con `orderId`, MongoDB saneado, ticket `CONFIRMED`, y timeline mas actividad diaria. Narrar la correlacion de la tabla anterior y continuar el cierre.

Para un ensayo local, iniciar el entorno previamente autorizado y repetir exactamente el recorrido con datos ficticios. No usar el ensayo ni el plan B para reiniciar servicios, desplegar, reprocesar eventos o ejecutar pruebas. Registrar las capturas sin PII y con el `orderId` y los `eventId` visibles.
