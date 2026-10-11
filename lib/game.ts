import { DARES, LEVELS, SECONDS, dareInfo, type Avatar, type Lang, type Level, type ProofKind } from "./dares.ts"

export type { Avatar, Lang, Level, ProofKind }
export const ROUNDS = 5
export const MAX_SKIPS = 2
export const MAX_CUSTOM = 5
export const HAND = 3 // dare cards each player chooses from for their partner
export const PICK_TIME = 30_000
export const JOIN_WINDOW = 10 * 60_000 // "Code expires in 10:00"
export const ROOM_TTL = 2 * 60 * 60_000 // PRD: rooms die after 2h of inactivity
const REVEAL = 3_000 // card flip + reading time before the clock starts biting
export const GRACE = 5_000 // network slack: a voice note may still be uploading when the clock hits zero

export type ProofInput = { path?: string; url?: string; kind: Proof["kind"]; caption: string }
export type Proof = { url: string; kind: "image" | "video" | "audio"; caption: string }
/** A dare a player wrote for their partner (saved in the lobby or typed while picking). `by` = the writer. */
export type CustomDare = { id: string; by: string; text: string; proof: ProofKind }
/** What a giver chose for their partner: a deck card or their own words. */
export type Pick = { dare: number } | { custom: Omit<CustomDare, "id"> }
export type Turn = {
  dare: number // index into DARES, or -1 for a custom dare
  custom?: Omit<CustomDare, "id">
  from?: string // who picked it (missing on rooms from before picking existed)
  endsAt: number
  status: "pending" | "done" | "skipped" | "timeout"
  proof: Proof | null
}
/** Every proof sent in this room, for the admin panel (the turn only holds the current round's). */
export type ProofLog = Proof & { round: number; by: string; name: string; from?: string; dare: string; at: number }
export type Player = { id: string; name: string; avatar?: Avatar; lang?: Lang; score: number; done: number; skipped: number; turn: Turn | null }
export type Phase = "lobby" | "pick" | "dare" | "result" | "final"
/** Stored as data, not sentences, so each phone renders it in its own language. `dare` is -1 for custom dares. */
export type FeedItem = {
  kind?: "join" | "picked" | "done" | "skip" | "timeout" | "banter"
  name?: string
  dare?: number
  text?: string // banter text (or a whole line on rooms from before structured feed)
  at: number
  by?: string
}
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
  custom?: CustomDare[] // saved in the lobby, not yet given
  hands?: Record<string, number[]> // pick phase: giver id -> cards on offer
  picks?: Record<string, Pick> // pick phase: giver id -> choice
  pickEndsAt?: number
  proofs?: ProofLog[]
}
export type Action =
  | { type: "join"; name: string; avatar?: Avatar; lang?: Lang }
  | { type: "set_avatar"; avatar: Avatar }
  | { type: "set_level"; level: Level }
  | { type: "add_dare"; text: string; proof: ProofKind }
  | { type: "remove_dare"; id: string }
  | { type: "start" }
  | { type: "pick"; dare?: number; saved?: string; text?: string; proof?: ProofKind }
  | { type: "complete"; proof?: Proof }
  | { type: "skip" }
  | { type: "tick" }
  | { type: "next"; round: number }
  | { type: "rematch" }
  | { type: "banter"; text: string }

/** `message` is Hinglish, `en` English; the client shows the one matching the player's language. */
export class GameError extends Error {
  en: string
  constructor(message: string, en = message) {
    super(message)
    this.en = en
  }
}
const fail = (hi: string, en: string): never => {
  throw new GameError(hi, en)
}

const cleanName = (name: unknown) =>
  (typeof name === "string" ? name.trim().slice(0, 20) : "") || fail("Apna naam toh batao", "Tell us your name")

const cleanLang = (l: unknown): Lang => (l === "en" ? "en" : "hi")

function cleanDare(text: unknown, proof: unknown) {
  const t = typeof text === "string" ? text.trim().replace(/\s+/g, " ").slice(0, 160) : ""
  if (t.length < 5) fail("Dare thoda detail mein likho", "Write the dare in a bit more detail")
  if (proof !== "voice" && proof !== "photo") fail("Proof type chuno", "Choose a proof type")
  return { text: t, proof: proof as ProofKind }
}

const newPlayer = (id: string, name: string, avatar: Avatar = "boy", lang: Lang = "hi"): Player => ({
  id,
  name,
  avatar,
  lang,
  score: 0,
  done: 0,
  skipped: 0,
  turn: null,
})

