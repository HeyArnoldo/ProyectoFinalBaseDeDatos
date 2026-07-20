# Amir Alviery Cardenas Chancan

**Curso:** Base de Datos 2  
**Rol:** Apertura, cierre y explicación de la decisión global.  
**Objetivo:** Explicar por qué el proyecto separa la operación en MongoDB de las consultas temporales derivadas en Cassandra, sin atribuirme programación.

## Guion hablado (60-90 segundos)

> Buenos días. Somos el Grupo 1 y presentamos una plataforma de pedidos para restaurante disponible en `https://restaurante.cloud.groowtech.com`. La decisión central no fue usar dos bases de datos por cantidad de tecnologías, sino asignar una responsabilidad concreta a cada una. MongoDB conserva la operación: catálogo, pedido y evento de salida. Cassandra contiene solamente dos proyecciones para consultar la línea temporal de un pedido y la actividad diaria de un restaurante. Por eso MongoDB es la única fuente de verdad: si una proyección no está disponible, el pedido sigue conservado y los eventos pendientes permiten reconstruirla. La creación o el cambio de un pedido se confirma junto con su evento de salida en una transacción de MongoDB. Después, un trabajador embebido en la API procesa ese evento y actualiza Cassandra de forma idempotente. El alcance es académico y de nodo único; demostramos integridad, consultas orientadas al modelo y recuperación ante fallos parciales, no rendimiento medido ni alta disponibilidad. En resumen: una compra, dos modelos de datos y una sola fuente de verdad.

## ¿Qué hiciste tú?

Después de cumplir la lista de esta ficha, puedo afirmar honestamente: me encargué de preparar la apertura y el cierre, estudié la decisión global, verifiqué el flujo real y ensayé la explicación con evidencia del repositorio.

## Antes de poder decirlo

- [ ] Ejecutar `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml -f infra/compose.local.yaml up -d --build --wait` desde la raíz.
- [ ] Ejecutar `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml -f infra/compose.local.yaml ps` y confirmar `web`, `api`, `mongodb` y `cassandra` en estado saludable.
- [ ] Abrir `http://127.0.0.1:18080` y `https://restaurante.cloud.groowtech.com`; comprobar que la interfaz pública carga sin presentar credenciales.
- [ ] Leer `README.md` y `docs/presentacion-opendesign.md`, especialmente el mensaje central y los límites del alcance.
- [ ] Pedir a un compañero que cree un pedido y comprobar con el operador que existe antes de decir que MongoDB conserva la operación.
- [ ] Ensayar el guion con cronómetro entre 60 y 90 segundos, sin leer la pantalla.

## Evidencia verificable

- `README.md:3, 10-13` describe los cuatro servicios, el dominio y la ruta `/api`.
- `infra/compose.yaml:2-100` define exactamente `web`, `api`, `mongodb` y `cassandra`.
- `apps/api/src/orders/checkout.service.ts:70-125` confirma en una transacción el pedido y su registro `outbox`.
- `apps/api/src/projections/projection.worker.ts:157-250` procesa la salida, escribe las proyecciones y reintenta ante error.

## Concepto central

**Fuente única de verdad:** MongoDB conserva el estado operacional; Cassandra no decide el estado del pedido y sus vistas pueden reconstruirse desde los eventos de salida.

## Pregunta principal del profesor

**¿Por qué usaron dos bases de datos?**  
Porque resuelven responsabilidades distintas: MongoDB protege la operación y la transacción; Cassandra sirve dos consultas temporales derivadas con claves de partición definidas.

## Repreguntas

**¿Cassandra recibe la misma escritura al mismo tiempo que MongoDB?**  
No. Primero se confirma MongoDB con el evento de salida; después el trabajador actualiza Cassandra.

**¿Cuál es la fuente de verdad?**  
MongoDB. Allí están el pedido, su historial y los eventos pendientes o procesados.

**¿Qué ocurre si Cassandra no está disponible?**  
La operación ya confirmada en MongoDB se conserva; el evento queda pendiente para reintento.

**¿Demuestran alta disponibilidad?**  
No. El entorno usa un nodo Cassandra con factor de replicación uno y no se hicieron pruebas de alta disponibilidad.

## Acción de demo

Abrir el catálogo en el dominio, señalar el diagrama o la diapositiva del flujo `pedido -> MongoDB -> outbox -> trabajador -> Cassandra` y entregar la demostración a Alex Esteefano Apolinarez Salvatierra.

## Errores que no debe decir

- No decir que programé, diseñé o implementé la arquitectura.
- No decir que Cassandra es una segunda fuente de verdad ni que almacena toda la operación.
- No decir que se escribe en ambas bases de datos dentro de una misma transacción.
- No afirmar rendimiento probado, escalabilidad probada o alta disponibilidad.

## Checklist de ensayo

- [ ] Puedo explicar la fuente de verdad en una frase.
- [ ] Distingo operación confirmada de proyección derivada.
- [ ] Digo el límite de nodo único sin improvisar promesas de producción.
- [ ] Mi intervención dura entre 60 y 90 segundos.
- [ ] Cierro con la transición hacia la demostración o las preguntas.
