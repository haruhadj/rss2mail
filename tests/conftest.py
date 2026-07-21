import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# Point db.py at an isolated sqlite file before rss2mail/db get imported anywhere,
# so tests never touch the real rss2mail.db or config/ files.
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["RSS2MAIL_DB_PATH"] = _tmp_db.name

import pytest
import db as db_module


@pytest.fixture
def clean_db():
    """Wipe all tables for tests that need a blank slate."""
    with db_module.get_conn() as conn:
        conn.execute("DELETE FROM feeds")
        conn.execute("DELETE FROM settings")
        conn.execute("DELETE FROM processed_items")
        conn.execute("DELETE FROM logs")
        conn.execute("DELETE FROM last_check_results")
    yield
