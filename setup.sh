#!/bin/bash

# RSS2Mail Setup Script
# Creates Python virtual environment and installs dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

echo "====================================="
echo "  RSS2Mail Setup"
echo "====================================="
echo ""

# Check if python3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed"
    echo "Please install it with: sudo apt install python3 python3-venv"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
    echo "Virtual environment created at $VENV_DIR"
else
    echo "Virtual environment already exists at $VENV_DIR"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install Python dependencies
echo "Installing Python dependencies..."
pip install fastapi uvicorn feedparser requests

echo ""
echo "====================================="
echo "  Python setup complete!"
echo "====================================="
echo ""

# Check if Node.js is installed for frontend
if command -v npm &> /dev/null; then
    echo "Node.js found. Installing frontend dependencies..."
    cd "$SCRIPT_DIR/webui/frontend"
    npm install
    echo "Frontend dependencies installed!"
else
    echo "Warning: Node.js/npm not found. Frontend will not work."
    echo "Install Node.js to use the WebUI."
fi

echo ""
echo "Setup complete! To run the application:"
echo ""
echo "1. Activate the virtual environment:"
echo "   source venv/bin/activate"
echo ""
echo "2. Run the backend:"
echo "   python webui/backend/app.py"
echo ""
echo "3. In another terminal, run the frontend:"
echo "   cd webui/frontend && npm run dev"
echo ""
echo "Or use the launch script (after activating venv):"
echo "   ./webui/launch.sh"
