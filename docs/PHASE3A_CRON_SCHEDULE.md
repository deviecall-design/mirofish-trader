# Phase 3a — OpenClaw Cron Schedule Reference

## Export Scripts

Two scripts automate FinceptTerminal → MiroFish pipeline:

| Script | Location | Frequency | Purpose |
|--------|----------|-----------|---------|
| `fincept-to-mirofish-export.sh` | `~/.openclaw/workspace/scripts/` | Every 4 hours | Copies `latest-export.json` to MiroFish seed directory with timestamp |
| `mirofish-batch-run.sh` | `~/.openclaw/workspace/scripts/` | Every 4 hours (staggered +5min) | Runs MiroFish CLI on all new seed files, saves results to `uploads/runs/` |

## OpenClaw Cron Configuration

Add these entries to your OpenClaw cron schedule (via `openclaw cron add` or dashboard):

```bash
# Every 4 hours: pull FinceptTerminal exports
0 */4 * * * ~/.openclaw/workspace/scripts/fincept-to-mirofish-export.sh

# Every 5 hours (staggered): run batch simulations
5 */4 * * * ~/.openclaw/workspace/scripts/mirofish-batch-run.sh
```

### Explanation

- **`0 */4 * * *`** = 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC (every 4 hours)
- **`5 */4 * * *`** = 00:05, 04:05, 08:05, 12:05, 16:05, 20:05 UTC (every 4 hours, +5 min offset)

The 5-minute stagger ensures exports complete before batch simulations begin.

## Directories

| Path | Purpose | Created by |
|------|---------|-----------|
| `~/mirofish-trader/data/exports/` | FinceptTerminal JSON exports (manual or API) | Manual/FinceptTerminal API |
| `~/mirofish/seeds/` | MiroFish input seeds (fincept-export-*.json) | `fincept-to-mirofish-export.sh` |
| `~/mirofish/uploads/runs/` | MiroFish simulation results (result.json, error.log) | `mirofish-batch-run.sh` |

## Output Format

### Export Script Output
```
[2026-06-09 18:53:00] ✅ Exported FinceptTerminal data to MiroFish seed: fincept-export-1717970980.json
```

### Batch Run Script Output
```
[2026-06-09 19:05:15] 🐟 Running MiroFish on DRO (seed: seeds/fincept-export-1717970980.json)...
[2026-06-09 19:05:45] ✅ MiroFish completed for DRO
[2026-06-09 19:05:55] 🐟 Running MiroFish on TSLA (seed: seeds/fincept-export-1717970980.json)...
[2026-06-09 19:06:25] ✅ MiroFish completed for TSLA
[2026-06-09 19:06:35] ✅ MiroFish batch complete — Processed: 2, Success: 2, Failed: 0
```

## Error Handling

Both scripts are **non-fatal**:
- Export script: If FinceptTerminal export doesn't exist, logs warning and exits (0)
- Batch run script: If a single simulation fails, logs error and continues with next seed

Logs are written to `stdout` and captured by OpenClaw cron. Check cron logs via:
```bash
openclaw cron logs <job-id>
```

## Testing

Before adding to cron, test manually:

```bash
# Test export script
~/.openclaw/workspace/scripts/fincept-to-mirofish-export.sh

# Test batch script (ensure seeds exist first)
~/.openclaw/workspace/scripts/mirofish-batch-run.sh
```

## Future Enhancements

- [ ] Post MiroFish verdicts to mirofish-trader webhook (for dashboard real-time updates)
- [ ] Slack notification on batch completion
- [ ] Retry logic for transient API failures
- [ ] Archive old seed files after X days

---

*Phase 3a — Auto-Export Scripts | Updated 9 June 2026*
