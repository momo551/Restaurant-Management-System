import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    help = 'Wait for database to be ready'

    def handle(self, *args, **options):
        self.stdout.write('Waiting for database...')
        db_conn = None
        attempts = 0
        while not db_conn and attempts < 30:
            try:
                db_conn = connections['default']
                db_conn.ensure_connection()
                self.stdout.write(self.style.SUCCESS('Database ready!'))
                return
            except OperationalError:
                attempts += 1
                self.stdout.write(f'Attempt {attempts}/30 — not ready, retrying in 3s...')
                time.sleep(3)
        self.stdout.write(self.style.ERROR('Database unavailable after 30 attempts. Exiting.'))
        raise SystemExit(1)