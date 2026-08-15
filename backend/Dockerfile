# Development image for the DairyDesk Django API.
#
# Pinned to the same interpreter the project was built with so every teammate
# gets an identical Python regardless of what's installed on their machine.
# Debian slim (not Alpine) because psycopg[binary] ships glibc-only wheels.
FROM python:3.13-slim

# PYTHONDONTWRITEBYTECODE keeps __pycache__ out of the bind-mounted host tree.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Requirements first so dependency layers survive source edits.
# Nothing here needs a compiler or libpq, so there's no apt-get layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Invoked via `sh` rather than an exec bit, so a Windows checkout that loses
# the +x mode can't break startup.
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
