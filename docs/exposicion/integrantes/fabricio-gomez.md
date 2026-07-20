# Fabricio Sebastian Gomez Ore

**Curso:** Base de Datos 2  
**Rol:** Arquitectura Docker y flujo de datos.  
**Objetivo:** Mostrar cómo los cuatro contenedores reproducen el recorrido web, API, MongoDB y Cassandra, sin afirmar que los programé.

## Guion hablado (60-90 segundos)

> La arquitectura se ejecuta en cuatro contenedores definidos en Docker Compose: web, API, MongoDB y Cassandra. El contenedor web expone la interfaz; la API atiende las solicitudes y concentra las reglas de negocio; MongoDB funciona como réplica configurada para transacciones; y Cassandra mantiene las proyecciones de consulta. El navegador no se conecta directamente a ninguna base de datos: pasa por la API. Cuando se crea o cambia un pedido, la API confirma el cambio y un evento de salida en MongoDB. Un trabajador que vive dentro de la misma API consulta los eventos pendientes, los reclama temporalmente, escribe las dos vistas de Cassandra y recién después marca el evento como procesado. Este flujo evita tratar a Cassandra como base operacional. La composición también espera los chequeos de salud de MongoDB y Cassandra antes de iniciar la API, y la web espera a la API. Para la exposición podemos verificar los cuatro servicios con `docker compose ps` y recorrer la aplicación publicada. Es un entorno reproducible de alcance académico; no presentamos pruebas de carga ni alta disponibilidad.

## ¿Qué hiciste tú?

Después de ejecutar y validar esta ficha, puedo decir: me encargué de preparar el entorno de demostración, estudié la composición Docker, verifiqué el orden del flujo y documenté la evidencia que voy a mostrar.

## Antes de poder decirlo

- [ ] Ejecutar `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml -f infra/compose.local.yaml up -d --build --wait`.
- [ ] Ejecutar `docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml -f infra/compose.local.yaml ps` y guardar una captura sin secretos.
- [ ] Confirmar en la salida que aparecen solo `web`, `api`, `mongodb` y `cassandra`.
- [ ] Abrir `http://127.0.0.1:18080`, crear o identificar un pedido de prueba y verificar que el recorrido público funciona.
- [ ] Iniciar sesión como operador con las credenciales de prueba guardadas fuera de pantalla, abrir el estado de proyección y comprobar que termina en `IDLE` después de procesar el pedido.
- [ ] Leer `infra/compose.yaml` y trazar en papel el flujo antes de ensayarlo.

## Evidencia verificable

- `infra/compose.yaml:1-106` contiene los cuatro servicios, sus dependencias y chequeos de salud.
- `infra/compose.yaml:33-37` conecta la API con MongoDB y Cassandra por la red interna de Compose.
- `README.md:10-13` confirma el dominio público y que solo la web se enruta públicamente.
- `apps/api/src/projections/projection.worker.ts:62-67, 157-250` inicia el trabajador embebido y muestra su ciclo de procesamiento.

## Concepto central

**Flujo desacoplado:** la operación se confirma en MongoDB; la actualización de Cassandra ocurre después mediante el registro `outbox` y el trabajador embebido.

## Pregunta principal del profesor

**¿Cómo viajan los datos desde la interfaz hasta Cassandra?**  
La interfaz llama a la API; la API confirma el pedido y su salida en MongoDB; el trabajador toma esa salida y actualiza las dos proyecciones Cassandra.

## Repreguntas

**¿Por qué la web no consulta MongoDB directamente?**  
Porque la API centraliza autenticación, reglas de negocio, validación y acceso a datos.

**¿Qué inicia primero?**  
MongoDB y Cassandra deben estar saludables; luego inicia la API y la web depende de la salud de la API.

**¿El trabajador es otro contenedor?**  
No. Es parte de la API, por eso la composición define cuatro contenedores.

**¿Qué evidencia muestra que el flujo terminó?**  
El estado de proyección puede indicar `IDLE` y la línea temporal devuelve los eventos del pedido.

## Acción de demo

Ejecutar `docker compose ... ps`, mostrar los cuatro servicios saludables y abrir el sitio. Durante la demostración, señalar que el estado de proyección se consulta como operador, no desde el navegador público.

## Errores que no debe decir

- No decir que creé los Dockerfiles, configuré Compose o programé el trabajador.
- No decir que el navegador se conecta a MongoDB o Cassandra.
- No decir que hay más de cuatro contenedores.
- No afirmar que el orden de inicio prueba tolerancia a fallos, escalabilidad o alta disponibilidad.

## Checklist de ensayo

- [ ] Puedo nombrar los cuatro contenedores y la función de cada uno.
- [ ] Explico el flujo sin dibujar una escritura simultánea en las dos bases.
- [ ] Sé mostrar `docker compose ps` sin revelar variables.
- [ ] Mi guion dura entre 60 y 90 segundos.
- [ ] Tengo abierta la pestaña local o el dominio antes de hablar.
