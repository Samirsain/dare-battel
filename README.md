# Dare Battles

Real-time couple dare game (18+), built as an installable mobile PWA, in Hinglish or English (toggle on the home screen). One partner creates a room, the other joins with a 6-digit code. Each round has two steps:

1. **Pick** (30s): each player sees 3 dare cards (plus their saved custom dares, or "write your own") and chooses one *for their partner*. Time runs out → the first card goes.
2. **Dare**: each player does what their partner picked; the proof is a **voice note** or a **photo**.

Three levels: Friendly (+2), Couple (+3), Extreme (+4). 5 rounds, 2 skips per game.

Next.js 16 (App Router) · Supabase (Postgres, Realtime, Storage) · Cloudinary (photos) · Web Push · GSAP.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in. Generate push keys with `npx web-push generate-vapid-keys`.
3. In Supabase → SQL Editor, run `supabase/schema.sql` (safe to re-run). It creates `rooms`, `push_subs`, and the private `proofs` bucket, and allows audio in it.
4. `npm run dev`

On Vercel, add every variable from `.env.example` (including the three `VAPID_*` ones and `ADMIN_PASSWORD`) under Project → Settings → Environment Variables, then redeploy — `NEXT_PUBLIC_*` values are baked in at build time.

**Admin:** `/admin`, password = `ADMIN_PASSWORD` (12+ characters, otherwise the panel stays off). Lists every live room, its players, pending custom dares and every proof sent, with delete.

## Where things live

| Path | What |
|---|---|
| `lib/game.ts` | Pure game rules (`reduce`: pick → dare → result), bilingual errors, push-alert copy (`notice`). Tested in `lib/game.test.ts` (`npm test`). |
| `lib/dares.ts` | The 30 dares in Hinglish + English, levels, and gendered verb tokens: `{he\|she}` follows the player, `[he\|she]` the partner. |
| `lib/i18n.ts` | `useT()` — strings sit next to their use as `t("Hinglish", "English")`. |
| `lib/server.ts` | Supabase writes with optimistic locking, redacted realtime broadcast, push sending. |
| `components/game/*` | Screens: lobby, pick, dare + proof upload, voice recorder/player, results. |
| `public/sw.js` | Service worker: offline page, asset cache, push notifications. |

## Privacy model

- Voice notes go to the private Supabase bucket and are viewed through 24h signed URLs; photos go to Cloudinary.
- Proofs reach the partner, and the admin panel can review them; the in-app rules say so.
- The realtime channel is public (anyone who guesses a room code could listen), so broadcasts never carry proof links. Players fetch them with their device secret.
- Rooms and their media are deleted by the daily cron (`/api/cleanup`) once idle for 2 hours.
