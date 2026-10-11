"use client"

import { useEffect, useState } from "react"
import { Camera, Check, Loader2, Mic, PenLine, Send, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Face, Gif, Screen, SoundToggle } from "./kit"
import { TypingDots } from "./fx"
import { DareWriter } from "./lobby"
import { useNow, type ClientAction } from "@/lib/client"
import { cue } from "@/lib/sfx"
import { useLang, useT } from "@/lib/i18n"
import { LEVELS } from "@/lib/dares"
import { cardFor, GRACE, levelOf, ROUNDS, type Pick, type Player, type ProofKind, type Room } from "@/lib/game"
import { cn } from "@/lib/utils"

type Props = { room: Room; you: Player; partner: Player; act: (a: ClientAction) => Promise<unknown> }
type Choice = { dare: number } | { saved: string } | { write: true }

const ProofChip = ({ proof }: { proof: ProofKind }) => (
  <span className="flex items-center gap-1 rounded-full bg-[#f6eefc] px-2 py-0.5 text-[11px] font-semibold text-foreground/75">
    {proof === "voice" ? <Mic className="size-3" /> : <Camera className="size-3" />}
    {proof === "voice" ? "Voice note" : "Photo"}
  </span>
)

// Round step 1: each player chooses the dare their partner will do.
export function PickPhase({ room, you, partner, act }: Props) {
  const t = useT()
  const lang = useLang()
  const now = useNow(250)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [text, setText] = useState("")
  const [proof, setProof] = useState<ProofKind>("voice")
  const [busy, setBusy] = useState(false)
  const mine = room.picks?.[you.id]
  const theirs = !!room.picks?.[partner.id]
  const left = Math.max(0, Math.ceil(((room.pickEndsAt ?? now) - now) / 1000))
  const points = LEVELS[levelOf(room)].points
  const saved = (room.custom ?? []).filter((c) => c.by === you.id)
  const hand = room.hands?.[you.id] ?? []

  useEffect(() => {
    if (!mine && left > 0 && left <= 5) cue("tick")
  }, [left, mine])

  // Past the deadline the server picks for whoever hasn't; either phone may nudge it.
  const overdue = now >= (room.pickEndsAt ?? Infinity) + GRACE + 500
  useEffect(() => {
    if (!overdue) return
    const tick = () => act({ type: "tick" }).catch(() => {})
    tick()
    const id = setInterval(tick, 3000)
    return () => clearInterval(id)
  }, [overdue, act])

  const valid = !!choice && (!("write" in choice) || text.trim().length >= 5)

  async function give() {
    if (!choice || !valid) return
    setBusy(true)
    try {
      await act({ type: "pick", ...("dare" in choice ? { dare: choice.dare } : "saved" in choice ? { saved: choice.saved } : { text, proof }) })
      cue("pop")
    } catch (e) {
      toast.error((e as Error).message)
    }
    setBusy(false)
  }

  const top = (
    <div data-enter className="flex items-center justify-between gap-2">
      <Badge variant="purple" className="px-3 text-xs">
        Round {room.round}/{ROUNDS}
      </Badge>
      <Badge variant={left <= 10 ? "pink" : "gold"} className="tabular-nums" role="timer" aria-label={t(`${left} second bache`, `${left} seconds left`)}>
        ⏱ {left}s
      </Badge>
      <SoundToggle />
    </div>
  )

  if (mine) return <Waiting room={room} you={you} partner={partner} pick={mine} theirs={theirs} top={top} lang={lang} />

  return (
    <Screen
      glows={[[-110, 140, 280, "purple"], [190, 520, 260, "pink"]]}
      enterKey={room.round}
      className="px-4"
      footer={
        <div data-enter>
          <Button variant="glow" size="cta" onClick={give} disabled={!valid || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Send className="size-[18px]" />}
            {t(`Ye dare ${partner.name} ko do`, `Give this to ${partner.name}`)}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground" aria-live="polite">
            {theirs
              ? t(`${partner.name} ne tumhara dare chun liya 😈 — ab tumhari baari`, `${partner.name} already picked yours 😈 — your turn`)
              : t("Time khatam hua toh pehla card chala jayega", "If time runs out, the first card is sent")}
          </p>
        </div>
      }
    >
      {top}

      <div data-enter className="mt-5 flex items-center gap-3">
        <Face name={partner.name} avatar={partner.avatar} size={44} />
        <div className="min-w-0">
          <h2 className="text-[22px] leading-tight font-bold text-balance">{t(`${partner.name} ke liye dare chuno 💌`, `Pick a dare for ${partner.name} 💌`)}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t(`Jo chunoge, wahi ${partner.name} ko karna padega`, `Whatever you pick, ${partner.name} has to do`)}</p>
        </div>
      </div>

      <div role="radiogroup" aria-label={t("Dare cards", "Dare cards")} className="mt-4 flex flex-col gap-2.5">
        {hand.map((i) => {
          const c = cardFor(room, you, i, lang)
          return (
            <Card key={i} on={choice != null && "dare" in choice && choice.dare === i} onPick={() => setChoice({ dare: i })}>
              <div className="flex items-center gap-2">
                <ProofChip proof={c.proof} />
                <span className="ml-auto flex items-center gap-1 text-xs font-bold text-[#a15c07]">
                  <Sparkles className="size-3.5" /> +{points}
                </span>
              </div>
              <p className="mt-1.5 text-[15px] font-bold">{c.title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-foreground/75">{c.text}</p>
            </Card>
          )
        })}

        {saved.map((c) => (
          <Card key={c.id} on={choice != null && "saved" in choice && choice.saved === c.id} onPick={() => setChoice({ saved: c.id })}>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-[#fff1d6] px-2 py-0.5 text-[11px] font-semibold text-[#a15c07]">
                <PenLine className="size-3" /> {t("Tumhara saved", "Your saved")}
              </span>
              <ProofChip proof={c.proof} />
            </div>
            <p className="mt-1.5 text-[14px] leading-snug font-semibold">{c.text}</p>
          </Card>
        ))}

        <Card on={choice != null && "write" in choice} onPick={() => setChoice({ write: true })}>
          <span className="flex items-center gap-2 text-[15px] font-bold">
            <PenLine className="size-4 text-[#d61f74]" /> {t("Apna dare likho", "Write your own")}
          </span>
          {choice && "write" in choice ? (
            <div className="mt-3 flex flex-col gap-2.5 text-left" onClick={(e) => e.stopPropagation()}>
              <DareWriter text={text} setText={setText} proof={proof} setProof={setProof} them={partner.name} autoFocus />
            </div>
          ) : (
            <p className="mt-0.5 text-[13px] text-foreground/70">{t("Card pasand nahi? Khud likho", "Don't like the cards? Make one up")}</p>
          )}
        </Card>
      </div>
      <div className="min-h-3 flex-1" />
    </Screen>
  )
}

/** One choosable card. A div with radio semantics, because the "write your own" card holds inputs. */
function Card({ on, onPick, children }: { on: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <div
      data-enter
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          onPick()
        }
      }}
      className={cn(
        "relative cursor-pointer rounded-2xl border-2 p-3.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out outline-none focus-visible:ring-3 focus-visible:ring-pink/50 active:scale-[0.985]",
        on ? "border-[#d61f74] bg-[#fff0f7] shadow-[0_12px_26px_-16px_rgb(214_31_116/0.8)]" : "glass border-transparent",
      )}
    >
      {children}
      {on && (
        <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-[#d61f74] text-white shadow-md animate-in zoom-in-50 duration-200">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
    </div>
  )
}

function Waiting({
  room,
  you,
  partner,
  pick,
  theirs,
  top,
  lang,
}: {
  room: Room
  you: Player
  partner: Player
  pick: Pick
  theirs: boolean
  top: React.ReactNode
  lang: "hi" | "en"
}) {
  const t = useT()
  const gave = "dare" in pick ? cardFor(room, you, pick.dare, lang) : null
  const custom = "custom" in pick ? pick.custom : null
  return (
    <Screen glows={[[-110, 140, 280, "purple"], [190, 520, 260, "pink"]]} enterKey="waiting" className="items-stretch px-4">
      {top}
      <div className="min-h-6 flex-1" />
      <div data-enter className="mx-auto">
        <Gif name={theirs ? "yay" : "waiting"} size={130} />
      </div>
      <h2 data-enter className="mt-3 text-center text-[24px] leading-tight font-bold text-balance">
        {theirs ? t("Dono ne chun liya! 🔥", "You both picked! 🔥") : t(`${partner.name} tumhare liye chun rahe hain…`, `${partner.name} is picking yours…`)}
      </h2>
      {!theirs && (
        <div data-enter className="mt-2">
          <TypingDots />
        </div>
      )}

      <div data-enter className="glass mt-6 rounded-3xl p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
          <Face name={partner.name} avatar={partner.avatar} size={24} />
          {t(`Tumne ${partner.name} ko diya`, `You gave ${partner.name}`)}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <ProofChip proof={gave?.proof ?? custom!.proof} />
          {custom && (
            <span className="flex items-center gap-1 rounded-full bg-[#fff1d6] px-2 py-0.5 text-[11px] font-semibold text-[#a15c07]">
              <PenLine className="size-3" /> Custom
            </span>
          )}
        </div>
        {gave && <p className="mt-1.5 text-[15px] font-bold">{gave.title}</p>}
        <p className="mt-0.5 text-[14px] leading-snug text-foreground/80">{gave?.text ?? custom!.text}</p>
      </div>
      <div className="min-h-6 flex-1" />
    </Screen>
  )
}
