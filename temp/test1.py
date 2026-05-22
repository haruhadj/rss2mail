import os
import sys
import time
import feedparser
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from config import credentials, feeds, settings
from datetime import datetime

def format_pub_date(pub_date_str):
    """Parse and format the pubDate from the RSS feed."""
    try:
        pub_date = datetime.strptime(pub_date_str, '%a, %d %b %Y %H:%M:%S +0000')
        return pub_date.strftime('%A, %B %d, %Y at %I:%M %p')
    except ValueError:
        return pub_date_str  # Return the raw string if parsing fails

def send_email(feed_title, items, cover_image_url=None):
    """Send an email containing all items for a specific feed, with a single cover image."""
    msg = MIMEMultipart("alternative")
    msg['From'] = credentials.EMAIL
    msg['To'] = credentials.EMAIL
    msg['Subject'] = f"Updates from {feed_title}"

    # Cover image (if available) - only included once at the top of the email
    cover_image_html = (
        f'<img src="{cover_image_url}" alt="Cover Image" style="max-width: 200px; height: auto; margin-bottom: 20px;">'
        if cover_image_url
        else ""
    )

    # Build the HTML for the items
    html_items = ""
    for title, link, pub_date in items:  # Added pub_date for display in the email
        formatted_date = format_pub_date(pub_date)  # Format the pubDate

        html_items += f"""
        <div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            <h3>{title}</h3>
            <p><a href="{link}" style="color: #1a73e8; text-decoration: none; font-size: 16px;">Read the chapter</a></p>
            <p><small>Published on: {formatted_date}</small></p>  <!-- Display publication date -->
        </div>
        """

    # Build the complete HTML body
    html_body = f"""
    <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    padding: 20px;
                }}
                .email-content {{
                    background-color: #fff;
                    padding: 20px;
                    border-radius: 5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }}
                h3 {{
                    color: #333;
                }}
                p {{
                    color: #555;
                }}
            </style>
        </head>
        <body>
            <div class="email-content">
                <h2>Updates from {feed_title}</h2>
                {cover_image_html}  <!-- Include the cover image only once -->
                {html_items}
            </div>
        </body>
    </html>
    """

    part = MIMEText(html_body, 'html')
    msg.attach(part)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(credentials.EMAIL, credentials.APP_PASSWORD)
        server.sendmail(credentials.EMAIL, credentials.EMAIL, msg.as_string())

    # Mark all items as processed
    for _, link, _ in items:
        mark_as_processed(link)

CONFIG_DIR = "/home/haruhadj/rss2mail/test/config"  # Set the config folder path
PROCESSED_ITEMS_FILE = os.path.join(CONFIG_DIR, "processed_items.txt")

def load_processed_items():
    """Load the processed items from a file."""
    if not os.path.exists(CONFIG_DIR):
        os.makedirs(CONFIG_DIR)  # Create the config folder if it doesn't exist
    try:
        with open(PROCESSED_ITEMS_FILE, "r") as file:
            return set(file.read().splitlines())
    except FileNotFoundError:
        return set()

def mark_as_processed(item_url, feed_title=None):
    """Mark an item as processed by adding it to the processed items file."""
    if not os.path.exists(CONFIG_DIR):
        os.makedirs(CONFIG_DIR)  # Ensure the config folder exists

    # Include the feed title in the processed items file if provided
    if feed_title:
        processed_item = f"{feed_title} - {item_url}\n"
    else:
        processed_item = f"{item_url}\n"

    with open(PROCESSED_ITEMS_FILE, "a") as file:
        file.write(processed_item)

def fetch_rss_feed(url, max_items=5):
    """Fetch RSS feed and return up to `max_items` entries."""
    feed = feedparser.parse(url)
    processed_items = load_processed_items()
    items = []

    # Extract the cover image URL if available
    cover_image_url = None
    if 'image' in feed.feed:
        cover_image_url = feed.feed.image.get('url')

    for entry in feed.entries[:max_items]:
        title = entry.title
        link = entry.link
        pub_date = entry.get("published", "")  # Get the published date if available

        # Skip already processed items
        if link in processed_items:
            continue

        items.append((title, link, pub_date))  # Include the pubDate for display

    return items, cover_image_url

