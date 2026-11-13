# DUBSTEPWACHO

Prototipo responsive de la plataforma comunitaria de Dubstep y Bass Music latinoamericana.

## Ejecutar

```bash
npm install
npm run dev
```

## Estado actual

La interfaz incluye portada, exploración musical, perfiles ilustrativos, reproductor global, foro, página de distribución y un flujo local de subida/moderación de archivos MP3. El frontend está construido con React y Vite.

**Esto sigue siendo un prototipo, no un servicio productivo.** Se incorporaron endpoints de registro, ingreso, sesión y cierre de sesión mediante Cloudflare Pages Functions, junto con una migración D1 de usuarios, sesiones y perfiles de artista. Estos endpoints responden 503 hasta conectar una base D1 con binding `DB`. El formulario público deshabilita registro e ingreso mientras no esté habilitado el servidor.

La activación pública del registro requiere además revisar limitación de bots, verificación de correo y pruebas integrales. Los perfiles persistentes aún no cuentan con formulario de edición. La publicación y moderación real, el almacenamiento privado y el foro requieren más backend. El formulario MP3 solo mantiene el archivo localmente mientras dura la sesión: no hay subida remota, escaneo antivirus ni aislamiento del contenido. No se deben cargar archivos privados en esta versión.

## Preparación de cuentas (Cloudflare)

1. Crear una base Cloudflare D1 específica para DubstepWacho, sin reutilizar la de Allen KS.
2. Aplicar `migrations/0001_auth.sql` a esa base.
3. Asociar esa D1 al proyecto Pages con nombre de binding `DB`, en producción y vistas previas cuando corresponda.
4. Completar protección anti-bots, verificación de correo, recuperación de contraseña y pruebas de permisos antes de habilitar registro real para visitantes.

Los endpoints se encuentran en `functions/api/auth/`; las contraseñas se derivan con PBKDF2 SHA-256 y sal aleatoria, y la sesión se conserva en una cookie HttpOnly, Secure y SameSite=Lax. El rol administrador nunca se puede seleccionar en el registro público.

Los lanzamientos y artistas precargados son ejemplos ficticios; no tienen MP3 reproducibles. La portada de *Raíz Bass Vol. I* es arte conceptual creado para el prototipo.

## Pruebas

```bash
npm run build
npm run test:sites
node --test tests/auth.test.mjs
```

La verificación visual quedó pendiente por un fallo de acceso a la vista previa. Antes de un lanzamiento público, probar el progreso del reproductor y la continuidad del audio en Safari de iPhone, Chrome para Android y escritorio.

## Próximas etapas

1. Autenticación segura y permisos por rol.
2. PostgreSQL y API de perfiles, temas y canciones.
3. Cargas a Cloudflare R2 en cuarentena y revisión administrativa del servidor.
4. Reproductor probado con MP3 públicos, soporte HTTP Range y Safari iOS.
5. Foro, seguimiento y notificaciones; luego distribución musical.
