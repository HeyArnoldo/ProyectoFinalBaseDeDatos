# Presentación OpenDesign: plataforma políglota de pedidos

## Instrucciones para OpenDesign

Crear una presentación académica de **7 diapositivas**, formato **16:9**, para una exposición de **6 a 7 minutos**. Debe acompañar una demostración en vivo del sistema, no reemplazarla.

### Regla de renderizado

- Renderizar únicamente las siete secciones tituladas `Diapositiva`.
- Dentro de cada diapositiva, mostrar solo `Texto visible` y construir el recurso indicado en `Visual`.
- Enviar `Guion del expositor`, `Guion y acciones` y `Transición` a las notas del presentador; nunca mostrarlos en pantalla.
- No renderizar las secciones posteriores a `Material de apoyo para el equipo`.

### Dirección visual

- Estilo: técnico, universitario, limpio y seguro.
- Paleta: azul oscuro `#17365D`, azul claro `#EAF0F6`, blanco y un acento naranja moderado.
- Tipografía: Inter, IBM Plex Sans o equivalente; usar una fuente monoespaciada solo para nombres técnicos.
- Usar diagramas simples, capturas reales del sistema y poco texto.
- Máximo cuatro ideas visibles por diapositiva.
- Mantener el mismo encabezado, numeración y pie: `Grupo 1 | Base de Datos 2`.
- No colocar párrafos del guion en las diapositivas: el guion pertenece a las notas del presentador.
- Evitar imágenes decorativas genéricas, fondos con degradados y bloques extensos de código.

### Mensaje central

> Una compra, dos modelos de datos y una sola fuente de verdad.

### Distribución del tiempo

| Tiempo | Diapositiva | Responsable |
|---|---|---|
| 0:00--0:30 | 1. Apertura | Amir |
| 0:30--1:10 | 2. Problema y solución | Adriano |
| 1:10--1:55 | 3. Arquitectura | José |
| 1:55--2:40 | 4. MongoDB operacional | Rodrigo |
| 2:40--3:25 | 5. Cassandra y sincronización | Fabricio |
| 3:25--5:15 | 6. Demostración en vivo | Alex + equipo |
| 5:15--5:55 | 7. Evidencia y cierre | Amir |

El tiempo restante hasta 6:20 se reserva para cambios de expositor y latencia de la demostración. El límite absoluto es 7:00.

---

## Diapositiva 1: Una compra, dos modelos de datos

**Responsable:** Cardenas Chancan, Amir Alviery  
**Duración:** 30 segundos

### Texto visible

**Plataforma políglota para la gestión de pedidos de un restaurante**

MongoDB + Cassandra + NestJS + React

**Grupo 1**

### Visual

Composición central con `pedido -> MongoDB` como flujo principal y una segunda línea discontinua `outbox -> Cassandra`. No mostrar una escritura simultánea o una bifurcación directa hacia las dos bases de datos.

### Guion del expositor

> Buenos días. Somos el Grupo 1 y presentamos una plataforma de pedidos para restaurante construida con persistencia políglota. El objetivo no fue usar dos bases de datos por usar más tecnología, sino asignar a cada una una responsabilidad concreta: MongoDB conserva la operación y Cassandra responde consultas temporales derivadas. En los próximos minutos mostraremos la decisión técnica y el sistema funcionando.

### Transición

> Primero, Adriano explicará qué problema resolvemos y qué puede hacer el usuario.

---

## Diapositiva 2: El problema no era solo guardar pedidos

**Responsable:** Souza Reyna, Adriano Joao  
**Duración:** 40 segundos

### Texto visible

- El cliente consulta el catálogo y registra su pedido.
- El servidor calcula precios y totales.
- El operador controla estados y despacho.
- La actividad debe recuperarse incluso después de fallos.

**Flujo:** `Catálogo -> Pedido -> Preparación -> Despacho -> Entrega`

### Visual

Mostrar un recorrido horizontal con cinco pasos e iconos simples. Resaltar con un candado que el total se calcula en el servidor.

### Guion del expositor

