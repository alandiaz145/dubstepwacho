# Automatización futura de desarrollo — propuesta sin activar

Estado: diseño y preparación. No hay workflows programados, tokens de agentes ni permisos nuevos instalados por este documento.

## Objetivo

Permitir ciclos de mantenimiento que lean `AGENTS.md`, `ROADMAP.md` y `SECURITY.md`, elijan una tarea autorizada y acotada, trabajen en una rama aislada, ejecuten pruebas y dejen una propuesta verificable para revisión humana.

## Arquitectura recomendada

1. **GitHub Actions (disparador manual inicialmente)** crea una ejecución con permisos mínimos: `contents: read`. No se agrega un cron hasta que Alan lo autorice.
2. **Agente de programación aislado** recibe una tarea explícita elegida del roadmap, sin secretos de Cloudflare, R2, D1 ni capacidades de desplegar. No debe procesar MP3 privados ni datos personales.
3. **Rama de trabajo y propuesta**: cambios limitados a archivos permitidos; el agente debe abrir una solicitud de revisión (pull request) mediante una credencial de alcance específico y temporal sólo cuando ese permiso se apruebe.
4. **Pruebas de CI**: ejecutar con Node.js 24 (`node:sqlite` se usa en las pruebas reales de transacciones): `npm run build`, `npm run test:security`, `npm run test:runtime`, `npm run test:browser` y `npm run test:sites` (en ese orden, porque la suite incluye verificación de los artefactos de empaquetado). Fallos impiden aprobar; registrar salida, versiones y riesgos en la propuesta. `npm run check:public` es una comprobación externa manual de solo lectura, no un permiso para mutar producción.
5. **Revisión**: una persona aprueba el merge hacia `main`. Cloudflare sólo despliega código desde la rama protegida siguiendo los controles ya existentes.

## Barreras obligatorias

- `test:browser` requiere Chromium instalado (o `DW_CHROMIUM_PATH`) y usa un perfil aislado, APIs interceptadas y audio WAV sintético. No descargar ni publicar MP3 de usuarios para pruebas. Playwright-core no instala un navegador por sí solo; preparar esa dependencia en el ejecutor antes del piloto, sin activar Actions todavía.

- `test:runtime` ejecuta Miniflare/workerd con D1/R2 efímeros locales y tráfico saliente interceptado. Sólo usa datos sintéticos, banderas de prueba en memoria y un adaptador de rutas ubicado en `tests/runtime/`; no requiere ni debe recibir credenciales de Cloudflare ni correo real. No incluir ese adaptador en un despliegue.

- El manifiesto `.openai/hosting.json` ahora permite empaquetado local del frontend sin `project_id` ni bindings. No es el manifiesto original recuperado y no autoriza publicación. Antes del piloto, verificar build desde un checkout limpio; no inventar identidad, saltar pruebas ni confundir el artefacto estático con el backend de Pages.

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

## Pendientes de Alan

- Autorizar, si lo desea, CI de GitHub Actions y sus minutos de ejecución.
- Elegir proveedor de agente, presupuesto, frecuencia y alcance de credenciales.
- Definir quién revisará y aprobará los PRs antes de los despliegues.

Este archivo es un diseño, no una automatización activa.
