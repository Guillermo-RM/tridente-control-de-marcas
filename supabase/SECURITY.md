# Revisión de seguridad del SQL

Fecha: 2026-09-10. Alcance: migraciones 0001–0008; no certificación de toda la app.

## Aplicación en Supabase

Si todavía no ejecutaste las migraciones, abre cada archivo de `migrations/`, copia todo su contenido en una consulta nueva del SQL Editor y pulsa Run, en este orden:

1. `0001_priority_one_foundation.sql`
2. `0002_operations.sql`
3. `0003_nickname_login.sql`
4. `0004_security_hardening.sql`
5. `0005_remove_master_mfa_requirement.sql`
6. `0006_remove_worker_recovery_email.sql`
7. `0007_lightweight_scan_retention.sql`
8. `0008_master_only_scan_history.sql`

No vuelvas a ejecutar migraciones ya aplicadas: no son idempotentes. Usa el propietario de las migraciones (habitualmente postgres). Si existe información real, toma una copia de seguridad antes de migrar.

0007 elimina de las marcas las columnas `user_agent` y `client_scanned_at`, y borra físicamente las marcas con más de seis meses cuando se ejecuta la limpieza. Toma una copia de seguridad antes de aplicarla si necesitas conservar esos datos. 0008 retira a los trabajadores todo acceso de lectura al historial. No habilites la aplicación antes de completar las ocho migraciones.

Tras aplicar: revisar Security Advisor y probar login nickname/password, creación de trabajador/condominio/QR, asignación, escaneo e historial mediante la app real. Las relaciones compuestas también requieren comprobar las consultas anidadas de PostgREST.

## Cambios efectivos

- Revocación explícita de permisos de PUBLIC, anon, authenticated y service_role, seguida de concesiones mínimas compatibles con el backend actual.
- `authenticated` solo puede leer las filas autorizadas por RLS; no puede ejecutar RPC administrativas ni alterar su perfil.
- `service_role` conserva el CRUD administrativo necesario; solo puede leer marcas, registrar nuevas mediante RPC y purgar las antiguas mediante la función de retención. Auditorías: SELECT/INSERT, sin UPDATE/DELETE/TRUNCATE.
- Funciones privilegiadas con `search_path` fijo y ejecución restringida. Defaults más restrictivos para objetos nuevos del propietario de la migración. La revocación global del EXECUTE de PUBLIC afecta también futuras funciones de ese propietario en otros esquemas; otros propietarios requieren sus propios defaults.
- Relaciones compuestas impiden combinar trabajador, organización, condominio y checkpoint incompatibles en las marcas.
- Coordenadas en pareja, rangos válidos y límites para precisión, distancia y textos de las marcas.
- Organizaciones o perfiles desactivados pierden lectura autenticada y autorización de escaneo. La migración 0005 elimina el requisito AAL2 por decisión del cliente.
- La RPC comprueba asignación/estado bajo bloqueos de filas, calcula distancia/clasificación y registra la hora del servidor. Su firma reducida recibe solo los datos necesarios.
- Cada nueva marca elimina primero el historial vencido del trabajador. El cron diario elimina además registros antiguos de trabajadores que dejaron de marcar.
- Las marcas ya no almacenan agente de navegador ni hora declarada por el dispositivo; conservan únicamente identificadores, nombres históricos, IP, ubicación, precisión, distancia, clasificación y hora autoritativa del servidor.
- Solo el rol maestro puede leer marcas mediante RLS; los trabajadores únicamente pueden registrarlas a través de la API protegida.
- Rate limiter con rechazo explícito de NULL, límites de parámetros y exactamente N intentos permitidos antes del bloqueo.

## Cobertura frente a OWASP Top 10:2025

| Riesgo | Cobertura SQL y límite pendiente |
| --- | --- |
| A01 Control de acceso | RLS, ACL y FK compuestas probadas. El backend con service_role sigue siendo una frontera de confianza. |
| A02 Configuración | Permisos explícitos y defaults restrictivos. Falta validar configuración efectiva de Supabase y despliegue. |
| A03 Cadena de suministro | No se resuelve en SQL; requiere auditoría de dependencias, CI y procedencia de artefactos. |
| A04 Criptografía | Contraseñas delegadas a Supabase Auth. TLS, gestión/rotación de claves y backups quedan fuera de esta revisión. |
| A05 Inyección | RPC con argumentos tipados y SQL estático, sin concatenación de SQL dinámico. Falta revisión completa de entradas y salidas de la app. |
| A06 Diseño | Aislamiento, deduplicación y retención. Un QR copiado o GPS falsificado no demuestra presencia física. |
| A07 Autenticación | Login por contraseña y límites de intentos. Al eliminar MFA, una contraseña comprometida permite acceso maestro; faltan alertas de acceso. |
| A08 Integridad | Historial sin escrituras directas del backend y FK compuestas. Propietario de BD y RPC autorizadas conservan privilegios. |
| A09 Registro y alertas | Auditoría de solo anexado para service_role. Falta garantizar que cada operación se audite y alertar ante fallos. |
| A10 Excepciones | Parámetros inválidos rechazados y migración transaccional. Faltan pruebas de concurrencia/carga, fallos de red y manejo de errores HTTP. |

## Límites importantes

`service_role` omite RLS: la clave secreta debe permanecer exclusivamente en el servidor. Sus RPC administrativas no autentican por sí mismas al usuario final. El backend debe validar sesión, rol y organización antes de utilizarlas. La RPC de escaneo recibe el trabajador desde el backend; no verifica la firma/versión del QR, que siguen siendo responsabilidad de la app. IP, ubicación y hora del cliente no son evidencias infalsificables.

Las auditorías se insertan actualmente desde la app, fuera de una transacción común con cada operación, y su fallo no aborta necesariamente la operación: no se garantiza exhaustividad ni autenticidad frente a una clave de servidor comprometida. No hay alertas implementadas por esta migración.

RLS y las consultas del backend ocultan marcas de más de seis meses. La migración 0007 también las elimina al registrar una nueva marca del trabajador; `vercel.json` programa una limpieza global diaria mediante `/api/cron/cleanup-history` para trabajadores inactivos. El despliegue debe definir `CRON_SECRET` y supervisar la ejecución. La limpieza no está dividida en lotes y requiere evaluar particionamiento mensual si el volumen crece de forma excepcional.

## Verificación realizada

- Ocho migraciones ejecutadas en PostgreSQL embebido (PGlite), sin conexión a Supabase.
- 15 comprobaciones SQL aprobadas: permisos, RLS entre organizaciones, acceso maestro sin MFA, desactivaciones, coordenadas, FK, rate limiting, RPC, deduplicación, defaults y retención.
- 23 pruebas existentes de la aplicación aprobadas con `npm test`.
- Auth se simula mediante roles/claims; pgcrypto se sustituye únicamente en el test por una función UUID compatible. No valida la extensión, Supabase Auth real, REST, concurrencia entre conexiones ni configuración remota.

Para repetir: instalar `@electric-sql/pglite` en una carpeta temporal y ejecutar:

```text
node scripts/test-sql-security.mjs <ruta-absoluta-a-pglite/dist/index.js>
```

El test crea datos ficticios en memoria, no lee `.env.local` y no modifica Supabase.

Referencias: [OWASP Top 10:2025](https://owasp.org/Top10/2025/), [seguridad de funciones de Supabase](https://supabase.com/docs/guides/database/functions), [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
