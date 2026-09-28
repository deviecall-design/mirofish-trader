// Gate for any Binance order (testnet or live). Fail closed: if
// TRADING_API_SECRET is unset, or the request does not present it, no
// broker order is sent. Paper trades never call this.

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

export class OrderUnauthorizedError extends Error {
  constructor() {
    super(
      "broker order refused: caller is not authenticated (Authorization: Bearer TRADING_API_SECRET required)"
    );
    this.name = "OrderUnauthorizedError";
  }
}

/** Constant-time check. Empty or missing secret never matches. */
export function authorizationMatches(
  header: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const presented = Buffer.from(header ?? "");
  const required = Buffer.from(expected);
  if (presented.length !== required.length) return false;
  return timingSafeEqual(presented, required);
}

export async function assertBrokerOrderAuthorized(): Promise<void> {
  const hdrs = await headers();
  if (
    !authorizationMatches(
      hdrs.get("authorization"),
      process.env.TRADING_API_SECRET
    )
  ) {
    throw new OrderUnauthorizedError();
  }
}
