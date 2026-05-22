import os
import sys
import time
import feedparser
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from config import credentials, feeds, settings
from datetime import datetime

# Get the directory containing the script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(SCRIPT_DIR, "config")
PROCESSED_ITEMS_FILE = os.path.join(CONFIG_DIR, "processed_items.txt")

def format_pub_date(pub_date_str):
    """Parse and format the pubDate from the RSS feed."""
    try:
        pub_date = datetime.strptime(pub_date_str, '%a, %d %b %Y %H:%M:%S +0000')
        return pub_date.strftime('%A, %B %d, %Y at %I:%M %p')
    except ValueError:
        return pub_date_str

def send_email(feed_title, items, cover_image_url=None):
    """Send an email containing all items for a specific feed, with a single cover image."""
    msg = MIMEMultipart("alternative")
    msg['From'] = credentials.EMAIL
    msg['To'] = credentials.EMAIL
    msg['Subject'] = f"Updates from {feed_title}"

    cover_image_html = (
        f'<img src="{cover_image_url}" alt="Cover Image" style="max-width: 200px; height: auto; margin-bottom: 20px;">'
        if cover_image_url
        else ""
    )

    html_items = ""
    for title, link, pub_date in items:
        formatted_date = format_pub_date(pub_date)
        html_items += f"""
        <div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            <h3>{title}</h3>
            <p><a href="{link}" style="color: #1a73e8; text-decoration: none; font-size: 16px;">Read the chapter</a></p>
            <p><small>Published on: {formatted_date}</small></p>
        </div>
        """

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
                {cover_image_html}
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

    # Mark items as processed after successful email
    for _, link, _ in items:
        mark_as_processed(link, feed_title)

def load_processed_items():
    """Load the processed items from the file and return a set of processed URLs."""
    if not os.path.exists(CONFIG_DIR):
        os.makedirs(CONFIG_DIR)

    processed_urls = set()
    
    try:
        with open(PROCESSED_ITEMS_FILE, "r") as file:
            for line in file:
                line = line.strip()
                if " - " in line:
                    processed_urls.add(line.split(" - ")[-1])
                else:
                    processed_urls.add(line)
    except FileNotFoundError:
        pass

    return processed_urls

def mark_as_processed(item_url, feed_title=None):
    """Mark an item as processed by adding it to the processed items file."""
    if not os.path.exists(CONFIG_DIR):
        os.makedirs(CONFIG_DIR)

    processed_item = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {feed_title} - {item_url}\n" if feed_title else f"{item_url}\n"

    with open(PROCESSED_ITEMS_FILE, "a") as file:
        file.write(processed_item)

def fetch_rss_feed(url, max_items=5):
    """Fetch RSS feed and return up to `max_items` unprocessed entries."""
    feed = feedparser.parse(url)
    processed_items = load_processed_items()
    items = []

    cover_image_url = None
    if 'image' in feed.feed:
        cover_image_url = feed.feed.image.get('url')

    for entry in feed.entries[:max_items]:
        title = entry.title
        link = entry.link
        pub_date = entry.get("published", "")

        # Skip already processed items
        if link in processed_items:
            continue

        items.append((title, link, pub_date))

    return items, cover_image_url
    
def reset_processed_items():
    """Reset the processed items file by removing it and creating a new empty file."""
    try:
        # Ensure the config directory exists
        if not os.path.exists(CONFIG_DIR):
            os.makedirs(CONFIG_DIR)
            
        # Remove the file if it exists
        if os.path.exists(PROCESSED_ITEMS_FILE):
            os.remove(PROCESSED_ITEMS_FILE)
            
        # Create a new empty file
        with open(PROCESSED_ITEMS_FILE, "w") as file:
            pass  # Creates an empty file
            
    except Exception as e:
        print(f"Error resetting processed items: {e}")
        return False
        
    return True
    
def save_feeds():
    """Save the feeds to the configuration file."""
    feeds_file_path = os.path.join(CONFIG_DIR, "feeds.py")
    try:
        with open(feeds_file_path, "w") as file:
            file.write("FEEDS = [\n")
            for name, url in feeds.FEEDS:
                file.write(f"    ({repr(name)}, {repr(url)}),\n")
            file.write("]\n")
        print("Feeds have been successfully saved.")
    except Exception as e:
        print(f"Error saving feeds: {e}")

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
        max_items = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 5

        for name, url in feeds.FEEDS:
            feed = feedparser.parse(url)
            feed_title = feed.feed.title if 'title' in feed.feed else name
            items, cover_image_url = fetch_rss_feed(url, max_items)

            if items:
                if silent:
                    for _, link, _ in items:
                        mark_as_processed(link, feed_title)
                    print(f"Feed initialized (silent): {feed_title}")
                else:
                    send_email(feed_title, items, cover_image_url)
                    print(f"Email sent for feed: {feed_title}")
            else:
                print(f"No new items to process for feed: {feed_title}")
    elif command == "add":
        try:
            if len(sys.argv) < 4:
                print("Usage: python test2.py add <name> <url>")
                print("Hint: If the name contains spaces, enclose it in quotes.")
                return

            name = sys.argv[2]
            url = sys.argv[3]

            if len(sys.argv) > 4:
                print(
                    f"Warning: Detected multiple arguments after 'add'. Did you forget to use quotes for the name or URL?\n"
                    f"Example: python test2.py add \"Fly Me to the Moon\" \"https://example.com/feed\""
                )
                return

            feeds.FEEDS.append((name, url))
            save_feeds()
            print(f"Feed added: {name} - {url}")
        except IndexError:
            print("Usage: python test2.py add <name> <url>")
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
            settings_file_path = os.path.join(CONFIG_DIR, "settings.py")
            with open(settings_file_path, "w") as file:
                file.write(f"SEND_INTERVAL = {interval}\n")
            print(f"Interval changed to: {interval} minutes")
        except IndexError:
            print("Usage: python test1.py interval <time>")
        except ValueError:
            print("Invalid time value. Please provide a valid integer.")
    elif command == "reset":
        if reset_processed_items():
            print("Processed items have been successfully reset.")
        else:
            print("Error occurred while resetting processed items.")
    else:
        print("Invalid command. Use 'python test1.py help' for a list of commands.")
        
if __name__ == "__main__":
    main()