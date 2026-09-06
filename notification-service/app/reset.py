"""Wipe this service's delivery state, so every product can alert again.

    python -m app.reset            # clear cooldowns and processed event ids
    python -m app.reset --dry-run  # just report what is there

For demos and presentations. The cooldown and the processed-event table exist to
stop a supplier being emailed twice, which is exactly what you want in
production and exactly what gets in the way when you are showing the same
product alerting three times in ten minutes.

This only clears *this service's* half. The main application separately tracks
whether each product is already known to be low — clear that with
`manage.py reset_notifications` on the backend, or the producer will not emit a
second event at all.
"""
import argparse
import sqlite3
from datetime import datetime

from . import config


def _local(iso):
    """UTC timestamp as stored -> the container's local time, for reading.

    The store keeps UTC deliberately, because cooldown arithmetic across a
    daylight-saving boundary should not depend on where the service is running.
    This is display only.
    """
    try:
        return datetime.fromisoformat(iso).astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    except ValueError:
        return iso


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true", help="Report the state, change nothing."
    )
    args = parser.parse_args()

    connection = sqlite3.connect(config.STATE_DB_PATH)
    try:
        sends = connection.execute("SELECT COUNT(*) FROM sent_notifications").fetchone()[0]
        processed = connection.execute("SELECT COUNT(*) FROM processed_events").fetchone()[0]

        if args.dry_run:
            print(f"{sends} send record(s), {processed} processed event(s).")
            for row in connection.execute(
                "SELECT product_id, status, sent_at FROM sent_notifications "
                "WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 20"
            ):
                print(f"  product {row[0]} last really sent {_local(row[2])} (in cooldown)")
            return

        connection.execute("DELETE FROM sent_notifications")
        connection.execute("DELETE FROM processed_events")
        connection.commit()
        print(f"Cleared {sends} send record(s) and {processed} processed event(s).")
        print("Every product can alert again.")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
