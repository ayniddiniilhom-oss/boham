const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function text(value, max = 12000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function imagePart(value) {
  if (!value || typeof value !== "object") return null;
  const mimeType = String(value.mimeType || "").toLowerCase();
  const data = typeof value.data === "string" ? value.data.replace(/^data:[^;]+;base64,/, "") : "";
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowed.has(mimeType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > 8_000_000) return null;
  return { inline_data: { mime_type: mimeType, data } };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestGemini(model, geminiKey, payload, signal) {
  const delays = [0, 900, 1800, 3200];
  let lastStatus = 503;
  let lastResult = null;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await sleep(delays[attempt]);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        signal,
        body: JSON.stringify(payload),
      },
    );
    let result = {};
    try { result = await response.json(); } catch { result = {}; }
    if (response.ok) return { response, result };
    lastStatus = response.status;
    lastResult = result;
    if (![429, 500, 502, 503, 504].includes(response.status)) break;
  }
  return { response: { ok: false, status: lastStatus }, result: lastResult || {} };
}

function authHeaders(accessToken, anonKey) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function getUser(supabaseUrl, anonKey, accessToken) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  return response.ok ? response.json() : null;
}

async function createConversation(supabaseUrl, anonKey, accessToken, userId) {
  const response = await fetch(`${supabaseUrl}/rest/v1/ai_conversations`, {
    method: "POST",
    headers: { ...authHeaders(accessToken, anonKey), Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, title: "Чати нав" }),
  });
  if (!response.ok) throw new Error(`Conversation insert failed: ${response.status}`);
  const rows = await response.json();
  return rows?.[0]?.id || null;
}

