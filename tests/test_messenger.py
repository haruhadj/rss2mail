import messenger


def test_send_payload_returns_status_and_json_on_success(mocker):
    mock_response = mocker.Mock(status_code=200, content=b'{"ok": true}')
    mock_response.json.return_value = {"ok": True}
    mocker.patch("messenger.requests.post", return_value=mock_response)

    status, data = messenger._send_payload("token", {"a": 1})

    assert status == 200
    assert data == {"ok": True}


def test_send_payload_returns_none_status_on_network_error(mocker):
    mocker.patch("messenger.requests.post", side_effect=Exception("boom"))

    status, data = messenger._send_payload("token", {})

    assert status is None
    assert "error" in data


def test_send_items_to_messenger_requires_credentials(mocker):
    mocker.patch("messenger._get_page_token", return_value=None)
    mocker.patch("messenger._get_recipient_id", return_value=None)

    result = messenger.send_items_to_messenger("Feed", [("t", "l", "")])

    assert result is False


def test_send_items_to_messenger_sends_one_message_per_item(mocker):
    mocker.patch("messenger._get_page_token", return_value="token")
    mocker.patch("messenger._get_recipient_id", return_value="recipient")
    mock_send = mocker.patch("messenger._send_payload", return_value=(200, {}))
    mocker.patch("messenger.time.sleep")

    items = [("Title1", "http://x/1", ""), ("Title2", "http://x/2", "")]
    result = messenger.send_items_to_messenger("Feed", items)

    assert result is True
    assert mock_send.call_count == 2
