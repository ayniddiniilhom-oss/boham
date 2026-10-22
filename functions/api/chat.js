export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin"
  };

  // Compare against this deployment's own host so preview and production hosts work,
  // while cross-origin browser calls are rejected. This is not authentication or rate limiting.
  const requestOrigin = new URL(request.url).origin;
  if (origin && origin !== requestOrigin) {
    return Response.json({ error: "Дархост аз манбаи иҷозатнадошта қабул нашуд." }, { status: 403, headers });
  }
  if (!env.AI_GEMINI_KEY) {
    return Response.json({ error: "Калиди AI дар Cloudflare танзим нашудааст." }, { status: 500, headers });
  }
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") {
    return Response.json({ error: "Дархост бояд JSON бошад." }, { status: 415, headers });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Формати дархост нодуруст аст." }, { status: 400, headers }); }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4000) {
    return Response.json({ error: "Савол бояд аз 1 то 4000 аломат бошад." }, { status: 400, headers });
  }

  // Keep the model name configurable. Default is a current stable Flash model;
  // set GEMINI_MODEL in Cloudflare if your AI Studio account uses another model.
  const model = typeof env.GEMINI_MODEL === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(env.GEMINI_MODEL)
    ? env.GEMINI_MODEL : "gemini-3.8-flash";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.AI_GEMINI_KEY
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "Ту Ёвари «Бо Ҳам», ёвари портали донишҷӯён ҳастӣ. Ҷавобҳоро одӣ, муфид ва боэҳтиром навис. Ба забони корбар ҷавоб деҳ; барои тоҷикӣ забони тоҷикиро истифода бар. Маълумоти расмии донишкада, ҷадвали дарс, нарх ё эълони тасдиқнашударо насоз. Агар маълумот надорӣ, ошкоро бигӯ. Ба корбар ёдрас кун, ки ҷавобҳои AI метавонанд хато дошта бошанд." }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 800 }
      })
    });
    const result = await upstream.json();
    if (!upstream.ok) {
      // Keep provider details and API key out of public responses.
      const status = upstream.status === 429 ? 429 : 502;
      return Response.json({ error: status === 429 ? "Лимити дархостҳои AI расид. Каме баъд кӯшиш кунед." : "Хидмати AI ҳоло ҷавоб надод. Танзими модел ва калидро санҷед." }, { status, headers });
    }
    const answer = result?.candidates?.[0]?.content?.parts?.map(p => typeof p.text === "string" ? p.text : "").join("").trim();
    if (!answer) return Response.json({ error: "AI ҷавоби матнӣ барнагардонд." }, { status: 502, headers });
    return Response.json({ answer }, { status: 200, headers });
  } catch {
    return Response.json({ error: "Хидмати AI дер ҷавоб дод ё пайвастшавӣ қатъ шуд. Баъдтар кӯшиш кунед." }, { status: 502, headers });
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Allow": "POST, OPTIONS" } });
  return Response.json({ error: "Танҳо POST иҷозат аст." }, { status: 405, headers: { "Allow": "POST" } });
}
