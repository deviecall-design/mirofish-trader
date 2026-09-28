"use client";

import { useEffect, useState } from "react";
import { formatSignalAge } from "../lib/freshness";
import {
  JARVIS_STATUS_EVENT,
  readJarvisClientStatus,
  type JarvisClientStatus,
} from "../lib/jarvisClientStatus";

function Chip({
  value,
  tone,
  title,
}: {
  value: string;
  tone: "ok" | "off";
  title?: string;
}) {
  const dot = tone === "ok" ? "var(--bullish)" : "var(--muted)";
  return (
    <span
      title={title}
      className="hud-label flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1"
    >
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: dot, boxShadow: tone === "ok" ? `0 0 6px ${dot}` : "none" }}
      />
      Jarvis <span className="text-[var(--foreground)]">{value}</span>
    </span>
  );
}

export default function JarvisStatus() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [local, setLocal] = useState<JarvisClientStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jarvis/status")
      .then((res) => res.json())
      .then((data: { configured?: boolean }) => {
        if (!cancelled) setConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sync = () => setLocal(readJarvisClientStatus());
    sync();
    window.addEventListener(JARVIS_STATUS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(JARVIS_STATUS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (configured == null || local == null) return <Chip value="checking" tone="off" />;
  if (!configured) return <Chip value="not configured" tone="off" title="ANTHROPIC_API_KEY is not set" />;

  const failed =
    local.lastErrorAt &&
    (!local.lastSuccessAt || local.lastErrorAt > local.lastSuccessAt);

  if (failed) {
    return (
      <Chip
        value="last call failed"
        tone="off"
        title={local.lastError ?? "The last Jarvis request from this browser failed"}
      />
    );
  }
  if (local.lastSuccessAt) {
    return (
      <Chip
        value={`last reply ${formatSignalAge(local.lastSuccessAt)}`}
        tone="ok"
        title="Last successful reply from this browser. A configured key alone is not treated as active."
      />
    );
  }
  return (
    <Chip
      value="key set, no reply yet"
      tone="off"
      title="The API key is configured. Jarvis has not completed a call from this browser."
    />
  );
}
