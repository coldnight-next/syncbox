#!/usr/bin/env bash
set -euo pipefail

echo "=== Syncbox Windows Build ==="

# Ensure we're in the project root
cd "$(dirname "$0")/.."

echo "[1/4] Installing dependencies..."
npm ci

echo "[2/4] Running checks..."
npm run typecheck
npm run lint
npm run test

echo "[3/4] Building application..."
npm run build

echo "[4/4] Packaging installer..."
if [ -n "${WIN_CSC_FILE:-}" ] && [ -n "${WIN_CSC_KEY_PASSWORD:-}" ]; then
  echo "Code signing enabled"
  npx electron-builder --win --config electron-builder.yml
else
  echo "Code signing NOT configured — building unsigned"
  npx electron-builder --win --config electron-builder.yml -c.win.certificateFile= -c.win.certificatePassword=
fi

echo ""
echo "=== Build complete! ==="
echo "Installer located in: release/"
ls -la release/*.exe release/*.msi 2>/dev/null || echo "(no installers found — check build output)"
