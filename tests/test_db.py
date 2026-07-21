import db


def test_settings_roundtrip(clean_db):
    db.update_settings({"send_interval": 30, "email": "a@b.com"})
    settings = db.get_settings()
    assert settings["send_interval"] == 30
    assert settings["email"] == "a@b.com"


def test_get_settings_falls_back_on_corrupt_interval(clean_db):
    db.update_settings({"send_interval": "not-a-number"})
    settings = db.get_settings()
    assert settings["send_interval"] == 15


def test_get_settings_defaults_when_unset(clean_db):
    settings = db.get_settings()
    assert settings["send_interval"] == 15
    assert settings["email"] == ""


def test_processed_items_roundtrip(clean_db):
    assert not db.is_processed("http://x")
    db.mark_processed("http://x", "Feed")
    assert db.is_processed("http://x")


def test_reset_processed_clears_all(clean_db):
    db.mark_processed("http://x", "Feed")
    db.reset_processed()
    assert not db.is_processed("http://x")


def test_feeds_crud(clean_db):
    feed = db.add_feed("Test", "http://example.com/rss")
    assert db.get_feed_by_id(feed["id"])["name"] == "Test"

    assert db.remove_feed(feed["id"]) is True
    assert db.get_feed_by_id(feed["id"]) is None
    assert db.remove_feed(feed["id"]) is False


def test_new_feed_has_empty_tags(clean_db):
    feed = db.add_feed("Test", "http://example.com/rss")
    assert feed["tags"] == []
    assert db.get_feed_by_id(feed["id"])["tags"] == []


def test_update_feed_tags_roundtrip(clean_db):
    feed = db.add_feed("Test", "http://example.com/rss")
    db.update_feed_tags(feed["id"], ["manga", "weekly"])

    stored = db.get_feed_by_id(feed["id"])
    assert stored["tags"] == ["manga", "weekly"]
    assert any(f["tags"] == ["manga", "weekly"] for f in db.get_feeds())


def test_save_check_result_keeps_only_latest_per_feed(clean_db):
    feed = db.add_feed("Test", "http://example.com/rss")
    db.save_check_result(feed["id"], "Test", "sent", 3)
    db.save_check_result(feed["id"], "Test", "no_new_items", 0)

    results = [r for r in db.get_last_check_results() if r["feed_id"] == feed["id"]]
    assert len(results) == 1
    assert results[0]["status"] == "no_new_items"


def test_get_stats_totals_and_top_feeds(clean_db):
    db.add_feed("Feed A", "http://a.example/rss")
    db.mark_processed("http://a.example/1", "Feed A")
    db.mark_processed("http://a.example/2", "Feed A")
    db.mark_processed("http://b.example/1", "Feed B")

    stats = db.get_stats()

    assert stats["total_feeds"] == 1
    assert stats["total_chapters"] == 3
    assert stats["top_feeds"][0] == {"feed_title": "Feed A", "count": 2}


def test_get_stats_empty_db(clean_db):
    stats = db.get_stats()
    assert stats["total_feeds"] == 0
    assert stats["total_chapters"] == 0
    assert stats["top_feeds"] == []
    assert stats["weekly"] == []
