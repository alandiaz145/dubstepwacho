# DubstepWacho — estado y tareas

Actualizado el 14 de noviembre de 2026. Resultados locales; no acreditan funcionamiento productivo. El [registro histórico](docs/development-log-2026-11-14.md) conserva los ciclos anteriores y sus bloqueos ya resueltos.

## Trabajo propuesto para revisión

- `main` sigue en `9ab01e9`. PR [#2](https://github.com/alandiaz145/dubstepwacho/pull/2): seguridad de cuentas, concurrencia, límites de solicitudes/subidas, streaming privado, pruebas de runtime y reproductor, empaquetado local y verificación offline de respaldos. Listo para revisión humana; sin merge.
- PR [#3](https://github.com/alandiaz145/dubstepwacho/pull/3), en borrador dependiente del #2, rama `feat/account-resend-and-ep-feedback`, basada en el PR #2: interfaz de reenvío de verificación y recuperación con respuestas persistentes, desafío nuevo tras cada intento o cambio de diálogo, estados de EP con cancelación y reintento, y eliminación de datos administrativos obsoletos ante HTTP 401/403. Las sesiones vencidas en moderación o subida vuelven al ingreso. Conserva estilos, arte y banderas cerradas.
- Validación local de esta rama: build correcto, seguridad 89/89, Sites 4/4, runtime Cloudflare 3/3, Chromium 22/22 y npm audit sin vulnerabilidades reportadas. Datos sintéticos, correo y Turnstile interceptados; sin archivos privados ni credenciales productivas.
- El PR de continuación apunta a `main` y depende del #2: revisar primero el #2 y volver a comprobar el diff restante después de su merge. Ningún PR se fusiona automáticamente.

## Continuación local — evidencia de análisis e inventario

- PR [#4](https://github.com/alandiaz145/dubstepwacho/pull/4), en borrador, rama `feat/private-scan-result-validation`, dependiente del PR #3: validador puro de resultados que comprueba identidad/intento/versión, hashes/tamaños de ambos archivos, cronología y vigencia de firmas con política explícita. Un veredicto no limpio nunca produce `allClean`.
- Comparador de inventarios sólo de recuentos: distingue faltantes, tamaños diferentes y objetos sin referencia, con período de gracia obligatorio. Sin adaptador D1/R2 ni capacidad de borrado.
- Diez pruebas sintéticas nuevas. Build correcto, seguridad 99/99, runtime local 3/3 y Sites 4/4. No se modificó frontend; Chromium 22/22 corresponde al ciclo anterior.
- Ambos módulos permanecen desconectados de rutas, escáneres y almacenamiento. Autenticación del ejecutor, transacción/idempotencia y conectores requieren otra implementación y revisión.

## Prioridad 1 — cuentas y recuperación

Preparados: verificación de correo, reenvío, recuperación con revocación de sesiones, límites por IP/operación, sesiones acotadas y transacciones contra carreras. El frontend conserva errores accesibles y renueva desafíos consumidos o vencidos.

Pendientes:

- Respaldo SQL independiente y restauración comprobada de `dubstepwacho-db`; después, revisión del plan de migraciones 0003–0006. No ejecutar migraciones de producción antes del respaldo.
- Vinculación efectiva de credencial temporal en un entorno autorizado: la configuración quedó pausada por pedido del usuario. No pedir que repita el proceso mientras se puedan completar tareas locales.
- Remitente y dominio de correo, widget Turnstile real y ensayo integral de entrega, expiración, reenvío, recuperación y acceso con cuentas controladas.
- Limpieza de URL, confirmación explícita, tokens inválidos/duplicados y reintento tras fallo de red verificados en Chromium. Pendiente auditoría con lector de pantalla y entrega real.
- Revisión independiente de seguridad y pruebas reales de límites/costos antes de considerar `AUTH_ENABLED`.

## Prioridad 2 — MP3 privados y moderación

Preparados: cuarentena R2, límites de bytes y frecuencia, roles/origen, aprobación únicamente tras análisis limpio, publicación/retirada transaccional e historial privado. Runtime local cubre todo el circuito con veredictos simulados.

Pendientes:

- Contrato propuesto en [private-scanner-contract.md](docs/private-scanner-contract.md): aislamiento, hashes, autenticación, idempotencia y reconciliación. Revisar e implementar; sin proveedor activo ni gasto autorizado.
- Reconciliación de objetos huérfanos, retención, borrado y presupuestos de almacenamiento/transferencia.
- Ensayo con moderadores reales, derechos declarados, archivos corruptos y límites de consumo.
- Mantener `UPLOADS_ENABLED` apagado y no distribuir obras inéditas ni enviarlas a servicios públicos de análisis.

## Prioridad 3 — reproductor y compatibilidad

Preparados: reproducción desde gesto del usuario, cola/avance, reintento, control de promesas obsoletas y streaming Range/HEAD; pruebas Chromium con WAV sintético.

Pendientes:

- MP3 expresamente autorizados en Chrome, Firefox y Safari iPhone físico: inicio, pausa, reanudación, avance, cola, cambios de red y retirada.
- Lector de pantalla, navegación móvil y medición de rendimiento/consumo con catálogo real.
- No presentar la prueba Chromium como compatibilidad Safari ni publicar audio de muestra sin permiso.

## Prioridad 4 — EPs, artistas y comunidad

Preparados: esquema 0005 de volúmenes y repertorios, lecturas públicas filtradas y archivo con carga/error/vacío/reintento; respuestas antiguas no sobrescriben la selección reciente.

Pendientes:

- EP Vol. 1: reglas, fechas, cupos, selección, créditos, licencias, territorios y autorización de distribución; decisiones artísticas de Alan.
- Inscripción y demos privados una vez listo el circuito de cuentas/cuarentena, confirmación de créditos/licencias y páginas de volúmenes con artwork aprobado.
- Perfiles verificables, colaboraciones y enlaces de artista respaldados por datos persistentes.
- Foro persistente, feedback por tema, denuncias, moderación, antispam, notificaciones y soporte. La demostración actual no representa un servicio persistente.
- Mapa regional sin ubicación privada y WhatsApp voluntario: requieren reglas de privacidad y enlaces oficiales.

## Prioridad 5 — sostenibilidad, accesibilidad y automatización

- Privacidad, condiciones, edad mínima, contacto y denuncias de derechos: preparar implementación; contenido legal/comercial requiere aprobación.
- Marketplace de samples/stems/presets/servicios: licencias, comisiones, moneda y entrega segura pendientes; sin cobros habilitados.
- Donaciones y costos transparentes tras elegir procesador y autorizar gastos.
- Rendimiento móvil, carga de imágenes, accesibilidad y regresiones de errores/red: trabajo local autorizado que puede continuar sin abrir cuentas.
- Automatización: arquitectura GitHub Actions documentada en [AUTOMATION.md](AUTOMATION.md), presupuesto inicial USD 0, permisos mínimos y PR con revisión. No activar workflows, cron, credenciales ni servicios pagos sin autorización específica.

## Próximas tareas locales

1. Completar pruebas de accesibilidad y errores de red en formularios restantes, conservando las banderas cerradas.
2. Revisar estados de error y cancelación de otras lecturas privadas, sin ampliar permisos.
3. Medir carga inicial e imágenes y corregir mejoras técnicas que preserven la identidad visual.
4. Probar la futura transición de análisis con SQLite aislado: consumo idempotente, estado vigente y rollback de auditoría. No incorporar endpoints ni mecanismos para otorgar `clean` hasta revisar la autenticación del ejecutor.

Los bloqueos externos no impiden estas tareas. La publicación permanece sujeta a revisión humana, respaldo verificado y validación real descrita en [release-validation.md](docs/release-validation.md).
