#!/usr/bin/env python3
"""
RSS2Mail WebUI Backend - FastAPI Server
"""

import os
import sys
import smtplib
import logging
from email.mime.text import MIMEText
from typing import Optional, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
import feedparser

# Configure logging so scheduler output is visible
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, PROJECT_ROOT)
import rss2mail as rssmod
import db

# Optional Messenger support
try:
    import withimg
    MESSENGER_AVAILABLE = True
except ImportError:
    MESSENGER_AVAILABLE = False
    withimg = None

# Initialize DB (creates tables + seeds from config files on first run)
db.init_db()

logger = logging.getLogger("rss2mail.scheduler")

_scheduler = BackgroundScheduler()


def _scheduled_check_all():
    logger.info("[SCHEDULER] Running scheduled check for all feeds...")
    try:
        feeds = db.get_feeds()
        logger.info("[SCHEDULER] Found %d feeds to check", len(feeds))
        if not feeds:
            logger.info("[SCHEDULER] No feeds configured, skipping")
            return

        opts = CheckOptions(send_email=True, send_messenger=None, max_items=5)
        for f in feeds:
            try:
                result = _do_check(f["id"], f["name"], f["url"], opts)
                logger.info("[SCHEDULER] Checked '%s': %s (%d items)", f["name"], result.get("status"), result.get("items_count", 0))
            except Exception as e:
                logger.error("[SCHEDULER] Error checking '%s': %s", f["name"], e, exc_info=True)
        logger.info("[SCHEDULER] Scheduled check completed")
    except Exception as e:
        logger.error("[SCHEDULER] Fatal error in scheduled check: %s", e, exc_info=True)


