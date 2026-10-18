#!/usr/bin/env bash
# Android-only gate. Never starts a device or executes live financial operations.
set -euo pipefail
cd "$(dirname "$0")/.."
exec ./gradlew "$@" --no-daemon
