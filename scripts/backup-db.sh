#!/usr/bin/env bash
# Dump Postgres and upload to the backups bucket. Requires AWS CLI + pg_dump.
set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-staging}"
BUCKET="${BACKUP_BUCKET:-mugheer-${ENVIRONMENT}-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="mugheer-${ENVIRONMENT}-${STAMP}.sql.gz"

echo "Dumping database..."
pg_dump "${DATABASE_URL:?DATABASE_URL required}" --no-owner --no-privileges | gzip > "/tmp/${FILE}"

echo "Uploading to s3://${BUCKET}/db/${FILE}"
aws s3 cp "/tmp/${FILE}" "s3://${BUCKET}/db/${FILE}" --sse AES256
rm -f "/tmp/${FILE}"

echo "Backup complete: ${FILE}"
