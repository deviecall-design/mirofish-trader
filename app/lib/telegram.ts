/**
 * Telegram notifications are OFF by default.
 *
 * Messages are only sent when TELEGRAM_ALERTS_ENABLED is exactly "true".
 * When disabled, sendTelegram logs and returns null; callers already treat
 * null as "not sent", so scans, signals and paper-trade closes keep working
 * and only the notification is skipped.
 *
 * To turn alerts back on, set TELEGRAM_ALERTS_ENABLED=true in the Vercel
 * project's environment variables and redeploy.
 */
export function telegramAlertsEnabled(): boolean {
  return process.env.TELEGRAM_ALERTS_ENABLED === "true";
}

export async function sendTelegram(text: string, chatId?: string | number) {
  if (!telegramAlertsEnabled()) {
    console.info(
      "Telegram alerts disabled (set TELEGRAM_ALERTS_ENABLED=true to enable) — skipping send",
    );
    return null;
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn("TELEGRAM_BOT_TOKEN not set — skipping send");
    return null;
  }
  const target = chatId ?? process.env.TELEGRAM_CHAT_ID;
  if (!target) {
    console.warn("No telegram chat id available");
    return null;
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: target,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    console.error("telegram send failed", await res.text());
    return null;
  }
  return res.json();
}
