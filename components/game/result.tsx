"use client"

import { useRef, useState } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { ArrowRight, Loader2, Maximize2, MessageCircle, RotateCcw, Share2, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Face, Gif, Screen } from "./kit"
import { calm, Confetti, CountUp, Float, safety } from "./fx"
import { VoicePlayer } from "./voice"
import { shareResult } from "@/lib/client"
import { ROUNDS, type Action, type Player, type Proof, type Room } from "@/lib/game"
import { cn } from "@/lib/utils"

type Props = { room: Room; you: Player; partner: Player; run: (a: Action) => Promise<unknown> }

const VERDICT = {
  one: [
    "{l} ne mauka chhoda, {w} ne loot liya 😎",
    "{w} full form mein hai, {l} ko practice chahiye 😂",
    "{w} ki himmat ko salaam, {l} agli baar pakka 💪",
  ],
  both: ["Itna pyaar? Judges confused hain 😍", "Made for each other wali energy 💞", "Barabar ki takkar — agla round decide karega 🔥"],
  none: [
    "Dono ne dare chhod diya! Ab couple boxing match shuru 😂🥊",
    "Score 0! Dares gayi tel lene, ab aapas mein ladai chal rahi hai 🥊",
    "Dono ne sharam kar li — ab partner naraz hai! 🙈💥",
  ],
}

const STATUS = { done: "Proof bheja", skipped: "Skip kiya", timeout: "Time out", pending: "…" }

/** Hero sticker drops in and settles. */
function useDrop(scope: React.RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (calm()) return
      return safety(gsap.from(".hero", { y: -40, scale: 0.5, duration: 1, ease: "bounce.out", delay: 0.2 }), 2500)
    },
    { scope },
  )
}

// Figma 07 · Round Result
export function RoundResult({ room, you, partner, run }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  useDrop(ref)
  const a = you.turn?.status === "done"
  const b = partner.turn?.status === "done"
  const kind = a && b ? "both" : a || b ? "one" : "none"
  const [w, l] = a ? [you, partner] : [partner, you]
  const lines = VERDICT[kind]
  const verdict = lines[(room.round + Number(room.code)) % lines.length].replace("{w}", w.name).replace("{l}", l.name) // same line on both phones
  const title = kind === "both" ? "Dono ne kar dikhaya! 🔥" : kind === "none" ? "Dono ne dhoka diya! 🥊" : `${w.name} ne round jeeta!`
  const last = room.round >= ROUNDS

  const next = async () => {
    setBusy(true)
    await run({ type: "next", round: room.round })
    setBusy(false)
  }

  return (
    <Screen
      glows={[[60, 120, 280, "pink"], [-120, 560, 280, "purple"]]}
      enterKey={room.round}
      footer={
        <div data-enter className="grid grid-cols-[1fr_auto] gap-3">
          <Button variant="glow" size="cta" onClick={next} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : last ? <Trophy /> : null}
            {last ? "Final score dekho" : "Next Round"}
            {!busy && !last && <ArrowRight />}
          </Button>
          <Button
            variant="glass"
            size="cta"
            className="w-14 px-0"
            aria-label="Result share karo"
            onClick={() => shareResult({ a: you.name, as: you.score, b: partner.name, bs: partner.score, r: room.round })}
          >
            <Share2 />
          </Button>
        </div>
      }
    >
      {kind !== "none" && <Confetti fire={room.round} />}
      <div data-enter className="flex justify-center">
        <Badge variant={kind === "none" ? "pink" : "gold"}>Round {room.round} Result</Badge>
      </div>

      <div ref={ref} className="relative mx-auto mt-3 grid size-[min(120px,14dvh)] place-items-center">
        <div className="hero size-full">
          <Float amp={6} className="size-full">
            <Gif name={kind === "none" ? "fight" : kind === "both" ? "fireworks" : "celebrate"} size={120} className="size-full!" />
          </Float>
        </div>
      </div>

      <h2 data-enter className="mt-4 text-center text-[26px] leading-[32px] font-bold text-balance">
        {title}
      </h2>
      <p data-enter className="mx-auto mt-1.5 max-w-[310px] text-center text-[15px] leading-[22px] text-muted-foreground text-balance">
        {verdict}
      </p>

      <div data-enter className="mt-5 grid grid-cols-2 gap-3">
        <ScoreCard p={you} you win={kind === "one" && a} />
        <ScoreCard p={partner} win={kind === "one" && b} />
      </div>

      {/* The payoff: what your partner actually sent. Theirs first. */}
      {(a || b) && (
        <div data-enter className="mt-3 flex flex-col gap-2.5">
          {b && <ProofCard p={partner} />}
          {a && <ProofCard p={you} you />}
        </div>
      )}

      <div className="min-h-2 flex-1" />
    </Screen>
  )
}

function ScoreCard({ p, you, win }: { p: Player; you?: boolean; win?: boolean }) {
  const status = p.turn?.status ?? "pending"
  return (
    <div
      className={cn(
        "glass relative flex flex-col items-center rounded-3xl px-3 pt-4 pb-3.5 text-center transition-shadow",
        win && "border-[#ff7ab8] bg-[#fff0f7]/90 shadow-[0_14px_30px_-14px_rgb(214_31_116/0.65)]",
      )}
    >
      <Face name={p.name} avatar={p.avatar} size={44} />
      <span className="mt-2 max-w-full truncate text-[13px] font-semibold">
        {p.name}
        {you && <span className="font-normal text-muted-foreground"> (You)</span>}
      </span>
      <CountUp value={p.score} className="text-[34px] leading-[40px] font-extrabold" />
      <span className={cn("text-xs font-semibold", status === "done" ? "text-[#15803d]" : status === "pending" ? "text-muted-foreground" : "text-[#be123c]")}>
        {STATUS[status]}
      </span>
    </div>
  )
}

