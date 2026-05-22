from flask import Flask, request
import requests
import os

app = Flask(__name__)

PAGE_ACCESS_TOKEN = os.getenv("EAAPxMAyLyk8BPrGkhDMVVTfB5ThmLYlGmmoRZCbl094ZAIkabMxx5yip9kZAHsWfDwV8KETgjTZBqXPJS5xJ1yiYZBFFLZCIX5zHFNt92b0jGN9Mk1O5supal5PXTyZCv3vcbCCMHZALXGU2UUM3ZAfGB4ZBdTlpcXe9LKJS86ZCJny6ZAEwAaTQZCP7ZBsvhWs7KeUmcUzRuGCYuv4Mqz4CZAHm2n65xp64wZDZD", "EAAPxMAyLyk8BPrGkhDMVVTfB5ThmLYlGmmoRZCbl094ZAIkabMxx5yip9kZAHsWfDwV8KETgjTZBqXPJS5xJ1yiYZBFFLZCIX5zHFNt92b0jGN9Mk1O5supal5PXTyZCv3vcbCCMHZALXGU2UUM3ZAfGB4ZBdTlpcXe9LKJS86ZCJny6ZAEwAaTQZCP7ZBsvhWs7KeUmcUzRuGCYuv4Mqz4CZAHm2n65xp64wZDZD")

@app.route("/webhook", methods=["GET"])
def verify():
    if request.args.get("hub.mode") == "subscribe" and request.args.get("hub.verify_token") == "verify123":
        return request.args.get("hub.challenge")
    return "Verification failed", 403


@app.route("/webhook", methods=["POST"])
def webhook():
    data = request.get_json()
    print("?? Incoming webhook event:", data)

    if "entry" in data:
        for entry in data["entry"]:
            for event in entry.get("messaging", []):
                if "message" in event:
                    sender_id = event["sender"]["id"]
                    message_text = event["message"].get("text", "")
                    reply_text = f"You said: {message_text}"
                    send_message(sender_id, reply_text)
    return "OK", 200


def send_message(recipient_id, text):
    url = f"https://graph.facebook.com/v23.0/me/messages?access_token={PAGE_ACCESS_TOKEN}"
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": text}
    }
    response = requests.post(url, json=payload)
    print("?? Message send response:", response.json())


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=7878)
