#!/usr/bin/env bash
# Restores an encrypted backup into a NEW local database and prints a few
# counts, to prove a backup can actually be used. It never touches your dev
# database (money_mitra) or production.
#
#   ops/backups/restore.sh path/to/2026-11-16.dump.gpg
#
# gpg asks for the backup passphrase. Connects to the local Postgres on
# 127.0.0.1:5433 unless PGHOST / PGPORT say otherwise.
set -euo pipefail

file=${1:?Usage: ops/backups/restore.sh <YYYY-MM-DD.dump.gpg>}
[ -f "$file" ] || { echo "No such file: $file" >&2; exit 1; }

export PGHOST=${PGHOST:-127.0.0.1}
export PGPORT=${PGPORT:-5433}
pg_isready -q || { echo "Postgres is not running on $PGHOST:$PGPORT; start it first." >&2; exit 1; }
db="money_mitra_restore_$(basename "$file" .dump.gpg | tr -cd '0-9')"

if psql -d postgres -tAc "select 1 from pg_database where datname = '$db'" | grep -q 1; then
  echo "$db already exists. Remove it with: dropdb -h $PGHOST -p $PGPORT $db" >&2
  exit 1
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

gpg --quiet --decrypt --output "$tmp/db.dump" "$file"
createdb "$db"
pg_restore --no-owner --no-acl --exit-on-error --dbname="$db" "$tmp/db.dump"

psql -d "$db" -P footer=off -c '
  select
    (select count(*) from "User")             as users,
    (select count(*) from "Transaction")      as transactions,
    (select max("date")::date from "Transaction") as latest_entry,
    (select count(*) from "NetWorthItem")     as net_worth_items,
    (select count(*) from "Transfer")         as transfers,
    (select count(*) from "SharedGroup")      as shared_groups,
    (select count(*) from "Post")             as posts'
psql -d "$db" -tAc 'select '"'"'Latest migration: '"'"' || migration_name
  from _prisma_migrations order by finished_at desc nulls last limit 1'

echo
echo "Restored into $db. When you are done looking, remove it with:"
echo "  dropdb -h $PGHOST -p $PGPORT $db"
