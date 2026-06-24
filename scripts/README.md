# MiroFish Automation Scripts

## Phase 3a: FinceptTerminal Auto-Export & Batch Simulations

### Scripts

**`fincept-to-mirofish-export.sh`**
- Runs every 4 hours (via OpenClaw cron)
- Pulls latest FinceptTerminal export from `~/mirofish-trader/data/exports/latest-export.json`
- Copies to `~/mirofish/seeds/fincept-export-{timestamp}.json`
- Non-fatal if export unavailable (waits for next cycle)

**`mirofish-batch-run.sh`**
- Runs every 4 hours (staggered 5min after export script, via OpenClaw cron)
- Iterates all `seeds/fincept-export-*.json` files in `~/mirofish`
- Runs `uv run mirofish run` with real market context
- Outputs verdicts to `~/mirofish/uploads/runs/fincept-{symbol}-{timestamp}/`
- Rate-limited: 10s sleep between simulations

### Cron Schedule

Use OpenClaw cron (not system crontab):

```bash
# Every 4 hours: pull FinceptTerminal exports
0 */4 * * * ~/.openclaw/workspace/scripts/fincept-to-mirofish-export.sh

# Every 5 hours (staggered): run batch simulations
5 */4 * * * ~/.openclaw/workspace/scripts/mirofish-batch-run.sh
```

Example via `cron` tool:
```bash
cron action=add job={
  "name": "FinceptTerminal export pull",
  "schedule": { "kind": "cron", "expr": "0 */4 * * *" },
  "payload": { "kind": "systemEvent", "text": "~/.openclaw/workspace/scripts/fincept-to-mirofish-export.sh" },
  "sessionTarget": "main"
}
```

### Dependencies

- `uv` (Python package manager) — for `uv run mirofish run`
- `~/mirofish` CLI installed and synced
- FinceptTerminal data exports to `~/mirofish-trader/data/exports/latest-export.json`

### Testing

```bash
# Test export script
bash ~/.openclaw/workspace/scripts/fincept-to-mirofish-export.sh

# Test batch script (runs all seeds)
bash ~/.openclaw/workspace/scripts/mirofish-batch-run.sh

# Monitor output
tail -f ~/.openclaw/logs/fincept-export.log
```

### Integration

- **Phase 2:** MiroFish bias adapters (FRED macro + StockTwits sentiment) ✅
- **Phase 3a:** Export scripts + cron schedule (this)
- **Phase 3c:** Dashboard redesign (pending)

---

*Updated: 9 June 2026 — Ares*
