import { DARES, LEVELS, dareInfo, type Avatar, type Level } from "./dares.ts"

export type { Avatar, Level }
export const ROUNDS = 5
export const MAX_SKIPS = 2
export const JOIN_WINDOW = 10 * 60_000 // "Code expires in 10:00"
export const ROOM_TTL = 2 * 60 * 60_000 // PRD: rooms die after 2h of inactivity
const REVEAL = 3_000 // card flip + reading time before the clock starts biting
export const GRACE = 5_000 // network slack: a voice note may still be uploading when the clock hits zero

export type ProofInput = { path?: string; url?: string; kind: Proof["kind"]; caption: string }
export type Proof = { url: string; kind: "image" | "video" | "audio"; caption: string }
export type Turn = { dare: number; endsAt: number; status: "pending" | "done" | "skipped" | "timeout"; proof: Proof | null }
export type Player = { id: string; name: string; avatar?: Avatar; score: number; done: number; skipped: number; turn: Turn | null }
export type Phase = "lobby" | "dare" | "result" | "final"
export type FeedItem = { text: string; at: number; by?: string; banter?: boolean }
export type Room = {
  code: string
  v: number
  createdAt: number
  hostId: string
  phase: Phase
  round: number
  level?: Level // missing on rooms created before levels existed
  players: Player[]
  used: number[]
  feed: FeedItem[]
}
export type Action =
  | { type: "join"; name: string; avatar?: Avatar }
  | { type: "set_avatar"; avatar: Avatar }
  | { type: "set_level"; level: Level }
  | { type: "start" }
  | { type: "complete"; proof?: Proof }
  | { type: "skip" }
  | { type: "tick" }
  | { type: "next"; round: number }
  | { type: "rematch" }
  | { type: "banter"; text: string }

export class GameError extends Error {}
const fail = (msg: string): never => {
  throw new GameError(msg)
}

const cleanName = (name: unknown) =>
  (typeof name === "string" ? name.trim().slice(0, 20) : "") || fail("Apna naam toh batao")

const newPlayer = (id: string, name: string, avatar: Avatar = "boy"): Player => ({ id, name, avatar, score: 0, done: 0, skipped: 0, turn: null })

export const levelOf = (r: Room): Level => r.level ?? "friendly"

/** The dare as `p` reads it: verbs agree with p's avatar and their partner's. */
export const dareFor = (r: Room, p: Player) => dareInfo(p.turn!.dare, p.avatar, r.players.find((o) => o.id !== p.id)?.avatar)

export function createRoom(code: string, hostId: string, name: string, now: number, avatar: Avatar = "boy"): Room {
  return { code, v: 1, createdAt: now, hostId, phase: "lobby", round: 0, level: "friendly", players: [newPlayer(hostId, cleanName(name), avatar)], used: [], feed: [] }
}

function log(r: Room, text: string, now: number, extra?: Partial<FeedItem>) {
  r.feed = [{ text, at: now, ...extra }, ...r.feed].slice(0, 6)
}

function deal(r: Room, now: number, rand: () => number) {
  const level = levelOf(r)
  const all = DARES.flatMap(([l], i) => (l === level ? [i] : []))
  let left = all.filter((i) => !r.used.includes(i))
  if (left.length < r.players.length) {
    r.used = r.used.filter((i) => !all.includes(i))
    left = all
  }
  for (const p of r.players) {
    const dare = left.splice(Math.floor(rand() * left.length), 1)[0]
    r.used.push(dare)
    p.turn = { dare, endsAt: now + REVEAL + dareInfo(dare).seconds * 1000, status: "pending", proof: null }
  }
}

// Times out overdue turns and moves to the result once nobody is still pending.
function settle(r: Room, now: number): boolean {
  if (r.phase !== "dare") return false
  let changed = false
  for (const p of r.players) {
    if (p.turn?.status === "pending" && now > p.turn.endsAt + GRACE) {
      p.turn.status = "timeout"
      log(r, `${p.name} ka time khatam`, now)
      changed = true
    }
  }
  if (r.players.every((p) => p.turn?.status !== "pending")) {
    r.phase = "result"
    changed = true
  }
  return changed
}