> Un pedido parece una operación CRUD sencilla, pero tiene reglas importantes. El cliente no puede decidir el precio ni el total; esos valores se reconstruyen con el catálogo activo. Además, un pedido solo puede avanzar por estados válidos y los reintentos no deben duplicarlo. El operador necesita observar el despacho y recuperar la actividad si Cassandra estuvo temporalmente fuera de servicio. Esas necesidades guiaron toda la arquitectura.

### Transición

> Con esas reglas claras, José mostrará cómo se distribuyen las responsabilidades.

---

## Diapositiva 3: Arquitectura acotada y reproducible

**Responsable:** Terrazos Espinal, José Mauricio  
**Duración:** 45 segundos

### Texto visible

```text
Cliente -> React/Nginx -> API NestJS -> MongoDB
                                      |
                                   outbox
                                      v
                    trabajador embebido -> Cassandra
```

- Exactamente cuatro contenedores.
- MongoDB es la fuente de verdad.
- El trabajador está embebido en la API.
- Cassandra contiene solo dos proyecciones.

### Visual

Redibujar el flujo como cuatro bloques: Web, API + trabajador, MongoDB y Cassandra. Mostrar explícitamente `MongoDB outbox -> trabajador embebido -> Cassandra`; usar línea continua para la operación y línea discontinua para la proyección asíncrona.

### Guion del expositor

> La solución ejecuta cuatro contenedores: web, API, MongoDB y Cassandra. La interfaz solo se comunica con NestJS. Todas las decisiones de negocio se confirman primero en MongoDB, nuestra única fuente de verdad. La misma API incorpora un trabajador que lee eventos pendientes y actualiza Cassandra. No añadimos Kafka ni un quinto servicio porque el alcance académico prioriza demostrar correctamente las bases de datos y mantener un entorno local reproducible.

### Transición

> Rodrigo explicará ahora cómo MongoDB protege la operación principal.

---

## Diapositiva 4: MongoDB protege la operación

**Responsable:** Povis Zavala, Rodrigo Raul  
**Duración:** 45 segundos

### Texto visible

- MongoDB es la fuente operacional de verdad.
- `order + outbox` se confirman en una transacción.
- Validación e índices protegen la integridad.
- `Idempotency-Key` evita pedidos duplicados.

### Visual

Tres documentos MongoDB etiquetados `catalog_items`, `orders` y `outbox`. Encerrar `orders + outbox` dentro de un borde con la etiqueta `transacción`.

### Guion del expositor

> MongoDB almacena tres colecciones principales. El catálogo mantiene el precio vigente; el pedido guarda una instantánea para conservar el valor histórico; y la salida, u outbox, registra el evento que después será proyectado. Los validadores e índices refuerzan la integridad dentro de la base de datos. La creación del pedido y su evento ocurre en una sola transacción. Si el cliente reintenta con la misma clave, recibe el pedido original en lugar de crear otro.

### Transición

> Ese evento permite actualizar Cassandra sin convertirla en una segunda fuente de verdad. Fabricio mostrará cómo.

---

## Diapositiva 5: Cassandra se diseña desde las consultas

**Responsable:** Gomez Ore, Fabricio Sebastian  
**Duración:** 45 segundos

### Texto visible

**Dos consultas, dos tablas**

- `order_timeline_by_order`: historial por `order_id`.
- `restaurant_activity_by_day`: actividad por restaurante y día.
- Las lecturas usan la partición completa, sin `ALLOW FILTERING`.
- `Outbox -> lease -> upsert idempotente -> processed`.

### Visual

Mostrar dos tarjetas de consulta y, debajo, una línea de cuatro pasos para el trabajador. Incluir la etiqueta `sin ALLOW FILTERING`.

### Guion del expositor

> Cassandra no replica todo MongoDB. Implementa únicamente dos vistas construidas desde las consultas que necesitamos: la línea temporal de un pedido y la actividad de un restaurante por día. Las lecturas siempre incluyen la clave de partición y nunca usan ALLOW FILTERING. El trabajador reclama cada evento, escribe ambas vistas de manera idempotente y después lo marca como procesado. Si falla a mitad del proceso, puede repetir las mismas claves sin crear un evento lógico adicional.

