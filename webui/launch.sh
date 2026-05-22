#!/bin/bash

# RSS2Mail WebUI Launcher
# Starts both the FastAPI backend and Vite frontend dev server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
VENV_DIR="$PROJECT_ROOT/venv"

echo "====================================="
echo "  RSS2Mail WebUI Launcher"
echo "====================================="
echo ""

# Check if virtual environment exists
if [ ! -d "$VENV_DIR" ]; then
    echo "Error: Virtual environment not found at $VENV_DIR"
    echo "Please run the setup script first:"
    echo "  ./setup.sh"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $UVICORN_PID $VITE_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM

# Start FastAPI backend using uvicorn
echo "Starting FastAPI backend on http://localhost:5000..."
cd "$PROJECT_ROOT/webui/backend"
"$VENV_DIR/bin/uvicorn" app:app --host 0.0.0.0 --port 5000 --reload &
UVICORN_PID=$!

sleep 2

# Start Vite frontend
echo "Starting Vite frontend on http://localhost:5173..."
cd "$SCRIPT_DIR/frontend"
pnpm run dev &
VITE_PID=$!

echo ""
echo "====================================="
echo "  WebUI Ready!"
echo "====================================="
echo "Frontend: http://localhost:5173"
echo "API:      http://localhost:5000/api"
echo "Docs:     http://localhost:5000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

wait
