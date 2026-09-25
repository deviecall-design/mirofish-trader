// How old a stored signal can be before the dashboard stops treating it as
// current.
//
// The scanner is scheduled every 15 minutes. It writes a row only when a
// watched price has moved at least 2% (or the first time it sees a symbol).
// Seven days is long enough that a quiet name can go without a new row, and
// short enough that a scanner which has stopped cannot keep the May notes
// at the top of the screen. "Older than 7 days" means strictly more than
// 7 * 24 hours. A signal from exactly 7 days ago is still fresh.

export const STALE_SIGNAL_AFTER_DAYS = 7;
export const STALE_SIGNAL_AFTER_MS = STALE_SIGNAL_AFTER_DAYS * 24 * 60 * 60 * 1000;

export function signalAgeMs(createdAt: string, now = Date.now()): number {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - t);
}

export function isStaleSignal(createdAt: string, now = Date.now()): boolean {
  return signalAgeMs(createdAt, now) > STALE_SIGNAL_AFTER_MS;
}

export function formatSignalAge(createdAt: string, now = Date.now()): string {
  const ms = signalAgeMs(createdAt, now);
  if (!Number.isFinite(ms)) return "unknown age";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatScanWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown date";
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hourCycle: "h23",
  }).format(d);
  return `${formatted} UTC`;
}