async function ownConversation(supabaseUrl, anonKey, accessToken, userId, conversationId) {
  const url = new URL(`${supabaseUrl}/rest/v1/ai_conversations`);
  url.searchParams.set("select", "id");
  url.searchParams.set("id", `eq.${conversationId}`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return false;
  const rows = await response.json();
  return Array.isArray(rows) && rows.length === 1;
}

async function insertMessages(supabaseUrl, anonKey, accessToken, userId, conversationId, rows) {
  const response = await fetch(`${supabaseUrl}/rest/v1/ai_messages`, {
    method: "POST",
    headers: { ...authHeaders(accessToken, anonKey), Prefer: "return=minimal" },
    body: JSON.stringify(rows.map((row) => ({
      conversation_id: conversationId,
      user_id: userId,
      role: row.role,
      content: row.content,
    }))),
  });
  if (!response.ok) throw new Error(`Message insert failed: ${response.status}`);
}

async function touchConversation(supabaseUrl, anonKey, accessToken, conversationId) {
  await fetch(`${supabaseUrl}/rest/v1/ai_conversations?id=eq.${conversationId}`, {
    method: "PATCH",
    headers: { ...authHeaders(accessToken, anonKey), Prefer: "return=minimal" },
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS", ...JSON_HEADERS } });
}

export async function onRequestPost({ request, env }) {
  const supabaseUrl = String(env.SUPABASE_URL || "https://otpbejlswdxqhgbgqnhu.supabase.co").replace(/\/$/, "");
  const anonKey = env.SUPABASE_ANON_KEY || "sb_publishable_RJt-ytjsKJf9_E6kfFDcuA_uxRr2Rsj";
  const geminiKey = env.AI_GEMINI_KEY || env.GEMINI_API_KEY;
  const model = /^[a-zA-Z0-9._-]{1,80}$/.test(env.GEMINI_MODEL || "")
    ? env.GEMINI_MODEL
    : "gemini-2.5-flash";

  if (!supabaseUrl || !anonKey || !geminiKey) {
    return json({ error: "Танзимоти серверӣ пурра нестанд." }, 500);
  }

  const tokenMatch = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  const accessToken = tokenMatch?.[1] || "";
  if (!accessToken) return json({ error: "Аввал ба аккаунт ворид шавед." }, 401);

  const user = await getUser(supabaseUrl, anonKey, accessToken);
  if (!user?.id) return json({ error: "Сессия гузаштааст. Аз нав ворид шавед." }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Формати JSON нодуруст аст." }, 400); }

  const message = text(body?.message, 12000);
  if (!message) return json({ error: "Паём холӣ буда наметавонад." }, 400);
  const image = imagePart(body?.image);
  if (body?.image && !image) return json({ error: "Акс нодуруст аст ё аз ҳад калон мебошад." }, 400);

  let conversationId = text(body?.conversationId, 80);
  try {
    if (conversationId) {
      if (!await ownConversation(supabaseUrl, anonKey, accessToken, user.id, conversationId)) {
        return json({ error: "Ин гуфтугӯ ба шумо тааллуқ надорад." }, 403);
      }
    } else {
      conversationId = await createConversation(supabaseUrl, anonKey, accessToken, user.id);
    }

    if (!conversationId) return json({ error: "Гуфтугӯ сохта нашуд." }, 502);

    const history = Array.isArray(body?.history)
      ? body.history
          .filter((item) => item && (item.role === "user" || item.role === "assistant"))
          .map((item) => ({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: text(item.content) }],
          }))
          .filter((item) => item.parts[0].text)
          .slice(-20)
      : [];

    const geminiController = new AbortController();
    const geminiTimeout = setTimeout(() => geminiController.abort(), 25000);
    let upstream;
    let upstreamResult;
    try {
      ({ response: upstream, result: upstreamResult } = await requestGemini(model, geminiKey, {
          system_instruction: { parts: [{ text: "Ту Ёвари «Бо Ҳам», ёвари портали донишҷӯён ҳастӣ. Ба саволи охир мустақим ҷавоб деҳ ва мавзӯъро гум накун. Ба забони корбар ҷавоб деҳ; агар тоҷикӣ нависад, тоҷикӣ навис. Ҷавобро пайдарпай ва сохторнок бо Markdown навис: аввал хулосаи кӯтоҳ, баъд қадамҳо ё нуқтаҳои асосӣ. Аз такрори ҷумлаҳо, ҷавобҳои пароканда ва саволҳои нолозим худдорӣ кун. Маълумоти расмӣ, ҷадвал, нарх ё эълонро насоз; агар маълумот надорӣ, ошкоро бигӯ." }] },
          contents: [...history, { role: "user", parts: image ? [{ text: message }, image] : [{ text: message }] }],
          generationConfig: { temperature: 0.25, maxOutputTokens: 1800 },
        }, geminiController.signal));
    } finally {
      clearTimeout(geminiTimeout);
    }

    const result = upstreamResult || {};
    if (!upstream.ok) {
      console.error("Gemini error", upstream.status, result);
      if (upstream.status === 429) return json({ error: "Лимити муваққатии AI расид. Лутфан баъд аз якчанд сония боз кӯшиш кунед." }, 429);
      return json({ error: "Gemini ҳоло муваққатан ҷавоб дода натавонист. Лутфан саволро боз фиристед." }, 502);
    }

    const answer = text(result?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n"), 20000);
    if (!answer) return json({ error: "Gemini ҷавоби матнӣ барнагардонд." }, 502);

    await insertMessages(supabaseUrl, anonKey, accessToken, user.id, conversationId, [
      { role: "user", content: image ? `${message}\n[Акс барои таҳлил замима шуд]` : message },
      { role: "model", content: answer },
    ]);
    await touchConversation(supabaseUrl, anonKey, accessToken, conversationId);

    return json({ answer, conversationId });
  } catch (error) {
    console.error(error);
    return json({ error: error?.name === "AbortError" ? "Gemini дер ҷавоб дод. Баъдтар боз кӯшиш кунед." : "Паём коркард ё сабт карда нашуд." }, 502);
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") return onRequestOptions();
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "Танҳо POST иҷозат аст." }, 405);
}
