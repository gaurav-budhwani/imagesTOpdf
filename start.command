#!/bin/bash
# ==============================================================================
# Double-clickable macOS Finder Launcher for IMAGEStoPDF Studio
# ==============================================================================

cd "$(dirname "$0")"

if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is required to run IMAGEStoPDF."
    read -p "Press Enter to exit..."
    exit 1
fi

PORT=5174

# Open default browser after 1 second
(sleep 1.0 && open "http://localhost:${PORT}" 2>/dev/null || true) &

echo "🚀 Starting IMAGEStoPDF Studio..."
exec python3 app.py "$PORT"
