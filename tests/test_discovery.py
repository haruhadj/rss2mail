import os

import discovery


FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "weebcentral_search_simple.html")


def _load_fixture() -> str:
    with open(FIXTURE_PATH) as f:
        return f.read()


def test_extract_results_parses_real_weebcentral_markup():
    results = discovery._extract_results(_load_fixture())

    assert len(results) == 3
    assert results[0] == {
        "id": "01J76XY7FQY59WRK2YWX5T4E5N",
        "title": "Vinland Saga",
        "cover_url": "https://temp.compsci88.com/cover/fallback/01J76XY7FQY59WRK2YWX5T4E5N.jpg",
        "feed_url": "https://weebcentral.com/series/01J76XY7FQY59WRK2YWX5T4E5N/rss",
    }


def test_search_weebcentral_returns_empty_for_blank_query():
    assert discovery.search_weebcentral("") == []
    assert discovery.search_weebcentral("   ") == []


def test_search_weebcentral_uses_cache(mocker):
    discovery._cache.clear()
    mock_post = mocker.patch("discovery.requests.post")
    mock_post.return_value.text = _load_fixture()
    mock_post.return_value.raise_for_status = mocker.Mock()

    first = discovery.search_weebcentral("Vinland")
    second = discovery.search_weebcentral("vinland")  # different case, same cache key

    assert first == second
    mock_post.assert_called_once()


def test_search_weebcentral_fails_soft_on_network_error(mocker):
    discovery._cache.clear()
    mocker.patch("discovery.requests.post", side_effect=Exception("boom"))

    assert discovery.search_weebcentral("anything") == []
