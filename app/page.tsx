"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Flame, LogIn } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Deco, Face, Gif, LEVEL_ICON, NameDialog, Screen, SoundToggle } from "@/components/game/kit"
import { Float, Pulse } from "@/components/game/fx"
import { api, forgetRoom, lastRoom } from "@/lib/client"
import { LEVELS, LEVEL_ORDER } from "@/lib/dares"
import { ROUNDS, type Room } from "@/lib/game"

// Figma 01 · Home
export default function Home() {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  async function create(name: string, avatar: "boy" | "girl") {
    setBusy(true)
    try {
      const { room } = await api("/api/rooms", { name, avatar })
      router.push(`/room/${room.code}`)
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Screen
      glows={[[-90, 90, 280, "purple"], [170, 560, 300, "pink"]]}
      footer={
        <>
          <Resume />
          <div data-enter>
            <Button variant="glow" size="cta" onClick={() => setAsking(true)}>
              <Flame /> Create Room
            </Button>
          </div>
          <div data-enter className="mt-3">
            <Button asChild variant="glass" size="cta">
              <Link href="/join">
                <LogIn /> Join Room
              </Link>
            </Button>
          </div>
          <p data-enter className="mt-4 text-center text-xs text-muted-foreground">
            Couples ke liye • Safe, consensual &amp; fun
          </p>
        </>
      }
    >
      <Deco type="flower" x={314} y={116} size={44} />
      <Deco type="heart" x={34} y={150} size={40} delay={0.4} />
      <Deco type="daisy" x={304} y={300} size={36} delay={0.8} />
      <Deco type="sparkle" x={62} y={330} size={24} delay={0.2} />
      <Deco type="blossom" x={26} y={450} size={38} delay={0.6} />
      <Deco type="heart" x={318} y={470} size={30} color="#c084fc" delay={1} />
      <Deco type="flower" x={14} y={600} size={28} color="#c4b5fd" delay={0.3} />
      <Deco type="sparkle" x={330} y={590} size={20} delay={0.9} />

      <div data-enter className="flex items-center justify-between">
        <SoundToggle />
        <Badge variant="pink">18+</Badge>
      </div>

      <div className="min-h-2 flex-1" />

      <div data-enter className="relative mx-auto grid size-[min(188px,22dvh)] place-items-center">
        <Pulse className="absolute inset-4 rounded-full bg-[radial-gradient(circle,rgb(255_143_196/0.55),transparent_70%)] blur-lg" scale={1.15} />
        <Float amp={6} className="size-full">
          <Gif name="hero" size={188} className="size-full!" />
        </Float>
      </div>

      <h1 data-enter className="text-gradient mt-5 text-center text-[38px] leading-[44px] font-extrabold tracking-[-0.02em]">
        Dare Battles
      </h1>
      <p data-enter className="mx-auto mt-2.5 max-w-[310px] text-center text-base leading-6 text-muted-foreground text-balance">
        Partner ko voice notes aur photos ke dares do. Proof bhejo, points lo, champion bano.
      </p>
      <ul data-enter className="mt-4 flex items-center justify-center gap-4 text-[13px] font-semibold text-foreground/75" aria-label="Levels">
        {LEVEL_ORDER.map((l) => {
          const Icon = LEVEL_ICON[l]
          return (
            <li key={l} className="flex items-center gap-1.5">
              <Icon className="size-4 text-[#d61f74]" />
              {LEVELS[l].label}
            </li>
          )
        })}
      </ul>

      <div className="min-h-4 flex-1" />

      <NameDialog open={asking} onOpenChange={setAsking} onSubmit={create} busy={busy} cta="Room banao" />
    </Screen>
  )
}

/** Reopening the installed app lands here; if this phone is still in a live room, offer the way back in. */
function Resume() {
  const [live, setLive] = useState<{ room: Room; me: string } | null>(null)

  useEffect(() => {
    const code = lastRoom()
    if (!code) return
    api(`/api/rooms/${code}`).then(
      ({ room, me }) => (me && room.players.some((p) => p.id === me) ? setLive({ room, me }) : forgetRoom(code)),
      () => forgetRoom(code),
    )
  }, [])

  if (!live) return null
  const { room, me } = live
  const partner = room.players.find((p) => p.id !== me)
  const you = room.players.find((p) => p.id === me)!
  const line =
    room.phase === "lobby"
      ? partner
        ? `Lobby · ${partner.name} ke saath`
        : "Lobby · partner ka wait"
      : room.phase === "final"
        ? `Final score · ${you.score}–${partner?.score ?? 0}`
        : `Round ${room.round}/${ROUNDS} · ${you.score}–${partner?.score ?? 0}`

  return (
    <Link
      href={`/room/${room.code}`}
      className="glass mb-3 flex items-center gap-3 rounded-3xl py-3 pr-3 pl-3.5 animate-in fade-in slide-in-from-bottom-3 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] transition-transform"
    >
      <div className="flex -space-x-3">
        <Face name={you.name} avatar={you.avatar} size={38} />
        {partner && <Face name={partner.name} avatar={partner.avatar} size={38} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">Battle continue karo</p>
        <p className="truncate text-[13px] text-muted-foreground">{line}</p>
      </div>
      <span className="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,#dc1474,#9b3df0)] text-white">
        <ChevronRight className="size-5" />
      </span>
    </Link>
  )
}