def update_feed(url, add=True):
    """Add or remove a feed URL from the list."""
    if add:
        feeds.FEEDS.append(url)
    else:
        feeds.FEEDS.remove(url)
    save_feeds()

def save_feeds():
    """Save the feed URLs to the configuration file."""
    with open('config/feeds.py', 'w') as file:
        file.write("FEEDS = [\n")
        for url in feeds.FEEDS:
            file.write(f"    '{url}',\n")
        file.write("]\n")

def change_interval(new_interval):
    """Change the interval for sending emails."""
    settings.SEND_INTERVAL = new_interval
    with open('config/settings.py', 'w') as file:
        file.write(f"SEND_INTERVAL = {new_interval}\n")
        
def reset_processed_items():
    processed_file_path = os.path.join(CONFIG_DIR, "processed_items.txt")
    with open(processed_file_path, "w") as file:
        file.write("")

def main():
    if len(sys.argv) < 2:
        print("Usage: python test1.py <command>")
        return

    command = sys.argv[1]

    if command == "help" or command == "--help":
        print("""
Usage:
    python test1.py <command>

Available commands:
    send            Send the RSS feed items as an email.
    send --silent   Mark items as processed without sending an email.
    add <name> <url> Add a new RSS feed with a name and URL.
    remove <index>  Remove a feed based on its index in the list.
    interval <time> Change the interval for sending emails (in minutes).
    reset           Reset the processed items file (clear the list of processed items).
    list            List all the current feeds with their titles and URLs.
    help, --help    Show this help message.
        """)
    elif command == "send":
        silent = "--silent" in sys.argv
        max_items = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 5  # Default max items to 5

        for name, url in feeds.FEEDS:
            feed = feedparser.parse(url)
            feed_title = feed.feed.title if 'title' in feed.feed else name  # Use the feed name
            items, cover_image_url = fetch_rss_feed(url, max_items)

            if items:
                if silent:
                    for _, link, _ in items:
                        mark_as_processed(link, name)  # Pass both the link and feed title
                    print(f"Feed initialized (silent): {feed_title}")
                else:
                    send_email(feed_title, items, cover_image_url)
                    print(f"Email sent for feed: {feed_title}")
    elif command == "add":
        try:
            name = sys.argv[2]
            url = sys.argv[3]
            feeds.FEEDS.append((name, url))
            save_feeds()
            print(f"Feed added: {name} - {url}")
        except IndexError:
            print("Usage: python test1.py add <name> <url>")
    elif command == "remove":
        try:
            index = int(sys.argv[2])
            if 0 <= index < len(feeds.FEEDS):
                name, url = feeds.FEEDS.pop(index)
                save_feeds()
                print(f"Feed removed: {name} - {url}")
            else:
                print("Invalid index. Use 'list' to view feeds.")
        except (ValueError, IndexError):
            print("Invalid input. Provide a valid index.")
    elif command == "list":
        print("Current Feeds:")
        for idx, (name, url) in enumerate(feeds.FEEDS):
            print(f"{idx}. {name} - {url}")
    elif command == "interval":
        try:
            interval = int(sys.argv[2])
            settings.SEND_INTERVAL = interval
            with open("config/settings.py", "w") as file:
                file.write(f"SEND_INTERVAL = {interval}\n")
            print(f"Interval changed to: {interval} minutes")
        except IndexError:
            print("Usage: python test1.py interval <time>")
        except ValueError:
            print("Invalid time value. Please provide a valid integer.")
    elif command == "reset":
        reset_processed_items()
        print("Processed items have been reset.")
    else:
        print("Invalid command. Use 'python test1.py help' for a list of commands.")

if __name__ == "__main__":
    main()
