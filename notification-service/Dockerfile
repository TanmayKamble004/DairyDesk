# The DairyDesk Notification Microservice.
#
# Same Python as the backend so the two stay in step, but that is the only thing
# they share: no Django, no DRF, no database driver. If this image needs one of
# those later, something has gone wrong with the separation.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Its own database lives here, mounted as a named volume so dedup and cooldown
# state survives a restart. Without that, a restart re-sends every alert it has
# already handled.
RUN mkdir -p /data
VOLUME ["/data"]

# -m, so the package-relative imports in app/ resolve.
CMD ["python", "-m", "app.main"]