/** Pure: returns the next room, or the same object when the action is a no-op. Throws GameError on illegal moves. */
export function reduce(room: Room, by: string, a: Action, now: number, rand: () => number = Math.random): Room {
  const r: Room = structuredClone(room)
  const settled = settle(r, now)
  const me = r.players.find((p) => p.id === by)
  if (a.type !== "join" && !me) fail("Tum is room mein nahi ho")

  switch (a.type) {
    case "join":
      if (me) return room
      if (r.players.length >= 2) fail("Room full hai")
      if (r.phase !== "lobby") fail("Battle already shuru ho chuka hai")
      if (now - r.createdAt > JOIN_WINDOW) fail("Code expire ho gaya. Naya room banao")
      const partnerAvatar = a.avatar ?? (r.players[0]?.avatar === "boy" ? "girl" : "boy")
      r.players.push(newPlayer(by, cleanName(a.name), partnerAvatar))
      log(r, `${r.players[1].name} ne room join kiya`, now)
      break
    case "set_avatar":
      if (a.avatar !== "boy" && a.avatar !== "girl") return room
      me!.avatar = a.avatar
      break
    case "set_level":
      if (by !== r.hostId) fail("Level sirf host chun sakta hai")
      if (r.phase !== "lobby" || !(a.level in LEVELS) || r.level === a.level) return room
      r.level = a.level
      break
    case "start":
      if (by !== r.hostId) fail("Sirf host battle start kar sakta hai")
      if (r.phase !== "lobby") return room
      if (r.players.length < 2) fail("Partner ka wait karo")
      r.phase = "dare"
      r.round = 1
      deal(r, now, rand)
      break
    case "complete":
    case "skip": {
      const t = me!.turn ?? fail("Abhi koi dare nahi hai")
      if (r.phase !== "dare" || t.status !== "pending") fail(t.status === "timeout" ? "Time khatam ho gaya" : "Ye dare already ho gaya")
      const { title, points } = dareInfo(t.dare)
      if (a.type === "skip") {
        if (me!.skipped >= MAX_SKIPS) fail("Skip limit khatam! Ab toh dare karna padega")
        t.status = "skipped"
        me!.skipped++
        log(r, `${me!.name} ne "${title}" skip kiya`, now, { by })
      } else {
        t.proof = a.proof ?? fail("Pehle proof bhejo — voice note ya photo")
        t.status = "done"
        me!.done++
        me!.score += points
        log(r, `${me!.name} ne "${title}" ka proof bheja`, now, { by })
      }
      settle(r, now)
      break
    }
    case "tick":
      if (!settled) return room
      break
    case "next":
      if (r.phase !== "result" || a.round !== r.round) return settled ? bump(r) : room
      if (r.round >= ROUNDS) r.phase = "final"
      else {
        r.round++
        r.phase = "dare"
        deal(r, now, rand)
      }
      break
    case "rematch":
      if (r.phase !== "final") return room
      r.phase = "lobby"
      r.round = 0
      r.players = r.players.map((p) => newPlayer(p.id, p.name, p.avatar))
      break
    case "banter": {
      const clean = (typeof a.text === "string" ? a.text.trim().slice(0, 60) : "") || "🔥"
      log(r, `${me!.name}: ${clean}`, now, { by, banter: true })
      break
    }
    default:
      fail("Unknown move")
  }
  return bump(r)
}

const bump = (r: Room) => ({ ...r, v: r.v + 1 })

export const expired = (updatedAt: number, now: number) => now - updatedAt > ROOM_TTL

export type Notice = { to: string; title: string; body: string; tag: string; url: string }

/** What the other player should hear about `by`'s move (push alert), or null when it isn't worth a buzz. */
export function notice(prev: Room, next: Room, by: string): Notice | null {
  const me = next.players.find((p) => p.id === by)
  const other = next.players.find((p) => p.id !== by)
  if (!me || !other || next === prev) return null
  const say = (title: string, body: string): Notice => ({ to: other.id, title, body, tag: next.code, url: `/room/${next.code}` })
  const was = prev.players.find((p) => p.id === by)?.turn?.status
  const turn = me.turn

  if (prev.players.length < next.players.length) return say(`${me.name} aa ${me.avatar === "girl" ? "gayi" : "gaya"}! 🔥`, "Lobby mein chalo — battle start karo")
  if (prev.phase === "lobby" && next.phase === "dare") return say("Battle shuru! ⚔️", "Round 1 — tumhara dare ready hai")
  if (prev.phase !== "final" && next.phase === "final") return say("Final score aa gaya 🏁", "Dekho kaun bana Dare Champion")
  if (prev.phase === "result" && next.phase === "dare") return say(`Round ${next.round} shuru 🔥`, "Naya dare tumhara wait kar raha hai")
  if (prev.phase === "final" && next.phase === "lobby") return say("Rematch! 🔁", "Lobby mein aao — ek aur battle")
  const then = next.phase === "result" ? "Round result ready — abhi dekho" : "Tumhara dare abhi baaki hai ⏰"
  if (was === "pending" && turn?.status === "done")
    return say(`${me.name} ne ${turn.proof?.kind === "audio" ? "voice note 🎙️" : "photo 📸"} bheja`, then)
  if (was === "pending" && turn?.status === "skipped") return say(`${me.name} ne dare skip kiya 🥊`, then)
  const head = next.feed[0]
  if (head?.banter && head.by === by && (head.at !== prev.feed[0]?.at || head.text !== prev.feed[0]?.text))
    return say(me.name, head.text.slice(me.name.length + 2))
  return null
}
