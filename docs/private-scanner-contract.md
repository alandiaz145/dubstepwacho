# Contrato propuesto de análisis privado

Diseño técnico, sin integración ni servicio activo. No crea endpoint, credenciales, migraciones ni gasto. El flujo actual permanece bloqueado: ningún envío obtiene un veredicto limpio automáticamente.

## Límites de confianza

El navegador sólo puede enviar archivos a cuarentena. Ni artistas ni moderadores pueden conceder `scan_status='clean'`. El ejecutor de análisis debe estar aislado del frontend y de las credenciales generales de D1/R2. No debe recibir datos personales ni acceso a otras obras.

Cada trabajo identifica un envío y una versión inmutable de sus dos objetos: MP3 y portada. El coordinador calcula hashes SHA-256 de los bytes almacenados; nunca confía en hashes, rutas ni MIME entregados por el cliente. Los nombres R2 se resuelven desde datos privados del servidor, no desde una URL proporcionada por el ejecutor.

## Trabajo y resultado

Contrato lógico propuesto; los nombres finales y el esquema requieren revisión antes de implementarse:

- Trabajo: identificador aleatorio, identificador de pista, versión de objetos, hashes esperados, tamaños, tipos esperados, fecha de creación, vencimiento e intento.
- Entrega privada: acceso de lectura limitado a esos dos objetos y por un plazo corto; sin listar buckets, escribir objetos ni consultar cuentas. No incluir enlaces ni claves en logs.
- Resultado: identificador de trabajo/intento, hashes realmente leídos, veredicto individual de audio y portada, motor/versión, versión y fecha de firmas, inicio y fin, y código de fallo acotado.
- Veredictos: limpio, detectado, inválido, error o vencido. Sólo ambos archivos limpios, con hashes coincidentes y firmas suficientemente recientes según la política aprobada, permiten revisión humana. Ausencia de hallazgos sin análisis completo no es un resultado limpio.

La autenticación máquina a máquina debe ser independiente de cookies de sesión y Turnstile, con audiencia limitada y expiración corta. El servidor valida autenticidad, cuerpo acotado, identificadores, intento y versión antes de usar un resultado. Las claves de firma no se comparten con código de PRs ni con navegadores. Elegir el mecanismo y su rotación es un paso de implementación pendiente, no una credencial nueva autorizada.

## Transición atómica e idempotencia

En una transacción D1, comprobar trabajo vigente, intento no consumido, pista en cuarentena y versión/hashes sin cambios; persistir evidencia y evento de auditoría, consumir el intento y pasar a `pending_review` sólo si ambos veredictos son limpios. Repetir el mismo resultado no crea otro evento ni cambia estados. Resultados distintos para un intento consumido se rechazan y se registran sin sustituir el primero.

Un resultado atrasado no puede recuperar una pista retirada, rechazada, reemplazada ni publicada. Una falla de auditoría revierte toda la transición. Cambiar bytes invalida el análisis anterior y exige un trabajo nuevo. Un resultado limpio nunca publica: aprobación y publicación conservan sus controles humanos existentes.

## Aislamiento y recursos

Procesamiento sin acceso saliente general, con límites de memoria, CPU, tiempo, disco y concurrencia. Actualización de firmas separada del procesamiento de obras. Prohibir ejecución de archivos, descompresión ilimitada, redirecciones remotas y envío de muestras a servicios públicos. Limpiar disco temporal después de cada trabajo y al reiniciar. Registrar metadatos mínimos sin nombres personales, contenido ni enlaces privados.

Error, agotamiento de recursos, firmas obsoletas, discrepancia de hashes o vencimiento mantienen el bloqueo. Reintentos acotados con espera; agotarlos requiere revisión operativa, sin promoción automática a limpio. Presupuesto inicial USD 0: no seleccionar alojamiento ni activar cómputo sin una decisión explícita de costos y privacidad.

## Reconciliación y retención

