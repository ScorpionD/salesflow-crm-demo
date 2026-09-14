#!/bin/sh
set -eu
cd /opt/salesflow-crm-demo
docker exec -i salesflow-crm-db-1 psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
SELECT 'CREATE DATABASE salesflow_test' WHERE NOT EXISTS(SELECT 1 FROM pg_database WHERE datname='salesflow_test')\gexec
SQL
docker exec -i salesflow-crm-db-1 psql -v ON_ERROR_STOP=1 -U postgres -d salesflow_test < server/schema.sql
docker exec -i salesflow-crm-db-1 psql -v ON_ERROR_STOP=1 -U postgres -d salesflow_test < db/grants.sql
docker build --target test -t salesflow-crm-tests .
docker run --rm --network salesflow-crm_database --env-file secrets/test-client.env --memory 768m --cpus 1 salesflow-crm-tests npm test
