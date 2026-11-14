# DubstepWacho — etapas de lanzamiento

Estado al 13 de noviembre de 2026. Este documento separa lo implementado de lo que aún no es seguro abrir al público.

## Registro del ciclo autónomo actual

### Ciclo del 14 de noviembre de 2026 — propuesta en rama para revisión

- Base inspeccionada: `main` en `9ab01e9`; cambios propuestos mediante PR, sin commits directos a `main`, merge ni despliegue.
- Lector JSON compartido endurecido: límite de 8192 bytes aplicado durante la lectura, cancelación del stream al excederlo, UTF-8 estricto y rechazo de `null`, arrays y valores primitivos. Evita errores internos en autenticación y moderación y lectura completa de solicitudes excesivas sin Content-Length. Cuatro regresiones verifican límites exactos, caracteres multibyte, cancelación y HTTP 400 en login/recuperación.
- Corregida la prueba de configuración pública: habilitar registro requiere también correo transaccional configurado. No se relajó el servidor ni se configuró ningún proveedor.
- Dos pruebas con esquema SQLite real verifican sesiones vencidas, tokens malformados/desconocidos, correo sin verificar, rechazo de logout desde otro origen, revocación selectiva e idempotencia.
- Verificación local con Node 24.22.1: 52/52 pruebas de seguridad y lógica correctas; Sites 3/4 correctas, con fallo de empaquetado preexistente.
- Bloqueo reproducido desde checkout limpio: falta `.openai/hosting.json` en `main`. Vite compila, pero `npm run build` falla en `prepare-sites-build.mjs`; la prueba de empaquetado Sites también falla por los artefactos ausentes. Recuperar la configuración original aprobada antes de considerar build y Sites verificados; no se inventó configuración ni se omitió la prueba fallida.
- Vista local iniciada en puerto 5173. El navegador compartido no pudo abrirse: `the gaas-browser node_repl sandbox cannot be disabled`. La prueba manual de foco sigue pendiente; no equivale a una validación de Safari iPhone.
- Próximos pasos: restaurar configuración original de hosting, repetir build/suite completa y probar los diálogos en navegador funcional. Continúan bloqueados el respaldo independiente verificado de D1, migraciones 0003–0006, correo/Turnstile real y escáner privado. No se activaron Actions, servicios pagos, registros ni subidas.

