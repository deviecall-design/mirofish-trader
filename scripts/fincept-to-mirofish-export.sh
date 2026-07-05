#!/bin/bash
# fincept-to-mirofish-export.sh
# Every 4h: Check for FinceptTerminal export → copy to MiroFish seeds
# Scheduled via OpenClaw cron: 0 */4 * * * ~/.openclaw/workspace/scripts/fincept-to-mirofish-export.sh

set -euo pipefail

FINCEPT_EXPORT_DIR="${HOME}/mirofish-trader/data/exports"
MIROFISH_SEED_DIR="${HOME}/mirofish/seeds"

# Ensure seed directory exists
mkdir -p "${MIROFISH_SEED_DIR}"

# Only run if export exists (manual or API)
if [ -f "${FINCEPT_EXPORT_DIR}/latest-export.json" ]; then
  TIMESTAMP=$(date +%s)
  cp "${FINCEPT_EXPORT_DIR}/latest-export.json" \
     "${MIROFISH_SEED_DIR}/fincept-export-${TIMESTAMP}.json"
  
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ Exported FinceptTerminal data to MiroFish seed: fincept-export-${TIMESTAMP}.json"
  exit 0
else
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  No FinceptTerminal export found at ${FINCEPT_EXPORT_DIR}/latest-export.json"
  exit 0  # Non-fatal — wait for next cycle
fi
