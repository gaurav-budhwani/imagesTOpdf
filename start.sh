#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

PORT="${1:-5174}"

if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is required to run imagesTOpdf."
    exit 1
fi

echo "Starting imagesTOpdf on port ${PORT}..."
exec python3 app.py "$PORT"
