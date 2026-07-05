import { ReactNode } from "react";

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5 ${className}`}
    >
      {title && <h3 className="hud-label mb-3">{title}</h3>}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "bullish" | "bearish" | "neutral";
}) {
  const color =
    tone === "bullish"
      ? "text-[var(--bullish)]"
      : tone === "bearish"
      ? "text-[var(--bearish)]"
      : tone === "neutral"
      ? "text-[var(--neutral)]"
      : "";
  return (
    <Card>
      <div className="hud-label">{label}</div>
      <div className={`num mt-1 text-[28px] font-medium ${color}`}>{value}</div>
      {hint && <div className="num mt-1 text-xs text-[var(--muted)]">{hint}</div>}
    </Card>
  );
}
