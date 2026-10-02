import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendTelegram, telegramAlertsEnabled } from "./telegram";

describe("sendTelegram kill switch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "12345");
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not send when TELEGRAM_ALERTS_ENABLED is unset (default off)", async () => {
    vi.stubEnv("TELEGRAM_ALERTS_ENABLED", "");
    expect(telegramAlertsEnabled()).toBe(false);
    await expect(sendTelegram("hello")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["false", "1", "TRUE", "yes"])(
    "does not send when TELEGRAM_ALERTS_ENABLED=%s",
    async (value) => {
      vi.stubEnv("TELEGRAM_ALERTS_ENABLED", value);
      await expect(sendTelegram("hello", 999)).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("sends when TELEGRAM_ALERTS_ENABLED is exactly \"true\"", async () => {
    vi.stubEnv("TELEGRAM_ALERTS_ENABLED", "true");
    await expect(sendTelegram("hello")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    expect(JSON.parse(init.body).chat_id).toBe("12345");
  });
});
