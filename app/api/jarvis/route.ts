// Jarvis: Claude-powered assistant for the dashboard. Manual tool-use loop so
// mutating tools stay behind the confirm gate enforced in tools.ts.

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { JARVIS_TOOLS, runJarvisTool } from "./tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TOOL_ITERATIONS = 8;

const JARVIS_SYSTEM = `You are Jarvis, the assistant embedded in the MiroFish Trader dashboard. You help the owner monitor signals, positions and performance, run swarm sentiment simulations, and act on pending signals.

Rules that override everything else:
- Never claim a trade or order was placed unless a tool result in this conversation confirms it.
- approve_signal with confirm=true may ONLY be called after the user has explicitly confirmed the specific order in this conversation (e.g. after you showed the preview and they said yes/confirm). Never treat your own preview as confirmation. If in doubt, ask.
- When you show an order preview, state the symbol, direction, current price, and whether it is paper, testnet, or LIVE money.
- Be concise and direct — this is a trading dashboard, not a chat lounge. Use plain text, no markdown tables.
- If a tool errors, report the error honestly and suggest what the user can do.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string | Anthropic.ContentBlockParam[];
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const history = (body.messages ?? []).slice(-30);
  if (!history.length) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const toolEvents: { name: string; input: unknown; result: unknown }[] = [];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 2048,
        thinking: { type: "adaptive" },
        system: JARVIS_SYSTEM,
        tools: JARVIS_TOOLS,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason !== "tool_use") {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        return Response.json({ reply, toolEvents, messages });
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        let result: unknown;
        try {
          result = await runJarvisTool(block.name, block.input as Record<string, unknown>);
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) };
        }
        toolEvents.push({ name: block.name, input: block.input, result });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }

    return Response.json({
      reply: "I hit my tool-call limit for one message — ask me to continue.",
      toolEvents,
      messages,
    });
  } catch (err) {
    console.error("Jarvis error:", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: message, toolEvents }, { status: 500 });
  }
}
