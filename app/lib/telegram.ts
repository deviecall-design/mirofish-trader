const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegram(text: string, chatId?: string | number) {
  if (!BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN not set — skipping send");
    return null;
  }
  const target = chatId ?? CHAT_ID;
  if (!target) {
    console.warn("No telegram chat id available");
    return null;
  }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
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