- Cloudflare D1 real inspeccionado en `dubstepwacho-db`: actualmente existen las tablas iniciales `users`, `sessions`, `auth_attempts`, `artist_profiles`, `tracks` y `moderation_events`; `users` carece de `email_verified_at`. Se obtuvo bookmark Time Travel del estado previo, sin modificar registros. El respaldo independiente sigue pendiente: la consola visual no ofrece exportación SQL, y este entorno no tiene credenciales de API/Wrangler configuradas. No ejecutar `ALTER TABLE` ni otras migraciones antes de exportar y verificar el backup. Las seis migraciones se ejecutaron con éxito en SQLite local en el orden 0001–0006; no equivalen a su aplicación en D1 productivo.
- Reglas de continuidad incorporadas en `AGENTS.md`; el repositorio `main` sigue siendo la referencia y no se alteró la identidad visual.
- Endurecidos los enlaces de verificación de correo y recuperación de contraseña: la transacción revalida el token vigente para impedir que dos solicitudes paralelas utilicen el mismo enlace. Tests de regresión añadidos.
- Sesiones acotadas a 10 por usuario, con eliminación de sesiones vencidas y creación transaccional; prueba automatizada añadida.
- Verificación externa de sólo lectura disponible con `npm run check:public`: comprueba configuración, catálogo, acceso privado e índice EP. Ejecutada correctamente; el índice EP continúa en HTTP 503 hasta aplicar la migración.
- Las decisiones de moderación ahora revalidan estado y análisis limpio dentro de la transacción D1, y sólo auditan cambios efectivos; impide que dos moderadores pisen una transición más reciente. Prueba de conflicto añadida.
- Pruebas adicionales con SQLite real (`node:sqlite`, Node 24) verifican que aprobación y publicación se auditen una vez, que las decisiones tardías respondan 409 y que un fallo de auditoría revierta el cambio de estado.
- Evitada una carrera de interfaz en el archivo EP: al cambiar rápidamente de volumen, sólo la última consulta puede actualizar las canciones visibles. Pendiente de prueba con volúmenes públicos reales después de aplicar `0005`.
- Mejoradas etiquetas accesibles del menú, navegación activa, controles de transporte, repetición, cola y expansión del reproductor. Falta una auditoría manual con lector de pantalla y Safari iPhone.
- Preparado `AUTOMATION.md` con el diseño de agentes programados, ramas, pruebas, permisos mínimos y revisión. **Ninguna automatización fue activada.**
- Prueba externa confirmada: la interfaz administrativa más reciente se desplegó en `dubstepwacho.pages.dev` y `/api/eps/` devolvía HTTP 503 por migración aún pendiente. Las APIs de cuentas permanecen cerradas.
- Bloqueos sin eludir: migraciones D1 `0003`–`0005` (acceso Cloudflare), Turnstile y correo real, escáner privado de MP3, reglas del EP, prueba física Safari iPhone y decisiones de cobro.
- Pruebas de SQLite real para límites por IP/operación, reinicio de ventana de 15 minutos, aislamiento entre usuarios y máximo de diez sesiones; sin ataques ni tráfico de carga contra producción.
- Limpieza incremental y acotada (256 registros antiguos por ejecución muestreada) de `auth_attempts` preparada, con índice en migración `0006_auth_attempts_maintenance.sql` y prueba local SQLite. Falta aplicar también `0006` antes de abrir cuentas.
- Corregido un fallo de integración de la radio: el catálogo entrega `/api/tracks/audio/:id`, pero la cola sólo aceptaba URL HTTPS absolutas. Ahora admite exclusivamente esas rutas públicas validas y orígenes HTTPS; salta pistas fallidas y corta al agotar las opciones, sin bucles. Tests de regresión añadidos; falta prueba con MP3 real autorizado.
- Endpoints públicos reforzados: el listado devuelve `503` si falta D1 y construye cada ficha con campos permitidos explícitos (nunca claves de R2 ni correos internos); audio y portada sin clave válida responden `404` sin acceder a R2, y streaming sin API de metadatos responde `503`. Regresiones agregadas para los tres casos. Verificación local: 50 pruebas de seguridad, build y 4 pruebas de empaquetado Sites correctas; pendiente despliegue automático y validación externa.
- Mejorada la accesibilidad de las ventanas de ingreso, recuperación y subida: semántica de diálogo modal, nombre accesible y botón de cierre etiquetado; foco inicial, ciclo de Tab/Shift+Tab, cierre con Escape y restitución de foco al control anterior. 50 pruebas de seguridad, compilación y 4 pruebas Sites correctas. La prueba automatizada con navegador quedó bloqueada: el Chromium instalado no pudo iniciarse (`socket() failed: Operation not permitted`); requiere prueba en un navegador con permisos de ejecución.
- Próxima tarea independiente recomendada: comprobar el foco y los formularios modales en navegador real, probar accesibilidad del reproductor y verificar despliegue después del commit. Próxima tarea externa bloqueada: instalar las migraciones `0003`–`0006` y verificar los bindings de Cloudflare antes de habilitar cualquier función privada.

## Base pública (implementada)

- Sitio responsive con catálogo conceptual, artistas, foro de demostración y sección EP colectivo Vol. 1.
- D1 para cuentas y moderación; R2 privado para archivos en cuarentena.
- Panel de moderación y bloqueo de aprobación sin veredicto de análisis limpio.
- Reproductor con cola y avance automático; catálogo público filtrado por `published + clean` y audio con HTTP Range (206).
- Protección del registro mediante Turnstile: clave pública servida sin revelar la secreta, widget visual y validación del servidor.
- Tests automáticos de autenticación, publicación, subida y audio. No equivalen a pruebas manuales en iPhone.
- Audio `HEAD` responde con metadatos/rangos sin descargar el cuerpo de R2; la implementación conserva streaming `206`.

