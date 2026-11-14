# Seguridad de archivos — DubstepWacho

## Estado actual (prelanzamiento)

- Las solicitudes JSON de cuentas y decisiones de moderación se limitan a 8192 bytes durante la lectura del stream; se cancela el cuerpo excesivo y se rechazan UTF-8 inválido, arrays, `null` y valores primitivos con HTTP 400. Esta verificación es local y no acredita despliegue productivo.

- `AUTH_ENABLED` no está activado: no se admiten registros ni sesiones públicas.
- El registro exige `TURNSTILE_SECRET_KEY` y verifica cada token contra Siteverify, con comprobación de hostname. Si falta el token, venció, falla la red o no hay credencial, el servidor rechaza el registro. Esta barrera no habilita las cuentas por sí sola.
- El formulario de registro consulta `/api/auth/config` para obtener únicamente la clave pública `TURNSTILE_SITE_KEY`. La clave secreta nunca se entrega al navegador. El botón de registro permanece bloqueado hasta recibir un token de desafío; si falla el envío, debe resolverse uno nuevo.
- Los nuevos registros generan un token aleatorio SHA-256 almacenado sólo como hash en D1 (`0003_email_verification.sql`); no crean sesión hasta confirmar el correo. El enlace vence a la hora y el endpoint de verificación consume el token. El envío transaccional es una integración opcional con Resend que requiere `RESEND_API_KEY` y `VERIFICATION_EMAIL_FROM`; no se configuró ni activó ninguna cuenta de correo.
- Recuperación de contraseña preparada con `0004_password_reset.sql`: enlace de 30 minutos, token hasheado de un solo uso, respuesta genérica para evitar revelar cuentas y revocación de todas las sesiones al cambiar la contraseña. Requiere las mismas claves de correo, Turnstile y migraciones antes de su uso público.
- La confirmación de correo y el cambio de contraseña verifican de nuevo, dentro de su transacción D1, que el token todavía exista y no esté vencido. Esto reduce el riesgo de reutilización en solicitudes simultáneas; requiere prueba integral en la base real antes de habilitar cuentas.
- Las sesiones nuevas se crean en una transacción que elimina sesiones vencidas del usuario y conserva como máximo 10 sesiones activas por cuenta. El inicio de sesión adicional puede cerrar una sesión antigua; falta comprobarlo con D1 real.
- SQLite local confirmó límites por IP y operación, renovación de ventana de 15 minutos, separación de usuarios y poda de sesiones a diez. Esto verifica las consultas SQL, no constituye un ensayo de carga contra Cloudflare.
- Los contadores `auth_attempts` más antiguos que 24 horas se limpian de forma oportunista, con muestreo y lotes máximos de 256; la limpieza es de mejor esfuerzo y nunca sustituye el bloqueo de intentos. La migración aditiva `0006_auth_attempts_maintenance.sql` crea un índice temporal para evitar consultas costosas a medida que crezca la tabla; sigue pendiente de aplicar en D1.
- `UPLOADS_ENABLED` no está activado: no se reciben MP3 de usuarios.
- Los archivos futuros se guardan en `PRIVATE_MUSIC`, dentro de `quarantine/`, sin acceso público directo a R2.
- Se limita el tamaño a 10 MiB por MP3 y 3 MiB por portada, con control de firma inicial, cantidad de envíos, origen y derechos declarados.
- Un administrador **no puede aprobar** un track salvo que `scan_status='clean'` y `status='pending_review'`.
- No hay actualmente un escáner conectado que pueda establecer el estado `clean`. Esto es intencional: ningún track nuevo puede pasar de cuarentena a aprobado todavía.
- Las rutas públicas `/api/tracks`, `/api/tracks/audio/:id` y `/api/tracks/cover/:id` consultan D1 y sólo exponen `status='published'` junto a `scan_status='clean'`. Los audios admiten respuestas HTTP 206 y encabezados `Range` para avance en reproductores móviles; sin objeto autorizado responden 404. Esto no supone que ya haya canciones públicas.
- `POST /api/admin/publication` permite publicar sólo pistas `approved` con análisis limpio, o retirar pistas `published`, y requiere administrador autenticado, mismo origen y motivo para retirar. El cambio de estado y el evento de moderación se ejecutan en una transacción D1: si falla el registro, la publicación también se revierte. `GET /api/admin/history` deja consultar las últimas 50 decisiones únicamente a administradores autenticados. Sigue pendiente una prueba real del circuito con D1 y cuentas habilitadas.
- `POST /api/admin/review` también revalida dentro de su transacción el estado y el resultado del análisis antes de modificar una pista; si otra decisión cambió el estado, responde 409 sin registrar una aprobación falsa.

## Flujo requerido antes de habilitar subidas

1. Recibir el MP3 en R2 privado y crear la ficha `pending_analysis`.
2. Enviar un trabajo de análisis a un servicio aislado (por ejemplo, ClamAV en un contenedor administrado) que lea únicamente el objeto en cuarentena.
3. Escanear tanto el MP3 como la portada, registrar motor, versión, fecha, hashes y veredicto en D1, con un mecanismo autenticado para reportar resultados.
4. Si el resultado es limpio, pasar a `pending_review`; si es malicioso, corrupto, desconocido o el escáner falla, permanecer bloqueado y alertar a moderación.
5. Permitir aprobación manual sólo tras veredicto limpio. Servir audio desde una ruta autorizada sin exponer el bucket ni aceptar rutas de archivo arbitrarias.
6. Reanalizar si cambia el archivo o si la política de seguridad lo requiere. Registrar las acciones y conservar un procedimiento de retirada.

## Opciones para análisis

- **ClamAV en un servicio aislado:** control de privacidad de los temas inéditos y capacidad de automatizar; requiere alojamiento, actualizaciones de firmas, límites de recursos y monitoreo.
- **Servicio comercial privado de análisis:** evita administrar un motor propio, pero requiere costos, una API y revisar las condiciones sobre conservación y divulgación de archivos.
- **Cloudflare WAF Malicious Uploads Detection:** requiere Enterprise y un complemento pago, por lo que no se asume disponible en esta cuenta.

No usar automáticamente el API público de VirusTotal: sus condiciones restringen el uso comercial y las muestras públicas pueden compartirse. No enviar tracks inéditos a terceros sin una decisión de privacidad explícita.

## Condiciones de lanzamiento

- Crear el widget Turnstile del dominio real, configurar su clave secreta como secreto de Cloudflare (jamás en GitHub), e instalar `0003_email_verification.sql` y `0004_password_reset.sql` en D1. Elegir/verificar remitente transaccional y configurar secretos, probar un registro real desde el email hasta el login y recuperar una contraseña antes de considerar `AUTH_ENABLED`. `TURNSTILE_TEST_MODE` se reserva para pruebas aisladas con claves de prueba; debe permanecer ausente en producción.
- Integración real de análisis de malware y pruebas con archivos limpios, corruptos y el archivo de prueba EICAR (sin almacenar ni publicar material malicioso).
- Verificación de correo, protección anti-bots y recuperación de cuenta.
- Pruebas de control de acceso (usuarios, artistas y administradores) y de moderación, incluidos intentos de aprobación antes del resultado limpio.
- Prueba manual de reproducción y avance de audio en Safari de iPhone.

Mantener las banderas de activación apagadas hasta completar esas condiciones. Ningún resultado de escaneo garantiza riesgo cero; la cuarentena, los límites, los permisos y la moderación siguen siendo necesarios.
