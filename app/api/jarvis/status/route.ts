export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Whether a key is configured. This does not call Anthropic, and it does not
// mean the last conversation succeeded — the header reads that from this browser.
export async function GET() {
  return Response.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) });
}
