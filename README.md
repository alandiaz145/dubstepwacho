# DUBSTEPWACHO

Prototipo responsive de la plataforma comunitaria de Dubstep y Bass Music latinoamericana, construido con React y Vite. Conserva la identidad visual lima sobre negro y el arte conceptual aprobado.

## Desarrollo local

Requiere Node.js 24 para las pruebas con `node:sqlite`.

```bash
npm ci
npm run dev
```

Vite sirve el frontend. Los endpoints de `functions/api/` son Cloudflare Pages Functions; no se convierten en un backend productivo al iniciar Vite.

## Estado de seguridad

**Las cuentas y las subidas públicas permanecen deshabilitadas.** Tener un binding D1 no habilita esas funciones: requieren banderas explícitas y completar las condiciones de [SECURITY.md](SECURITY.md).

El backend implementa verificación de correo, recuperación de contraseña, sesiones limitadas y revocables, Turnstile, recepción privada en cuarentena, moderación con auditoría transaccional, publicación/retirada y streaming público con HTTP Range. Son implementaciones sujetas a pruebas y configuración; no significa que estén operativas en producción.

La base productiva es `dubstepwacho-db`. Las migraciones `0003`–`0006` siguen pendientes y no existe todavía un respaldo independiente verificado. **No aplicar migraciones productivas hasta exportar y verificar ese respaldo.** No se debe activar `AUTH_ENABLED` ni `UPLOADS_ENABLED` para resolver fallos de prueba.

Los MP3 futuros se reciben en R2 privado mediante `PRIVATE_MUSIC`, con límite de 10 MiB por audio y 3 MiB por portada. Sólo se sirve una pista `published` con análisis `clean`; una aprobación humana por sí sola no permite distribución. No existe aún un escáner conectado que autorice el paso a revisión. No enviar material inédito a servicios de análisis públicos.

Los artistas y lanzamientos precargados son ejemplos ficticios, sin audio reproducible. La portada de *Raíz Bass Vol. I* es arte conceptual del prototipo. Las reglas y fechas del EP real siguen pendientes.

## Verificación

```bash
npm run build
npm run test:security
npm run test:runtime
npm run test:sites
npm audit --audit-level=high
```

El build y la prueba de empaquetado Sites requieren el manifiesto original `.openai/hosting.json`, actualmente ausente del repositorio. Vite compila, pero el empaquetado completo sigue bloqueado hasta recuperar su configuración aprobada. No inventar un identificador de Site ni omitir la prueba para ocultar el fallo.

`test:security` incluye pruebas con SQLite real y requiere los artefactos del build para la comprobación Sites. `test:runtime` ejecuta los handlers reales en Miniflare/workerd con D1/R2 efímeros locales: aplica las migraciones sólo a esa base aislada y comprueba cuentas, sesiones y streaming. Intercepta Turnstile y correo; no requiere credenciales, no envía correos y no accede a producción. El adaptador de rutas en `tests/runtime/` es sólo de pruebas y no se publica.

Estas verificaciones no sustituyen un ensayo con los bindings productivos ni las pruebas manuales de reproducción y avance en Safari iPhone. Para comprobaciones externas de sólo lectura existe `npm run check:public`; no autoriza escrituras ni pruebas de carga.

## Continuidad

El estado, los resultados y los bloqueos se registran en [ROADMAP.md](ROADMAP.md). Las reglas de desarrollo están en [AGENTS.md](AGENTS.md) y la propuesta de automatización, sin activar, en [AUTOMATION.md](AUTOMATION.md).

Los cambios se proponen mediante ramas y Pull Requests sujetos a revisión humana. No se fusionan ni se despliegan cambios sensibles automáticamente. No activar servicios pagos, registros, subidas ni agentes programados por anticipado.
