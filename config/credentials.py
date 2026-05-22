import os

# Email credentials — set via environment variables or .env file
EMAIL = os.environ.get("RSS2MAIL_EMAIL", "")
APP_PASSWORD = os.environ.get("RSS2MAIL_APP_PASSWORD", "")
MESSENGER_PAGE_ACCESS_TOKEN = os.environ.get("RSS2MAIL_MESSENGER_TOKEN", "")
MESSENGER_RECIPIENT_ID = os.environ.get("RSS2MAIL_MESSENGER_RECIPIENT_ID", "")