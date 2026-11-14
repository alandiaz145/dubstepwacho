# Respaldo previo a migraciones D1

Estado: procedimiento preparado, **respaldo productivo todavía no obtenido ni verificado**. El entorno actual no tiene credenciales Cloudflare ni Wrangler. El bookmark Time Travel registrado antes no sustituye una copia independiente.

## Exportación por un operador autorizado

1. Confirmar cuenta y base exactas: `dubstepwacho-db`. Mantener cuentas y subidas cerradas y no ejecutar migraciones durante la captura. Usar una credencial temporal con el mínimo permiso que admita exportación; no conceder despliegues ni pegar el token en Git, comandos, chat o logs.
2. En un equipo autorizado, configurar la credencial mediante su mecanismo seguro y ejecutar Wrangler con una versión fijada y revisada. El comando de exportación, **no ejecutado en este ciclo**, es:

   ```bash
   wrangler d1 export dubstepwacho-db --remote --output /ruta/privada/dubstepwacho-pre-migrations.sql
   ```

   Esto solicita una exportación; no aplicar `d1 migrations apply` ni ejecutar SQL de escritura en la base remota. Verificar previamente permisos, cuenta y límites de la operación.
3. Guardar fuera del repositorio la fecha UTC, identidad de base/cuenta y recuentos de la captura coherente. Para el esquema previo a 0003–0006, comparar al menos `users`, `sessions`, `auth_attempts`, `artist_profiles`, `tracks` y `moderation_events`. Si existen otras tablas, cotejarlas también. No guardar registros, correos, contraseñas, tokens o URLs firmadas en el informe público.
4. Guardar una segunda copia en almacenamiento independiente y privado ya disponible, preferentemente cifrado y fuera de este equipo. No crear servicios pagos. Volver a descargar esa copia y comparar su SHA-256 con el original; dos rutas del mismo disco no demuestran independencia.

## Restauración de prueba local

El verificador requiere el Node.js 24 utilizado por el proyecto (probado con 24.22.1, con `DatabaseSync.setAuthorizer`). Recibe un SQL propio de D1 y opcionalmente un JSON de recuentos capturados de forma independiente:

```json
{"users":0,"sessions":0,"auth_attempts":0,"artist_profiles":0,"tracks":0,"moderation_events":0}
```

**Los ceros son sólo un ejemplo; no son los recuentos productivos.** Ejecutar contra la copia recuperada del almacenamiento independiente:

```bash
npm run verify:backup -- /ruta/privada/copia-recuperada.sql /ruta/privada/recuentos.json
```

El script restaura únicamente en memoria; no tiene cliente Cloudflare ni ejecuta migraciones. Comprueba esquema base requerido, transacción cerrada, `integrity_check`, claves foráneas y recuentos proporcionados. Restringe ATTACH/DETACH, extensiones, triggers, tablas virtuales y pragmas peligrosos. Informa hash, tamaño y recuentos, nunca filas. Sólo usar exports propios de confianza; no es un servicio público para procesar SQL arbitrario. El límite de entrada es 128 MiB.

`scope: local-restore-only` significa precisamente eso: no acredita el origen del archivo, la consistencia respecto de un snapshot remoto ni la independencia del almacenamiento. Sin JSON de recuentos, `comparedExpectedCounts` es falso. El verificador valida el esquema base de seis tablas; revisar por separado cualquier tabla adicional del export.

## Evidencia mínima antes de considerar una migración

- Exportación SQL completa de la base y cuenta correctas, con fecha y snapshot identificado.
- Copia independiente recuperable, acceso protegido y SHA-256 coincidente tras recuperarla.
- Restauración local correcta, esquema y recuentos cotejados, sin datos privados en el reporte del PR.
- Procedimiento de restauración y operador responsable identificados.
- Revisión humana del plan y de las migraciones 0003–0006; mantener las banderas apagadas.

No interpretar el éxito del script ni las pruebas sintéticas como autorización de migración o respaldo productivo completado.
