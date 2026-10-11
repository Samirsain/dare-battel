import { createHash } from "node:crypto"
import { after } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import { createRoom, expired, notice, reduce, GameError, type Action, type Notice, type Room } from "./game.ts"

// Server-only: the secret key never leaves route handlers (no NEXT_PUBLIC_ prefix).
export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })

export const BUCKET = "proofs"

// Clients hold a random secret; state only ever exposes its hash, so seeing the room
// over realtime doesn't let anyone act as the other player.
export const playerId = (secret: unknown) => {
  if (typeof secret !== "string" || secret.length < 16) throw new GameError("Session missing, page refresh karo")
  return createHash("sha256").update(secret).digest("hex").slice(0, 16)
}

export const isCode = (code: string) => /^\d{6}$/.test(code)

/** Proof links stay out of anything an outsider could see; players fetch them with their secret. */
export const redact = (room: Room): Room => ({
  ...room,
  players: room.players.map((p) => (p.turn?.proof ? { ...p, turn: { ...p.turn, proof: { ...p.turn.proof, url: "" } } } : p)),
})

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

export async function newRoom(secret: unknown, name: unknown, avatar?: "boy" | "girl"): Promise<Room> {
  const id = playerId(secret)
  for (let i = 0; i < 5; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const room = createRoom(code, id, name as string, Date.now(), avatar)
    const { error } = await admin().from("rooms").insert({ code, state: room, v: room.v }) // pk clash -> roll again
    if (!error) return room
  }
  throw new Error("Room nahi ban paya, dobara try karo")
}

/** Optimistic concurrency: read v, reduce, write only if v unchanged; retry on a race. */
export async function act(code: string, secret: unknown, action: Action): Promise<Room> {
  const by = playerId(secret)
  const db = admin()
  for (let i = 0; i < 4; i++) {
    const room = await getRoom(code)
    if (!room) throw new GameError("Room nahi mila ya expire ho gaya")
    const next = reduce(room, by, action, Date.now())
    if (next === room) return room
    const { data } = await db
      .from("rooms")
      .update({ state: next, v: next.v, updated_at: new Date().toISOString() })
      .eq("code", code)
      .eq("v", room.v)
      .select("code")
    if (data?.length) {
      await broadcast(next)
      after(() => nudge(notice(room, next, by)))
      return next
    }
  }
  throw new Error("Bahut tez! Ek baar aur try karo")
}

export function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "Kuch gadbad ho gayi"
  return Response.json({ error: msg }, { status: e instanceof GameError ? 400 : 500 })
}
