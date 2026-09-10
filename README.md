# Tridente Control 2

Nueva aplicación para administrar condominios, trabajadores y puntos de control
QR. Está construida con Next.js 16, React 19, TypeScript y PostgreSQL/Supabase.

## Funcionalidades implementadas

- login con nickname y contraseña, y cierre de sesión seguro;
- roles `master` y `worker`;
- páginas protegidas desde el servidor;
- organizaciones aisladas mediante RLS;
- auditoría de sesiones;
- rate limiting de intentos de acceso;
- configuración separada por entorno.
- CRUD con archivo lógico de condominios;
- creación, edición, asignación y archivo de trabajadores;
- creación, edición, impresión, rotación y archivo de puntos QR;
- QR firmados, versionados e invalidables;
- escáner de cámara y apertura directa del QR como enlace;
- registro de trabajador, IP, ubicación, precisión, distancia y hora del servidor;
- detección de marcas fuera de la zona configurada;
- prevención de duplicados durante 60 segundos;
- reporte administrativo filtrable; los trabajadores no pueden consultar historiales;
- exportación CSV segura;
- retención automática de seis meses;
- marcas compactas sin hora del cliente ni agente del navegador;
- vista de auditoría administrativa.

La configuración local usa Supabase mediante variables de entorno. Las
migraciones deben aplicarse en orden en cada entorno nuevo.

## Preparación local

1. Crea un proyecto de Supabase para desarrollo.
2. Copia `.env.example` como `.env.local` y completa sus valores.
3. En Supabase Auth deshabilita el registro público.
4. Vincula Supabase CLI al proyecto correcto.
5. Revisa y aplica las migraciones de `supabase/migrations` en orden.
   Incluye `0003_nickname_login.sql` para el acceso por nickname y `0005` para
   mantener el acceso maestro únicamente con contraseña. `0007` reduce el peso
   de las marcas y garantiza la ventana móvil de seis meses.
6. Completa temporalmente las variables `BOOTSTRAP_*` y ejecuta
   `npm run provision:master` para crear la primera organización y cuenta maestra.
7. Elimina inmediatamente las variables `BOOTSTRAP_*`.
8. Solo después inicia la aplicación con `npm run dev`.

No copies claves de producción a desarrollo o staging. La clave `service_role`
nunca debe llevar el prefijo `NEXT_PUBLIC_` ni exponerse en el navegador.
En Vercel configura `CRON_SECRET`; el cron diario completa la limpieza de marcas
de trabajadores que ya no registran actividad.

## Comandos de verificación

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

La arquitectura completa está en `docs/architecture/system.md`; los controles
fundacionales están documentados en `docs/architecture/priority-1.md`.

Los nicknames son globalmente únicos, de 3 a 32 caracteres, y se guardan en
minúsculas. El correo sigue siendo obligatorio para Auth y recuperación, pero no
se pide al iniciar sesión. Para el primer administrador configura también
`BOOTSTRAP_MASTER_NICKNAME`. La migración 0003 asigna a cuentas existentes un
nickname temporal `u_` seguido de 30 caracteres de su UUID sin guiones; consulta
`profiles.nickname` en Supabase y reemplázalo por el nickname deseado.

El servidor aplica el límite de intentos antes de resolver el nickname, obtiene
el correo actual desde Supabase Auth y verifica la contraseña con Auth. No existe
una ruta pública que exponga el correo asociado a un nickname.
