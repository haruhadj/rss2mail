# messenger.py
import os
import requests
import time
from math import ceil

# Import your rss functions (safe because rss2mail.py has "if __name__ == '__main__': main()" guard)
import rss2mail as rssmod

# Try to read from config.credentials if it exists, else use env vars
try:
    from config import credentials as conf_credentials
except Exception:
    conf_credentials = None

def _get_page_token():
    if conf_credentials and hasattr(conf_credentials, "MESSENGER_PAGE_ACCESS_TOKEN"):
        return getattr(conf_credentials, "MESSENGER_PAGE_ACCESS_TOKEN")
    return os.getenv("PAGE_ACCESS_TOKEN") or os.getenv("MESSENGER_PAGE_ACCESS_TOKEN")

def _get_recipient_id():
    if conf_credentials and hasattr(conf_credentials, "MESSENGER_RECIPIENT_ID"):
        return getattr(conf_credentials, "MESSENGER_RECIPIENT_ID")
    return os.getenv("MESSENGER_RECIPIENT_ID") or os.getenv("RECIPIENT_ID")

GRAPH_API_URL = "https://graph.facebook.com/v23.0/me/messages"

# Messenger send helper
def _send_payload(page_token, payload, timeout=10):
    url = f"{GRAPH_API_URL}?access_token={page_token}"
    try:
        r = requests.post(url, json=payload, timeout=timeout)
        return r.status_code, r.json() if r.content else {}
    except Exception as e:
        return None, {"error": str(e)}

def chunk_text(text, max_chars=1500):
    """Split long text into chunks safe for Messenger (simple split by words)."""
    if len(text) <= max_chars:
        return [text]
    words = text.split()
    chunks = []
    cur = []
    cur_len = 0
    for w in words:
        if cur_len + len(w) + 1 > max_chars:
            chunks.append(" ".join(cur))
            cur = [w]
            cur_len = len(w) + 1
        else:
            cur.append(w)
            cur_len += len(w) + 1
    if cur:
        chunks.append(" ".join(cur))
    return chunks

def send_items_to_messenger(feed_title, items, cover_image_url=None, page_token=None, recipient_id=None):
    """
    Combines all new items from one feed into a single Messenger message,
    and sends the cover image once at the end.
    """
    page_token = page_token or _get_page_token()
    recipient_id = recipient_id or _get_recipient_id()

    if not page_token or not recipient_id:
        print("?? Missing PAGE_ACCESS_TOKEN or RECIPIENT_ID. Set config.credentials or environment variables.")
        return False

    # ?? Build combined text message
    message_lines = [f"?? {feed_title} - New Updates:"]
    for i, (title, link, pub_date) in enumerate(items, start=1):
        formatted_date = rssmod.format_pub_date(pub_date)
        message_lines.append(f"\n{i}. {title}\n{link}\n?? {formatted_date}")

    message_text = "\n".join(message_lines)

    # Split into chunks if too long
    chunks = chunk_text(message_text, max_chars=1500)
    all_ok = True

    # ?? Send combined text message
    for chunk in chunks:
        payload = {
            "messaging_type": "MESSAGE_TAG",
            "tag": "ACCOUNT_UPDATE",
            "recipient": {"id": recipient_id},
            "message": {"text": chunk}
        }
        status, data = _send_payload(page_token, payload)
        if status != 200 or ("error" in data):
            print("?? Messenger send failed:", status, data)
            all_ok = False
            break
        time.sleep(0.3)

    # ??? Send cover image only once (if provided and text succeeded)
    if all_ok and cover_image_url:
        img_payload = {
            "messaging_type": "MESSAGE_TAG",
            "tag": "ACCOUNT_UPDATE",
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "image",
                    "payload": {"url": cover_image_url, "is_reusable": True}
                }
            }
        }
        status, data = _send_payload(page_token, img_payload)
        if status != 200 or ("error" in data):
            print("?? Image send failed:", status, data)
            all_ok = False
        else:
            time.sleep(0.3)

    return all_ok

def send_all_feeds(max_items=5, page_token=None, recipient_id=None):
    """
    Iterate over feeds.FEEDS defined in config.feeds and send new items to Messenger.
    Reuses rssmod.fetch_rss_feed and rssmod.mark_as_processed.
    """
    try:
        from config import feeds as cfg_feeds
    except Exception as e:
        print("?? Could not import config.feeds:", e)
        return

    page_token = page_token or _get_page_token()
    recipient_id = recipient_id or _get_recipient_id()
    if not page_token or not recipient_id:
        print("?? Missing PAGE_ACCESS_TOKEN or RECIPIENT_ID. Set config.credentials or environment variables.")
        return

    for name, url in cfg_feeds.FEEDS:
        feed_title = rssmod.get_feed_title(url) or name
        items, cover_image = rssmod.fetch_rss_feed(url, max_items)
        if not items:
            print(f"No new items for {feed_title}")
            continue

        print(f"Found {len(items)} new items for {feed_title} - sending to Messenger...")
        success = send_items_to_messenger(feed_title, items, cover_image, page_token, recipient_id)
        if success:
            # mark each item processed
            for _, link, _ in items:
                rssmod.mark_as_processed(link, feed_title)
            print(f"? Sent and marked {len(items)} items for {feed_title}")
        else:
            print(f"? Failed to send items for {feed_title}; leaving them unprocessed for retry.")
