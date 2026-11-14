# Carga inicial y accesibilidad — verificación local

Ciclo del 14 de noviembre de 2026, Node 24, Vite 6.4.6. Base comparada: commit `63b1ed9`. Las medidas son tamaños del build local, no tiempos de producción ni una prueba de red móvil real.

## Cambios

- EPs y moderación se importan al entrar a esas secciones. Cada sección tiene espera accesible y un límite de errores: si falla el chunk, muestra una acción de recarga y mantiene disponibles navegación y reproductor. La recarga es explícita y reinicia el estado local de la página.
- Las portadas de listas usan carga diferida y decodificación asíncrona. Se conserva carga inmediata para portada grande y reproductor; el arte principal conserva su fuente original y recibe prioridad alta. La geometría cuadrada sigue controlada por los mismos estilos.
- La hoja de Google Fonts existente se declara en HTML, con conexiones anticipadas, en lugar de descubrirse mediante `@import` en CSS. Se conservan familias, pesos y `display=swap`; no se agregan proveedores.
- Búsquedas, filtros, campo de tema de prueba y cierre de cola tienen nombres accesibles explícitos. `prefers-reduced-motion: reduce` desactiva el desplazamiento suave. El foro sigue siendo demostración local.

## Medidas

| Artefacto | Antes | Después |
| --- | ---: | ---: |
| JavaScript de entrada | 234.599 bytes | 229.651 bytes |
| Entrada gzip (reporte Vite) | 73,37 KB | 72,19 KB |
| Chunk EP, al abrir | incluido en entrada | 2.559 bytes |
| Chunk moderación, al abrir | incluido en entrada | 4.881 bytes |
| Arte aprobado | 69.852 bytes | sin cambios |

La reducción inicial es pequeña, aproximadamente 2,1% sin comprimir; dividir chunks añade algo de código total. No se afirma una mejora medida de LCP o latencia. La mayor utilidad para catálogos futuros es evitar descargar portadas lejanas y módulos de secciones que el visitante no abre.

## Evidencia y límites

`tests/browser/deferred-panels.test.mjs` usa `vite preview` contra el build emitido. Verifica escritorio y móvil: módulos y APIs de EP/moderación ausentes antes de navegar, carga al entrar, recuperación de un chunk fallido mediante recarga, navegación fuera de una descarga pendiente sin iniciar lecturas posteriores, imágenes lejanas que se descargan al desplazar y controles accesibles con movimiento reducido.

Las capturas de inicio a 1440×1000 y 390×844, con los mismos datos y fuentes externas interceptadas, coinciden píxel por píxel antes/después de la optimización. Esta comparación local con fuentes de respaldo no sustituye revisión con Google Fonts reales, lector de pantalla, Safari físico ni medición en producción. No se editaron los bytes del arte ni las reglas visuales aprobadas.

Ejecutar `npm run build` antes de `npm run test:browser`: la suite combina Vite de desarrollo y preview del build. Todo usa APIs interceptadas y datos sintéticos; no activa registros, subidas, servicios ni despliegues.
