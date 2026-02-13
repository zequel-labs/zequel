#!/bin/bash
# SQL Server Docker entrypoint that starts the server and runs init.sql

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Forward signals to SQL Server for graceful shutdown
trap 'kill -TERM $SQLPID 2>/dev/null; wait $SQLPID' SIGTERM SIGINT

# Start SQL Server in background
/opt/mssql/bin/sqlservr &
SQLPID=$!

# Wait for SQL Server to be ready
log "Waiting for SQL Server to start..."
for i in {1..60}; do
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "SELECT 1" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    log "SQL Server is ready."
    break
  fi
  sleep 1
done

# Create zequel database (idempotent)
log "Creating zequel database..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q \
  "IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'zequel') CREATE DATABASE zequel"

# Run init script
log "Running init.sql..."
if /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -d zequel -i /init.sql; then
  log "SQL Server initialization complete."
else
  log "WARNING: init.sql exited with errors (seed data may be incomplete)."
fi

# Keep container running (forward signals)
wait $SQLPID