### Transición

> Alex demostrará ahora este recorrido directamente en la aplicación.

---

## Diapositiva 6: Demostración en vivo

**Operación del sistema:** Apolinarez Salvatierra, Alex Esteefano  
**Narración de pasos:** Adriano, Rodrigo, José y Fabricio  
**Duración máxima:** 1 minuto 50 segundos

### Texto visible

**Recorrido de demostración**

1. Consultar el catálogo.
2. Crear un pedido como invitado.
3. Ingresar como operador y avanzar el estado.
4. Consultar la línea temporal proyectada.

### Visual

Usar una captura real del catálogo como fondo principal y una barra inferior con los cuatro pasos. Al importar el Markdown, adjuntar `assets/presentacion/01-catalogo.png`, `02-pedido.png`, `03-operador.png` y `04-timeline.png`. Si todavía no existen, usar marcos vacíos etiquetados y reemplazarlos antes de presentar; no generar pantallas ficticias.

### Guion y acciones

#### 0. Control de la demostración, 30 segundos distribuidos

**Habla:** Alex.  
**Acción:** manejar la aplicación durante todo el recorrido y anunciar brevemente cada cambio de pantalla.

> Vamos a recorrer una compra completa. Ya tenemos los cuatro servicios iniciados y datos semilla preparados. Primero veremos la experiencia pública y después la operación protegida y su proyección.

#### 1. Catálogo, 15 segundos

**Habla:** Adriano.  
**Acción:** abrir el catálogo con datos semilla.

> Como invitado podemos consultar únicamente productos activos. El precio que vemos es informativo; la API volverá a consultarlo al crear el pedido.

#### 2. Pedido, 20 segundos

**Habla:** Rodrigo.  
**Acción:** seleccionar productos, indicar cantidad y confirmar.

> Enviamos productos y cantidades, no un total confiable. La API valida el catálogo, calcula cada subtotal y devuelve el pedido con su identificador y estado PENDING.

#### 3. Operación, 20 segundos

**Habla:** José.  
**Acción:** iniciar sesión como operador y avanzar el pedido a CONFIRMED o PREPARING.

> Las operaciones administrativas requieren la sesión segura del operador. La transición valida el estado actual y registra simultáneamente el historial y un nuevo evento de salida.

#### 4. Proyección, 25 segundos

**Habla:** Fabricio.  
**Acción:** abrir el estado de proyección y la línea temporal del pedido.

> El trabajador procesa los eventos pendientes y Cassandra devuelve la secuencia ordenada del pedido. Esta vista es derivada: si Cassandra falla, MongoDB conserva la operación y permite reproducir los eventos.

### Transición

> Con el flujo completo visible, Amir cerrará con la evidencia técnica y la conclusión.

---

## Diapositiva 7: Qué demuestra el proyecto

**Responsable:** Cardenas Chancan, Amir Alviery  
**Duración:** 40 segundos

### Texto visible

- **Integridad:** cálculo del servidor y transacciones MongoDB.
- **Recuperación:** idempotencia y reproducción de eventos.
- **Consultas:** dos vistas Cassandra orientadas a partición.
- **Alcance:** nodo único; no afirma alta disponibilidad.

### Visual

Tres columnas: Integridad, Recuperación y Alcance. Terminar con la frase central de la presentación.

### Guion del expositor

> El proyecto demuestra que la persistencia políglota funciona cuando cada tecnología tiene un límite claro. MongoDB garantiza la integridad operacional con validadores, índices y transacciones. Cassandra responde consultas temporales previamente modeladas y puede reconstruirse desde la salida. La idempotencia permite recuperarnos de reintentos y fallos parciales. Nuestro alcance es local y de nodo único, por lo que no afirmamos alta disponibilidad. En síntesis: una compra, dos modelos de datos y una sola fuente de verdad. Gracias.

---

# Material de apoyo para el equipo

> Todo lo que sigue corresponde a preparación y notas. OpenDesign no debe convertirlo en diapositivas.

## Preparación de la demostración

### Antes de entrar al aula

