"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSymbol } from "./actions";
import { Card } from "../components/Card";

export function WatchlistEditor() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [symbol, setSymbol] = useState("");
  const [theme, setTheme] = useState("AI/Tech");
  const [error, setError] = useState<string | null>(null);

  return (
    <Card title="Add symbol">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!symbol.trim()) return;
          startTransition(async () => {
            const res = await addSymbol(symbol.trim().toUpperCase(), theme);
            if (!res.ok) {
              setError(res.reason ?? "failed");
              return;
            }
            setSymbol("");
            router.refresh();
          });
        }}
      >
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Symbol e.g. AAPL"
          className="px-3 py-1.5 rounded bg-[var(--panel-2)] border border-[var(--border)] text-sm"
        />
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--panel-2)] border border-[var(--border)] text-sm"
        >
          <option>Crypto</option>
          <option>AI/Tech</option>
          <option>Speculative</option>
          <option>Other</option>
        </select>
        <button
          disabled={pending}
          className="px-3 py-1.5 rounded bg-[var(--accent)] text-black font-medium text-sm disabled:opacity-50"
        >
          Add
        </button>
        {error && <span className="text-xs text-[var(--bearish)] self-center">{error}</span>}
      </form>
    </Card>
  );
}
