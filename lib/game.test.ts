import { test } from "node:test"
import assert from "node:assert/strict"
import {
  createRoom,
  reduce,
  notice,
  redact,
  dareFor,
  cardFor,
  GameError,
  ROUNDS,
  MAX_SKIPS,
  MAX_CUSTOM,
  HAND,
  PICK_TIME,
  GRACE,
  JOIN_WINDOW,
  type Room,
  type Proof,
} from "./game.ts"
import { DARES, dareInfo } from "./dares.ts"

const T0 = 1_000_000
const proof: Proof = { url: "https://x/y.mp3", kind: "audio", caption: "" }
const lobby = () => reduce(createRoom("123456", "a", "Aarav", T0, "boy", "hi"), "b", { type: "join", name: "Meera", avatar: "girl", lang: "en" }, T0)
const picking = (r: Room = lobby()) => reduce(r, "a", { type: "start" }, T0, () => 0)
/** Both players give their partner the first card in their hand. */
const pickFirst = (r: Room) => {
  r = reduce(r, "a", { type: "pick", dare: r.hands!.a[0] }, T0)
  return reduce(r, "b", { type: "pick", dare: r.hands!.b[0] }, T0)
}
const started = () => pickFirst(picking())

test("join: second player in, third rejected, late join rejected", () => {
  const r = lobby()
  assert.deepEqual(r.players.map((p) => [p.name, p.lang]), [["Aarav", "hi"], ["Meera", "en"]])
  assert.equal(reduce(r, "b", { type: "join", name: "x" }, T0), r, "rejoin is a no-op")
  assert.throws(() => reduce(r, "c", { type: "join", name: "Kabir" }, T0), GameError)
  const solo = createRoom("1", "a", "Aarav", T0)
  assert.throws(() => reduce(solo, "b", { type: "join", name: "M" }, T0 + JOIN_WINDOW + 1), /expire/)
  assert.throws(() => reduce(solo, "b", { type: "join", name: "  " }, T0), /naam/)
})

test("errors carry an English version", () => {
  try {
    reduce(lobby(), "b", { type: "start" }, T0)
    assert.fail("should throw")
  } catch (e) {
    assert.ok(e instanceof GameError)
    assert.match(e.message, /host/)
    assert.equal(e.en, "Only the host can start the battle")
  }
})

test("start opens the pick phase: two distinct hands from the chosen level", () => {
  assert.throws(() => reduce(lobby(), "b", { type: "start" }, T0), /host/)
  assert.throws(() => reduce(createRoom("1", "a", "A", T0), "a", { type: "start" }, T0), /Partner/)
  assert.throws(() => reduce(lobby(), "b", { type: "set_level", level: "extreme" }, T0), /host/)
  const r = picking(reduce(lobby(), "a", { type: "set_level", level: "extreme" }, T0))
  assert.equal(r.phase, "pick")
  assert.equal(r.round, 1)
  assert.equal(r.pickEndsAt, T0 + PICK_TIME)
  const all = [...r.hands!.a, ...r.hands!.b]
  assert.equal(r.hands!.a.length, HAND)
  assert.equal(new Set(all).size, HAND * 2, "no card in both hands")
  assert.ok(all.every((i) => DARES[i][0] === "extreme"))
  assert.equal(reduce(r, "a", { type: "set_level", level: "friendly" }, T0), r, "level locked once started")
})

test("each player's dare is the card their partner picked for them", () => {
  let r = picking()
  const forMeera = r.hands!.a[2]
  assert.throws(() => reduce(r, "a", { type: "pick", dare: r.hands!.b[0] }, T0), /paas nahi/, "can't give a card from the partner's hand")
  r = reduce(r, "a", { type: "pick", dare: forMeera }, T0)
  assert.equal(r.phase, "pick", "waits for Meera to pick too")
  assert.equal(reduce(r, "a", { type: "pick", dare: r.hands!.a[0] }, T0), r, "a second pick is ignored")
  r = reduce(r, "b", { type: "pick", text: "Mere liye  gaana gaao", proof: "voice" }, T0 + 1000)
  assert.equal(r.phase, "dare")
  const [aarav, meera] = r.players
  assert.equal(meera.turn!.dare, forMeera)
  assert.equal(meera.turn!.from, "a")
  assert.equal(aarav.turn!.custom?.text, "Mere liye gaana gaao")
  assert.equal(aarav.turn!.from, "b")
  assert.equal(dareFor(r, aarav).custom, true)
  assert.equal(dareFor(r, aarav).points, 2, "custom scores at the room's level")
  assert.ok(r.used.includes(forMeera))
  assert.equal(r.hands, undefined)
  assert.ok(meera.turn!.endsAt > T0 + 1000 + dareInfo(forMeera).seconds * 1000)
})

