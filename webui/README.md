# RSS2Mail WebUI

A React + TypeScript web interface for managing RSS feeds with email and Facebook Messenger notifications.

## Features

- **Dashboard**: Manga-style grid of feeds, sort by name/added/updated, click a card to see all chapters
- **Add Feed**: Add RSS feeds with auto-title and cover extraction
- **Settings**: Configure Gmail credentials and Facebook Messenger
- **Logs**: View activity logs and reset processed items
- **Dark Mode**: Toggle in the navbar, persisted across sessions

## Architecture

- **Backend**: FastAPI (uvicorn) on port 5000
- **Frontend**: React + TypeScript + Vite + Tailwind CSS on port 5173 (dev)
- **Database**: SQLite (`rss2mail.db`)
- **CLI**: `rss2mail.py` still works independently

---

## Installation

### 1. Run the Setup Script

```bash
cd /home/haruhadj/scripts-opipc/rss2mail
./setup.sh
```

This creates `venv/`, installs Python deps, and installs frontend Node deps via pnpm.

### Manual Setup (if needed)

```bash
# Python venv
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn feedparser requests

# Frontend (requires pnpm)
cd webui/frontend
pnpm install
```

---

## Environment Setup

All sensitive values are kept out of the codebase via environment variables.

### 1. Copy the example file

```bash
cp .env.example .env
```

### 2. Fill in `.env`

```ini
RSS2MAIL_EMAIL=yourname@gmail.com
RSS2MAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Optional — only needed for Facebook Messenger
RSS2MAIL_MESSENGER_TOKEN=
RSS2MAIL_MESSENGER_RECIPIENT_ID=
```

### 3. Load it for local dev

The backend reads these as standard environment variables. Source them before
running `launch.sh`:

```bash
set -a && source .env && set +a
./webui/launch.sh
```

