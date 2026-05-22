import os
import sqlite3
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("RSS2MAIL_DB_PATH", os.path.join(SCRIPT_DIR, "rss2mail.db"))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Create tables and seed from config files if DB is new."""
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS feeds (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                name      TEXT NOT NULL,
                url       TEXT NOT NULL UNIQUE,
                cover_url TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS processed_items (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                link       TEXT NOT NULL UNIQUE,
                feed_title TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS logs (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                message    TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS last_check_results (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                feed_id     INTEGER,
                feed_name   TEXT NOT NULL,
                status      TEXT NOT NULL,
                items_count INTEGER DEFAULT 0,
                error       TEXT,
                checked_at  TEXT NOT NULL
            );
        """)

    # Safe migrations for existing DBs
    with get_conn() as conn:
        for migration in [
            "ALTER TABLE feeds ADD COLUMN cover_url TEXT",
            "ALTER TABLE feeds ADD COLUMN last_sent_at TEXT",
        ]:
            try:
                conn.execute(migration)
            except Exception:
                pass

    _seed_from_config()


def _seed_from_config():
    """Populate DB from config files on first run (idempotent)."""
    with get_conn() as conn:
        # Only seed if tables are empty
        feeds_empty = conn.execute("SELECT COUNT(*) FROM feeds").fetchone()[0] == 0
        settings_empty = conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0] == 0

        if feeds_empty:
            try:
                from config import feeds as cfg_feeds
                for name, url in cfg_feeds.FEEDS:
                    conn.execute(
                        "INSERT OR IGNORE INTO feeds (name, url) VALUES (?, ?)",
                        (name, url)
                    )
            except ImportError:
                pass

        if settings_empty:
            try:
                from config import credentials as cred
                from config import settings as cfg_settings
                defaults = {
                    "email": getattr(cred, "EMAIL", ""),
                    "app_password": getattr(cred, "APP_PASSWORD", ""),
                    "messenger_enabled": str(False),
                    "messenger_page_token": getattr(cred, "MESSENGER_PAGE_ACCESS_TOKEN", ""),
                    "messenger_recipient_id": getattr(cred, "MESSENGER_RECIPIENT_ID", ""),
                    "send_interval": str(getattr(cfg_settings, "SEND_INTERVAL", 15)),
                }
                # Auto-enable messenger if credentials exist
                if defaults["messenger_page_token"] or defaults["messenger_recipient_id"]:
                    defaults["messenger_enabled"] = str(True)
                for key, value in defaults.items():
                    conn.execute(
                        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                        (key, value)
                    )
            except ImportError:
                pass

    _seed_processed_items()


def _seed_processed_items():
    """Migrate processed_items.txt to DB on first run."""
    txt_path = os.path.join(SCRIPT_DIR, "config", "processed_items.txt")
    if not os.path.exists(txt_path):
        return
    with get_conn() as conn:
        already = conn.execute("SELECT COUNT(*) FROM processed_items").fetchone()[0]
        if already > 0:
            return
        try:
            with open(txt_path) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split(" - ", 2)
                    if len(parts) == 3:
                        ts, feed_title, link = parts
                    else:
                        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        feed_title = None
                        link = line
                    conn.execute(
                        "INSERT OR IGNORE INTO processed_items (link, feed_title, created_at) VALUES (?, ?, ?)",
                        (link, feed_title, ts)
                    )
        except Exception:
            pass


# ─── Feeds ───────────────────────────────────────────────────────────────────

def get_feeds():
    with get_conn() as conn:
        return [dict(row) for row in conn.execute("SELECT * FROM feeds ORDER BY id")]


def add_feed(name: str, url: str, cover_url: str = None) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO feeds (name, url, cover_url) VALUES (?, ?, ?)", (name, url, cover_url)
        )
        return {"id": cur.lastrowid, "name": name, "url": url, "cover_url": cover_url}


def update_feed_cover(feed_id: int, cover_url: str):
    with get_conn() as conn:
        conn.execute("UPDATE feeds SET cover_url = ? WHERE id = ?", (cover_url, feed_id))


def update_feed_last_sent(feed_id: int):
    with get_conn() as conn:
        conn.execute(
            "UPDATE feeds SET last_sent_at = ? WHERE id = ?",
            (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), feed_id)
        )


def remove_feed(feed_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM feeds WHERE id = ?", (feed_id,))
        return cur.rowcount > 0


def get_feed_by_id(feed_id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM feeds WHERE id = ?", (feed_id,)).fetchone()
        return dict(row) if row else None


# ─── Settings ─────────────────────────────────────────────────────────────────

def get_settings() -> dict:
    with get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        result = {row["key"]: row["value"] for row in rows}
    return {
        "email": result.get("email", ""),
        "app_password": result.get("app_password", ""),
        "messenger_enabled": result.get("messenger_enabled", "False") == "True",
        "messenger_page_token": result.get("messenger_page_token", ""),
        "messenger_recipient_id": result.get("messenger_recipient_id", ""),
        "send_interval": int(result.get("send_interval", 15)),
    }


def update_settings(data: dict):
    with get_conn() as conn:
        for key, value in data.items():
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, str(value))
            )


# ─── Processed items ──────────────────────────────────────────────────────────

def is_processed(link: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM processed_items WHERE link = ?", (link,)
        ).fetchone()
        return row is not None


def mark_processed(link: str, feed_title: str = None):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO processed_items (link, feed_title, created_at) VALUES (?, ?, ?)",
            (link, feed_title, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )


def reset_processed():
    with get_conn() as conn:
        conn.execute("DELETE FROM processed_items")


# ─── Last check results ───────────────────────────────────────────────────────

def save_check_result(feed_id: int, feed_name: str, status: str, items_count: int = 0, error: str = None):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO last_check_results (feed_id, feed_name, status, items_count, error, checked_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (feed_id, feed_name, status, items_count, error, now)
        )
        # Keep only the latest result per feed
        conn.execute(
            "DELETE FROM last_check_results WHERE feed_id = ? AND id NOT IN "
            "(SELECT id FROM last_check_results WHERE feed_id = ? ORDER BY id DESC LIMIT 1)",
            (feed_id, feed_id)
        )


def get_last_check_results() -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT feed_id, feed_name, status, items_count, error, checked_at "
            "FROM last_check_results ORDER BY checked_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]


def get_last_check_time() -> str | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT MAX(checked_at) as last FROM last_check_results"
        ).fetchone()
        return row["last"] if row else None


# ─── Logs ─────────────────────────────────────────────────────────────────────

def add_log(message: str):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO logs (message, created_at) VALUES (?, ?)",
            (message, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )


def get_logs(limit: int = 100) -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT created_at, message FROM logs ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [f"[{row['created_at']}] {row['message']}" for row in rows]