test("pick clock: whoever hasn't picked by the deadline gives their first card", () => {
  let r = picking()
  r = reduce(r, "a", { type: "pick", dare: r.hands!.a[1] }, T0)
  assert.equal(reduce(r, "a", { type: "tick" }, T0 + PICK_TIME), r, "not overdue yet")
  const late = reduce(r, "a", { type: "tick" }, T0 + PICK_TIME + GRACE + 1)
  assert.equal(late.phase, "dare")
  assert.equal(late.players[0].turn!.dare, r.hands!.b[0], "Aarav gets Meera's first card")
  assert.equal(late.players[1].turn!.dare, r.hands!.a[1])
  assert.equal(reduce(late, "b", { type: "pick", dare: r.hands!.b[2] }, T0 + PICK_TIME + GRACE + 2), late, "too-late pick is a no-op")
})

test("saved custom dares: written in the lobby, offered while picking, used up once given", () => {
  let r = lobby()
  assert.throws(() => reduce(r, "a", { type: "add_dare", text: "hi", proof: "voice" }, T0), /detail/)
  r = reduce(r, "a", { type: "add_dare", text: "Selfie bhejo smile ke saath", proof: "photo" }, T0)
  for (let i = 1; i < MAX_CUSTOM; i++) r = reduce(r, "a", { type: "add_dare", text: `Dare number ${i}`, proof: "voice" }, T0 + i)
  assert.throws(() => reduce(r, "a", { type: "add_dare", text: "One too many", proof: "photo" }, T0), /Max/)
  const id = r.custom![0].id
  assert.equal(reduce(r, "b", { type: "remove_dare", id }, T0), r, "only the writer can remove it")
  r = picking(r)
  assert.throws(() => reduce(r, "b", { type: "pick", saved: id }, T0), /saved/, "Meera can't give Aarav's saved dare")
  r = reduce(r, "a", { type: "pick", saved: id }, T0)
  assert.equal(r.custom!.length, MAX_CUSTOM - 1)
  r = reduce(r, "b", { type: "pick", dare: r.hands!.b[0] }, T0)
  assert.equal(r.players[1].turn!.custom?.text, "Selfie bhejo smile ke saath")
  assert.equal(r.players[1].turn!.custom?.proof, "photo")
})

test("complete needs proof and scores; skip limited; round ends when both resolved", () => {
  let r = started()
  const pts = dareInfo(r.players[0].turn!.dare).points
  assert.throws(() => reduce(r, "a", { type: "complete" }, T0 + 5000), /proof/)
  r = reduce(r, "a", { type: "complete", proof }, T0 + 5000)
  assert.equal(r.players[0].score, pts)
  assert.deepEqual(r.players[0].turn!.proof, proof)
  assert.equal(r.phase, "dare", "still waiting on partner")
  assert.throws(() => reduce(r, "a", { type: "skip" }, T0 + 5000), /already/)
  r = reduce(r, "b", { type: "skip" }, T0 + 6000)
  assert.equal(r.phase, "result")
  assert.equal(r.players[1].skipped, 1)
  assert.deepEqual(r.feed.map((f) => f.kind), ["skip", "done", "picked", "picked", "join"])
})

test("timeout: tick settles overdue turns, completing late fails", () => {
  const r = started()
  assert.equal(reduce(r, "a", { type: "tick" }, T0 + 1000), r, "nothing due -> same object, no write")
  const late = T0 + 10 * 60_000
  assert.throws(() => reduce(r, "a", { type: "complete", proof }, late), /Time khatam/)
  const t = reduce(r, "a", { type: "tick" }, late)
  assert.equal(t.phase, "result")
  assert.ok(t.players.every((p) => p.turn!.status === "timeout"))
})

test("full game: next is idempotent, every round is a fresh pick, game ends after ROUNDS", () => {
  let r: Room = started()
  for (let i = 1; i <= ROUNDS; i++) {
    r = reduce(r, "a", i <= MAX_SKIPS ? { type: "skip" } : { type: "complete", proof }, T0)
    r = reduce(r, "b", { type: "complete", proof }, T0)
    if (i === MAX_SKIPS + 1) assert.equal(r.players[0].skipped, MAX_SKIPS)
    const next = reduce(r, "a", { type: "next", round: i }, T0)
    assert.equal(reduce(next, "b", { type: "next", round: i }, T0), next, "double tap from partner is a no-op")
    r = i < ROUNDS ? pickFirst(next) : next
    if (i < ROUNDS) assert.equal(r.round, i + 1)
  }
  assert.equal(r.phase, "final")
  assert.equal(r.players[1].done, ROUNDS)
  assert.equal(new Set(r.used).size, ROUNDS * 2, "10 different dares across the game")
  assert.equal(r.proofs!.length, ROUNDS + ROUNDS - MAX_SKIPS)
  assert.equal(r.proofs![0].from, "Aarav", "who gave each proven dare is kept")
  let s = reduce(started(), "a", { type: "skip" }, T0)
  s = reduce(s, "b", { type: "skip" }, T0)
  s = pickFirst(reduce(s, "a", { type: "next", round: 1 }, T0))
  s = reduce(s, "a", { type: "skip" }, T0)
  s = reduce(s, "b", { type: "skip" }, T0)
  s = pickFirst(reduce(s, "a", { type: "next", round: 2 }, T0))
  assert.throws(() => reduce(s, "a", { type: "skip" }, T0), /Skip limit/)
  const again = reduce(reduce(r, "b", { type: "rematch" }, T0), "a", { type: "start" }, T0)
  assert.equal(again.players[0].score, 0)
  assert.equal(again.hands!.a.length, HAND, "a played-out level still deals full hands")
})

