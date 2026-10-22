export async function onRequestGet({ env }) {
  const configured = Boolean(env.AI_GEMINI_KEY || env.GEMINI_API_KEY);
  return Response.json({
    status: configured ? "ready" : "needs_configuration",
    aiConfigured: configured,
    model: "gemini-3.8-flash",
    note: configured ? "AI key is configured" : "Set AI_GEMINI_KEY in Cloudflare."
  }, { headers: { "Cache-Control": "no-store" } });
}
