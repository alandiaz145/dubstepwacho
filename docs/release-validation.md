# Validaciones externas pendientes

Estado: pendiente. Las pruebas Chromium con WAV sintético y workerd local no acreditan Safari iPhone, entrega de correo ni operación productiva.

## Safari iPhone físico

Usar un entorno aislado autorizado y un MP3 cuyo titular haya autorizado expresamente la prueba. No publicar música inédita para completar este paso. Registrar dispositivo, versión de iOS/Safari, red, commit probado, identificador/hash del fixture y evidencia sin datos personales.

- Iniciar con un toque, pausar y reanudar; indicador coincidente con el audio real.
- Avanzar a distintos puntos del MP3 y comprobar respuestas 206, tiempos y continuidad.
- Siguiente/anterior, cola, repetición y radio con una sola pista y con varias.
- Cambiar rápidamente de pista; un fallo anterior no debe detener el indicador de la nueva.
- Simular indisponibilidad temporal y reintentar cuando vuelva el recurso.
- Interrupción por bloqueo de pantalla, cambio de aplicación o audio del sistema; comprobar pausa/reanudación conforme al comportamiento de iOS, sin prometer reproducción de fondo no verificada.
- Teclado/VoiceOver: nombres de controles, foco, formularios y estado de reproducción. Comprobar también orientación y tamaño de texto sin cambiar la identidad visual.

Resultado actual: **no ejecutado**, faltan dispositivo y MP3 autorizado.

## Correo y Turnstile

Antes de cuentas públicas: widget del dominio real, claves guardadas fuera de Git, remitente elegido/verificado y política de costos confirmada. En un entorno aislado probar registro → correo → confirmación → login, reenvío tras fallo, enlace vencido/usado, recuperación y revocación de sesiones. No activar proveedor pago ni banderas productivas para hacer la prueba. Registrar sólo resultados, nunca enlaces secretos ni credenciales.

Resultado actual: **pendiente** de configuración y decisiones externas. Los proveedores de las pruebas locales están interceptados.

## Escáner privado

Definir servicio aislado y presupuesto cero compatible o aprobar otra opción por separado. Probar permisos de lectura de cuarentena, análisis de audio y portada, hashes, fallo cerrado, archivo corrupto y EICAR de prueba sin publicar muestras ni enviar música inédita a terceros. Sólo después integrar el veredicto autenticado con moderación.

Resultado actual: **sin escáner conectado**. Las pruebas locales asignan un veredicto simulado exclusivamente a fixtures, sin endpoint público para concederlo.

## Producción y revisión

El manifiesto local `.openai/hosting.json` sirve para empaquetar el frontend sin asociarlo a ningún Site. No es una configuración de despliegue del backend Pages ni de sus bindings D1/R2. Una publicación futura necesita una identidad real y configuración revisada.

El PR requiere revisión humana antes de fusionar. El respaldo independiente y las migraciones pendientes se manejan según [el procedimiento D1](d1-backup-runbook.md); ningún check local autoriza por sí mismo una escritura productiva.
