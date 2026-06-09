#!/bin/bash
# mirofish-batch-run.sh
# Auto-run MiroFish on all new fincept-export-*.json seeds
# Scheduled via OpenClaw cron: 5 */4 * * * ~/.openclaw/workspace/scripts/mirofish-batch-run.sh

set -euo pipefail

MIROFISH_HOME="${HOME}/mirofish"
SEED_DIR="${MIROFISH_HOME}/seeds"
RUN_DIR_BASE="${MIROFISH_HOME}/uploads/runs"

# Exit gracefully if mirofish home or seed dir doesn't exist
if [ ! -d "${SEED_DIR}" ]; then
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️  No MiroFish seeds directory at ${SEED_DIR}. Skipping batch run."
  exit 0
fi

cd "${MIROFISH_HOME}" || {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ Failed to change to ${MIROFISH_HOME}"
  exit 1
}

PROCESSED_COUNT=0
SUCCESS_COUNT=0
FAILED_COUNT=0

# Process all new fincept-export-*.json seeds
for seed_file in seeds/fincept-export-*.json; do
  # Skip if no matching files
  [ -e "$seed_file" ] || continue
  
  PROCESSED_COUNT=$((PROCESSED_COUNT + 1))
  symbol=$(basename "$seed_file" | sed 's/fincept-export-//;s/.json//')
  timestamp=$(date +%s)
  run_dir="${RUN_DIR_BASE}/fincept-${symbol}-${timestamp}"
  
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] 🐟 Running MiroFish on ${symbol} (seed: ${seed_file})..."
  
  mkdir -p "$run_dir"
  
  # Run MiroFish with proper error handling
  if uv run --python 3.12 mirofish run \
    --files "$seed_file" \
    --requirement "Analyze market sentiment for ${symbol}. Predict 7-day trajectory based on current technical, fundamental, and macro context from FinceptTerminal data." \
    --json > "${run_dir}/result.json" 2> "${run_dir}/error.log"; then
    
    if [ -f "${run_dir}/report/verdict.json" ]; then
      echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ MiroFish completed for ${symbol}"
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
      # Post verdict to mirofish-trader webhook (optional future enhancement)
    else
      echo "[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  MiroFish completed but no verdict file for ${symbol}"
      FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
  else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ MiroFish failed for ${symbol}. Error log: ${run_dir}/error.log"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
  
  # Respect API rate limits
  sleep 10
done

echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ MiroFish batch complete — Processed: $PROCESSED_COUNT, Success: $SUCCESS_COUNT, Failed: $FAILED_COUNT"
exit 0
