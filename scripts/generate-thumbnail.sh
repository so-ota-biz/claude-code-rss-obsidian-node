#!/usr/bin/env bash
set -euo pipefail

PROMPT_FILE="${1:?prompt file required}"
OUTPUT_PATH="${2:?output path required}"

# Adapter script. Replace the command below with your installed image CLI.
# Example idea:
# nano-banana --prompt-file "$PROMPT_FILE" --output "$OUTPUT_PATH"

if ! command -v nano-banana >/dev/null 2>&1; then
  echo "nano-banana CLI is not installed or not in PATH" >&2
  exit 1
fi

nano-banana --prompt-file "$PROMPT_FILE" --output "$OUTPUT_PATH"