Or use a tool like [`direnv`](https://direnv.net/) to auto-load `.env` when you
enter the project directory.

> **Note:** Once you save settings via the WebUI, they are stored in the SQLite DB
> and the env vars are no longer needed on subsequent runs (the DB values take
> precedence). The env vars serve as the initial seed on a fresh install.

---

## Running (Development)

```bash
cd /home/haruhadj/scripts-opipc/rss2mail
./webui/launch.sh
```

- Frontend: http://localhost:5173
- API:      http://localhost:5000/api
- API docs: http://localhost:5000/docs

### Run manually in two terminals

```bash
# Terminal 1 — FastAPI backend
cd /home/haruhadj/scripts-opipc/rss2mail
./venv/bin/uvicorn webui.backend.app:app --host 0.0.0.0 --port 5000 --reload

# Terminal 2 — Vite frontend
cd /home/haruhadj/scripts-opipc/rss2mail/webui/frontend
pnpm run dev
```

---

## Running at Boot (Linux — systemd)

> **Requirements**: `systemd` (standard on Ubuntu, Debian, Fedora, Arch, etc.)

There are two services to register: the **FastAPI backend** and the **Vite frontend**.
Replace `YOUR_USER` with your Linux username and adjust the path if yours differs from
`/home/haruhadj/scripts-opipc/rss2mail`.

### Step 1 — Create the backend service

```bash
sudo nano /etc/systemd/system/rss2mail-backend.service
```

Paste:

```ini
[Unit]
Description=RSS2Mail FastAPI Backend
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/haruhadj/scripts-opipc/rss2mail/webui/backend
ExecStart=/home/haruhadj/scripts-opipc/rss2mail/venv/bin/uvicorn app:app --host 0.0.0.0 --port 5000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Step 2 — Create the frontend service

```bash
sudo nano /etc/systemd/system/rss2mail-frontend.service
```

Paste:

```ini
[Unit]
Description=RSS2Mail Vite Frontend
After=network.target rss2mail-backend.service

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/haruhadj/scripts-opipc/rss2mail/webui/frontend
ExecStart=/usr/bin/pnpm run dev
Restart=on-failure
RestartSec=5
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
```

> **Tip:** If `pnpm` is installed in your home directory (e.g. via `npm i -g pnpm`), find
> its full path with `which pnpm` and use that instead of `/usr/bin/pnpm`.

### Step 3 — Enable and start both services

```bash
# Reload systemd to pick up new unit files
sudo systemctl daemon-reload

# Enable both to start at boot
sudo systemctl enable rss2mail-backend.service
sudo systemctl enable rss2mail-frontend.service

# Start them now (no reboot needed)
sudo systemctl start rss2mail-backend.service
sudo systemctl start rss2mail-frontend.service
```

### Step 4 — Verify they're running

```bash
sudo systemctl status rss2mail-backend.service
sudo systemctl status rss2mail-frontend.service
```

Both should show `active (running)`.

### Useful commands

```bash
# View live logs
sudo journalctl -u rss2mail-backend.service -f
sudo journalctl -u rss2mail-frontend.service -f

# Restart a service
sudo systemctl restart rss2mail-backend.service

# Stop at boot (disable autostart)
sudo systemctl disable rss2mail-backend.service
sudo systemctl disable rss2mail-frontend.service
```

---

## Running with Docker (Linux)

> **Requirements**: Docker Engine + Docker Compose v2 (`docker compose` command).
> Install: https://docs.docker.com/engine/install/

A single container serves the full app on **port 5000** — the frontend is pre-built
into the image, the SQLite database is stored in a named volume so it survives
container restarts and image rebuilds.

### Quick start

```bash
cd /home/haruhadj/scripts-opipc/rss2mail

# Build the image and start the container
docker compose up -d --build
```

Open http://localhost:5000 in your browser.

### Other useful commands

```bash
# View logs
docker compose logs -f

# Stop the container
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Open a shell inside the container
docker compose exec rss2mail bash
```

### Run at boot with Docker

`restart: unless-stopped` in `docker-compose.yml` means the container **automatically
restarts after a reboot** as long as the Docker daemon itself starts at boot.

Enable Docker to start at boot (one-time setup):

```bash
sudo systemctl enable docker
```

That's it — no extra service files needed.

### Persistent data

The SQLite database is stored in the Docker named volume `rss2mail-data` at `/data/rss2mail.db`
inside the container. It survives image rebuilds and `docker compose down`.

To back it up:

```bash
docker compose cp rss2mail:/data/rss2mail.db ./rss2mail.db.bak
```

To restore:

```bash
docker compose cp ./rss2mail.db.bak rss2mail:/data/rss2mail.db
```

---

## CLI Usage

```bash
source venv/bin/activate

python rss2mail.py send              # Send emails for new items
python rss2mail.py add <name> <url>  # Add a feed
python rss2mail.py remove <id>       # Remove a feed
python rss2mail.py list              # List all feeds
python rss2mail.py interval <min>    # Change check interval
python rss2mail.py reset             # Reset processed items
python rss2mail.py send-messenger    # Send to Messenger only
python rss2mail.py send-all          # Send to both
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/feeds` | List all feeds |
| POST | `/api/feeds` | Add feed |
| DELETE | `/api/feeds/{id}` | Remove feed |
| GET | `/api/feeds/{id}/details` | Fetch live RSS items for a feed |
| POST | `/api/check` | Check all feeds |
| POST | `/api/check/{id}` | Check one feed |
| GET | `/api/last-check` | Last check results |
| POST | `/api/reset` | Reset processed items |
| GET | `/api/settings` | Get settings |
| POST | `/api/settings` | Update settings |
| POST | `/api/test/email` | Send test email |
| GET | `/api/logs` | Activity logs |

---

## File Structure

```
rss2mail/
├── venv/                   # Python virtual environment
├── rss2mail.db             # SQLite database
├── webui/
│   ├── backend/
│   │   └── app.py          # FastAPI server
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── types.ts    # TypeScript types
│   │   │   ├── api.ts      # API client
│   │   │   ├── App.tsx     # Main router + dark mode toggle
│   │   │   ├── main.tsx    # React entry
│   │   │   ├── pages/      # Dashboard, AddFeed, Settings, Logs
│   │   │   └── index.css   # Tailwind + component classes
│   │   ├── package.json
│   │   ├── tailwind.config.js
│   │   └── vite.config.ts
│   ├── README.md
│   └── launch.sh           # Dev launcher (both servers)
├── setup.sh                # First-time setup
├── rss2mail.py             # CLI tool
├── db.py                   # SQLite helpers
├── messenger.py            # Messenger module
├── webhook.py              # Webhook server
└── config/                 # Credentials + settings
```
