import { DARES, LEVELS, SECONDS, dareInfo, type Avatar, type Level, type ProofKind } from "./dares.ts"

export type { Avatar, Level, ProofKind }
export const ROUNDS = 5
export const MAX_SKIPS = 2
export const JOIN_WINDOW = 10 * 60_000 // "Code expires in 10:00"
export const ROOM_TTL = 2 * 60 * 60_000 // PRD: rooms die after 2h of inactivity
const REVEAL = 3_000 // card flip + reading time before the clock starts biting
export const GRACE = 5_000 // network slack: a voice note may still be uploading when the clock hits zero

export type ProofInput = { path?: string; url?: string; kind: Proof["kind"]; caption: string }
export type Proof = { url: string; kind: "image" | "video" | "audio"; caption: string }
/** A dare one player wrote for the other in the lobby; dealt to the partner before the deck. */
export type CustomDare = { id: string; by: string; text: string; proof: ProofKind }
export type Turn = {
  dare: number // index into DARES, or -1 for a custom dare
  custom?: Omit<CustomDare, "id">
  endsAt: number
  status: "pending" | "done" | "skipped" | "timeout"
  proof: Proof | null
}
/** Every proof sent in this room, for the admin panel (the turn only holds the current round's). */
export type ProofLog = Proof & { round: number; by: string; name: string; dare: string; at: number }
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
  custom?: CustomDare[] // not yet dealt
  proofs?: ProofLog[]
}
export type Action =
  | { type: "join"; name: string; avatar?: Avatar }
  | { type: "set_avatar"; avatar: Avatar }
  | { type: "set_level"; level: Level }
  | { type: "add_dare"; text: string; proof: ProofKind }
  | { type: "remove_dare"; id: string }
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

export const MAX_CUSTOM = 5

/** The dare as `p` reads it: verbs agree with p's avatar and their partner's; custom dares score at the room's level. */
export const dareFor = (r: Room, p: Player) => {
  const t = p.turn!
  if (t.custom) {
    const level = levelOf(r)
    return { ...LEVELS[level], level, proof: t.custom.proof, title: "Custom dare", text: t.custom.text, seconds: SECONDS[t.custom.proof], custom: true }
  }
  return { ...dareInfo(t.dare, p.avatar, r.players.find((o) => o.id !== p.id)?.avatar), custom: false }
}

/**
 * What may travel over the public realtime channel (anyone who guesses a room code can listen):
 * no proof links, no custom dare text, no proof history. `redacted` tells players to fetch the real state.
 */
export function redact(room: Room): Room & { redacted?: true } {
  const hidden = room.custom?.length || room.proofs?.length || room.players.some((p) => p.turn?.proof || p.turn?.custom)
  if (!hidden) return room
  return {
    ...room,
    redacted: true,
    custom: room.custom?.map((c) => ({ ...c, text: "" })),
    proofs: [],
    players: room.players.map((p) =>
      p.turn
        ? { ...p, turn: { ...p.turn, proof: p.turn.proof && { ...p.turn.proof, url: "" }, custom: p.turn.custom && { ...p.turn.custom, text: "" } } }
        : p,
    ),
  }
}

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
    // The partner's own dares come first, in the order they wrote them.
    const mine = r.custom?.findIndex((c) => c.by !== p.id) ?? -1
    if (mine >= 0) {
      const [{ by, text, proof }] = r.custom!.splice(mine, 1)
      p.turn = { dare: -1, custom: { by, text, proof }, endsAt: now + REVEAL + SECONDS[proof] * 1000, status: "pending", proof: null }
      continue
    }
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
    case "add_dare": {
      if (r.phase !== "lobby") fail("Custom dares sirf lobby mein likh sakte ho")
      const text = typeof a.text === "string" ? a.text.trim().replace(/\s+/g, " ").slice(0, 160) : ""
      if (text.length < 5) fail("Dare thoda detail mein likho")
      if (a.proof !== "voice" && a.proof !== "photo") fail("Proof type chuno")
      r.custom ??= []
      if (r.custom.filter((c) => c.by === by).length >= MAX_CUSTOM) fail(`Max ${MAX_CUSTOM} custom dares`)
      r.custom.push({ id: `${now.toString(36)}${r.custom.length}`, by, text, proof: a.proof })
      break
    }
    case "remove_dare": {
      const before = r.custom?.length ?? 0
      r.custom = r.custom?.filter((c) => !(c.id === a.id && c.by === by))
      if ((r.custom?.length ?? 0) === before) return room
      break
    }
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
      const { title, points, text } = dareFor(r, me!)
      if (a.type === "skip") {
        if (me!.skipped >= MAX_SKIPS) fail("Skip limit khatam! Ab toh dare karna padega")
        t.status = "skipped"
        me!.skipped++
        log(r, `${me!.name} ne "${title}" skip kiya`, now, { by })
      } else {
        t.proof = a.proof ?? fail("Pehle proof bhejo — voice note ya photo")
        r.proofs = [...(r.proofs ?? []), { ...t.proof, round: r.round, by, name: me!.name, dare: text, at: now }]
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
