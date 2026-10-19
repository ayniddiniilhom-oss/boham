export async function onRequestGet({ env }) {
  const configured = Boolean(env.AI_GEMINI_KEY);
  return Response.json({
    status: configured ? "ready" : "needs_configuration",
    aiConfigured: configured,
    model: (typeof env.GEMINI_MODEL === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(env.GEMINI_MODEL))
      ? env.GEMINI_MODEL : "gemini-3.8-flash",
    note: configured
      ? "AI key is configured; this check does not test the provider API key itself."
      : "Set AI_GEMINI_KEY in Cloudflare Pages settings."
  }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
