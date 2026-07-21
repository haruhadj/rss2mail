import db
import rss2mail


def test_send_email_sends_via_smtp_and_marks_processed(mocker, clean_db):
    mock_smtp_cls = mocker.patch("rss2mail.smtplib.SMTP_SSL")
    mock_server = mocker.MagicMock()
    mock_smtp_cls.return_value.__enter__.return_value = mock_server
    mocker.patch.object(rss2mail.credentials, "EMAIL", "test@example.com")
    mocker.patch.object(rss2mail.credentials, "APP_PASSWORD", "app-password")

    items = [("Title", "http://example.com/x", "Mon, 01 Jan 2024 12:00:00 +0000")]
    rss2mail.send_email("Feed", items)

    mock_smtp_cls.assert_called_once_with("smtp.gmail.com", 465, timeout=rss2mail.NETWORK_TIMEOUT)
    mock_server.login.assert_called_once_with("test@example.com", "app-password")
    mock_server.sendmail.assert_called_once()
    assert db.is_processed("http://example.com/x")
