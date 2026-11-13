# Seguridad de archivos — DubstepWacho

## Estado actual (prelanzamiento)

- `AUTH_ENABLED` no está activado: no se admiten registros ni sesiones públicas.
- `UPLOADS_ENABLED` no está activado: no se reciben MP3 de usuarios.
- Los archivos futuros se guardan en `PRIVATE_MUSIC`, dentro de `quarantine/`, sin acceso público directo a R2.
- Se limita el tamaño a 10 MiB por MP3 y 3 MiB por portada, con control de firma inicial, cantidad de envíos, origen y derechos declarados.
- Un administrador **no puede aprobar** un track salvo que `scan_status='clean'` y `status='pending_review'`.
- No hay actualmente un escáner conectado que pueda establecer el estado `clean`. Esto es intencional: ningún track nuevo puede pasar de cuarentena a aprobado todavía.

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

- Integración real de análisis de malware y pruebas con archivos limpios, corruptos y el archivo de prueba EICAR (sin almacenar ni publicar material malicioso).
- Verificación de correo, protección anti-bots y recuperación de cuenta.
- Pruebas de control de acceso (usuarios, artistas y administradores) y de moderación, incluidos intentos de aprobación antes del resultado limpio.
- Prueba manual de reproducción y avance de audio en Safari de iPhone.

Mantener las banderas de activación apagadas hasta completar esas condiciones. Ningún resultado de escaneo garantiza riesgo cero; la cuarentena, los límites, los permisos y la moderación siguen siendo necesarios.
