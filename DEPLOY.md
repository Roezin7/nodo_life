# Despliegue y recuperación

Recurso existente Coolify NODO Vida, repositorio Roezin7/nodo_life, main, Dockerfile raíz, puerto4000. Necesita los montajes y variables descritos en README. No reactivar PostgreSQL ni ejecutar comandos Prisma antiguos.

Archivo anterior del volumen: /opt/nodo-vida/legacy/postgres-original.tar, privado del host. Código anterior: commit9be2291. Configuración Coolify anterior respaldada privadamente antes de modificarla. Revertir exige volver al código/configuración anteriores de forma coordinada; no conectar el código antiguo a la base canónica.

No hacer rollback del archivo SQLite para revertir una interfaz: perdería registros añadidos desde el chat. Hacer respaldo consistente de la base antes de intervenir. Claves no forman parte del repositorio ni de la imagen.
