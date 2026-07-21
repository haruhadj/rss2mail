"""Weebcentral series search, used by the WebUI's Add Feed > Discover tab.

Scrapes the site's own quick-search endpoint (the same one its search box
uses). robots.txt only disallows /users/*, so /search is not off-limits.
Markup is fragile by nature (small, unofficial HTML scrape) — every entry
point here fails soft (returns []) rather than raising, so a site redesign
degrades the feature instead of breaking the app.
"""

import re
import time

import requests
from bs4 import BeautifulSoup

SEARCH_URL = "https://weebcentral.com/search/simple"
REQUEST_TIMEOUT = 10
CACHE_TTL = 60  # seconds

_cache: dict[str, tuple[float, list[dict]]] = {}

_SERIES_URL_RE = re.compile(r"/series/([A-Za-z0-9]+)/")


def _extract_results(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    results = []
    for link in soup.find_all("a", href=True):
        match = _SERIES_URL_RE.search(link["href"])
        if not match:
            continue
        series_id = match.group(1)
        title_el = link.find("div", class_=re.compile("line-clamp"))
        title = title_el.get_text(strip=True) if title_el else link.get_text(strip=True)
        if not title:
            continue
        img = link.find("img")
        cover_url = img["src"] if img and img.get("src") else None
        results.append({
            "id": series_id,
            "title": title,
            "cover_url": cover_url,
            "feed_url": f"https://weebcentral.com/series/{series_id}/rss",
        })
    return results


def search_weebcentral(query: str) -> list[dict]:
    query = query.strip()
    if not query:
        return []

    cache_key = query.lower()
    cached = _cache.get(cache_key)
    if cached and time.time() - cached[0] < CACHE_TTL:
        return cached[1]

    try:
        response = requests.post(
            f"{SEARCH_URL}?location=main",
            data={"text": query},
            timeout=REQUEST_TIMEOUT,
            headers={"User-Agent": "Mozilla/5.0 (rss2mail feed discovery)"},
        )
        response.raise_for_status()
        results = _extract_results(response.text)
    except Exception:
        return []

    _cache[cache_key] = (time.time(), results)
    return results
