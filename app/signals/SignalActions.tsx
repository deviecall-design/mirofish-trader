"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveSignal, ignoreSignal } from "./actions";
import type { SignalRow } from "../lib/supabase";

export function SignalActions({ signal }: { signal: SignalRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 shrink-0">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await approveSignal(signal.id);
            router.refresh();
          })
        }
        className="px-3 py-1.5 rounded bg-[var(--bullish)] text-black font-medium text-sm disabled:opacity-50"
      >
        Approve
      </button>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await ignoreSignal(signal.id);
            router.refresh();
          })
        }
        className="px-3 py-1.5 rounded border border-[var(--border)] text-sm disabled:opacity-50"
      >
        Ignore
      </button>
    </div>
  );
}
