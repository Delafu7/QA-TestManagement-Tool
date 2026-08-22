#!/usr/bin/env bash
# Respalda la base de datos SQLite del servicio `server` (docker compose) a un
# directorio del host, fuera del volumen Docker `sqlite-data`: así un
# `docker volume rm sqlite-data` accidental no destruye también las copias
# (docs/user-stories.md US-01).
#
# Usa server/scripts/backup.js dentro del contenedor para hacer una copia en
# caliente (segura con el servidor en marcha), la extrae al host con
# `docker compose cp` y aplica retención: conserva solo los BACKUP_RETENTION
# backups más recientes (por defecto 7).
#
# Uso manual: ./scripts/backup.sh
# Programado (crontab del host), diario a las 3am:
#   0 3 * * * cd /ruta/al/proyecto && ./scripts/backup.sh >> /var/log/qa-tool-backup.log 2>&1

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-7}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CONTAINER_TMP_PATH="/tmp/qa-tool-backup-${TIMESTAMP}.sqlite"
HOST_BACKUP_PATH="${BACKUP_DIR}/qa-tool-${TIMESTAMP}.sqlite"

cd "$PROJECT_ROOT"
mkdir -p "$BACKUP_DIR"

docker compose exec -T server node scripts/backup.js "$CONTAINER_TMP_PATH"
docker compose cp "server:${CONTAINER_TMP_PATH}" "$HOST_BACKUP_PATH"
docker compose exec -T server rm -f "$CONTAINER_TMP_PATH"

echo "Backup guardado en ${HOST_BACKUP_PATH}"

# Retención: conserva solo los BACKUP_RETENTION backups más recientes
mapfile -t existing_backups < <(ls -1t "${BACKUP_DIR}"/qa-tool-*.sqlite 2>/dev/null)
if [ "${#existing_backups[@]}" -gt "$BACKUP_RETENTION" ]; then
  for old_backup in "${existing_backups[@]:$BACKUP_RETENTION}"; do
    rm -f "$old_backup"
    echo "Eliminado backup antiguo: ${old_backup}"
  done
fi
