#!/bin/bash

# migrate:fresh — Drops all tables and lets the app re-run migrations on next start.
# Usage: npm run migrate:fresh

set -e

case "$(uname)" in
  Darwin) DB_DIR="$HOME/Library/Application Support/zequel" ;;
  Linux)  DB_DIR="$HOME/.config/zequel" ;;
  *)      echo "Unsupported platform: $(uname)"; exit 1 ;;
esac

DB_PATH="$DB_DIR/zequel-dev.db"

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found: $DB_PATH"
  exit 1
fi

echo "Dropping all tables in: $DB_PATH"

sqlite3 "$DB_PATH" "PRAGMA foreign_keys = OFF;"
sqlite3 "$DB_PATH" "SELECT 'DROP TABLE IF EXISTS \"' || name || '\";' FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" | sqlite3 "$DB_PATH"

echo "Done. All tables dropped."
echo "Start the app (npm run dev) to re-run all migrations."