- [ ] Ejecutar `docker compose --project-directory . -f infra/compose.yaml -f infra/compose.local.yaml up -d --build`.
- [ ] Confirmar que los cuatro contenedores están sanos.
- [ ] Verificar que el catálogo semilla tenga productos activos.
- [ ] Capturar las cuatro pantallas reales en `assets/presentacion/` con los nombres indicados en la diapositiva 6.
- [ ] Tener preparadas las credenciales del operador sin mostrarlas en pantalla.
- [ ] Crear una clave de idempotencia nueva para la demostración.
- [ ] Abrir previamente las pestañas de catálogo, operador, proyección y respaldo.
- [ ] Ocultar notificaciones, terminales con secretos y datos personales.
- [ ] Probar el recorrido completo una vez antes de presentar.

### Plan de contingencia

Si la demostración falla, no depurar frente al público por más de 15 segundos.

1. Explicar qué paso debía observarse.
2. Volver a la diapositiva 6.
3. Mostrar cuatro capturas preparadas: catálogo, pedido creado, transición y línea temporal.
4. Continuar con la conclusión sin reiniciar toda la infraestructura.

---

## Reparto del equipo

| Integrante | Parte principal | Concepto que debe dominar |
|---|---|---|
| Amir Alviery Cardenas Chancan | Apertura y cierre | Decisión global y límites del proyecto |
| Adriano Joao Souza Reyna | Problema y catálogo durante la demo | Reglas de negocio y cálculo del total |
| José Mauricio Terrazos Espinal | Arquitectura y transición durante la demo | Componentes, contenedores y flujo de datos |
| Rodrigo Raul Povis Zavala | MongoDB y creación del pedido en la demo | Validación, índices, transacción e idempotencia |
| Fabricio Sebastian Gomez Ore | Cassandra y proyección durante la demo | Particiones, proyecciones, outbox y recuperación |
| Alex Esteefano Apolinarez Salvatierra | Operación completa de la demostración | Recorrido completo y manejo de la interfaz |

---

## Preguntas probables y respuestas breves

### ¿Por qué usar dos bases de datos?

MongoDB resuelve el estado operacional y las transacciones; Cassandra resuelve dos consultas temporales derivadas. No se duplican responsabilidades.

### ¿Cuál es la fuente de verdad?

MongoDB. Cassandra puede eliminarse y reconstruirse desde los eventos conservados en la salida.

### ¿Cómo evitan pedidos duplicados?

La API exige una clave de idempotencia única y compara la huella de la solicitud. Un reintento equivalente devuelve el pedido original.

### ¿Cómo evitan eventos duplicados en Cassandra?

El mismo `event_id`, junto con la partición y el tiempo del evento, forma una clave estable. Una repetición actualiza la misma fila lógica.

### ¿Por qué no utilizar Kafka?

El alcance exige cuatro contenedores y prioriza evidencia de bases de datos. Un trabajador embebido es suficiente para el volumen académico y evita un servicio adicional.

### ¿Qué ocurre si Cassandra se detiene?

MongoDB sigue aceptando la operación y acumula eventos pendientes. Cuando Cassandra vuelve, el trabajador reintenta o reproduce hasta que ambas vistas convergen.

### ¿Cassandra ofrece alta disponibilidad en este proyecto?

No. Se usa un nodo con factor de replicación uno. El proyecto demuestra modelado orientado a consultas y recuperación, no alta disponibilidad productiva.

### ¿Cómo protegen los totales?

El cliente solo envía artículos y cantidades. La API consulta precios activos, calcula subtotales y almacena una instantánea del pedido.

---

## Reglas para ensayar

- Cada integrante debe mantenerse dentro de su tiempo; el objetivo ensayado es 6 minutos 20 segundos incluyendo transiciones.
- No leer las diapositivas: explicar una decisión y señalar el visual correspondiente.
- No repetir la introducción al cambiar de expositor.
- Usar las transiciones escritas para que la presentación parezca una sola historia.
- Alex debe ensayar la demo con otro integrante controlando el tiempo.
- Amir debe cortar detalles adicionales y reservarlos para preguntas.
- Realizar dos ensayos completos: uno normal y otro usando el plan de contingencia.
