# DUBSTEPWACHO

Prototipo responsive de la plataforma comunitaria de Dubstep y Bass Music latinoamericana.

## Ejecutar

```bash
npm install
npm run dev
```

## Estado actual

La interfaz incluye portada, exploración musical, perfiles ilustrativos, reproductor global, foro, página de distribución y un flujo local de subida/moderación de archivos MP3. El frontend está construido con React y Vite.

**Esto es un prototipo, no un servicio productivo.** Las cuentas, perfiles persistentes, publicaciones, moderación real y el foro requieren backend, base de datos, almacenamiento privado y controles de seguridad. El formulario de MP3 solo mantiene el archivo localmente mientras dura la sesión: no hay subida remota, escaneo antivirus ni aislamiento del contenido. No se deben cargar archivos privados en esta versión.

Los lanzamientos y artistas precargados son ejemplos ficticios; no tienen MP3 reproducibles. La portada de *Raíz Bass Vol. I* es arte conceptual creado para el prototipo.

## Pruebas

```bash
npm run build
npm run test:sites
```

La verificación visual quedó pendiente por un fallo de acceso a la vista previa. Antes de un lanzamiento público, probar el progreso del reproductor y la continuidad del audio en Safari de iPhone, Chrome para Android y escritorio.

## Próximas etapas

1. Autenticación segura y permisos por rol.
2. PostgreSQL y API de perfiles, temas y canciones.
3. Cargas a Cloudflare R2 en cuarentena y revisión administrativa del servidor.
4. Reproductor probado con MP3 públicos, soporte HTTP Range y Safari iOS.
5. Foro, seguimiento y notificaciones; luego distribución musical.
