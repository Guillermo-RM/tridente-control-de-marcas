# Prioridad 1: identidad y aislamiento

## Alcance implementado

- Autenticación con correo y contraseña mediante Supabase Auth.
- Registro público deshabilitado en la configuración local; la aplicación no expone una ruta de registro.
- Perfiles con roles cerrados `master` y `worker`.
- Toda autorización crítica vuelve a comprobarse en el servidor.
- Acceso del `master` con nickname y contraseña; MFA no es obligatorio por decisión del cliente.
- Aislamiento por organización mediante Row Level Security (RLS).
- Auditoría de inicio y cierre de sesión con usuario, IP y agente del dispositivo.
- Límite atómico de intentos: cuatro intentos fallidos y bloqueo al quinto por 15 minutos.
- Redirecciones de autenticación validadas para evitar destinos externos.
- Separación explícita de secretos públicos y secretos exclusivos del servidor.

## Modelo inicial

`organizations` representa al cliente/empresa que opera Tridente. Un perfil siempre
pertenece a una organización. Los condominios se agregarán debajo de esta capa en
la prioridad 2; así un `master` podrá administrar varios condominios sin mezclar
datos con otra organización.

Las mutaciones directas de `organizations`, `profiles` y `audit_logs` están
revocadas para navegadores. Las futuras operaciones CRUD se harán mediante
acciones de servidor con validación, autorización y auditoría.

## Límites de confianza

- La interfaz nunca decide el rol; lo obtiene de `profiles` después de validar al usuario.
- `proxy.ts` refresca cookies, pero no sustituye las comprobaciones de cada página o acción.
- La clave `SUPABASE_SERVICE_ROLE_KEY` solo puede existir en el servidor.
- La IP se toma de las cabeceras del proxy de despliegue. No debe usarse como identidad.
- RLS exige sesión autenticada, rol `master` activo y pertenencia a la misma organización.

## Pendiente antes de producción

1. Crear tres proyectos separados: desarrollo, staging y producción.
2. Vincular Vercel y Supabase por entorno.
3. Aplicar la migración en desarrollo y comprobar sus políticas antes de promoverla.
4. Deshabilitar el registro público también en el panel remoto de Supabase Auth.
5. Crear el primer usuario Auth y su fila `profiles` mediante un procedimiento administrativo.
6. Configurar dominio, redirect URLs, backups y alertas.

La migración no se ejecutó porque no existe todavía un proyecto remoto vinculado.
