from rss2mail import format_pub_date


def test_format_pub_date_valid():
    result = format_pub_date("Mon, 01 Jan 2024 12:00:00 +0000")
    assert result == "Monday, January 01, 2024 at 12:00 PM"


def test_format_pub_date_passes_through_unparseable_input():
    assert format_pub_date("not a date") == "not a date"
