#!/usr/bin/env bash
set -euo pipefail

missing=0
for cmd in python3 yt-dlp; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing: $cmd" >&2
    missing=1
  else
    echo "found: $cmd -> $(command -v "$cmd")"
  fi
done

if [ "$missing" -ne 0 ]; then
  exit 1
fi

python3 - <<'PY'
import sys
print(f"python ok: {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
PY

yt-dlp --version | sed 's/^/yt-dlp ok: /'
