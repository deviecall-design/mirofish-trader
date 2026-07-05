import type { Metadata } from "next";
import { Chakra_Petch, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import JarvisPanel from "./components/JarvisPanel";
import SwarmField from "./components/SwarmField";
import AgentWire from "./components/AgentWire";
import { executionMode } from "./lib/execution";

const chakra = Chakra_Petch({
  variable: "--font-chakra",
  weight: ["600", "700"],
  subsets: ["latin"],
});
const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MiroFish Trader",
  description: "A thousand AI agents working for you — swarm-driven trading with Jarvis",
};

const NAV = [
  { href: "/",            label: "Dashboard" },
  { href: "/signals",     label: "Signals" },
  { href: "/journal",     label: "Journal" },
  { href: "/performance", label: "Performance" },
  { href: "/watchlist",   label: "Watchlist" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = executionMode();
  return (
    <html
      lang="en"
      className={`${chakra.variable} ${instrument.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col" data-mode={mode}>
        <SwarmField />
        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="border-b border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-sm">
            <div className="mx-auto max-w-6xl px-6 py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Link href="/" className="flex items-center gap-3">
                  <span aria-hidden>🐟</span>
                  <span className="hud-title text-lg text-[var(--foreground)]">
                    MiroFish <span style={{ color: "var(--hud)" }}>Trader</span>
                  </span>
                  {mode === "live" && (
                    <span
                      className="hud-label rounded border border-[var(--armed)] px-2.5 py-0.5"
                      style={{ color: "var(--armed)", boxShadow: "var(--glow)" }}
                    >
                      ⏺ Armed · Live Capital · Binance
                    </span>
                  )}
                  {mode === "testnet" && (
                    <span
                      className="hud-label rounded border border-[var(--accent)]/40 px-2.5 py-0.5"
                      style={{ color: "var(--accent)" }}
                    >
                      Testnet
                    </span>
                  )}
                </Link>
                <nav className="flex gap-1">
                  {NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="hud-label px-3 py-1.5 rounded hover:bg-[var(--panel-2)] hover:text-[var(--foreground)] transition-colors duration-120"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="mt-2">
                <AgentWire />
              </div>
            </div>
          </header>
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
          </main>
        </div>
        <JarvisPanel />
      </body>
    </html>
  );
}
