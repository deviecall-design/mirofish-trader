# Design System — MiroFish Trader · "Quiet Swarm"

## Product Context
- **What this is:** Personal AI-swarm trading command center — 1,000 simulated agents generate signals, Jarvis (Claude) assists and executes approved trades on Binance.
- **Who it's for:** A single owner-operator watching real money.
- **Space:** Trading dashboards (TradingView, exchange UIs) × premium dark tools (Linear).
- **Project type:** Data-dense dashboard web app (Next.js + Tailwind 4).
- **The one memorable thing:** *"A thousand AI agents working for me."* Every visual decision serves this.

## Aesthetic Direction
- **Direction:** Cinematic HUD, data-legible ("Quiet Swarm"). Mission control at 2am, not a casino floor.
- **Governing rule:** The swarm is ambient, the money is solid. Decoration lives at low opacity *behind* the data plane; financial values are flat, sharp, unanimated at rest.
- **Decoration level:** Intentional (swarm particle field, hairline panels; no gradients on UI chrome).

## Typography
- **Display/HUD:** Chakra Petch 600/700 — page titles, section headers, HUD labels. Uppercase, `letter-spacing: .06–.08em`. Never below 11px, never body copy.
- **UI/Body:** Instrument Sans 400/500/600 — everything conversational, buttons, table headers.
- **Data:** JetBrains Mono 400/500/700 — **every digit in the product** (prices, P&L, timestamps, ticks). `font-feature-settings: "zero"` (slashed zeros near money). Monospace = no layout shift on ticking values. No exceptions, including chat bubbles.
- **Loading:** `next/font/google` in `app/layout.tsx` (variables `--font-chakra`, `--font-instrument`, `--font-jetbrains`).
- **Scale:** labels 11px · body 14px · card values 28–30px · page titles 24–30px · hero P&L 36px.

## Color
- **Approach:** Restrained. Cyan is the only voice of the machine; green/red speak only for money; amber speaks only for live capital.

```css
--background: #060504;  /* page — warm void (arc-reactor revision) */
--panel:      #120D07;  /* cards, chat, tables */
--panel-2:    #1B140B;  /* nested: inputs, tooltips, hover rows */
--foreground: #F2EDE4;  /* warm off-white, never pure white */
--muted:      #8D8272;
--accent:     #FFAE33;  /* arc-reactor amber — the swarm's/Jarvis's color */
--bullish:    #2FE6A0;
--bearish:    #FF5C7A;
--neutral:    #8A93A6;
--armed:      #FF4D4D;  /* live capital runs HOT red */
--border:     #33241374;
--glow:       0 0 24px -6px rgba(255,174,51,.45);
```

- **Glow discipline:** glow is a status indicator, not decoration. Only three things may glow: the live price dot, the Jarvis orb, the ARMED banner.
- **Depth:** background steps, 1px hairline borders, radius 8px. No drop shadows between layers.

## Signature Elements (the memorable thing, rendered)
1. **Swarm Field** — fixed canvas behind content: 1,000 particles (one per agent), 1.5px, drifting; tinted bull/bear/neutral by stance. 30fps cap, paused when hidden, killed under `prefers-reduced-motion`.
2. **Consensus Strip** — 4px strip of 1,000 ticks on signal cards, one per agent vote, labeled `L 712 · S 203 · A 85`.
3. **Agent Wire** — header ticker cycling agent dispatches (`AGENT-0447 → momentum divergence BTC 4H → flipped LONG`) every ~4s, driven by real signal data.
4. **ARMED mode** — when execution mode is `live`, the HUD accent remaps cyan→amber app-wide + persistent `⏺ ARMED · LIVE CAPITAL · BINANCE` strip. Testnet shows a cyan `TESTNET` chip. You can tell from across the room whether the machine can spend money.

## Charts
- Horizontal gridlines only (`--border` @ 50%, 1px). No vertical gridlines, no axis lines, no tick marks.
- Tick labels: JetBrains Mono 11px `--muted`.
- Lines 1.5px, no point dots. Area fills: vertical gradient to transparent, ≤12% opacity.
- Bars: solid bull/bear @ 80%, 2px top radius, no gradients.
- Exactly one glowing element per chart: the live point (4px, accent, pulse 2s).
- Tooltip: `--panel-2`, 1px accent-tinted border, radius 6px, instant (0ms), Chakra label + mono values.
- No 3D, no chart shadows.

## Spacing & Layout
- **Base unit:** 4px. Density: compact-comfortable (data pages compact, chat comfortable).
- **Layout:** grid-disciplined. Max content width 72rem (existing `max-w-6xl`).
- **Radius:** panels 8px, chips/buttons 4–6px, orb full. Never bubble-radius everything.
- **Risk (locked in):** the candlestick/price chart is NOT the hero. Home = swarm state + P&L + top conviction signal.

## Motion
- **Perpetual:** swarm drift; Jarvis orb breathing (scale 1→1.06, 3s); live-dot pulse. Nothing else loops.
- **On event:** entrances 180ms (opacity + 4px translateY); value changes flash background 300ms @ 8% bull/bear — the digit itself NEVER rolls/slides.
- **Never animates:** P&L totals at rest, layout (no reflow on data), and the trade-confirmation card — it appears in 0ms, dead static. Stillness = seriousness.
- **Tokens:** hover 120ms, enter 180ms, state 250ms, reveal 400ms max. Ease-in-out `cubic-bezier(.2,0,0,1)`. Respect `prefers-reduced-motion` (kill drift, keep flashes).

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-05 | Quiet Swarm system created | /design-consultation: research (TradingView/Linear) + outside-voice synthesis; owner approved cinematic-legible HUD, swarm-as-hero, ARMED mode |
| 2026-07-05 | Arc-reactor revision | Owner supplied Iron-Man reference video: HUD accent cyan→amber (#FFAE33) on warm blacks, ARMED remaps to hot red (#FF4D4D), mission-control status modules added to header, arc-reactor Jarvis orb, HUD corner brackets on stat cards |
