import { test } from "node:test"
import assert from "node:assert/strict"
import { createRoom, reduce, notice, GameError, ROUNDS, MAX_SKIPS, JOIN_WINDOW, type Room, type Proof } from "./game.ts"
import { DARES, dareInfo } from "./dares.ts"

const T0 = 1_000_000
const proof: Proof = { url: "https://x/y.mp3", kind: "audio", caption: "" }
const lobby = () => reduce(createRoom("123456", "a", "Aarav", T0), "b", { type: "join", name: "Meera", avatar: "girl" }, T0)
const started = () => reduce(lobby(), "a", { type: "start" }, T0, () => 0)

test("join: second player in, third rejected, late join rejected", () => {
  const r = lobby()
  assert.deepEqual(r.players.map((p) => p.name), ["Aarav", "Meera"])
  assert.equal(reduce(r, "b", { type: "join", name: "x" }, T0), r, "rejoin is a no-op")
  assert.throws(() => reduce(r, "c", { type: "join", name: "Kabir" }, T0), GameError)
  const solo = createRoom("1", "a", "Aarav", T0)
  assert.throws(() => reduce(solo, "b", { type: "join", name: "M" }, T0 + JOIN_WINDOW + 1), /expire/)
  assert.throws(() => reduce(solo, "b", { type: "join", name: "  " }, T0), /naam/)
})

test("start: host only, needs partner, deals distinct dares from the chosen level", () => {
  assert.throws(() => reduce(lobby(), "b", { type: "start" }, T0), /host/)
  assert.throws(() => reduce(createRoom("1", "a", "A", T0), "a", { type: "start" }, T0), /Partner/)
  assert.throws(() => reduce(lobby(), "b", { type: "set_level", level: "extreme" }, T0), /host/)
  const spicy = reduce(lobby(), "a", { type: "set_level", level: "extreme" }, T0)
  const r = reduce(spicy, "a", { type: "start" }, T0, () => 0)
  assert.equal(r.phase, "dare")
  assert.equal(r.round, 1)
  assert.notEqual(r.players[0].turn!.dare, r.players[1].turn!.dare)
  assert.ok(r.players.every((p) => DARES[p.turn!.dare][0] === "extreme"))
  assert.equal(reduce(r, "a", { type: "set_level", level: "friendly" }, T0), r, "level locked once started")
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
  assert.equal(r.feed.length, 3)
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

test("next is idempotent per round; game ends after ROUNDS; skip cap holds; rematch reuses no dare early", () => {
  let r: Room = started()
  for (let i = 1; i <= ROUNDS; i++) {
    r = reduce(r, "a", i <= MAX_SKIPS ? { type: "skip" } : { type: "complete", proof }, T0)
    r = reduce(r, "b", { type: "complete", proof }, T0)
    if (i === MAX_SKIPS + 1) assert.equal(r.players[0].skipped, MAX_SKIPS)
    const next = reduce(r, "a", { type: "next", round: i }, T0)
    assert.equal(reduce(next, "b", { type: "next", round: i }, T0), next, "double tap from partner is a no-op")
    r = next
  }
  assert.equal(r.phase, "final")
  assert.equal(r.players[0].skipped, MAX_SKIPS)
  assert.equal(r.players[1].done, ROUNDS)
  assert.equal(new Set(r.used).size, ROUNDS * 2, "10 different dares across the game")
  let s = reduce(started(), "a", { type: "skip" }, T0)
  s = reduce(s, "b", { type: "skip" }, T0)
  s = reduce(s, "a", { type: "next", round: 1 }, T0)
  s = reduce(s, "a", { type: "skip" }, T0)
  s = reduce(s, "b", { type: "skip" }, T0)
  s = reduce(s, "a", { type: "next", round: 2 }, T0)
  assert.throws(() => reduce(s, "a", { type: "skip" }, T0), /Skip limit/)
  const again = reduce(reduce(r, "b", { type: "rematch" }, T0), "a", { type: "start" }, T0)
  assert.equal(again.players[0].score, 0)
  assert.ok(again.players.every((p) => p.turn), "pool refills when a level runs out")
})

test("outsiders can't act", () => {
  assert.throws(() => reduce(started(), "z", { type: "skip" }, T0), /nahi ho/)
})

test("dare text follows the doer's and the listener's avatar", () => {
  const why = DARES.findIndex(([, , t]) => t === "Kyun pyar?")
  assert.match(dareInfo(why, "boy").text, /pyar karte ho/)
  assert.match(dareInfo(why, "girl").text, /pyar karti ho/)
  const conf = DARES.findIndex(([, , t]) => t === "Horny confession")
  assert.match(dareInfo(conf, "girl", "boy").text, /feel karate ho/)
  assert.match(dareInfo(conf, "boy", "girl").text, /feel karati ho/)
  assert.ok(DARES.every((_, i) => !/[{}[\]|]/.test(dareInfo(i, "girl", "boy").text)), "no unresolved tokens")
})

test("notice: partner hears about joins, proofs and banter, not ticks", () => {
  const solo = createRoom("123456", "a", "Aarav", T0)
  const joined = lobby()
  assert.deepEqual(
    { to: notice(solo, joined, "b")?.to, title: notice(solo, joined, "b")?.title },
    { to: "a", title: "Meera aa gayi! 🔥" },
  )
  const r = started()
  assert.equal(notice(joined, r, "a")?.to, "b")
  const done = reduce(r, "a", { type: "complete", proof }, T0)
  assert.match(notice(r, done, "a")!.title, /voice note/)
  const chat = reduce(done, "b", { type: "banter", text: "Jaldi!" }, T0 + 1)
  assert.deepEqual([notice(done, chat, "b")?.to, notice(done, chat, "b")?.body], ["a", "Jaldi!"])
  assert.equal(notice(r, reduce(r, "a", { type: "tick" }, T0 + 1000), "a"), null)
})
