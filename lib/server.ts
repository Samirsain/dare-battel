import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { after } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import { createRoom, expired, notice, redact, reduce, GameError, type Action, type Lang, type Notice, type Room } from "./game.ts"

export { redact }

// Server-only: the secret key never leaves route handlers (no NEXT_PUBLIC_ prefix).
export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })

export const BUCKET = "proofs"

// Clients hold a random secret; state only ever exposes its hash, so seeing the room
// over realtime doesn't let anyone act as the other player.
export const playerId = (secret: unknown) => {
  if (typeof secret !== "string" || secret.length < 16) throw new GameError("Session missing, page refresh karo", "Session missing, please refresh the page")
  return createHash("sha256").update(secret).digest("hex").slice(0, 16)
}

export const isCode = (code: string) => /^\d{6}$/.test(code)

async function broadcast(room: Room) {
  // Anyone who guesses a room code can listen on this public channel, so it only ever carries redacted state.
  const ch = admin().channel(`room:${room.code}`)
  await ch.httpSend("state", redact(room)).catch(() => {}) // clients also refetch on focus, so a dropped push self-heals
}

const VAPID = [process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY] as const
export const pushReady = !!(VAPID[0] && VAPID[1])
if (pushReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", VAPID[0]!, VAPID[1]!)

/** Best effort: a missing table, dead subscription or slow push service never breaks a move. */
async function nudge(n: Notice | null) {
  if (!n || !pushReady) return
  const db = admin()
  const { data } = await db.from("push_subs").select("sub").eq("player", n.to).maybeSingle()
  if (!data) return
  try {
    // Dares are timed, so a nudge older than 2 minutes is noise.
    await webpush.sendNotification(data.sub, JSON.stringify(n), { TTL: 120, urgency: "high", topic: n.tag })
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    if (code === 404 || code === 410) await db.from("push_subs").delete().eq("player", n.to)
  }
}

export async function getRoom(code: string): Promise<Room | null> {
  if (!isCode(code)) return null
  const { data } = await admin().from("rooms").select("state, updated_at").eq("code", code).maybeSingle()
  if (!data || expired(Date.parse(data.updated_at), Date.now())) return null
  return data.state as Room
}

export async function newRoom(secret: unknown, name: unknown, avatar?: "boy" | "girl", lang?: Lang): Promise<Room> {
  const id = playerId(secret)
  for (let i = 0; i < 5; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const room = createRoom(code, id, name as string, Date.now(), avatar, lang)
    const { error } = await admin().from("rooms").insert({ code, state: room, v: room.v }) // pk clash -> roll again
    if (!error) return room
  }
  throw new GameError("Room nahi ban paya, dobara try karo", "Couldn't create the room, please try again")
}

/** Optimistic concurrency: read v, reduce, write only if v unchanged; retry on a race. */
export async function act(code: string, secret: unknown, action: Action): Promise<Room> {
  const by = playerId(secret)
  const db = admin()
  for (let i = 0; i < 4; i++) {
    const room = await getRoom(code)
    if (!room) throw new GameError("Room nahi mila ya expire ho gaya", "Room not found or expired")
    const next = reduce(room, by, action, Date.now())
    if (next === room) return room
    const { data } = await db
      .from("rooms")
      .update({ state: next, v: next.v, updated_at: new Date().toISOString() })
      .eq("code", code)
      .eq("v", room.v)
      .select("code")
    if (data?.length) {
      // The mover already gets `next` in the response; the partner's copy and push go out right after it.
      after(async () => {
        await broadcast(next)
        await nudge(notice(room, next, by))
      })
      return next
    }
  }
  throw new GameError("Bahut tez! Ek baar aur try karo", "Too fast! Try once more")
}

/** Deletes a room and every proof it stored (Supabase bucket + Cloudinary folder). Returns how many bucket files went. */
export async function purge(code: string) {
  const db = admin()
  await db.from("rooms").delete().eq("code", code)
  const { data } = await db.storage.from(BUCKET).list(code)
  if (data?.length) await db.storage.from(BUCKET).remove(data.map((f) => `${code}/${f.name}`))

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const { CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env
  if (cloudName && key && secret) {
    const headers = { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` }
    const api = `https://api.cloudinary.com/v1_1/${cloudName}`
    for (const type of ["image", "video"]) {
      await fetch(`${api}/resources/${type}/upload?prefix=dare-battles/${code}/`, { method: "DELETE", headers }).catch(() => {})
    }
    await fetch(`${api}/folders/dare-battles/${code}`, { method: "DELETE", headers }).catch(() => {})
  }
  return data?.length ?? 0
}

// Admin: one password from env (≥12 chars, else the panel stays off), traded for a signed 12h cookie.
// ponytail: no login rate limit; a long random ADMIN_PASSWORD is the defence. Add a limiter if the URL leaks.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ""
export const adminEnabled = ADMIN_PASSWORD.length >= 12
export const ADMIN_COOKIE = "db_admin"
const sign = (exp: number) => createHmac("sha256", ADMIN_PASSWORD).update(`admin:${exp}`).digest("hex")
const same = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest())

export const checkAdminPassword = (p: unknown) => adminEnabled && typeof p === "string" && same(p, ADMIN_PASSWORD)
export const adminToken = (exp: number) => `${exp}.${sign(exp)}`
export function isAdmin(token: string | undefined) {
  if (!adminEnabled || !token) return false
  const [exp, sig = ""] = token.split(".")
  return Number(exp) > Date.now() && same(sig, sign(Number(exp)))
}

/** `error` is Hinglish, `en` English; the client picks by the player's language. Unexpected errors stay generic. */
export function errorResponse(e: unknown) {
  if (e instanceof GameError) return Response.json({ error: e.message, en: e.en }, { status: 400 })
  console.error(e)
  return Response.json({ error: "Kuch gadbad ho gayi, dobara try karo", en: "Something went wrong, please try again" }, { status: 500 })
}
