# Бо Ҳам — портали донишҷӯён

**Бо Ҳам** портали донишҷӯён барои ҷустуҷӯи маълумот, хабарҳо, ҷадвали дарсҳо, ҷомеа ва ёвари AI мебошад. Лоиҳа бо HTML, CSS ва JavaScript-и оддӣ сохта шудааст ва React/Vite талаб намекунад.

## Хизматрасониҳои фаъол

- **Cloudflare Pages** — hosting ва нашри production.
- **Cloudflare Pages Functions** — backend дар `functions/api/`.
- **Supabase Auth** — воридшавӣ бо Email ва Google.
- **Supabase Database** — таърихи гуфтугӯи AI ва паёмҳои чати донишҷӯён.
- **Gemini AI** — ёвари серверии Markdown бо контексти паёмҳои охирин.
- **Се забон** — тоҷикӣ, русӣ ва англисӣ барои матнҳои интерфейс, placeholder-ҳо, label-ҳо, тугмаҳо, бахшҳои ҷадвал ва паёмҳои намоён.

## Ҷадвали дарсҳо

Дар `index.html` ҷадвали ҳафтаинаи гурӯҳ ворид шудааст:

- Душанбе — дипломатияи иқтисодӣ, иқтисодиёти байналмилалӣ ва ҳуқуқи байналмилалӣ;
- Сешанбе — логистика, муносибатҳои байналмилалии асъорӣ-қарзӣ, ҳуқуқ ва КМРО;
- Чоршанбе — кафедраи ҳарбӣ;
- Панҷшанбе — КМРО ва амалии логистика ва дипломатияи иқтисодӣ;
- Ҷумъа — КМРО, корҳои амалӣ ва соати тарбиявӣ;
- Шанбе — корҳои амалии иқтисодиёт, муносибатҳои асъорӣ-қарзӣ, логистика ва ҳуқуқ.

Маълумоти пурраи фан, омӯзгор ва навъи дарс дар объекти `weeklySchedule` дар дохили `index.html` нигоҳ дошта мешавад. Барои иваз кардани гурӯҳ ё семестр танҳо ҳамин объектро навсозӣ кунед.

## Файлҳои асосӣ

```text
index.html                    # frontend, CSS, i18n, Auth, schedule ва UI
functions/api/chat.js         # Gemini API + Supabase Auth + таърихи AI
functions/api/health.js       # ҳолати конфигуратсияи AI
_headers                       # security headers
wrangler.toml                 # Cloudflare Pages settings
README.md                     # ин роҳнамо
```

## Variables ва Secrets дар Cloudflare

Дар **Cloudflare Pages → Settings → Variables and Secrets → Production**:

```text
AI_GEMINI_KEY       Secret     калиди Gemini API
GEMINI_MODEL        Plaintext  gemini-2.5-flash
SUPABASE_URL        Plaintext  https://otpbejlswdxqhgbgqnhu.supabase.co
SUPABASE_ANON_KEY   Plaintext  publishable key-и Supabase
```

`AI_GEMINI_KEY` ҳеҷ гоҳ ба `index.html`, GitHub ё паёми чат гузошта нашавад. Агар калид дар ҷои оммавӣ пайдо шуда бошад, онро дар Google AI Studio rotate карда, қимати навро танҳо ҳамчун Cloudflare Secret гузоред.

## Supabase

Ҷадвалҳои асосӣ:

```text
ai_conversations
ai_messages
community_messages
```

RLS фаъол аст. Барои `community_messages` танҳо корбарони authenticated метавонанд паёмҳоро бихонанд ва паёми худро илова кунанд. Барои тағйири schema аз Supabase migration истифода баред; `service_role`-ро ба frontend нагузоред.

Дар **Authentication → URL Configuration**:

```text
Site URL:
https://bohamiiliutet.pages.dev

Redirect URL:
https://bohamiiliutet.pages.dev/
```

`http://localhost:3000` танҳо барои development-и маҳаллӣ истифода шавад ва набояд Site URL-и production бошад.

## Нашр

Repository ба Cloudflare Pages пайваст аст. Роҳи асосӣ:

```powershell
npx wrangler login
npx wrangler pages deploy . --project-name bohamiiliutet
```

Пеш аз deploy санҷед, ки дар папкаи асосӣ `index.html`, `functions/`, `_headers` ва `wrangler.toml` ҳастанд.

## Санҷиши баъди deploy

```text
https://bohamiiliutet.pages.dev/api/health
```

Натиҷаи дуруст бояд монанди ин бошад:

```json
{
  "status": "ready",
  "aiConfigured": true,
  "model": "gemini-2.5-flash"
}
```

Баъд дар сайт инҳоро санҷед:

1. Email login ва Google login.
2. Ёвари AI бо саволи кӯтоҳ.
3. Таърихи ҷавобҳои AI.
4. Чати донишҷӯён.
5. Иваз кардани забон ба тоҷикӣ, русӣ ва англисӣ.
6. Намоиши ҷадвали ҳар рӯзи ҳафта.

## Фалсафаи дизайн

Ранги асосии сабз нигоҳ дошта шуд, зеро сабз ба донишкада, рушд, оромӣ ва эътимод ишора мекунад. Барои он ки саҳифа дилкушо бошад, сабзи тира танҳо дар sidebar, hero ва тугмаҳои асосӣ истифода мешавад; фонҳои сафеду сабзи хеле равшан барои хондан ва истироҳати чашм мебошанд; lime ҳамчун accent барои диққат ба CTA ва ҳолати фаъол истифода мешавад.

Тарҳи нав ба се принсип такя мекунад: фазои холии бештар, карточкаҳои бо radius-и мулоим ва hierarchy-и равшани матн. Ин сайт бояд ҳамзамон ҷиддии академӣ ва гармии ҷомеаи донишҷӯиро нигоҳ дорад.

## Амният

- Калиди Gemini танҳо дар server-side environment аст.
- Access token ва refresh token-ҳои Supabase-ро дар чат ё GitHub нашр накунед.
- Агар URL бо `#access_token=...` тасодуфан мубодила шуд, session/OAuth connection-ро revoke кунед.
- Ҳеҷ гоҳ `SUPABASE_SERVICE_ROLE_KEY`, Cloudflare API token ё Google Client Secret-ро ба frontend нагузоред.
