"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import JarvisChat from "./JarvisChat";

// Floating Jarvis orb + dock. Hidden on the dashboard, where JarvisChat is
// embedded directly as the cockpit console.

export default function JarvisPanel() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[380px] max-w-[calc(100vw-2.5rem)] rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
            <div className="hud-title text-sm flex items-center gap-2" style={{ color: "var(--hud)" }}>
              <span aria-hidden>⚡</span> Jarvis
            </div>
          </div>
          <JarvisChat />
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Jarvis assistant"
        className="relative rounded-full w-[56px] h-[56px] text-lg grid place-items-center"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--hud) 55%, white 10%) 0%, color-mix(in srgb, var(--hud) 30%, transparent) 28%, transparent 62%), var(--panel)",
          border: "1px solid color-mix(in srgb, var(--hud) 40%, transparent)",
          boxShadow: "var(--glow)",
          color: "var(--hud)",
          animation: open ? "none" : "breathe 3s ease-in-out infinite",
        }}
      >
        <span
          aria-hidden
          className="absolute inset-[5px] rounded-full pointer-events-none"
          style={{
            border: "1px dashed color-mix(in srgb, var(--hud) 60%, transparent)",
            animation: "reactor-spin 14s linear infinite",
          }}
        />
        <span
          aria-hidden
          className="absolute inset-[11px] rounded-full pointer-events-none"
          style={{ border: "1px solid color-mix(in srgb, var(--hud) 35%, transparent)" }}
        />
        {open ? "✕" : "⚡"}
      </button>
    </div>
  );
}
