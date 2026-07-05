// BrokerAdapter — matches the Phase 4 adapter shape planned in ARCHITECTURE.md
// so this layer can later move into the standalone orchestrator unchanged.

export interface PlacedOrder {
  brokerOrderId: string;
  status: "filled" | "requested" | "rejected";
  fillPrice: number | null;
  executedQty: number | null;
  raw: unknown;
}

export interface OcoStatus {
  done: boolean;
  exitPrice: number | null;
  raw: unknown;
}

export interface BrokerAdapter {
  name: string;
  /** True when API credentials are present and execution is enabled. */
  isEnabled(): boolean;
  /** True when this broker can trade the given dashboard symbol (e.g. BTC). */
  supports(symbol: string): boolean;
  /** Market entry sized by quote notional (USD). */
  placeMarketOrder(
    symbol: string,
    side: "BUY" | "SELL",
    quoteNotionalUsd: number
  ): Promise<PlacedOrder>;
  /** Exchange-side TP/SL exit for an open position. */
  placeOcoExit(
    symbol: string,
    side: "BUY" | "SELL",
    qty: number,
    takeProfitPrice: number,
    stopLossPrice: number
  ): Promise<PlacedOrder>;
  /** Poll an OCO order list; done=true when either leg filled. */
  getOcoStatus(symbol: string, brokerOrderId: string): Promise<OcoStatus>;
}
