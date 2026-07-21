import webhook


def test_send_message_posts_expected_payload(mocker):
    mock_response = mocker.Mock()
    mock_response.json.return_value = {"ok": True}
    mock_post = mocker.patch("webhook.requests.post", return_value=mock_response)

    webhook.send_message("123", "hello")

    args, kwargs = mock_post.call_args
    assert args[0].startswith("https://graph.facebook.com/")
    assert kwargs["json"]["recipient"]["id"] == "123"
    assert kwargs["json"]["message"]["text"] == "hello"


def test_verify_endpoint_returns_challenge_on_valid_token():
    client = webhook.app.test_client()
    resp = client.get("/webhook", query_string={
        "hub.mode": "subscribe",
        "hub.verify_token": "verify123",
        "hub.challenge": "challenge-value",
    })
    assert resp.status_code == 200
    assert resp.data == b"challenge-value"


def test_verify_endpoint_rejects_invalid_token():
    client = webhook.app.test_client()
    resp = client.get("/webhook", query_string={
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong",
        "hub.challenge": "challenge-value",
    })
    assert resp.status_code == 403
