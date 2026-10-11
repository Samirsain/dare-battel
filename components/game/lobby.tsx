"use client"

import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { ArrowRight, Bell, BellOff, BellRing, Camera, ChevronRight, Copy, HeartHandshake, Loader2, Mic, PenLine, Plus, Repeat2, Share2, SkipForward, Sparkles, Swords, Timer, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { AVATARS, Deco, Face, Gif, Header, LEVEL_ICON, Screen, SoundToggle } from "./kit"
import { calm, Float, Pulse, TypingDots } from "./fx"
import { disablePush, enablePush, inviteText, openWhatsApp, pushState, useNow } from "@/lib/client"
import { useLang, useT, type T } from "@/lib/i18n"
import { LEVELS, LEVEL_ORDER } from "@/lib/dares"
import { JOIN_WINDOW, MAX_CUSTOM, MAX_SKIPS, ROUNDS, levelOf, type Action, type Level, type Player, type ProofKind, type Room } from "@/lib/game"
import { cn } from "@/lib/utils"

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

const expires = (left: number, t: T) =>
  left > 0 ? t(`Code ${mmss(left)} mein expire hoga`, `Code expires in ${mmss(left)}`) : t("Code expire ho gaya — naya room banao", "Code expired — create a new room")

// Figma 02 · Create Room — host sees the code until they continue or the partner joins.
export function ShareCode({ room, onContinue }: { room: Room; onContinue: () => void }) {
  const t = useT()
  const left = room.createdAt + JOIN_WINDOW - useNow()
  const copy = () =>
    navigator.clipboard.writeText(room.code).then(
      () => toast.success(t("Code copy ho gaya", "Code copied")),
      () => toast.error(t("Copy nahi hua, code khud likh lo", "Couldn't copy — note the code down")),
    )

  return (
    <Screen
      glows={[[120, 170, 300, "purple"], [-140, 620, 280, "pink"]]}
      footer={
        <div data-enter>
          <Button variant="glow" size="cta" onClick={onContinue}>
            {t("Lobby mein chalo", "Go to lobby")} <ArrowRight />
          </Button>
        </div>
      }
    >
      <Particles />
      <Header title={t("Room banao", "Create Room")} right={<SoundToggle />} />
      <h2 data-enter className="mt-6 text-center text-[28px] leading-[34px] font-bold">
        {t("Room ready hai!", "Your room is ready!")}
      </h2>
      <p data-enter className="mx-auto mt-2 max-w-[290px] text-center text-sm leading-[21px] text-muted-foreground">
        {t("Ye code partner ko bhejo — join karte hi battle shuru.", "Send this code to your partner — the battle starts once they join.")}
      </p>

      <Card data-enter className="glass mt-6 items-center gap-0 rounded-3xl py-6 text-center ring-0">
        <span className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">ROOM CODE</span>
        <button
          type="button"
          onClick={copy}
          aria-label={t(`Room code ${room.code}, copy karo`, `Room code ${room.code}, copy`)}
          className="mt-2.5 rounded-2xl px-3 text-[48px] leading-[57px] font-extrabold tracking-[0.12em] text-[#d61f74] tabular-nums transition-transform active:scale-95"
        >
          {room.code}
        </button>
        <Button variant="glass" className="mt-3 h-11 rounded-full px-5 text-[15px]" onClick={copy}>
          <Copy className="size-[18px]" /> {t("Code copy karo", "Copy code")}
        </Button>
        <span className="mt-3 text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
          {expires(left, t)}
        </span>
      </Card>

      <div data-enter className="mt-4">
        <Button variant="success" size="cta" onClick={() => openWhatsApp(inviteText(room.code))}>
          <Share2 /> {t("WhatsApp pe bhejo", "Share on WhatsApp")}
        </Button>
      </div>
      <div data-enter className="mt-3">
        <NotifyToggle label={t("Partner join kare toh alert", "Alert me when my partner joins")} />
      </div>

      <div className="flex min-h-24 flex-1 items-center justify-center">
        <Float amp={6}>
          <Gif name="blowkiss" size={112} />
        </Float>
      </div>
    </Screen>
  )
}

/** Figma "Particle" ellipses — tiny twinkling dots. */
function Particles() {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    if (calm()) return
    gsap.to(".p", { opacity: 0.15, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: { each: 0.3, from: "random" } })
  }, { scope: ref })
  const dots = [[288, 455, 3], [87, 62, 3], [20, 731, 7], [323, 600, 5], [256, 469, 3], [55, 76, 3], [291, 614, 5], [224, 483, 3], [23, 90, 3]]
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 -z-[1]">
      {dots.map(([x, y, s], i) => (
        <span key={i} className="p absolute rounded-full bg-pink/50" style={{ left: x, top: y, width: s, height: s }} />
      ))}
    </div>
  )
}

