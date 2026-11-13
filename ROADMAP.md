# DubstepWacho — etapas de lanzamiento

Estado al 13 de noviembre de 2026. Este documento separa lo implementado de lo que aún no es seguro abrir al público.

## Base pública (implementada)

- Sitio responsive con catálogo conceptual, artistas, foro de demostración y sección EP colectivo Vol. 1.
- D1 para cuentas y moderación; R2 privado para archivos en cuarentena.
- Panel de moderación y bloqueo de aprobación sin veredicto de análisis limpio.
- Reproductor con cola y avance automático; catálogo público filtrado por `published + clean` y audio con HTTP Range (206).
- Protección del registro mediante Turnstile: clave pública servida sin revelar la secreta, widget visual y validación del servidor.
- Tests automáticos de autenticación, publicación, subida y audio. No equivalen a pruebas manuales en iPhone.

## Antes de abrir el registro (bloqueantes)

1. **Verificación de correo**: la migración `0003_email_verification.sql`, el enlace de una hora, la comprobación, el reenvío limitado y el bloqueo de sesiones sin confirmar ya están desarrollados. Falta aplicar migración, decidir/verificar remitente transaccional, probar entrega real, recuperación de contraseña y evitar la enumeración por casos extremos.
2. **Turnstile real**: crear widget para `dubstepwacho.pages.dev`, guardar `TURNSTILE_SECRET_KEY` en secretos, configurar `TURNSTILE_SITE_KEY`, comprobar desafíos reales y medir falsos positivos. Mantener `AUTH_ENABLED` desactivado hasta entonces.
3. **Seguridad de sesiones y roles**: pruebas de expiración, cierre de sesión, revocación y acceso indebido. Revisión de límites de IP y protección Cloudflare WAF contra exceso de solicitudes.
4. **Políticas visibles**: privacidad, condiciones de uso, denuncias de derechos, edad mínima y contacto de soporte. Evitar formularios que prometan enviar datos mientras sean ilustrativos.

## Antes de recibir y publicar MP3 (bloqueantes)

1. Integrar escáner privado de malware para audio e imágenes y registrar resultado firmado en D1; si el escáner falla, no aprobar.
2. Limitar tamaño, frecuencia, almacenamiento y costo, incluyendo cuentas de prueba y archivos corruptos.
3. Permitir a moderadores revisar metadatos, derechos y archivos limpios. El endpoint de transición auditada `approved` a `published` y retirada ya está implementado; falta el panel administrativo real y una prueba end-to-end con D1/R2.
4. Probar reproducción real, avance, pausa y cola en Chrome/Firefox y Safari iPhone con archivos autorizados.

## EP colectivo — primera edición

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
