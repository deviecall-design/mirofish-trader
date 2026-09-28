// A neutral signal is "no clear edge". It must not open a paper or real
// trade. Bullish and bearish signals can. The scanner may still store a
// neutral row so the history is complete.

export function canOpenTrade(direction: string | null | undefined): boolean {
  return direction === "bullish" || direction === "bearish";
}
