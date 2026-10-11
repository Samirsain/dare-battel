"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Camera, Loader2, Lock, LogOut, Mic, PenLine, RotateCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { AVATARS, Face, LEVEL_ICON } from "@/components/game/kit"
import { MediaButton } from "@/components/game/result"
import { VoicePlayer } from "@/components/game/voice"
import { LEVELS } from "@/lib/dares"
import { levelOf, ROOM_TTL, ROUNDS, type Room } from "@/lib/game"
import type { AdminRoom } from "@/app/api/admin/route"
import { cn } from "@/lib/utils"

const ago = (t: number, now: number) => {
  const s = Math.max(0, (now - t) / 1000)
  return s < 60 ? "abhi" : s < 3600 ? `${Math.floor(s / 60)}m pehle` : `${Math.floor(s / 3600)}h pehle`
}

const PHASE: Record<Room["phase"], string> = { lobby: "Lobby", dare: "Dare chal raha", result: "Round result", final: "Game khatam" }

async function call(method: "GET" | "POST" | "DELETE", url = "/api/admin", body?: object) {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    ...(body && { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

export default function AdminPage() {
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")
  const [mediaOnly, setMediaOnly] = useState(false)
  const [now, setNow] = useState(0) // clock of the last load; ages and "expired" are relative to it

  const apply = useCallback(({ ok, status, json }: Awaited<ReturnType<typeof call>>) => {
    if (status === 401) return setAuthed(false)
    if (!ok) return void toast.error(json.error ?? "Load nahi hua")
    setAuthed(true)
    setRooms(json.rooms)
    setNow(Date.now())
  }, [])
  useEffect(() => void call("GET").then(apply), [apply])

  const load = () => {
    setLoading(true)
    void call("GET").then((r) => (setLoading(false), apply(r)))
  }

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (rooms ?? []).filter(
      ({ code, state }) =>
        (!mediaOnly || state.proofs?.length) &&
        (!term || code.includes(term) || state.players.some((p) => p.name.toLowerCase().includes(term))),
    )
  }, [rooms, q, mediaOnly])

  if (authed === null)
    return (
      <main className="grid min-h-dvh place-items-center">
        <Loader2 className="size-6 animate-spin text-[#d61f74]" />
      </main>
    )
  if (!authed) return <Login onIn={load} />

  const all = rooms ?? []
  const players = all.reduce((n, r) => n + r.state.players.length, 0)
  const proofs = all.reduce((n, r) => n + (r.state.proofs?.length ?? 0), 0)
  const live = all.filter((r) => r.state.phase !== "lobby" && r.state.phase !== "final" && now - Date.parse(r.updatedAt) < ROOM_TTL).length

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-2 bg-[rgb(255_247_251/0.85)] px-4 py-3 backdrop-blur-md">
        <h1 className="text-xl font-extrabold">Admin</h1>
        <span className="truncate text-[13px] text-muted-foreground tabular-nums">
          {all.length} rooms · {players} players · {proofs} proofs · {live} live
        </span>
        <button
          type="button"
          onClick={load}
          aria-label="Refresh"
          className="glass ml-auto grid size-10 shrink-0 place-items-center rounded-full active:scale-90"
        >
          <RotateCw className={cn("size-[18px]", loading && "animate-spin")} />
        </button>
        <button
          type="button"
          onClick={() => call("POST", undefined, { logout: true }).then(() => setAuthed(false))}
          aria-label="Logout"
          className="glass grid size-10 shrink-0 place-items-center rounded-full active:scale-90"
        >
          <LogOut className="size-[18px]" />
        </button>
      </header>

      <div className="mt-2 flex items-center gap-2">
        <label className="glass flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl px-3.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Naam ya room code"
            aria-label="Search"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={mediaOnly}
          onClick={() => setMediaOnly(!mediaOnly)}
          className={cn(
            "flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3.5 text-sm font-semibold transition-colors",
            mediaOnly ? "bg-[#d61f74] text-white" : "glass text-foreground/75",
          )}
        >
          <Mic className="size-4" /> Media
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {shown.map((r) => (
          <RoomCard key={r.code} room={r} now={now} onGone={() => setRooms((all) => all?.filter((x) => x.code !== r.code) ?? null)} />
        ))}
      </ul>
      {!shown.length && (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          {all.length ? "Is search se koi room nahi mila" : "Abhi koi room nahi hai. Rooms 2 ghante idle hone ke baad auto-delete hote hain."}
        </p>
      )}
    </main>
  )
}

