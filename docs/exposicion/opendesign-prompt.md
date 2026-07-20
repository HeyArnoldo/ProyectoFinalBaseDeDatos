# Prompt autocontenido para OpenDesign

```text
Disena una presentacion academica en espanol profesional para Base de Datos 2 sobre el proyecto de restaurante La Brasa, disponible en https://restaurante.cloud.groowtech.com.

Entrega exactamente 10 diapositivas en formato 16:9. Duracion total: 6 minutos 45 segundos. El mensaje central debe aparecer de forma literal en la apertura y el cierre:

"Una compra, dos modelos de datos y una sola fuente de verdad."

OBJETIVO NARRATIVO
La presentacion debe demostrar una decision de bases de datos, no una explicacion generica de programacion. Una compra se confirma primero en MongoDB, la unica fuente operacional de verdad. Cassandra recibe una proyeccion derivada para dos consultas previstas. La proyeccion puede demorar brevemente porque existe consistencia eventual.

REGLAS DE CONTENIDO
- Explica que MongoDB contiene las colecciones `catalog_items`, `orders` y `outbox`.
- Explica que `catalog_items` aporta productos activos y precio vigente; `orders` conserva la instantanea historica, total y estado; `outbox` conserva el evento pendiente de proyectar.
- Muestra que `orders + outbox` se escriben en una transaccion MongoDB despues de validar catalogo y calcular el total en el servidor.
- Explica que los indices protegen unicidad y acceso operacional, y que la idempotencia con `Idempotency-Key` evita crear dos pedidos ante un reintento equivalente. Una misma clave con contenido distinto debe presentarse como conflicto.
- Explica que Cassandra usa tablas orientadas a consulta: `order_timeline_by_order` para el historial por `order_id`, y `restaurant_activity_by_day` para la actividad por restaurante y dia.
- Muestra las particiones: `order_id` y `(restaurant_id, day)`. Aclara que las lecturas incluyen la clave de particion completa y no usan `ALLOW FILTERING`.
- Explica el flujo `outbox PENDING -> lease -> upserts idempotentes en Cassandra -> PROCESSED`, con reintento ante error.
- Explica que primero se confirma MongoDB y luego se proyecta Cassandra; no dibujes una escritura directa o simultanea del cliente hacia ambas bases.
- Declara el limite real: Cassandra funciona en nodo unico con `RF=1`. No afirmes alta disponibilidad, tolerancia a fallos distribuida ni replicacion productiva.
- No incluyas ni menciones tecnologias de mensajeria ajenas al proyecto.

REPARTO Y TIEMPOS
1. 0:00-0:25. Amir Alviery Cardenas Chancan. Titulo, dominio y mensaje central.
2. 0:25-0:55. Amir Alviery Cardenas Chancan. Separacion entre operacion MongoDB y proyeccion Cassandra.
3. 0:55-1:35. Fabricio Sebastian Gomez Ore. Arquitectura de software y cuatro contenedores: web, API, MongoDB y Cassandra; worker dentro de la API.
4. 1:35-2:20. Alex Esteefano Apolinarez Salvatierra. MongoDB como fuente operacional y sus tres colecciones.
5. 2:20-3:05. Alex Esteefano Apolinarez Salvatierra. Transaccion `orders + outbox`, indices e idempotencia.
6. 3:05-3:55. Rodrigo Raul Povis Zavala. Consultas MongoDB en vivo: catalogo, pedido, outbox, indices y plan de consulta.
7. 3:55-4:45. Adriano Joao Souza Reyna. Integracion Cassandra y tablas orientadas a consulta.
8. 4:45-5:25. Adriano Joao Souza Reyna. Outbox, worker, upserts idempotentes y consistencia eventual.
9. 5:25-6:15. Jose Mauricio Terrazos Espinal. Consultas Cassandra en vivo para timeline y actividad diaria.
10. 6:15-6:45. Amir Alviery Cardenas Chancan. Conclusion, mensaje central y limites de nodo unico / `RF=1`.

ATRIBUCION RESPONSABLE
Adriano Joao realizo la implementacion completa, pero su tramo debe concentrarse en la integracion Cassandra. Para Fabricio, Alex, Rodrigo Raul y Jose Mauricio describe responsabilidad real de analisis, validacion, documentacion y ejecucion de su parte de la demostracion. Amir presenta y cierra la narrativa del equipo.

TEXTO Y NOTAS
- En cada diapositiva muestra solo un titulo, hasta cuatro ideas cortas y los nombres tecnicos imprescindibles.
- Coloca el guion completo, el tiempo, el responsable, la transicion y las acciones de demo en las notas del presentador. Nunca pongas parrafos de guion en la diapositiva.
- La transicion debe conectar logicamente a la siguiente persona, sin volver a presentar el proyecto.
- Incluye notas que indiquen cuando una afirmacion corresponde a evidencia en vivo y cuando se usa una captura de contingencia.

DISENO VISUAL
- Estilo editorial tecnico y universitario, compatible con el lenguaje visual de La Brasa: fondo carbon #1E1D1A, crema #F7EFDF, acentos brasa #C94A2F, azafran #D89B2B y verde #4F6B45.
- Usa una sans clara para texto y una monoespaciada solo para nombres de colecciones, tablas, claves y consultas.
- Mantiene el pie "La Brasa | Base de Datos 2 | Grupo 1", numero de diapositiva y el dominio de forma discreta.
- Usa lineas continuas para la operacion MongoDB y punteadas para la proyeccion eventual hacia Cassandra.
- Prefiere diagramas de datos, claves, tablas y flujos. Evita fotos de stock, imagenes genericas, fondos con degradado, iconos decorativos, bloques largos de codigo y logotipos como elemento principal.

CAPTURAS REALES OBLIGATORIAS
- Usa capturas reales del proyecto en las diapositivas 6 y 9: resultado de `catalog_items`, `orders`, `outbox`, indices, plan de consulta, timeline Cassandra y actividad diaria Cassandra.
- En las capturas, resalta el mismo `order_id` o `event_id` cuando conecte MongoDB con Cassandra.
- Nunca generes terminales, resultados, datos, pedidos ni pantallas ficticias. Si una captura real no esta disponible al disenar, usa un marco vacio etiquetado "Reemplazar por captura real" y deja la instruccion en las notas.
- No muestres credenciales, secretos, datos personales ni terminales sin preparar.

ESTRUCTURA VISUAL SUGERIDA
- Diapositivas 1 y 10: ticket de pedido, MongoDB como bloque principal y Cassandra como vista derivada.
- Diapositiva 3: cuatro bloques de contenedores; navegador fuera del limite y bases internas.
- Diapositivas 4 y 5: documentos y contenedor de transaccion para `orders + outbox`.
- Diapositivas 7 y 9: dos tarjetas de tablas y sus consultas de particion completa.
- Diapositiva 8: linea de estados del outbox con rama de reintento.

El resultado debe ser legible a distancia, riguroso con el alcance real y centrado en las decisiones de MongoDB, Cassandra, outbox, idempotencia y consistencia eventual.
```
