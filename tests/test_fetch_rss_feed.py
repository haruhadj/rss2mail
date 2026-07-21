import db
import rss2mail


class FakeEntry:
    def __init__(self, title, link, published=""):
        self.title = title
        self.link = link
        self._published = published

    def get(self, key, default=""):
        return self._published if key == "published" else default


class AttrDict(dict):
    """Minimal stand-in for feedparser's FeedParserDict attribute access."""

    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name)


class FakeFeed:
    def __init__(self, entries, feed_dict=None):
        self.entries = entries
        feed_dict = feed_dict if feed_dict is not None else {}
        self.feed = AttrDict({
            k: (AttrDict(v) if isinstance(v, dict) else v) for k, v in feed_dict.items()
        })


def test_fetch_rss_feed_filters_already_processed(mocker, clean_db):
    db.mark_processed("http://example.com/1", "Feed")
    entries = [
        FakeEntry("Item1", "http://example.com/1"),
        FakeEntry("Item2", "http://example.com/2"),
    ]
    mocker.patch("rss2mail.feedparser.parse", return_value=FakeFeed(entries))

    items, cover_image_url = rss2mail.fetch_rss_feed("http://feed.example/rss")

    links = [link for _, link, _ in items]
    assert links == ["http://example.com/2"]
    assert cover_image_url is None


def test_fetch_rss_feed_respects_max_items(mocker, clean_db):
    entries = [FakeEntry(f"Item{i}", f"http://example.com/{i}") for i in range(10)]
    mocker.patch("rss2mail.feedparser.parse", return_value=FakeFeed(entries))

    items, _ = rss2mail.fetch_rss_feed("http://feed.example/rss", max_items=3)

    assert len(items) == 3


def test_fetch_rss_feed_extracts_cover_image(mocker, clean_db):
    feed_dict = {"image": {"url": "http://example.com/cover.jpg"}}
    mocker.patch("rss2mail.feedparser.parse", return_value=FakeFeed([], feed_dict))

    _, cover_image_url = rss2mail.fetch_rss_feed("http://feed.example/rss")

    assert cover_image_url == "http://example.com/cover.jpg"