export const levelOf = (r: Room): Level => r.level ?? "friendly"
export const partnerOf = (r: Room, id: string) => r.players.find((p) => p.id !== id)

/** A deck card as the giver sees it while picking: worded for their partner to do and say back to them. */
export const cardFor = (r: Room, giver: Player, i: number, lang: Lang = "hi") => dareInfo(i, partnerOf(r, giver.id)?.avatar, giver.avatar, lang)

/** The dare `p` must do, in `lang`; custom dares score at the room's level. */
export const dareFor = (r: Room, p: Player, lang: Lang = "hi") => {
  const t = p.turn!
  if (t.custom) {
    const level = levelOf(r)
    return { ...LEVELS[level], level, proof: t.custom.proof, title: "Custom dare", text: t.custom.text, seconds: SECONDS[t.custom.proof], custom: true }
  }
  return { ...dareInfo(t.dare, p.avatar, partnerOf(r, p.id)?.avatar, lang), custom: false }
}

/**
 * What may travel over the public realtime channel (anyone who guesses a room code can listen):
 * no proof links, no custom dare text, no proof history. `redacted` tells players to fetch the real state.
 */
export function redact(room: Room): Room & { redacted?: true } {
  const picks = Object.values(room.picks ?? {})
  const hidden =
    room.custom?.length || room.proofs?.length || picks.some((p) => "custom" in p) || room.players.some((p) => p.turn?.proof || p.turn?.custom)
  if (!hidden) return room
  return {
    ...room,
    redacted: true,
    custom: room.custom?.map((c) => ({ ...c, text: "" })),
    picks: room.picks && Object.fromEntries(Object.entries(room.picks).map(([k, p]) => [k, "custom" in p ? { custom: { ...p.custom, text: "" } } : p])),
    proofs: [],
    players: room.players.map((p) =>
      p.turn
        ? { ...p, turn: { ...p.turn, proof: p.turn.proof && { ...p.turn.proof, url: "" }, custom: p.turn.custom && { ...p.turn.custom, text: "" } } }
        : p,
    ),
  }
}

export function createRoom(code: string, hostId: string, name: string, now: number, avatar: Avatar = "boy", lang?: Lang): Room {
  return {
    code,
    v: 1,
    createdAt: now,
    hostId,
    phase: "lobby",
    round: 0,
    level: "friendly",
    players: [newPlayer(hostId, cleanName(name), avatar, cleanLang(lang))],
    used: [],
    feed: [],
  }
}

function log(r: Room, kind: NonNullable<FeedItem["kind"]>, now: number, extra: Omit<FeedItem, "kind" | "at"> = {}) {
  r.feed = [{ kind, at: now, ...extra }, ...r.feed].slice(0, 6)
}

/**
 * Starts a round's pick phase: each player gets HAND cards to choose from for their partner.
 * Unplayed dares are dealt first, alternating between the hands, so every hand leads with a fresh dare
 * (late in a game only a couple are left); played ones fill the rest. The two hands never share a card.
 */