function Login({ onIn }: { onIn: () => void }) {
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <form
        className="glass flex w-full max-w-[360px] flex-col gap-4 rounded-3xl p-6"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          const { ok, json } = await call("POST", undefined, { password })
          setBusy(false)
          if (ok) onIn()
          else toast.error(json.error ?? "Login nahi hua")
        }}
      >
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[linear-gradient(135deg,#dc1474,#9b3df0)] text-white">
          <Lock className="size-6" />
        </span>
        <h1 className="text-center text-xl font-extrabold">Admin login</h1>
        <Input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          aria-label="Admin password"
          className="h-12 rounded-2xl bg-white px-4 text-base"
        />
        <Button type="submit" variant="glow" size="cta" disabled={!password || busy}>
          {busy && <Loader2 className="animate-spin" />} Login
        </Button>
      </form>
    </main>
  )
}

function RoomCard({ room: { code, updatedAt, state }, now, onGone }: { room: AdminRoom; now: number; onGone: () => void }) {
  const [arm, setArm] = useState(false)
  const [busy, setBusy] = useState(false)
  const level = levelOf(state)
  const LevelIcon = LEVEL_ICON[level]
  const updated = Date.parse(updatedAt)
  const expired = now - updated > ROOM_TTL
  const proofs = [...(state.proofs ?? [])].reverse()
  const pending = state.custom ?? []
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "?"

  useEffect(() => {
    if (!arm) return
    const t = setTimeout(() => setArm(false), 3000)
    return () => clearTimeout(t)
  }, [arm])

  const remove = async () => {
    setBusy(true)
    const { ok, json } = await call("DELETE", `/api/admin?code=${code}`)
    setBusy(false)
    if (!ok) return void toast.error(json.error ?? "Delete nahi hua")
    toast.success(`Room #${code} aur uska media delete ho gaya`)
    onGone()
  }

  return (
    <li className="glass rounded-3xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-extrabold tabular-nums">#{code}</span>
        <Badge variant={LEVELS[level].tone} className="h-6 gap-1 text-[11px]">
          <LevelIcon /> {LEVELS[level].label}
        </Badge>
        <Badge variant="secondary" className="h-6 border-[#ead9f2] text-[11px] font-semibold">
          {PHASE[state.phase]}
          {state.phase !== "lobby" && ` · R${state.round}/${ROUNDS}`}
        </Badge>
        {expired && (
          <Badge variant="pink" className="h-6 text-[11px]">
            Expired
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{ago(updated, now)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {state.players.map((p) => (
          <div key={p.id} className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-white/60 px-2.5 py-2">
            <Face name={p.name} avatar={p.avatar} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {p.name}
                {p.id === state.hostId && <span className="font-normal text-muted-foreground"> · host</span>}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {AVATARS[p.avatar ?? "boy"].label} · {p.score} pts · {p.done} proofs
              </p>
            </div>
          </div>
        ))}
        {state.players.length < 2 && <p className="self-center px-2 text-xs text-muted-foreground">Partner abhi join nahi hua</p>}
      </div>

      {pending.length > 0 && (
        <details className="mt-3 rounded-2xl bg-[#fff8eb] px-3.5 py-2.5 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold text-[#a15c07]">
            <PenLine className="size-4" /> {pending.length} custom dares (abhi deal nahi hue)
          </summary>
          <ul className="mt-2 space-y-1.5">
            {pending.map((c) => (
              <li key={c.id} className="flex gap-2 leading-snug">
                {c.proof === "voice" ? <Mic className="mt-0.5 size-3.5 shrink-0" /> : <Camera className="mt-0.5 size-3.5 shrink-0" />}
                <span>
                  <b className="font-semibold">{name(c.by)}:</b> {c.text}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {proofs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {proofs.map((x) => {
            const p = state.players.find((pl) => pl.id === x.by)
            const label = `${x.name} · Round ${x.round}`
            return (
              <li key={`${x.by}${x.at}`} className="rounded-2xl bg-white/70 p-3">
                <div className="flex items-start gap-2.5">
                  <Face name={x.name} avatar={p?.avatar} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">
                      {label} <span className="font-normal text-muted-foreground">· {ago(x.at, now)}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{x.dare}</p>
                  </div>
                  {x.kind !== "audio" && <MediaButton proof={x} title={label} />}
                </div>
                {x.kind === "audio" && (
                  <div className="mt-2">
                    <VoicePlayer src={x.url} compact />
                  </div>
                )}
                {x.caption && <p className="mt-1.5 text-[13px] text-foreground/80 italic">“{x.caption}”</p>}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 flex justify-end">
        <Button
          variant={arm ? "destructive" : "ghost"}
          className={cn("h-10 rounded-full px-4 text-sm font-semibold", !arm && "text-muted-foreground")}
          disabled={busy}
          onClick={() => (arm ? remove() : setArm(true))}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {arm ? "Pakka? Room + media delete" : "Delete"}
        </Button>
      </div>
    </li>
  )
}
