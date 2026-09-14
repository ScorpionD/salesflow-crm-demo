#!/bin/sh
set -eu
cd /opt/salesflow-crm-demo
C=/opt/fullstack-api-dashboard-demo/tools/docker-compose-linux-x86_64
$C --env-file runtime.env -f compose.yaml -f compose.production.yaml build api
$C --env-file runtime.env -f compose.yaml -f compose.production.yaml up -d db
for i in 1 2 3 4 5 6 7 8 9 10; do docker exec salesflow-crm-db-1 pg_isready -U postgres -d salesflow >/dev/null 2>&1 && break; sleep 2; done
docker exec -i salesflow-crm-db-1 psql -v ON_ERROR_STOP=1 -U postgres -d salesflow < server/schema.sql
docker exec -i salesflow-crm-db-1 psql -v ON_ERROR_STOP=1 -U postgres -d salesflow < db/grants.sql
$C --env-file runtime.env -f compose.yaml -f compose.production.yaml up -d api n8n tunnel
docker ps --filter name=salesflow-crm --format '{{.Names}} {{.Status}}'
