"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  STALE_SIGNAL_AFTER_DAYS,
  formatScanWhen,
  formatSignalAge,
  isStaleSignal,
} from "../lib/freshness";

export default function ScanBanner() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase()
          .from("signals")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setState("error");
          return;
        }
        setCreatedAt((data?.created_at as string | undefined) ?? null);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const warn = state === "error" || (state === "ready" && (!createdAt || isStaleSignal(createdAt)));
  let text: string;
  if (state === "loading") {
    text = "Last scan: checking…";
  } else if (state === "error") {
    text = "Last scan: unknown. The signal list could not be read.";
  } else if (!createdAt) {
    text = "Last scan: never. The scanner has not stored a signal.";
  } else if (isStaleSignal(createdAt)) {
    text =
      `Last scan: ${formatScanWhen(createdAt)} (${formatSignalAge(createdAt)}). ` +
      `Nothing has been stored since then, so the scanner looks stopped. ` +
      `It is scheduled every 15 minutes and only writes a row when a watched price moves 2% or more. ` +
      `Signals older than ${STALE_SIGNAL_AFTER_DAYS} days stay off the headline.`;
  } else {
    text = `Last scan: ${formatScanWhen(createdAt)} (${formatSignalAge(createdAt)}).`;
  }

  return (
    <p
      className="mt-3 rounded border px-3 py-2 text-sm leading-relaxed"
      style={{
        borderColor: warn
          ? "color-mix(in srgb, var(--bearish) 55%, transparent)"
          : "var(--border)",
        background: warn
          ? "color-mix(in srgb, var(--bearish) 10%, transparent)"
          : "transparent",
        color: "var(--foreground)",
      }}
    >
      {text}
    </p>
  );
}