Antes de automatizar borrados, preparar un inventario privado de sólo lectura que compare D1 y objetos R2. Clasificar referencias faltantes, objetos sin referencia, trabajos vencidos y versiones discordantes. Reportar identificadores opacos y recuentos, nunca contenido ni URLs firmadas.

Los candidatos sin referencia necesitan período de gracia y segunda comprobación contra D1 antes de borrarse: un upload en curso puede haber escrito R2 antes de completar su transacción. La política de retención y el período de gracia están pendientes; no asumir valores ni borrar material automáticamente. Si un objeto falta o cambió, bloquear su disponibilidad y escalar a moderación con auditoría.

## Pruebas requeridas antes de activar

- Archivos sintéticos limpios, corruptos y casos de prueba del motor en entorno aislado; ambos objetos deben analizarse.
- Firmas/resultados inválidos, expiración, hashes incorrectos, duplicados y resultados fuera de orden.
- Reemplazo/retirada durante análisis, transacciones concurrentes y rollback de auditoría.
- Fallos de red, motor, almacenamiento y límites de recursos; todos conservan el bloqueo.
- Reconciliación con upload concurrente y objeto huérfano; la primera versión debe ser sólo informe.
- Revisión independiente de permisos, costos, privacidad, retención y apagado antes de conectar recursos reales.

## Preparación local implementada (sin conexión)

`lib/scanEvidence.js` exporta `validateScanEvidence({job,result,now,maxSignatureAgeMs})`. Es una función pura y no está importada por endpoints, worker ni frontend. Recibe JSON ya parseado y un snapshot de trabajo confiable; la autenticidad del resultado **no** se verifica aquí. El reloj y la edad máxima de firmas son obligatorios, en milisegundos, sin elegir una política de producción.

El esquema inicial es estricto: sin campos adicionales ni cadenas libres de diagnóstico. Los identificadores son opacos de hasta 128 caracteres alfanuméricos, guion o guion bajo; motor/versiones admiten también punto, dos puntos y signo más. Los hashes son SHA-256 hexadecimal en minúsculas y los tamaños enteros positivos seguros.

- `job`: `id`, `attempt` positivo, `trackId`, `objectVersion`, `createdAt`, `expiresAt`, `objects`.
- `result`: `jobId`, `attempt`, `trackId`, `objectVersion`, `startedAt`, `finishedAt`, `engine`, `objects`.
- `engine`: `name`, `version`, `signatureVersion`, `signatureUpdatedAt`.
- Ambos `objects` contienen exactamente `audio` y `cover`, cada uno con `sha256` y `size`; los del resultado añaden `verdict`: `clean`, `detected`, `invalid`, `error` o `expired`.

La respuesta es `{valid:false,code}` o `{valid:true,allClean}`. Un resultado bien formado con `error` o `detected` es evidencia válida, pero `allClean` es falso. Incluso `allClean:true` no autoriza una transición: siguen pendientes autenticación del ejecutor, estado vigente de la pista, consumo del trabajo, idempotencia y auditoría atómica. No usar el validador como sustituto de esas barreras.

`lib/privateInventory.js` exporta `summarizePrivateInventory({references,objects,now,gracePeriodMs})`. Compara snapshots completos suministrados por un futuro adaptador de confianza. `references` contiene `{key,size}`; `objects`, `{key,size,uploadedAt}` con fecha en milisegundos o `null` si se desconoce. No consulta D1/R2, no verifica hashes de bytes y no puede determinar si un snapshot está completo o actualizado.

Devuelve únicamente recuentos de referencias presentes, objetos faltantes, tamaños distintos y objetos sin referencia recientes, antiguos para revisar o de edad desconocida. Fechas futuras se retienen como desconocidas. Duplicados o entradas inválidas rechazan el informe con un error genérico sin claves. Ningún recuento habilita borrado: faltan revisión de retención y una segunda comprobación actual de referencias, especialmente ante subidas concurrentes.

Las pruebas de ambos módulos son sintéticas. No constituyen análisis de malware, autenticación de resultados ni una reconciliación real del bucket.
