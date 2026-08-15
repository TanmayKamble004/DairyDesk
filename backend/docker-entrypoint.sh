#!/bin/sh
# Container startup: wait for Postgres, apply migrations, seed an empty DB.
# Must keep LF line endings — see .gitattributes.
set -e

# compose's `depends_on: service_healthy` already covers this, but retry anyway
# so a bare `docker run` against an external database still works.
until python -c "import socket, os; socket.create_connection((os.environ.get('DB_HOST', 'db'), int(os.environ.get('DB_PORT', '5432'))), 2)" 2>/dev/null; do
  echo "Waiting for Postgres at ${DB_HOST:-db}:${DB_PORT:-5432}..."
  sleep 1
done

python manage.py migrate --noinput

# seed_demo clears its tables, so only run it on a genuinely empty database —
# a restart must never destroy data a teammate entered.
if [ "${SEED_DEMO:-true}" = "true" ]; then
  HAS_USERS=$(python manage.py shell -c "from django.contrib.auth import get_user_model; print(get_user_model().objects.exists())")
  if [ "$HAS_USERS" != "True" ]; then
    python manage.py seed_demo
  else
    echo "Users already present - skipping seed_demo."
  fi
fi

exec "$@"
