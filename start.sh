#!/usr/bin/env bash
# ==============================================================================
# Terminal Launcher for IMAGEStoPDF Studio (macOS / Linux)
# ==============================================================================

set -e
cd "$(dirname "$0")"

PORT="${1:-5174}"

if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is required to run IMAGEStoPDF."
    exit 1
fi

echo "🚀 Starting IMAGEStoPDF Studio on port ${PORT}..."
exec python3 app.py "$PORT"