function ProofCard({ p, you }: { p: Player; you?: boolean }) {
  const proof = p.turn!.proof
  if (!proof) return null
  const label = `${you ? "Tumhara" : `${p.name} ka`} ${proof.kind === "audio" ? "voice note" : proof.kind === "video" ? "video" : "photo"}`
  return (
    <div className={cn("glass rounded-2xl p-3", !you && "border-[#ffc2de]")}>
      <div className="flex items-center gap-2">
        <Face name={p.name} avatar={p.avatar} size={26} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</span>
        {proof.kind !== "audio" && <MediaButton proof={proof} title={label} />}
      </div>
      {proof.kind === "audio" ? (
        <div className="mt-2.5">
          <VoicePlayer src={proof.url} compact={you} />
        </div>
      ) : null}
      {proof.caption && <p className="mt-2 text-[13px] leading-snug text-foreground/80 italic">“{proof.caption}”</p>}
    </div>
  )
}

export function MediaButton({ proof, title }: { proof: Proof; title: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${title} dekho`}
        className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-[#f6eefc] ring-2 ring-white shadow-[0_6px_14px_-8px_rgb(58_31_77/0.5)] transition-transform active:scale-95"
      >
        {proof.kind === "video" ? (
          <video src={proof.url} className="size-full object-cover" muted playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={proof.url} alt="" className="size-full object-cover" />
        )}
        <span className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-white/90 text-foreground">
          <Maximize2 className="size-3" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(92vw,420px)] gap-3 rounded-3xl bg-white p-3 pt-4">
          <DialogHeader className="px-2 pr-10">
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
            <DialogDescription className={cn(!proof.caption && "sr-only")}>{proof.caption || "No caption"}</DialogDescription>
          </DialogHeader>
          {proof.kind === "video" ? (
            <video src={proof.url} className="max-h-[70dvh] w-full rounded-2xl bg-black" controls playsInline preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img src={proof.url} alt={title} className="max-h-[70dvh] w-full rounded-2xl object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// Figma 08 · Final Scoreboard
export function Final({ you, partner, run }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  useDrop(ref)
  const champ = you.score === partner.score ? null : you.score > partner.score ? you : partner
  const isLowScore = you.score < 6 && partner.score < 6
  const isNegativeOutcome = (you.skipped > you.done && partner.skipped > partner.done) || you.score === 0 || partner.score === 0
  const isFighting = isLowScore || isNegativeOutcome

  const share = () => shareResult({ a: you.name, as: you.score, b: partner.name, bs: partner.score, r: ROUNDS })

  const again = async () => {
    setBusy(true)
    await run({ type: "rematch" })
    setBusy(false)
  }

  return (
    <Screen
      glows={[[45, 40, 300, "pink"], [-100, 600, 260, "purple"], [220, 640, 220, "pink"]]}
      footer={
        <>
          <div data-enter>
            <Button variant="glow" size="cta" onClick={again} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} Play Again
            </Button>
          </div>
          <div data-enter className="mt-3">
            <Button variant="success" size="cta" onClick={share}>
              <MessageCircle /> Share on WhatsApp
            </Button>
          </div>
        </>
      }
    >
      {!isFighting && <Confetti count={48} />}
      {!isFighting && (
        <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 opacity-80" aria-hidden>
          <Gif name="fireworks" size={160} />
        </div>
      )}
      <div ref={ref} className="relative mx-auto grid size-[min(168px,20dvh)] place-items-center">
        <div className="hero size-full">
          <Float amp={6} className="size-full">
            <Gif name={isFighting ? "fight" : "dance"} size={168} className="size-full!" />
          </Float>
        </div>
      </div>

      <p data-enter className="mt-4 text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground">
        {isFighting ? "COUPLE FIGHT! 🥊" : "FINAL SCORE"}
      </p>
      <div data-enter className="mt-2 flex items-center justify-center gap-6">
        <FinalScore p={you} you lead={champ === you} />
        <span className="text-[28px] font-bold text-muted-foreground">–</span>
        <FinalScore p={partner} lead={champ === partner} />
      </div>

      <h2 data-enter className="mx-auto mt-4 max-w-[320px] text-center text-[24px] leading-[30px] font-extrabold text-balance">
        {isFighting
          ? champ
            ? `${champ.name} jeeta, par score kam hai! 🥊 Ladai chalu!`
            : "Score kam hai! Ab dono ka boxing match! 🥊💥"
          : champ
            ? `${champ.name} is the Dare Champion! 🔥`
            : "Barabar ki takkar! 🤝 Dono champion"}
      </h2>

      <div data-enter className="mt-5 grid grid-cols-3 gap-2.5">
        {[
          [ROUNDS, "Rounds"],
          [you.done, "Proofs sent"],
          [you.skipped, "Skipped"],
        ].map(([n, label]) => (
          <div key={label} className="glass flex h-[76px] flex-col items-center justify-center rounded-2xl">
            <CountUp value={n as number} className="text-2xl font-bold" />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <div className="min-h-2 flex-1" />
    </Screen>
  )
}

function FinalScore({ p, you, lead }: { p: Player; you?: boolean; lead?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Face name={p.name} avatar={p.avatar} size={52} />
      <CountUp value={p.score} className={cn("text-[56px] leading-[64px] font-extrabold", lead ? "text-[#d61f74]" : "text-foreground/55")} />
      <span className="max-w-[120px] truncate text-[13px] text-muted-foreground">
        {p.name}
        {you && " (You)"}
      </span>
    </div>
  )
}
