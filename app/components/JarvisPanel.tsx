"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ToolEvent {
  name: string;
  input: unknown;
  result: unknown;
}

interface ConfirmPreview {
  signal_id: string;
  symbol: string;
  direction: string;
  conviction?: number;
  currentPrice?: number;
  executionMode: string;
  note?: string;
}

interface ChatEntry {
  role: "user" | "assistant";
  text: string;
  confirm?: ConfirmPreview | null;
}

// Minimal typing for the (webkit-prefixed) Web Speech API.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function extractConfirm(toolEvents: ToolEvent[]): ConfirmPreview | null {
  for (const ev of toolEvents) {
    const r = ev.result as { needs_confirmation?: boolean } & ConfirmPreview;
    if (ev.name === "approve_signal" && r?.needs_confirmation) return r;
  }
  return null;
}

export default function JarvisPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speakRef = useRef(speak);
  speakRef.current = speak;

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries, busy]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      setInput("");
      setEntries((prev) => [...prev, { role: "user", text: trimmed }]);

      try {
        const history = [
          ...entries.map((e) => ({ role: e.role, content: e.text })),
          { role: "user", content: trimmed },
        ];
        const res = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

        const confirm = extractConfirm(data.toolEvents ?? []);
        setEntries((prev) => [
          ...prev,
          { role: "assistant", text: data.reply ?? "(no reply)", confirm },
        ]);
        if (speakRef.current && data.reply && typeof speechSynthesis !== "undefined") {
          speechSynthesis.cancel();
          speechSynthesis.speak(new SpeechSynthesisUtterance(data.reply));
        }
      } catch (err) {
        setEntries((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `⚠️ ${err instanceof Error ? err.message : "request failed"}`,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, entries]
  );

  const toggleMic = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = "en-AU";
    rec.interimResults = false;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) void send(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening, send]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[380px] max-w-[calc(100vw-2.5rem)] rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
            <div className="font-semibold text-sm flex items-center gap-2">
              <span aria-hidden>⚡</span> Jarvis
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={speak}
                onChange={(e) => setSpeak(e.target.checked)}
              />
              Speak replies
            </label>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 max-h-[55vh] min-h-[160px] text-sm">
            {entries.length === 0 && (
              <p className="text-[var(--muted)] text-xs leading-relaxed">
                Ask me things like “what’s pending?”, “show my open positions”,
                “run the swarm on BTC”, or “approve DRO”. Orders are only ever
                placed after you explicitly confirm.
              </p>
            )}
            {entries.map((entry, i) => (
              <div key={i}>
                <div
                  className={
                    entry.role === "user"
                      ? "ml-8 rounded-lg bg-[var(--panel-2)] px-3 py-2 whitespace-pre-wrap"
                      : "mr-4 whitespace-pre-wrap"
                  }
                >
                  {entry.text}
                </div>
                {entry.confirm && (
                  <div className="mt-2 mr-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs space-y-2">
                    <div className="font-semibold">
                      Confirm order — {entry.confirm.symbol} {entry.confirm.direction}
                      {entry.confirm.currentPrice != null &&
                        ` @ $${Number(entry.confirm.currentPrice).toFixed(2)}`}
                    </div>
                    <div className="uppercase tracking-wide font-semibold">
                      {entry.confirm.executionMode === "live"
                        ? "🔴 LIVE — real money"
                        : entry.confirm.executionMode}
                    </div>
                    {entry.confirm.note && <div>{entry.confirm.note}</div>}
                    <div className="flex gap-2 pt-1">
                      <button
                        className="rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-500 disabled:opacity-50"
                        disabled={busy}
                        onClick={() =>
                          send(
                            `Yes, I confirm — approve signal ${entry.confirm!.signal_id} and place the order.`
                          )
                        }
                      >
                        Confirm
                      </button>
                      <button
                        className="rounded border border-[var(--border)] px-3 py-1 hover:bg-[var(--panel-2)] disabled:opacity-50"
                        disabled={busy}
                        onClick={() => send("No — cancel that order.")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="text-[var(--muted)] text-xs">Jarvis is thinking…</div>}
          </div>

          <form
            className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              className="flex-1 rounded bg-[var(--panel-2)] px-3 py-1.5 text-sm outline-none border border-transparent focus:border-[var(--border)]"
              placeholder={listening ? "Listening…" : "Ask Jarvis…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleMic}
                title={listening ? "Stop listening" : "Push to talk"}
                className={`rounded px-2 py-1.5 text-sm border border-[var(--border)] hover:bg-[var(--panel-2)] ${
                  listening ? "bg-red-600/20 animate-pulse" : ""
                }`}
              >
                🎙️
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded bg-[var(--panel-2)] border border-[var(--border)] px-3 py-1.5 text-sm hover:opacity-80 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Jarvis assistant"
        className="rounded-full border border-[var(--border)] bg-[var(--panel)] shadow-lg w-12 h-12 text-xl hover:scale-105 transition-transform"
      >
        {open ? "✕" : "⚡"}
      </button>
    </div>
  );
}