## Antes de abrir el registro (bloqueantes)

1. **Verificación de correo**: la migración `0003_email_verification.sql`, el enlace de una hora, la comprobación, el reenvío limitado y el bloqueo de sesiones sin confirmar ya están desarrollados. La recuperación de contraseña, revocación de sesiones y migración `0004_password_reset.sql` también están preparadas. Falta aplicar las migraciones, decidir/verificar remitente transaccional y probar entrega real y casos extremos.
2. **Turnstile real**: crear widget para `dubstepwacho.pages.dev`, guardar `TURNSTILE_SECRET_KEY` en secretos, configurar `TURNSTILE_SITE_KEY`, comprobar desafíos reales y medir falsos positivos. Mantener `AUTH_ENABLED` desactivado hasta entonces.
3. **Seguridad de sesiones y roles**: pruebas de expiración, cierre de sesión, revocación y acceso indebido. Revisión de límites de IP y protección Cloudflare WAF contra exceso de solicitudes.
4. **Políticas visibles**: privacidad, condiciones de uso, denuncias de derechos, edad mínima y contacto de soporte. Evitar formularios que prometan enviar datos mientras sean ilustrativos.

## Antes de recibir y publicar MP3 (bloqueantes)

1. Integrar escáner privado de malware para audio e imágenes y registrar resultado firmado en D1; si el escáner falla, no aprobar.
2. Limitar tamaño, frecuencia, almacenamiento y costo, incluyendo cuentas de prueba y archivos corruptos.
3. Permitir a moderadores revisar metadatos, derechos y archivos limpios. El panel administrativo ya usa los endpoints autenticados de D1; publica/retira y registra el evento en una única transacción. Incluye una vista privada de las 50 últimas decisiones. Falta una prueba end-to-end con D1/R2 y moderadores reales.
4. Probar reproducción real, avance, pausa y cola en Chrome/Firefox y Safari iPhone con archivos autorizados.

## EP colectivo — primera edición

- La estructura D1 de volúmenes y repertorios está preparada en `0005_ep_volumes.sql` (todavía no aplicada). Sólo se consultan volúmenes marcados `published` y canciones publicadas con análisis limpio. El archivo aparece en la web cuando exista una edición real.
- Definir fecha de convocatoria, cantidad de temas, criterios, equipo que selecciona, licencias y territorios.
- Formularios para inscribirse, enviar demo privado y confirmar créditos/licencias antes de publicar.
- Página de cada volumen con artistas, lista de canciones, artwork y archivo de ediciones mensuales.
- Evitar publicar material enviado a concurso antes de la autorización específica del artista.

## Comunidad y sostenibilidad (fases posteriores)

- Feedback por tema con moderación, reportes y antispam; comentarios anónimos sólo con límites rigurosos.
- Perfiles verificables de productores, colaboraciones, mapa regional sin revelar ubicación privada, comunidad WhatsApp opt-in.
- Marketplace para samples, stems, presets y servicios: términos de licencias no exclusivas, comisiones y entrega segura.
- Donaciones transparentes y cuadro de costos de transferencia y almacenamiento, tras elegir procesador de pagos.
- Foro persistente, notificaciones y soporte; monitoreo de tráfico, errores y consumo de Cloudflare.

## Decisiones para revisar con Alan a las 12:00

- Servicio de verificación de correo y dominio remitente.
- Escáner de malware privado (servicio aislado o proveedor externo, con privacidad de material inédito).
- Condiciones de participación y calendario del EP Vol. 1.
- Política de pagos, comisión del marketplace y moneda de cobro.
- Prueba manual de Safari iPhone con uno o más MP3 expresamente autorizados.

Ninguna de estas decisiones bloquea seguir trabajando en pruebas y diseño. No contratar recursos pagos ni activar registros o subidas públicas por anticipado.