def _reschedule(interval_minutes: int):
    """Replace the running job with a new interval. Safe to call at any time."""
    if _scheduler.get_job("check_all"):
        _scheduler.remove_job("check_all")
    _scheduler.add_job(
        _scheduled_check_all,
        trigger="interval",
        minutes=interval_minutes,
        id="check_all",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Interval set to %d minute(s)", interval_minutes)


@asynccontextmanager
async def lifespan(app: FastAPI):
    interval = db.get_settings().get("send_interval", 15)
    _reschedule(int(interval))
    _scheduler.start()
    logger.info("Scheduler started")
    yield
    _scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")


app = FastAPI(title="RSS2Mail API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class AddFeedRequest(BaseModel):
    name: Optional[str] = None
    url: str

class SettingsUpdate(BaseModel):
    email: Optional[str] = None
    app_password: Optional[str] = None
    messenger_enabled: Optional[bool] = None
    messenger_page_token: Optional[str] = None
    messenger_recipient_id: Optional[str] = None
    send_interval: Optional[int] = None

class CheckOptions(BaseModel):
    max_items: int = 5
    send_email: bool = True
    send_messenger: Optional[bool] = None  # None = use DB setting

# ─── Helper ───────────────────────────────────────────────────────────────────

def _should_send_messenger(override: Optional[bool]) -> bool:
    if override is not None:
        return override
    return db.get_settings().get("messenger_enabled", False)

def _do_check(feed_id: int, name: str, url: str, opts: CheckOptions) -> dict:
    feed_title = rssmod.get_feed_title(url) or name
    feed_obj = feedparser.parse(url)
    processed = set()
    items = []
    cover_image = None

    if 'image' in feed_obj.feed:
        cover_image = feed_obj.feed.image.get('url')

    for entry in feed_obj.entries[:opts.max_items]:
        link = entry.link
        if db.is_processed(link):
            continue
        items.append((entry.title, link, entry.get("published", "")))

    if not items:
        db.save_check_result(feed_id, feed_title, "no_new_items", 0)
        return {"feed": feed_title, "status": "no_new_items", "items_count": 0}

    try:
        if opts.send_email:
            rssmod.send_email(feed_title, items, cover_image)
        if _should_send_messenger(opts.send_messenger) and MESSENGER_AVAILABLE and withimg:
            withimg.send_items_to_messenger(feed_title, items, cover_image)
        for _, link, _ in items:
            db.mark_processed(link, feed_title)
        db.update_feed_last_sent(feed_id)
        db.save_check_result(feed_id, feed_title, "sent", len(items))
        db.add_log(f"Checked '{feed_title}': {len(items)} new item(s) sent")
        return {"feed": feed_title, "status": "sent", "items_count": len(items)}
    except Exception as e:
        db.save_check_result(feed_id, feed_title, "error", 0, str(e))
        db.add_log(f"Error checking '{feed_title}': {e}")
        return {"feed": feed_title, "status": "error", "error": str(e)}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_cover(feed_obj) -> str | None:
    if hasattr(feed_obj, 'feed') and 'image' in feed_obj.feed:
        return feed_obj.feed.image.get('url')
    return None


# ─── Feeds ────────────────────────────────────────────────────────────────────

@app.get("/api/feeds")
def get_feeds():
    feeds = db.get_feeds()
    # Backfill cover_url for feeds missing it (runs once per feed)
    for feed in feeds:
        if not feed.get("cover_url"):
            try:
                cover = _extract_cover(feedparser.parse(feed["url"]))
                if cover:
                    db.update_feed_cover(feed["id"], cover)
                    feed["cover_url"] = cover
            except Exception:
                pass
    return {"feeds": feeds}


@app.post("/api/feeds")
def add_feed(body: AddFeedRequest):
    url = body.url.strip()
    name = (body.name or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    feed_data = feedparser.parse(url)
    if not feed_data.entries and not feed_data.feed:
        raise HTTPException(status_code=400, detail="Invalid or unreachable RSS feed URL")
    if not name:
        name = feed_data.feed.get("title", "") or rssmod.get_feed_title(url) or ""
        if not name:
            raise HTTPException(status_code=400, detail="Could not extract title. Please provide a name.")
    cover_url = _extract_cover(feed_data)
    feed = db.add_feed(name, url, cover_url)
    db.add_log(f"Feed added: {name}")
    return {"success": True, "message": f"Feed added: {name}", "feed": feed}


@app.get("/api/feeds/{feed_id}/details")
def get_feed_details(feed_id: int):
    feed = db.get_feed_by_id(feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    try:
        parsed = feedparser.parse(feed["url"])
        cover_url = _extract_cover(parsed)
        items = []
        for entry in parsed.entries:
            link = entry.get("link", "")
            items.append({
                "title": entry.get("title", ""),
                "link": link,
                "pub_date": entry.get("published", ""),
                "processed": db.is_processed(link),
            })
        return {
            "id": feed["id"],
            "name": feed["name"],
            "url": feed["url"],
            "cover_url": cover_url or feed.get("cover_url"),
            "last_sent_at": feed.get("last_sent_at"),
            "description": parsed.feed.get("description", ""),
            "series_link": parsed.feed.get("link", ""),
            "last_build_date": parsed.feed.get("updated", ""),
            "total_items": len(items),
            "items": items,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/feeds/{feed_id}")
def remove_feed(feed_id: int):
    feed = db.get_feed_by_id(feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    db.remove_feed(feed_id)
    db.add_log(f"Feed removed: {feed['name']}")
    return {"success": True, "message": f"Feed removed: {feed['name']}"}


# ─── Check ────────────────────────────────────────────────────────────────────

@app.post("/api/check")
def check_all_feeds(opts: CheckOptions = None):
    if opts is None:
        opts = CheckOptions()
    feeds = db.get_feeds()
    results = [_do_check(f["id"], f["name"], f["url"], opts) for f in feeds]
    return {"results": results}


@app.post("/api/check/{feed_id}")
def check_single_feed(feed_id: int, opts: CheckOptions = None):
    if opts is None:
        opts = CheckOptions()
    feed = db.get_feed_by_id(feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    return _do_check(feed["id"], feed["name"], feed["url"], opts)


# ─── Reset ────────────────────────────────────────────────────────────────────

@app.post("/api/reset")
def reset_processed():
    db.reset_processed()
    db.add_log("Processed items reset")
    return {"success": True, "message": "Processed items reset successfully"}


# ─── Last check ───────────────────────────────────────────────────────────────

@app.get("/api/last-check")
def get_last_check():
    return {
        "results": db.get_last_check_results(),
        "last_check_time": db.get_last_check_time(),
    }


# ─── Scheduler status (for debugging) ─────────────────────────────────────────

@app.get("/api/scheduler/status")
def scheduler_status():
    job = _scheduler.get_job("check_all")
    if job:
        return {
            "running": _scheduler.running,
            "interval_minutes": int((job.trigger.interval.total_seconds() / 60)) if hasattr(job.trigger, 'interval') else None,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        }
    return {"running": _scheduler.running, "interval_minutes": None, "next_run": None}


# ─── Settings ─────────────────────────────────────────────────────────────────

@app.get("/api/settings")
def get_settings():
    return db.get_settings()


@app.post("/api/settings")
def update_settings(body: SettingsUpdate):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    db.update_settings(data)
    db.add_log("Settings updated")
    if "send_interval" in data:
        _reschedule(int(data["send_interval"]))
    return {"success": True, "message": "Settings updated successfully"}


# ─── Test email ───────────────────────────────────────────────────────────────

@app.post("/api/test/email")
def test_email():
    settings = db.get_settings()
    email = settings.get("email", "")
    password = settings.get("app_password", "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email credentials not configured")
    try:
        msg = MIMEText("This is a test email from RSS2Mail WebUI.")
        msg["Subject"] = "RSS2Mail Test Email"
        msg["From"] = email
        msg["To"] = email
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(email, password)
            server.sendmail(email, email, msg.as_string())
        return {"success": True, "message": "Test email sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Logs ─────────────────────────────────────────────────────────────────────

@app.get("/api/logs")
def get_logs():
    return {"logs": db.get_logs(100)}


# ─── SPA Fallback ─────────────────────────────────────────────────────────────

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        index = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)

