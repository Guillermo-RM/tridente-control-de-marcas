# Arquitectura de Tridente Control

## Jerarquía de datos

```text
organization
├── profiles (master / worker)
├── condominiums
│   ├── worker_assignments
│   └── checkpoints
└── scan_events
```

Una organización puede administrar múltiples condominios. Los trabajadores solo
pueden marcar puntos de condominios a los que estén asignados. Toda consulta o
mutación del backend incluye `organization_id` para evitar cruces entre clientes.

## Flujo de una marca

1. El trabajador inicia sesión.
2. La cámara lee una URL con un token HMAC firmado y versionado.
3. El navegador solicita geolocalización y envía token, coordenadas, precisión y
   hora del dispositivo.
4. El servidor vuelve a validar usuario, rol, organización, firma, versión del
   QR, estado del condominio, estado del punto y asignación del trabajador.
5. El servidor calcula distancia y toma la IP de la infraestructura de despliegue.
6. PostgreSQL serializa marcas coincidentes, rechaza duplicados de 60 segundos y
   guarda snapshots de nombres junto con la hora autoritativa del servidor.

La ubicación del cliente es evidencia operativa, no una garantía criptográfica.
Una marca sin permiso de ubicación se conserva como `unavailable`; una marca
lejana queda como `outside` para revisión.

## Borrado y retención

Condominios, trabajadores y QR se archivan en vez de eliminarse físicamente. Así
los eventos históricos mantienen sus referencias. Los nombres también se copian
en cada marca para conservar el significado aunque una entidad cambie.

Un Vercel Cron invoca diariamente `/api/cron/cleanup-history`. La ruta exige el
secreto `CRON_SECRET` y elimina marcas con más de seis meses, además de límites de
acceso obsoletos.

## Despliegue

- Aplicación: Vercel.
- PostgreSQL y Auth: Supabase mediante Vercel Marketplace.
- Entornos independientes: development, preview/staging y production.
- Cámara y geolocalización requieren HTTPS en dispositivos reales.

Las migraciones deben probarse primero en desarrollo, luego en staging y solo
después promoverse a producción. Los secretos deben ser distintos por entorno.