test("outsiders can't act", () => {
  assert.throws(() => reduce(started(), "z", { type: "skip" }, T0), /nahi ho/)
})

test("dare text follows the doer's and the giver's avatar, and the language", () => {
  const why = DARES.findIndex(([, , t]) => t === "Kyun pyar?")
  assert.match(dareInfo(why, "boy").text, /pyar karte ho/)
  assert.match(dareInfo(why, "girl").text, /pyar karti ho/)
  assert.equal(dareInfo(why, "girl", "boy", "en").text, "In 30 seconds, tell me why you love me")
  const conf = DARES.findIndex(([, , t]) => t === "Horny confession")
  assert.match(dareInfo(conf, "girl", "boy").text, /feel karate ho/)
  assert.match(dareInfo(conf, "boy", "girl").text, /feel karati ho/)
  assert.ok(DARES.every((_, i) => !/[{}[\]|]/.test(dareInfo(i, "girl", "boy").text)), "no unresolved tokens")
  assert.ok(DARES.every((d) => d[4] && d[5]), "every dare has English")
  const r = picking()
  const card = r.hands!.b[0]
  assert.equal(cardFor(r, r.players[1], card).text, dareInfo(card, "boy", "girl").text, "Meera's card is worded for Aarav to do")
})

test("notice: partner hears joins, picks, proofs and banter in their own language", () => {
  const solo = createRoom("123456", "a", "Aarav", T0, "boy", "hi")
  const joined = lobby()
  assert.deepEqual([notice(solo, joined, "b")?.to, notice(solo, joined, "b")?.title], ["a", "Meera aa gayi! 🔥"])
  const p = picking()
  assert.deepEqual([notice(joined, p, "a")?.to, notice(joined, p, "a")?.body], ["b", "Pick a dare for Aarav 💌"], "Meera reads English")
  const one = reduce(p, "a", { type: "pick", dare: p.hands!.a[0] }, T0)
  assert.equal(notice(p, one, "a")?.title, "Aarav picked your dare 😈")
  const both = reduce(one, "b", { type: "pick", dare: one.hands!.b[0] }, T0)
  assert.equal(notice(one, both, "b")?.title, "Tumhara dare aa gaya 💌", "Aarav reads Hinglish")
  const done = reduce(both, "a", { type: "complete", proof }, T0)
  assert.match(notice(both, done, "a")!.title, /sent a voice note/)
  const chat = reduce(done, "b", { type: "banter", text: "Jaldi!" }, T0 + 1)
  assert.deepEqual([notice(done, chat, "b")?.to, notice(done, chat, "b")?.body], ["a", "Jaldi!"])
  assert.equal(notice(both, reduce(both, "a", { type: "tick" }, T0 + 1000), "a"), null)
})

test("broadcasts carry no proof links, custom dare text or proof history", () => {
  let r = lobby()
  r = reduce(r, "a", { type: "add_dare", text: "Secret wala dare", proof: "voice" }, T0)
  r = picking(r)
  r = reduce(r, "b", { type: "pick", text: "Kuch spicy likha", proof: "voice" }, T0)
  const pub = redact(r)
  assert.equal(pub.redacted, true)
  assert.equal(pub.custom![0].text, "")
  assert.ok(!JSON.stringify(pub).includes("Kuch spicy likha"))
  r = reduce(r, "a", { type: "pick", dare: r.hands!.a[0] }, T0)
  r = reduce(r, "a", { type: "complete", proof }, T0)
  const pub2 = redact(r)
  assert.deepEqual(pub2.proofs, [])
  assert.ok(pub2.players.every((p) => !p.turn?.proof?.url && !p.turn?.custom?.text))
  const plain = lobby()
  assert.equal(redact(plain), plain, "nothing private -> sent as is, no refetch needed")
})