function deal(r: Room, now: number, rand: () => number) {
  const level = levelOf(r)
  const shuffle = (xs: number[]) => xs.map((x) => [rand(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x)
  const all = DARES.flatMap(([l], i) => (l === level ? [i] : []))
  const order = [...shuffle(all.filter((i) => !r.used.includes(i))), ...shuffle(all.filter((i) => r.used.includes(i)))]
  const n = r.players.length
  r.hands = Object.fromEntries(r.players.map((p, k) => [p.id, order.filter((_, j) => j % n === k).slice(0, HAND)]))
  r.picks = {}
  r.pickEndsAt = now + PICK_TIME
  r.phase = "pick"
  for (const p of r.players) p.turn = null
}

/** Both have chosen: each player's dare is what their partner picked for them, and the clocks start. */
function begin(r: Room, now: number) {
  for (const doer of r.players) {
    const giver = partnerOf(r, doer.id)!
    const pick = r.picks![giver.id]
    const deck = "dare" in pick
    if (deck) r.used.push(pick.dare)
    const seconds = deck ? dareInfo(pick.dare).seconds : SECONDS[pick.custom.proof]
    doer.turn = {
      dare: deck ? pick.dare : -1,
      ...(!deck && { custom: pick.custom }),
      from: giver.id,
      endsAt: now + REVEAL + seconds * 1000,
      status: "pending",
      proof: null,
    }
  }
  r.phase = "dare"
  delete r.hands
  delete r.picks
  delete r.pickEndsAt
}

// Picks run out -> the first card is chosen for whoever didn't. Dares run out -> timeout. Everyone resolved -> result.
function settle(r: Room, now: number): boolean {
  if (r.phase === "pick") {
    if (now <= r.pickEndsAt! + GRACE) return false
    for (const p of r.players) r.picks![p.id] ??= { dare: r.hands![p.id][0] }
    begin(r, now)
    return true
  }
  if (r.phase !== "dare") return false
  let changed = false
  for (const p of r.players) {
    if (p.turn?.status === "pending" && now > p.turn.endsAt + GRACE) {
      p.turn.status = "timeout"
      log(r, "timeout", now, { name: p.name })
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
  if (a.type !== "join" && !me) fail("Tum is room mein nahi ho", "You're not in this room")

  switch (a.type) {
    case "join": {
      if (me) return room
      if (r.players.length >= 2) fail("Room full hai", "This room is full")
      if (r.phase !== "lobby") fail("Battle already shuru ho chuka hai", "This battle has already started")
      if (now - r.createdAt > JOIN_WINDOW) fail("Code expire ho gaya. Naya room banao", "This code has expired. Create a new room")
      const avatar = a.avatar ?? (r.players[0]?.avatar === "boy" ? "girl" : "boy")
      const p = newPlayer(by, cleanName(a.name), avatar, cleanLang(a.lang))
      r.players.push(p)
      log(r, "join", now, { name: p.name })
      break
    }
    case "set_avatar":
      if (a.avatar !== "boy" && a.avatar !== "girl") return room
      me!.avatar = a.avatar
      break
    case "set_level":
      if (by !== r.hostId) fail("Level sirf host chun sakta hai", "Only the host can choose the level")
      if (r.phase !== "lobby" || !(a.level in LEVELS) || r.level === a.level) return room
      r.level = a.level
      break
    case "add_dare": {
      if (r.phase !== "lobby") fail("Custom dares sirf lobby mein save kar sakte ho", "Custom dares can only be saved in the lobby")
      const d = cleanDare(a.text, a.proof)
      r.custom ??= []
      if (r.custom.filter((c) => c.by === by).length >= MAX_CUSTOM) fail(`Max ${MAX_CUSTOM} custom dares`, `Max ${MAX_CUSTOM} custom dares`)
      r.custom.push({ id: `${now.toString(36)}${r.custom.length}`, by, ...d })
      break
    }
    case "remove_dare": {
      const before = r.custom?.length ?? 0
      r.custom = r.custom?.filter((c) => !(c.id === a.id && c.by === by))
      if ((r.custom?.length ?? 0) === before) return room
      break
    }
    case "start":
      if (by !== r.hostId) fail("Sirf host battle start kar sakta hai", "Only the host can start the battle")
      if (r.phase !== "lobby") return room
      if (r.players.length < 2) fail("Partner ka wait karo", "Wait for your partner")
      r.round = 1
      deal(r, now, rand)
      break
    case "pick": {
      // A late tap after the clock already auto-picked, or a double tap, changes nothing.
      if (r.phase !== "pick" || r.picks![by]) return settled ? bump(r) : room
      let pick: Pick
      if (typeof a.dare === "number") {
        if (!r.hands![by]?.includes(a.dare)) fail("Ye card tumhare paas nahi hai", "That card isn't in your hand")
        pick = { dare: a.dare }
      } else if (a.saved) {
        const i = r.custom?.findIndex((c) => c.id === a.saved && c.by === by) ?? -1
        if (i < 0) fail("Ye saved dare nahi mila", "That saved dare is gone")
        const [{ text, proof }] = r.custom!.splice(i, 1)
        pick = { custom: { by, text, proof } }
      } else {
        pick = { custom: { by, ...cleanDare(a.text, a.proof) } }
      }
      r.picks![by] = pick
      log(r, "picked", now, { name: me!.name, by })
      if (r.players.every((p) => r.picks![p.id])) begin(r, now)
      break
    }
    case "complete":
    case "skip": {
      const t = me!.turn ?? fail("Abhi koi dare nahi hai", "There's no dare right now")
      if (r.phase !== "dare" || t.status !== "pending")
        fail(t.status === "timeout" ? "Time khatam ho gaya" : "Ye dare already ho gaya", t.status === "timeout" ? "Time's up" : "This dare is already done")
      const { points, text } = dareFor(r, me!)
      if (a.type === "skip") {
        if (me!.skipped >= MAX_SKIPS) fail("Skip limit khatam! Ab toh dare karna padega", "No skips left! You'll have to do this one")
        t.status = "skipped"
        me!.skipped++
        log(r, "skip", now, { name: me!.name, by, dare: t.dare })
      } else {
        t.proof = a.proof ?? fail("Pehle proof bhejo — voice note ya photo", "Send your proof first — a voice note or photo")
        const from = r.players.find((p) => p.id === t.from)?.name
        r.proofs = [...(r.proofs ?? []), { ...t.proof, round: r.round, by, name: me!.name, from, dare: text, at: now }]
        t.status = "done"
        me!.done++
        me!.score += points
        log(r, "done", now, { name: me!.name, by, dare: t.dare })
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
        deal(r, now, rand)
      }
      break
    case "rematch":
      if (r.phase !== "final") return room
      r.phase = "lobby"
      r.round = 0
      r.players = r.players.map((p) => newPlayer(p.id, p.name, p.avatar, p.lang))
      break
    case "banter": {
      const clean = (typeof a.text === "string" ? a.text.trim().slice(0, 60) : "") || "🔥"
      log(r, "banter", now, { name: me!.name, by, text: clean })
      break
    }
    default:
      fail("Unknown move", "Unknown move")
  }
  return bump(r)
}

const bump = (r: Room) => ({ ...r, v: r.v + 1 })

export const expired = (updatedAt: number, now: number) => now - updatedAt > ROOM_TTL

export type Notice = { to: string; title: string; body: string; tag: string; url: string }

/** What the other player should hear about `by`'s move (push alert, in their language), or null when it isn't worth a buzz. */
export function notice(prev: Room, next: Room, by: string): Notice | null {
  const me = next.players.find((p) => p.id === by)
  const other = next.players.find((p) => p.id !== by)
  if (!me || !other || next === prev) return null
  const en = other.lang === "en"
  const say = (hi: [string, string], eng: [string, string]): Notice => {
    const [title, body] = en ? eng : hi
    return { to: other.id, title, body, tag: next.code, url: `/room/${next.code}` }
  }
  const was = prev.players.find((p) => p.id === by)?.turn?.status
  const turn = me.turn
  const n = me.name

  if (prev.players.length < next.players.length)
    return say([`${n} aa ${me.avatar === "girl" ? "gayi" : "gaya"}! 🔥`, "Lobby mein chalo — battle start karo"], [`${n} joined! 🔥`, "Open the lobby and start the battle"])
  if (prev.phase === "lobby" && next.phase === "pick") return say(["Battle shuru! ⚔️", `${n} ke liye dare chuno 💌`], ["Battle started! ⚔️", `Pick a dare for ${n} 💌`])
  if (prev.phase === "result" && next.phase === "pick")
    return say([`Round ${next.round} 🔥`, `${n} ke liye dare chuno 💌`], [`Round ${next.round} 🔥`, `Pick a dare for ${n} 💌`])
  if (prev.phase === "pick" && next.phase === "dare")
    return say(["Tumhara dare aa gaya 💌", `${n} ne tumhare liye chuna — timer chalu!`], ["Your dare is here 💌", `${n} picked it for you — the timer's running!`])
  if (next.phase === "pick" && !prev.picks?.[by] && next.picks?.[by])
    return say([`${n} ne tumhare liye dare chun liya 😈`, "Ab tumhari baari — unke liye chuno"], [`${n} picked your dare 😈`, "Your turn — pick one for them"])
  if (prev.phase !== "final" && next.phase === "final") return say(["Final score aa gaya 🏁", "Dekho kaun bana Dare Champion"], ["Final score is in 🏁", "See who's the Dare Champion"])
  if (prev.phase === "final" && next.phase === "lobby") return say(["Rematch! 🔁", "Lobby mein aao — ek aur battle"], ["Rematch! 🔁", "Back to the lobby for another battle"])
  const ready = next.phase === "result"
  const then: [string, string] = [ready ? "Round result ready — abhi dekho" : "Tumhara dare abhi baaki hai ⏰", ready ? "The round result is ready — take a look" : "Your dare is still waiting ⏰"]
  if (was === "pending" && turn?.status === "done") {
    const audio = turn.proof?.kind === "audio"
    return say([`${n} ne ${audio ? "voice note 🎙️" : "photo 📸"} bheja`, then[0]], [`${n} sent a ${audio ? "voice note 🎙️" : "photo 📸"}`, then[1]])
  }
  if (was === "pending" && turn?.status === "skipped") return say([`${n} ne dare skip kiya 🥊`, then[0]], [`${n} skipped the dare 🥊`, then[1]])
  const head = next.feed[0]
  if (head?.kind === "banter" && head.by === by && (head.at !== prev.feed[0]?.at || head.text !== prev.feed[0]?.text)) return say([n, head.text!], [n, head.text!])
  return null
}
