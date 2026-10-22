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
  const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = env.SUPABASE_ANON_KEY;
  const geminiKey = env.AI_GEMINI_KEY || env.GEMINI_API_KEY;
  const model = /^[a-zA-Z0-9._-]{1,80}$/.test(env.GEMINI_MODEL || "")
    ? env.GEMINI_MODEL
    : "gemini-3.8-flash";

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

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: "Ту Ёвари «Бо Ҳам», ёвари портали донишҷӯён ҳастӣ. Ба забони корбар ҷавоб деҳ; агар тоҷикӣ нависад, тоҷикӣ навис. Ҷавобро бо Markdown навис. Маълумоти расмӣ, ҷадвал, нарх ё эълонро насоз; агар маълумот надорӣ, ошкоро бигӯ." }] },
          contents: [...history, { role: "user", parts: [{ text: message }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
        }),
      },
    );

    const result = await upstream.json();
    if (!upstream.ok) {
      console.error("Gemini error", upstream.status, result);
      return json({ error: upstream.status === 429 ? "Лимити AI расид. Баъдтар кӯшиш кунед." : "Gemini ҳоло ҷавоб надод." }, 502);
    }

    const answer = text(result?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n"), 20000);
    if (!answer) return json({ error: "Gemini ҷавоби матнӣ барнагардонд." }, 502);

    await insertMessages(supabaseUrl, anonKey, accessToken, user.id, conversationId, [
      { role: "user", content: message },
      { role: "model", content: answer },
    ]);
    await touchConversation(supabaseUrl, anonKey, accessToken, conversationId);

    return json({ answer, conversationId });
  } catch (error) {
    console.error(error);
    return json({ error: "Паём коркард ё сабт карда нашуд." }, 502);
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") return onRequestOptions();
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "Танҳо POST иҷозат аст." }, 405);
}
