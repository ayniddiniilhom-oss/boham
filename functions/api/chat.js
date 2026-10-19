export async function onRequestPost({ request, env }) {
  const corsHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };

  const origin = request.headers.get("Origin");
  const allowedOrigin = "https://bohamiiliutet.pages.dev";

  if (origin && origin !== allowedOrigin) {
    return Response.json(
      { error: "Ин манбаъ иҷозат надорад." },
      { status: 403, headers: corsHeaders }
    );
  }

  if (!env.AI_GEMINI_KEY) {
    return Response.json(
      { error: "Калиди AI дар сервер танзим нашудааст." },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (!message || message.length > 4000) {
      return Response.json(
        { error: "Савол бояд аз 1 то 4000 аломат бошад." },
        { status: 400, headers: corsHeaders }
      );
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.AI_GEMINI_KEY
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: "Ту Ёвари Бо Ҳам ҳастӣ, ёвари сомонаи донишҷӯён. Ба саволҳо бо забони истифодабаранда ҷавоб деҳ. Агар корбар тоҷикӣ нависад, тоҷикӣ ҷавоб деҳ. Ҷавобҳо равшан, муфид ва боэҳтиром бошанд. Маълумоти расмии донишкадаро насоз; агар маълумот надорӣ, рост бигӯ."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: message }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: "Хидмати AI ҳоло ҷавоб надод. Баъдтар кӯшиш кун." },
        { status: 502, headers: corsHeaders }
      );
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return Response.json(
        { error: "Ҷавоби холӣ аз AI гирифта шуд." },
        { status: 502, headers: corsHeaders }
      );
    }

    return Response.json({ answer }, { headers: corsHeaders });
  } catch {
    return Response.json(
      { error: "Дархост иҷро нашуд. Формати саволро санҷ." },
      { status: 400, headers: corsHeaders }
    );
  }
}
