// Binance spot adapter — signed REST via node:crypto, no SDK dependency.
// Testnet-first: points at testnet.binance.vision unless BINANCE_TESTNET=false.

import { createHmac } from "node:crypto";
import type { BrokerAdapter, OcoStatus, PlacedOrder } from "./types";

// Keep in sync with CRYPTO_PAIRS in app/lib/prices.ts.
const PAIRS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

export function toPair(symbol: string): string | null {
  return PAIRS[symbol.toUpperCase()] ?? null;
}

export function baseUrl(): string {
  return process.env.BINANCE_TESTNET === "false"
    ? "https://api.binance.com"
    : "https://testnet.binance.vision";
}

export function sign(query: string, secret: string): string {
  return createHmac("sha256", secret).update(query).digest("hex");
}

// USDT pairs on the watchlist (BTC, ETH) use 2-decimal price ticks and accept
// 5-decimal quantities. A full exchangeInfo lookup can replace this later.
export function roundPrice(price: number): string {
  return price.toFixed(2);
}

export function roundQty(qty: number): string {
  return (Math.floor(qty * 1e5) / 1e5).toFixed(5);
}

interface BinanceFill {
  price: string;
  qty: string;
}

async function signedRequest(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string>
): Promise<unknown> {
  const key = process.env.BINANCE_API_KEY;
  const secret = process.env.BINANCE_API_SECRET;
  if (!key || !secret) throw new Error("Binance API credentials not configured");

  const query = new URLSearchParams({
    ...params,
    recvWindow: "5000",
    timestamp: String(Date.now()),
  }).toString();
  const url = `${baseUrl()}${path}?${query}&signature=${sign(query, secret)}`;

  const res = await fetch(url, {
    method,
    headers: { "X-MBX-APIKEY": key },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "msg" in body
        ? (body as { msg: string }).msg
        : res.statusText;
    throw new Error(`Binance ${path} failed (${res.status}): ${msg}`);
  }
  return body;
}

function avgFillPrice(fills: BinanceFill[] | undefined): number | null {
  if (!fills?.length) return null;
  let notional = 0;
  let qty = 0;
  for (const f of fills) {
    notional += parseFloat(f.price) * parseFloat(f.qty);
    qty += parseFloat(f.qty);
  }
  return qty > 0 ? notional / qty : null;
}

export function binanceBroker(): BrokerAdapter {
  return {
    name: "binance",

    isEnabled() {
      return (
        process.env.EXECUTION_ENABLED === "true" &&
        !!process.env.BINANCE_API_KEY &&
        !!process.env.BINANCE_API_SECRET
      );
    },

    supports(symbol: string) {
      return toPair(symbol) !== null;
    },

    async placeMarketOrder(symbol, side, quoteNotionalUsd) {
      const pair = toPair(symbol);
      if (!pair) throw new Error(`unsupported symbol for Binance: ${symbol}`);
      const data = (await signedRequest("POST", "/api/v3/order", {
        symbol: pair,
        side,
        type: "MARKET",
        quoteOrderQty: quoteNotionalUsd.toFixed(2),
        newOrderRespType: "FULL",
      })) as {
        orderId: number;
        status: string;
        executedQty: string;
        fills?: BinanceFill[];
      };
      return {
        brokerOrderId: String(data.orderId),
        status: data.status === "FILLED" ? "filled" : "requested",
        fillPrice: avgFillPrice(data.fills),
        executedQty: parseFloat(data.executedQty) || null,
        raw: data,
      } satisfies PlacedOrder;
    },

    async placeOcoExit(symbol, side, qty, takeProfitPrice, stopLossPrice) {
      const pair = toPair(symbol);
      if (!pair) throw new Error(`unsupported symbol for Binance: ${symbol}`);
      // For a SELL exit: TP is the above (limit maker) leg, SL the below leg.
      const data = (await signedRequest("POST", "/api/v3/orderList/oco", {
        symbol: pair,
        side,
        quantity: roundQty(qty),
        aboveType: "LIMIT_MAKER",
        abovePrice: roundPrice(takeProfitPrice),
        belowType: "STOP_LOSS_LIMIT",
        belowStopPrice: roundPrice(stopLossPrice),
        belowPrice: roundPrice(stopLossPrice * 0.999),
        belowTimeInForce: "GTC",
      })) as { orderListId: number; listOrderStatus: string };
      return {
        brokerOrderId: String(data.orderListId),
        status: "requested",
        fillPrice: null,
        executedQty: qty,
        raw: data,
      } satisfies PlacedOrder;
    },

    async getOcoStatus(symbol, brokerOrderId) {
      const pair = toPair(symbol);
      if (!pair) throw new Error(`unsupported symbol for Binance: ${symbol}`);
      const list = (await signedRequest("GET", "/api/v3/orderList", {
        orderListId: brokerOrderId,
      })) as {
        listOrderStatus: string;
        orders: { orderId: number; symbol: string }[];
      };
      if (list.listOrderStatus !== "ALL_DONE") {
        return { done: false, exitPrice: null, raw: list } satisfies OcoStatus;
      }
      // One leg filled; find it for the real exit price.
      for (const leg of list.orders) {
        const order = (await signedRequest("GET", "/api/v3/order", {
          symbol: pair,
          orderId: String(leg.orderId),
        })) as { status: string; price: string; cummulativeQuoteQty: string; executedQty: string };
        if (order.status === "FILLED") {
          const qty = parseFloat(order.executedQty);
          const exitPrice =
            qty > 0 ? parseFloat(order.cummulativeQuoteQty) / qty : parseFloat(order.price);
          return { done: true, exitPrice, raw: list } satisfies OcoStatus;
        }
      }
      // List done but no filled leg found (e.g. expired) — close on last known data.
      return { done: true, exitPrice: null, raw: list } satisfies OcoStatus;
    },
  };
}
