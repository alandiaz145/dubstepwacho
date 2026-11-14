# Automatización futura de desarrollo — propuesta sin activar

Estado: Alan eligió ejecuciones a lo largo de todo el día y cambios mediante Pull Requests sujetos a revisión. Se propuso un workflow de CI para PRs y disparo manual en la rama `automation/pr-review-foundation`. Todavía no hay un agente programado, credenciales de IA ni permisos para desplegar.

## Objetivo

Permitir ciclos de mantenimiento que lean `AGENTS.md`, `ROADMAP.md` y `SECURITY.md`, elijan una tarea autorizada y acotada, trabajen en una rama aislada, ejecuten pruebas y dejen una propuesta verificable para revisión humana.

## Arquitectura recomendada

1. **GitHub Actions (disparador manual inicialmente)** crea una ejecución con permisos mínimos: `contents: read`. No se agrega un cron hasta definir presupuesto, credenciales y límites de uso. Alan ya aprobó el objetivo de ejecuciones durante todo el día.
2. **Agente de programación aislado** recibe una tarea explícita elegida del roadmap, sin secretos de Cloudflare, R2, D1 ni capacidades de desplegar. No debe procesar MP3 privados ni datos personales.
3. **Rama de trabajo y propuesta**: cambios limitados a archivos permitidos; el agente debe abrir una solicitud de revisión (pull request) mediante una credencial de alcance específico y temporal sólo cuando ese permiso se apruebe.
4. **Pruebas de CI**: ejecutar con Node.js 24 (`node:sqlite` se usa en las pruebas reales de transacciones): `npm run test:security`, `npm run build` y `npm run test:sites`. Fallos impiden aprobar; registrar salida, versiones y riesgos en la propuesta. `npm run check:public` es una comprobación externa manual de solo lectura, no un permiso para mutar producción.
5. **Revisión**: una persona aprueba el merge hacia `main`. Cloudflare sólo despliega código desde la rama protegida siguiendo los controles ya existentes.

## Barreras obligatorias

- Sin permisos de escritura de producción, sin mutaciones de D1 ni acceso R2 desde la ejecución autónoma.
- Sin `secrets` de pago ni claves de acceso a Cloudflare en agentes que analicen contenido no confiable de issues o pull requests.
- No ejecutar código de PRs externos en un contexto con credenciales de escritura; evitar `pull_request_target` para tareas de compilación no confiables.
- La IA no puede habilitar `AUTH_ENABLED`, `UPLOADS_ENABLED`, nuevos cobros ni publicación de canciones.
- Protección de `main`, revisión obligatoria, límites de duración/costo, presupuesto y apagado de emergencia antes de añadir una programación recurrente.
- El historial de ejecuciones debe conservar tarea, commit inicial, commit propuesto, resultado de pruebas, revisión y próxima tarea; nunca contraseñas ni tokens.

## Orden de implementación pendiente de aprobación

1. Crear CI de sólo lectura y ejecutarlo manualmente contra la rama principal.
2. Activar protección de rama y revisiones obligatorias.
3. Seleccionar proveedor/ejecutor del agente, presupuesto máximo y política de manejo de datos.
4. Dar al agente permisos para proponer ramas/PRs, **nunca** para desplegar directamente.
5. Hacer un piloto manual de una tarea pequeña; inspeccionar sus cambios y consumo.
6. Sólo después, decidir si activar una recurrencia programada (por ejemplo semanal).

## Configuración elegida por Alan (2026-11-13)

- Frecuencia objetivo: ciclos durante todo el día, no ejecución ininterrumpida.
- Gestión de cambios: ramas separadas y Pull Requests para revisión humana; nada de merges automáticos a `main`.
- La automatización de código queda inactiva mientras se definen un proveedor de ejecución, presupuesto máximo de API/Actions, credenciales mínimas, protección de rama y un procedimiento de parada.
- El workflow `ci.yml` ejecuta pruebas en Pull Requests y por disparo manual; no incluye secretos ni despliega a Cloudflare. Su ejecución puede consumir minutos de GitHub Actions.

## Pendientes de Alan

- Confirmar presupuesto y límites de minutos para GitHub Actions (el CI propuesto puede ejecutarse en Pull Requests).
- Elegir proveedor de agente, presupuesto monetario máximo, intervalo exacto entre ciclos y alcance de credenciales.
- Definir quién revisará y aprobará los PRs antes de los despliegues.

Este archivo es un diseño, no una automatización activa.
