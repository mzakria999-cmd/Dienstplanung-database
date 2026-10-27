#!/usr/bin/env bash
# Automatische Datenbanksicherung (pg_dump, komprimiert) mit Aufbewahrung.
# Beispiel-Cron (täglich 02:30):  30 2 * * * cd /opt/sdm && ./scripts/backup.sh >> backups/backup.log 2>&1
# Optional verschlüsselt: BACKUP_GPG_RECIPIENT=admin@firma.de
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL fehlt}"
DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
mkdir -p "$DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
FILE="$DIR/sdm_$STAMP.sql.gz"
pg_dump --no-owner --no-privileges "${DATABASE_URL%%\?*}" | gzip -9 > "$FILE"
if [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$FILE" && rm "$FILE"
  FILE="$FILE.gpg"
fi
find "$DIR" -name 'sdm_*.sql.gz*' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) Backup erstellt: $FILE ($(du -h "$FILE" | cut -f1))"
# Wiederherstellung: gunzip -c backups/sdm_<datum>.sql.gz | psql "$DATABASE_URL"