/** Push alerts for this device: partner joins, picks, sends proof, starts the next round. */
export function NotifyToggle({ label }: { label?: string }) {
  const t = useT()
  const [state, setState] = useState<Awaited<ReturnType<typeof pushState>> | "loading">("loading")
  const [busy, setBusy] = useState(false)
  useEffect(() => void pushState().then(setState), [])

  if (state === "loading" || state === "unsupported") return null
  if (state === "install")
    return (
      <p className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px] leading-snug text-foreground/80">
        <Bell className="size-5 shrink-0 text-[#d61f74]" />
        {t("iPhone pe alerts ke liye: Share → Add to Home Screen, phir app se kholo", "For alerts on iPhone: Share → Add to Home Screen, then open the app from there")}
      </p>
    )

  const on = state === "on"
  const flip = async () => {
    setBusy(true)
    try {
      if (on) await disablePush()
      else await enablePush()
      setState(on ? "off" : "on")
      if (!on) toast.success(t("Alerts on! App band ho tab bhi pata chalega 🔔", "Alerts on! You'll hear even when the app is closed 🔔"))
    } catch (e) {
      setState(await pushState())
      toast.error((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy || state === "blocked"}
      onClick={flip}
      className="glass flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-transform duration-150 active:scale-[0.98] disabled:opacity-70"
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", on ? "bg-[#d61f74] text-white" : "bg-[#f6eefc] text-[#7e22ce]")}>
        {busy ? <Loader2 className="size-[18px] animate-spin" /> : state === "blocked" ? <BellOff className="size-[18px]" /> : on ? <BellRing className="size-[18px]" /> : <Bell className="size-[18px]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label ?? t("Partner ki alerts", "Partner alerts")}</span>
        <span className="block text-xs text-muted-foreground">
          {state === "blocked"
            ? t("Blocked — browser settings se allow karo", "Blocked — allow them in browser settings")
            : on
              ? t("On — app band ho tab bhi", "On — even when the app is closed")
              : "Off"}
        </span>
      </span>
      <span aria-hidden className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200", on ? "bg-[#d61f74]" : "bg-[#e3d4ee]")}>
        <span
          className={cn(
            "absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
            on && "translate-x-5",
          )}
        />
      </span>
    </button>
  )
}

// Figma 04a / 04b · Lobby
export function Lobby({ room, you, partner, run }: { room: Room; you: Player; partner?: Player; run: (a: Action) => Promise<unknown> }) {
  const t = useT()
  const [rules, setRules] = useState(false)
  const [busy, setBusy] = useState(false)
  const now = useNow()
  const isHost = you.id === room.hostId
  const [host, guest] = room.players
  const left = room.createdAt + JOIN_WINDOW - now

  const start = async () => {
    setBusy(true)
    await run({ type: "start" })
    setBusy(false)
  }

  const flipAvatar = () => run({ type: "set_avatar", avatar: you.avatar === "girl" ? "boy" : "girl" })

  return (
    <Screen
      glows={[[-100, 200, 280, "purple"], [200, 420, 260, "pink"]]}
      enterKey={!!partner}
      footer={
        <>
          <div data-enter>
            {isHost && partner ? (
              <Button variant="glow" size="cta" onClick={start} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Swords />} {t("Battle shuru karo", "Start Battle")}
              </Button>
            ) : (
              <Button variant="glass" size="cta" disabled>
                {partner ? t(`${host.name} start karega…`, `${host.name} will start…`) : t("Partner ka wait…", "Waiting for partner…")}
              </Button>
            )}
          </div>
          <p data-enter className="mt-2.5 text-center text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
            {partner
              ? isHost
                ? t("Level set? Battle shuru karo!", "Level set? Start the battle!")
                : t("Host ke start karte hi dono ek dusre ke liye dare chunenge", "Once the host starts, you'll pick dares for each other")
              : expires(left, t)}
          </p>
        </>
      }
    >
      {partner && (
        <>
          <Deco type="heart" x={330} y={196} size={30} />
          <Deco type="flower" x={6} y={190} size={26} delay={0.5} />
          <Deco type="sparkle" x={338} y={360} size={18} delay={0.2} />
        </>
      )}
      <Header
        title="Lobby"
        right={
          <>
            <Badge variant="purple">#{room.code}</Badge>
            <SoundToggle />
          </>
        }
      />

      <h2 data-enter className="mt-5 text-center text-[28px] leading-[34px] font-bold">
        {partner ? t("Dono aa gaye!", "You're both here!") : t("Partner ka wait…", "Waiting for partner…")}
      </h2>
      {!partner && (
        <div data-enter className="mt-2">
          <TypingDots />
        </div>
      )}

      <div data-enter className="relative mt-6 grid grid-cols-2 gap-4">
        <PlayerCard player={host} you={host.id === you.id} host onFlip={host.id === you.id ? flipAvatar : undefined} />
        <PlayerCard player={guest} you={guest?.id === you.id} onFlip={guest?.id === you.id ? flipAvatar : undefined} />
        <Pulse className="absolute top-[64px] left-1/2 -ml-6 grid size-12 place-items-center rounded-full bg-[linear-gradient(135deg,#dc1474,#9b3df0)] text-base font-extrabold text-white shadow-[0_8px_20px_-6px_rgb(220_20_116/0.7)] ring-4 ring-background">
          VS
        </Pulse>
      </div>

      <div data-enter className="mt-5">
        <LevelPicker level={levelOf(room)} host={isHost} onPick={(level) => run({ type: "set_level", level })} />
      </div>

      <div data-enter className="mt-3 flex items-center justify-between gap-3 px-1 text-[13px] text-muted-foreground">
        <span>
          {ROUNDS} rounds • {MAX_SKIPS} skips • {t("voice/photo proof", "voice/photo proof")}
        </span>
        <Button variant="link" className="h-auto px-0 text-sm font-semibold text-[#d61f74]" onClick={() => setRules(true)}>
          {t("Rules", "Rules")}
        </Button>
      </div>

      <div data-enter className="mt-3">
        <CustomDares room={room} you={you} partner={partner} run={run} />
      </div>

      <div data-enter className="mt-3">
        {partner ? (
          <NotifyToggle />
        ) : (
          <Button variant="success" size="cta" className="h-12" onClick={() => openWhatsApp(inviteText(room.code))}>
            <Share2 /> {t("Code WhatsApp karo", "Send code on WhatsApp")}
          </Button>
        )}
      </div>

      <div className="flex min-h-4 flex-1 items-center justify-center">
        {partner && (
          <Float amp={5}>
            <Gif name="joined" size={80} />
          </Float>
        )}
      </div>

      <Dialog open={rules} onOpenChange={setRules}>
        <DialogContent sheet className="glass bg-white/95 px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t("Rules", "Rules")}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-3.5 text-[15px] leading-relaxed text-foreground/85">
            {(
              [
                [
                  Timer,
                  t("Har round: pehle dono ek dusre ke liye dare chunte ho (30 sec), phir dono apna dare karte ho", "Each round: first you both pick a dare for each other (30 sec), then you both do yours"),
                ],
                [Mic, t("Proof hi dare hai: voice note record karo ya photo bhejo", "The proof is the dare: record a voice note or send a photo")],
                [PenLine, t(`Card pasand nahi? Apna dare likho — ya lobby mein ${MAX_CUSTOM} tak pehle se save karo`, `Don't like the cards? Write your own — or save up to ${MAX_CUSTOM} in the lobby`)],
                [
                  Sparkles,
                  t(
                    `Friendly +${LEVELS.friendly.points}, Couple +${LEVELS.couple.points}, Extreme +${LEVELS.extreme.points} points per dare`,
                    `Friendly +${LEVELS.friendly.points}, Couple +${LEVELS.couple.points}, Extreme +${LEVELS.extreme.points} points per dare`,
                  ),
                ],
                [SkipForward, t(`Poore game mein max ${MAX_SKIPS} skips — ya timer khatam hone do, koi pressure nahi`, `Max ${MAX_SKIPS} skips per game — or just let the timer run out, no pressure`)],
                [Camera, t("Proof partner ko jaata hai; safety ke liye admin bhi dekh sakta hai. 24 ghante mein auto-delete.", "Proofs go to your partner; an admin can also review them for safety. Auto-deleted within 24 hours.")],
                [HeartHandshake, t("Safe, consensual aur fun. Kuch uncomfortable lage toh bina soche skip karo.", "Safe, consensual and fun. If anything feels uncomfortable, skip it — no questions.")],
              ] as const
            ).map(([Icon, text]) => (
              <li key={text} className="flex gap-3">
                <Icon className="mt-1 size-[18px] shrink-0 text-[#d61f74]" />
                {text}
              </li>
            ))}
          </ul>
          <Button variant="glow" size="cta" className="mt-1" onClick={() => setRules(false)}>
            {t("Samajh gaye", "Got it")}
          </Button>
        </DialogContent>
      </Dialog>
    </Screen>
  )
}

/** Dares a player saves ahead of time; they show up as extra cards when it's their turn to pick. Partner only sees the count. */
function CustomDares({ room, you, partner, run }: { room: Room; you: Player; partner?: Player; run: (a: Action) => Promise<unknown> }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [proof, setProof] = useState<ProofKind>("voice")
  const [busy, setBusy] = useState(false)
  const mine = (room.custom ?? []).filter((c) => c.by === you.id)
  const theirs = (room.custom ?? []).length - mine.length
  const them = partner?.name ?? "Partner"
  const full = mine.length >= MAX_CUSTOM

  const add = async () => {
    setBusy(true)
    if (await run({ type: "add_dare", text, proof })) setText("")
    setBusy(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-transform duration-150 active:scale-[0.98]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fff1d6] text-[#a15c07]">
          <PenLine className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t("Custom dares", "Custom dares")}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {mine.length ? t(`${mine.length} save kiye ${them} ke liye`, `${mine.length} saved for ${them}`) : t(`${them} ke liye apne dares likho`, `Write your own dares for ${them}`)}
            {theirs > 0 && t(` · ${them} ne ${theirs} likhe 🤫`, ` · ${them} wrote ${theirs} 🤫`)}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-foreground/40" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent sheet className="glass gap-4 bg-white/95 px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t("Custom dares", "Custom dares")}</DialogTitle>
            <DialogDescription>
              {t(
                `Pehle se likh ke rakho — ${them} ke liye dare chunte waqt ye bhi cards mein dikhenge. ${them} ko sirf ginti dikhegi 🤫`,
                `Save them now — they'll appear as extra cards when you pick ${them}'s dare. ${them} only sees how many 🤫`,
              )}
            </DialogDescription>
          </DialogHeader>

          {mine.length > 0 && (
            <ul className="flex flex-col gap-2">
              {mine.map((c) => (
                <li key={c.id} className="flex items-start gap-3 rounded-2xl bg-[#f6eefc]/80 py-2.5 pr-1.5 pl-3.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  {c.proof === "voice" ? <Mic className="mt-0.5 size-4 shrink-0 text-[#d61f74]" /> : <Camera className="mt-0.5 size-4 shrink-0 text-[#d61f74]" />}
                  <span className="min-w-0 flex-1 text-sm leading-snug">{c.text}</span>
                  <button
                    type="button"
                    aria-label={t("Dare hatao", "Remove dare")}
                    onClick={() => run({ type: "remove_dare", id: c.id })}
                    className="-my-1 grid size-9 shrink-0 place-items-center rounded-full text-foreground/50 transition-colors hover:bg-white active:scale-90"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {full ? (
            <p className="text-center text-sm text-muted-foreground">
              {t(`Max ${MAX_CUSTOM} ho gaye. Ek hatao toh naya likh sakte ho.`, `That's the max of ${MAX_CUSTOM}. Remove one to write another.`)}
            </p>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (text.trim().length >= 5 && !busy) void add()
              }}
            >
              <DareWriter text={text} setText={setText} proof={proof} setProof={setProof} them={them} />
              <Button type="submit" variant="glow" size="cta" disabled={text.trim().length < 5 || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Plus />} {t("Dare save karo", "Save dare")}
                <span className="font-normal opacity-80">
                  ({mine.length}/{MAX_CUSTOM})
                </span>
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Text + proof-type input shared by the lobby's saved dares and the pick screen's "write your own". */
export function DareWriter({
  text,
  setText,
  proof,
  setProof,
  them,
  autoFocus,
}: {
  text: string
  setText: (s: string) => void
  proof: ProofKind
  setProof: (p: ProofKind) => void
  them: string
  autoFocus?: boolean
}) {
  const t = useT()
  return (
    <>
      <Textarea
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        maxLength={160}
        placeholder={t(`${them} ke liye dare likho… e.g. “Mere liye apni favourite song ki 2 lines gaao”`, `Write a dare for ${them}… e.g. “Sing me 2 lines of your favourite song”`)}
        aria-label={t("Apna dare", "Your dare")}
        enterKeyHint="done"
        className="min-h-24 resize-none rounded-2xl bg-white p-3.5 text-base"
      />
      <div role="radiogroup" aria-label={t("Proof type", "Proof type")} className="grid grid-cols-2 gap-2">
        {(["voice", "photo"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={proof === k}
            onClick={() => setProof(k)}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition-colors duration-200",
              proof === k ? "border-[#d61f74] bg-[#fff0f7] text-[#d61f74]" : "border-transparent bg-[#f6eefc] text-foreground/70",
            )}
          >
            {k === "voice" ? <Mic className="size-4" /> : <Camera className="size-4" />}
            {k === "voice" ? "Voice note" : "Photo"}
          </button>
        ))}
      </div>
    </>
  )
}

/** Host picks the heat; the partner watches it change live. */
function LevelPicker({ level, host, onPick }: { level: Level; host: boolean; onPick: (l: Level) => void }) {
  const t = useT()
  const en = useLang() === "en"
  const i = LEVEL_ORDER.indexOf(level)
  const Icon = LEVEL_ICON[level]
  return (
    <div>
      <div role="radiogroup" aria-label="Dare level" className="glass relative grid grid-cols-3 rounded-2xl p-1">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-[linear-gradient(135deg,#dc1474,#9b3df0)] shadow-[0_8px_18px_-8px_rgb(220_20_116/0.8)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transform: `translateX(${i * 100}%)` }}
        />
        {LEVEL_ORDER.map((l) => {
          const I = LEVEL_ICON[l]
          const on = l === level
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!host}
              onClick={() => onPick(l)}
              className={cn(
                "relative z-10 flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors duration-200 disabled:cursor-default",
                on ? "text-white" : "text-foreground/70",
              )}
            >
              <I className="size-4" /> {LEVELS[l].label}
            </button>
          )
        })}
      </div>
      <p key={level} className="mt-2 flex items-start gap-2 px-1 text-[13px] leading-snug text-foreground/75 animate-in fade-in slide-in-from-top-1 duration-300">
        <Icon className="mt-0.5 size-4 shrink-0 text-[#d61f74]" />
        <span>
          {en ? LEVELS[level].blurbEn : LEVELS[level].blurb} · <b className="font-semibold text-foreground">+{LEVELS[level].points}</b> {t("per dare", "per dare")}
          {!host && <span className="text-muted-foreground">{t(" · host chunega", " · host decides")}</span>}
        </span>
      </p>
    </div>
  )
}

// Figma Player Card (State=Ready | State=Waiting)
function PlayerCard({ player, you, host, onFlip }: { player?: Player; you?: boolean; host?: boolean; onFlip?: () => void }) {
  const t = useT()
  const avatar = player?.avatar ?? "boy"
  return (
    <div
      className={cn(
        "glass flex h-[172px] flex-col items-center justify-center gap-1 rounded-3xl px-3 text-center",
        !player && "border-dashed border-pink/40 bg-white/50",
      )}
    >
      {player ? (
        <div className="relative">
          <Face name={player.name} avatar={avatar} size={68} />
          {onFlip && (
            <button
              type="button"
              onClick={onFlip}
              aria-label={t(`Avatar badlo (abhi ${AVATARS[avatar].label})`, `Change avatar (now ${AVATARS[avatar].label})`)}
              className="absolute -right-3 -bottom-2 grid size-9 place-items-center rounded-full bg-white text-foreground/80 shadow-[0_4px_12px_-4px_rgb(58_31_77/0.4)] ring-1 ring-black/5 transition-transform active:scale-90"
            >
              <Repeat2 className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <Gif name="waiting" size={72} />
      )}
      <span className="mt-1.5 max-w-full truncate text-base font-semibold">
        {player ? player.name : "Partner"}
        {you && <span className="font-normal text-muted-foreground"> ({t("Tum", "You")})</span>}
      </span>
      <span className="text-xs text-muted-foreground">
        {host ? "Host" : "Partner"}
        {player && ` · ${AVATARS[avatar].label}`}
      </span>
      <Badge variant={player ? "green" : "gold"} className="mt-1">
        {player ? "Ready" : t("Wait…", "Waiting…")}
      </Badge>
    </div>
  )
}
