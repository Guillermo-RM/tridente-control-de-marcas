# Control de Rondas

Aplicación para administrar recorridos de seguridad en condominios. Permite que los oficiales registren puntos de control con códigos QR y reporten incidencias, mientras el personal administrador consulta la actividad por condominio y trabajador.

## Funciones

- Gestión de condominios, trabajadores asignados y puntos QR.
- Códigos QR firmados y versionados, con impresión y opción para vincular códigos existentes.
- Registro de marcas mediante cámara, con ubicación cuando está disponible.
- Reporte de incidencias con fotografía, ubicación y seguimiento de estado.
- Consulta filtrada de marcas e incidencias y exportación de reportes en CSV y PDF.
- Control de acceso por roles, políticas de seguridad por fila y registro de auditoría.

## Decisiones técnicas

La aplicación utiliza Next.js, React y TypeScript. Supabase aporta autenticación, PostgreSQL y almacenamiento privado para evidencias. Las operaciones sensibles se realizan en el servidor; las marcas se consultan por páginas y tienen una ventana de retención de seis meses. El acceso de los trabajadores se limita a sus funciones operativas.

## Pruebas

El repositorio incluye pruebas automatizadas para validación de datos, autenticación, paginación, fechas, ubicación y exportación de reportes. También dispone de análisis estático y comprobación de tipos.

