"use client"

import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { Camera, ImagePlus, Loader2, MessageSquareHeart, Mic, PenLine, Send, SkipForward, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Face, Gif, Header, LEVEL_ICON, Screen, SoundToggle, type GifName } from "./kit"
import { calm, safety, TimerRing, TypingDots } from "./fx"
import { audioExt, VoiceRecorder } from "./voice"
import { api, supabase, useNow, type ClientAction } from "@/lib/client"
import { cue } from "@/lib/sfx"
import { useLang, useT, type T } from "@/lib/i18n"
import { dareInfo, type Lang } from "@/lib/dares"
import { dareFor, GRACE, MAX_SKIPS, ROUNDS, type FeedItem, type Player, type ProofInput, type Room } from "@/lib/game"
import { cn } from "@/lib/utils"

type Props = { room: Room; you: Player; partner: Player; act: (a: ClientAction) => Promise<unknown> }

const ago = (at: number, now: number, t: T) => {
  const s = Math.max(0, (now - at) / 1000)
  return s < 60 ? t("abhi", "now") : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`
}

const QUICK_BANTERS = [
  { emoji: "🌶️", hi: "Spicy!", en: "Spicy!" },
  { emoji: "🥊", hi: "Dar gaye?", en: "Scared?" },
  { emoji: "⏰", hi: "Jaldi!", en: "Hurry up!" },
  { emoji: "😘", hi: "Cute!", en: "Cute!" },
  { emoji: "🔥", hi: "Aag laga di!", en: "On fire!" },
  { emoji: "🙈", hi: "OMG!", en: "OMG!" },
]

/** Feed entries are stored as data so each phone reads them in its own language. */
function feedLine(f: FeedItem, t: T, lang: Lang) {
  if (!f.kind) return f.text ?? "" // rooms from before the structured feed
  const n = f.name ?? ""
  const title = f.dare == null || f.dare < 0 ? "Custom dare" : dareInfo(f.dare, undefined, undefined, lang).title
  switch (f.kind) {
    case "join":
      return t(`${n} ne room join kiya`, `${n} joined the room`)
    case "picked":
      return t(`${n} ne dare chun liya 😈`, `${n} picked a dare 😈`)
    case "done":
      return t(`${n} ne "${title}" ka proof bheja`, `${n} sent proof for "${title}"`)
    case "skip":
      return t(`${n} ne "${title}" skip kiya`, `${n} skipped "${title}"`)
    case "timeout":
      return t(`${n} ka time khatam`, `${n} ran out of time`)
    case "banter":
      return `${n}: ${f.text}`
  }
}

// Round step 2: everyone does the dare their partner picked.
export function DarePhase(props: Props) {
  const { room, you, act } = props
  const [proofRound, setProofRound] = useState(0) // proof screen belongs to one round; a new deal closes it
  const [burst, setBurst] = useState<GifName | null>(null)
  const now = useNow(250)
  const turn = you.turn!
  const info = dareFor(room, you)
  const left = Math.max(0, Math.min(info.seconds, Math.ceil((turn.endsAt - now) / 1000)))
  const pending = turn.status === "pending"

  const proofing = proofRound === room.round

  // Last five seconds tick (sound + buzz) while this player still owes a proof.
  useEffect(() => {
    if (pending && left > 0 && left <= 5) cue("tick")
  }, [left, pending])

  // Whoever is still pending past their deadline gets timed out by the server; either phone may nudge it.
  const due = Math.min(...room.players.filter((p) => p.turn?.status === "pending").map((p) => p.turn!.endsAt + GRACE + 500))
  const overdue = Number.isFinite(due) && now >= due
  useEffect(() => {
    if (!overdue) return
    const tick = () => act({ type: "tick" }).catch(() => {})
    tick()
    const t = setInterval(tick, 3000)
    return () => clearInterval(t)
  }, [overdue, act])

  return (
    <>
      {proofing && pending ? (
        <UploadProof {...props} left={left} onBack={() => setProofRound(0)} onSent={() => setBurst("fireworks")} />
      ) : (
        <Dare {...props} now={now} left={left} onProof={() => setProofRound(room.round)} onSkip={() => setBurst("fight")} />
      )}
      {burst && <Burst gif={burst} onDone={() => setBurst(null)} />}
    </>
  )
}

// Figma 05 · Dare — Gameplay (Mobile-Optimized, No Excess Scroll)
function Dare({ room, you, partner, act, now, left, onProof, onSkip }: Props & { now: number; left: number; onProof: () => void; onSkip: () => void }) {
  const t = useT()
  const lang = useLang()
  const card = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [banterBusy, setBanterBusy] = useState(false)
  const turn = you.turn!
  const info = dareFor(room, you, lang)
  const gave = partner.turn && dareFor(room, partner, lang) // what you picked for them
  const giver = room.players.find((p) => p.id === turn.from) ?? partner
  const skipsLeft = MAX_SKIPS - you.skipped
  const LevelIcon = info.custom ? PenLine : LEVEL_ICON[info.level]
  const voice = info.proof === "voice"

  useGSAP(
    () => {
      if (calm()) return void gsap.set(card.current, { autoAlpha: 1 })
      return safety(
        gsap.fromTo(
          card.current,
          { rotationY: -90, transformPerspective: 900, autoAlpha: 0 },
          { rotationY: 0, autoAlpha: 1, duration: 0.8, ease: "back.out(1.4)", delay: 0.15 },
        ),
      )
    },
    { dependencies: [room.round] },
  )

  async function skip() {
    setBusy(true)
    try {
      await act({ type: "skip" })
      cue("skip")
      onSkip()
    } catch (e) {
      toast.error((e as Error).message)
    }
    setBusy(false)
  }

  async function sendBanter(text: string) {
    if (banterBusy) return
    setBanterBusy(true)
    try {
      await act({ type: "banter", text })
      cue("pop")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTimeout(() => setBanterBusy(false), 800)
    }
  }

  const waitLine = {
    done: voice ? t("Voice note bhej diya ✅", "Voice note sent ✅") : t("Photo bhej di ✅", "Photo sent ✅"),
    skipped: t("Skip kar diya — partner naraz! 🥊", "Skipped — your partner's sulking! 🥊"),
    timeout: t("Time khatam ⏰", "Time's up ⏰"),
    pending: "",
  }[turn.status]

  const p = partner.turn
  const partnerLine =
    p?.status === "done"
      ? p.proof?.kind === "audio"
        ? t(`${partner.name} ne voice note bheja 🎙️`, `${partner.name} sent a voice note 🎙️`)
        : t(`${partner.name} ne photo bheji 📸`, `${partner.name} sent a photo 📸`)
      : p?.status === "skipped"
        ? t(`${partner.name} ne skip kiya 🥊`, `${partner.name} skipped 🥊`)
        : p?.status === "timeout"
          ? t(`${partner.name} ka time out ⏰`, `${partner.name} ran out of time ⏰`)
          : t(`${partner.name} tumhara diya dare kar rahe hain…`, `${partner.name} is doing your dare…`)

  return (
    <Screen glows={[[-120, 180, 260, "purple"], [200, 520, 240, "pink"]]} enterKey={room.round} compact>
      {/* Top bar: round, live score, sound */}
      <div data-enter className="flex items-center justify-between gap-2">
        <Badge variant="purple" className="px-3 text-xs">
          Round {room.round}/{ROUNDS}
        </Badge>
        <div className="glass flex h-10 items-center gap-2 rounded-full px-2" aria-label={t(`Score: tum ${you.score}, ${partner.name} ${partner.score}`, `Score: you ${you.score}, ${partner.name} ${partner.score}`)}>
          <Face name={you.name} avatar={you.avatar} size={26} />
          <span className="text-base font-bold tabular-nums">{you.score}</span>
          <span className="text-xs text-muted-foreground">–</span>
          <span className="text-base font-bold tabular-nums">{partner.score}</span>
          <Face name={partner.name} avatar={partner.avatar} size={26} />
        </div>
        <SoundToggle />
      </div>

      <div data-enter className="flex justify-center">
        <TimerRing left={turn.status === "pending" ? left : 0} total={info.seconds} size={118} />
      </div>

      {/* Dare card: who picked it for you is the first thing you read */}
      <div ref={card} className="glass relative rounded-3xl p-4 opacity-0 sm:p-5">
        <p className="flex items-center gap-2 pr-10 text-[13px] font-semibold text-[#d61f74]">
          <Face name={giver.name} avatar={giver.avatar} size={24} />
          <span className="truncate">
            {info.custom
              ? t(`${giver.name} ne tumhare liye khud likha ✍️`, `${giver.name} wrote this for you ✍️`)
              : t(`${giver.name} ne tumhare liye chuna 💌`, `${giver.name} picked this for you 💌`)}
          </span>
        </p>

        <p className="mt-2.5 min-h-[56px] text-[19px] leading-snug font-semibold text-balance">{info.text}</p>

        <div className="mt-3 flex items-center gap-2 pr-12">
          <Badge variant={info.custom ? "gold" : info.tone} className="gap-1 px-2.5 text-xs">
            <LevelIcon /> {info.custom ? "Custom" : info.label}
          </Badge>
          <Badge variant="secondary" className="h-[27px] gap-1 border-[#ead9f2] px-2.5 text-xs font-semibold text-foreground/80">
            {voice ? <Mic /> : <Camera />} {voice ? "Voice note" : "Photo"}
          </Badge>
          <span className="flex items-center gap-1 text-xs font-bold text-[#a15c07]">
            <Sparkles className="size-3.5" /> +{info.points}
          </span>
        </div>

        <div className="pointer-events-none absolute -right-2 -bottom-3">
          <Gif name="thumbs" size={54} />
        </div>
      </div>

      {/* Actions */}
      {turn.status === "pending" ? (
        <div data-enter className="flex flex-col gap-2">
          <Button variant="glow" size="cta" onClick={onProof} disabled={busy}>
            {voice ? <Mic /> : <Camera />} {voice ? t("Voice note record karo", "Record voice note") : t("Photo bhejo", "Send photo")}
          </Button>
          <Button variant="glass" size="cta" className="h-11 text-sm" onClick={skip} disabled={busy || skipsLeft <= 0}>
            {busy ? <Loader2 className="animate-spin" /> : <SkipForward className="size-4" />}
            {skipsLeft > 0 ? t(`Skip (${skipsLeft} bache)`, `Skip (${skipsLeft} left)`) : t("Skips khatam", "No skips left")}
          </Button>
        </div>
      ) : (
        <div data-enter className="glass flex min-h-[76px] items-center gap-3.5 rounded-2xl px-4 py-2.5">
          <Gif name={turn.status === "done" ? "waiting" : "fight"} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{waitLine}</p>
            {gave && (
              <p className="truncate text-xs text-muted-foreground">
                {t(`Tumne ${partner.name} ko diya: ${gave.title}`, `You gave ${partner.name}: ${gave.title}`)}
              </p>
            )}
            <div className="mt-1 [&>div]:justify-start">
              <TypingDots />
            </div>
          </div>
        </div>
      )}

      {/* Live: partner status, one-tap banter, feed */}
      <div data-enter className="glass rounded-2xl px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.15em] text-[#d61f74]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ff5c7a] opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-[#ff5c7a]" />
            </span>
            LIVE
          </div>
          <span
            key={p?.status}
            className={cn(
              "truncate text-xs font-semibold animate-in fade-in slide-in-from-right-2 duration-300",
              p?.status === "done" ? "text-[#15803d]" : p?.status === "pending" ? "text-muted-foreground" : "text-[#be123c]",
            )}
          >
            {partnerLine}
          </span>
        </div>

        <div className="no-scrollbar -mx-3.5 mt-2.5 flex items-center gap-2 overflow-x-auto px-3.5 pb-0.5">
          {QUICK_BANTERS.map((b) => {
            const word = t(b.hi, b.en)
            return (
              <button
                key={b.hi}
                type="button"
                disabled={banterBusy}
                onClick={() => sendBanter(`${b.emoji} ${word}`)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white bg-white/75 px-3 text-[13px] font-semibold shadow-[0_4px_10px_-6px_rgb(120_50_140/0.4)] transition-transform duration-150 active:scale-90 disabled:opacity-60"
              >
                <span aria-hidden>{b.emoji}</span>
                {word}
              </button>
            )
          })}
        </div>

        <ul className="mt-2 space-y-1 text-[13px]" aria-live="polite">
          {room.feed.slice(0, 2).map((f) => (
            <li key={`${f.at}${f.kind}${f.by}`} className="flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
              <span className="truncate font-medium text-foreground/85">{feedLine(f, t, lang)}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{ago(f.at, now, t)}</span>
            </li>
          ))}
          {!room.feed.length && (
            <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquareHeart className="size-3.5" />
              {t("Banter tap karke partner ko tang karo 😜", "Tap a banter to tease your partner 😜")}
            </li>
          )}
        </ul>
      </div>
    </Screen>
  )
}

/** Full-screen celebratory pop (fireworks on proof sent, fight on skip). */
function Burst({ gif, onDone }: { gif: GifName; onDone: () => void }) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      if (calm()) {
        const id = setTimeout(onDone, 1200)
        return () => clearTimeout(id)
      }
      const tl = gsap
        .timeline({ onComplete: onDone })
        .fromTo(ref.current, { scale: 0.4, rotation: -8, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.6, ease: "back.out(1.6)" })
        .to(ref.current, { scale: 0.85, autoAlpha: 0, duration: 0.3, ease: "power2.in" }, "+=0.8")
      return safety(tl, 2500)
    },
    { scope: ref },
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-[rgb(58_31_77/0.35)] backdrop-blur-[3px] animate-in fade-in duration-200" aria-hidden>
      <div ref={ref} className="flex flex-col items-center">
        <Gif name={gif} size={210} />
        <span className="mt-2 text-xl font-extrabold text-white drop-shadow-[0_2px_12px_rgb(120_20_80/0.8)]">
          {gif === "fireworks" ? t("Proof bhej diya! 🔥", "Proof sent! 🔥") : t("Skip! Partner naraz 🥊", "Skipped! Partner's sulking 🥊")}
        </span>
      </div>
    </div>
  )
}

const MAX_BYTES = 20 * 1024 * 1024

// Figma 06 · Upload Proof — voice note recorder or photo, per the dare.
function UploadProof({ room, you, act, left, onBack, onSent }: Props & { left: number; onBack: () => void; onSent: () => void }) {
  const t = useT()
  const lang = useLang()
  const zone = useRef<HTMLLabelElement>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [voice, setVoice] = useState<Blob | null>(null)
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState(false)
  const info = dareFor(room, you, lang)
  const isVoice = info.proof === "voice"
  const ready = isVoice ? !!voice : !!photo

  useGSAP(
    () => {
      if (!photo && !isVoice && !calm()) {
        gsap.to(zone.current, {
          boxShadow: "0 0 0 8px rgb(255 61 154 / 0.12)",
          borderColor: "rgb(214 31 116 / 0.7)",
          duration: 1,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        })
      }
    },
    { dependencies: [!!photo], revertOnUpdate: true },
  )

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  function pick(f?: File) {
    if (!f) return
    if (!f.type.startsWith("image/")) return void toast.error(t("Is dare ke liye photo chahiye", "This dare needs a photo"))
    if (f.size > MAX_BYTES) return void toast.error(t("Photo 20MB se badi hai", "Photo is larger than 20MB"))
    setPhoto(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit() {
    setBusy(true)
    try {
      const body = isVoice ? voice! : await shrink(photo!)
      const type = body.type.split(";")[0]
      const kind: ProofInput["kind"] = isVoice ? "audio" : "image"
      const ext = isVoice ? audioExt(type) : body === photo ? (photo.name.split(".").pop() ?? "jpg") : "jpg"
      const failed = t("Upload fail hua, dobara try karo", "Upload failed, please try again")

      const res = await api<
        | { provider: "cloudinary"; cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }
        | { provider: "supabase"; path: string; token: string }
      >(`/api/rooms/${room.code}/proof`, { ext, kind })

      let proof: ProofInput
      if (res.provider === "cloudinary") {
        const form = new FormData()
        form.append("file", body, `proof.${ext}`)
        form.append("api_key", res.apiKey)
        form.append("timestamp", String(res.timestamp))
        form.append("signature", res.signature)
        form.append("folder", res.folder)
        const up = await fetch(`https://api.cloudinary.com/v1_1/${res.cloudName}/auto/upload`, { method: "POST", body: form })
        const data = await up.json().catch(() => ({}))
        if (!up.ok || !data.secure_url) throw new Error(failed)
        proof = { url: data.secure_url, kind, caption }
      } else {
        const { error } = await supabase().storage.from("proofs").uploadToSignedUrl(res.path, res.token, body, { contentType: type || "application/octet-stream" })
        if (error) throw new Error(failed)
        proof = { path: res.path, kind, caption }
      }

      await act({ type: "complete", proof })
      cue("success")
      onSent()
      onBack()
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Screen
      glows={[[160, 200, 280, "purple"], [-140, 560, 260, "pink"]]}
      className="gap-3 px-4"
      footer={
        <div data-enter>
          <Button variant="glow" size="cta" onClick={submit} disabled={!ready || busy || left <= 0}>
            {busy ? <Loader2 className="animate-spin" /> : <Send className="size-[18px]" />}
            {busy
              ? t("Bhej rahe hain…", "Sending…")
              : left <= 0
                ? t("Time khatam", "Time's up")
                : isVoice
                  ? t("Voice note bhejo", "Send voice note")
                  : t("Photo bhejo", "Send photo")}
          </Button>
          <div className={cn("mt-2 h-1 overflow-hidden rounded-full bg-[#3a1f4d]/10", !busy && "invisible")} aria-hidden>
            <div className="h-full w-1/3 animate-[upload_1.1s_cubic-bezier(0.65,0,0.35,1)_infinite] rounded-full bg-[linear-gradient(90deg,#dc1474,#9b3df0)]" />
          </div>
        </div>
      }
    >
      <Header
        title={isVoice ? "Voice note" : t("Photo proof", "Photo proof")}
        back={busy ? () => {} : onBack}
        right={
          <Badge variant={left <= 10 ? "pink" : "gold"} className="tabular-nums">
            ⏱ {left}s
          </Badge>
        }
      />

      <div data-enter className="glass rounded-2xl px-4 py-3">
        <Badge variant={info.custom ? "gold" : info.tone} className="h-6 text-[11px]">
          {info.custom ? "Custom" : info.label} · +{info.points}
        </Badge>
        <p className="mt-1.5 text-[15px] leading-snug font-semibold text-balance">{info.text}</p>
      </div>

      <div data-enter>
        {isVoice ? (
          <VoiceRecorder onTake={(take) => setVoice(take?.blob ?? null)} disabled={busy} />
        ) : (
          <label
            ref={zone}
            className="relative flex h-[230px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-pink/40 bg-white/50 text-center focus-within:ring-3 focus-within:ring-pink/50"
          >
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={preview} alt={t("Proof ka preview", "Proof preview")} className="absolute inset-0 size-full object-cover animate-in fade-in zoom-in-105 duration-500" />
                <span className="glass absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold">
                  <ImagePlus className="size-3.5" /> {t("Badlo", "Change")}
                </span>
              </>
            ) : (
              <>
                <div className="absolute top-2 right-2">
                  <Gif name="shy" size={60} />
                </div>
                <span className="grid size-16 place-items-center rounded-full bg-[linear-gradient(135deg,#dc1474,#9b3df0)] shadow-[0_12px_28px_-8px_rgb(220_20_116/0.7)]">
                  <Camera className="size-7 text-white" />
                </span>
                <span className="mt-3 text-[15px] font-semibold">{t("Photo lo ya gallery se chuno", "Take a photo or pick from gallery")}</span>
                <span className="mt-1 max-w-[240px] text-xs leading-tight text-muted-foreground">{t("Partner ke liye • 24 ghante mein delete", "For your partner • deleted within 24 hours")}</span>
              </>
            )}
          </label>
        )}
      </div>

      <div data-enter>
        <label htmlFor="caption" className="px-1 text-xs font-semibold tracking-[0.12em] text-muted-foreground">
          {t("CAPTION (OPTIONAL)", "CAPTION (OPTIONAL)")}
        </label>
        <Textarea
          id="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={140}
          enterKeyHint="done"
          placeholder={t("Kuch cute likho… 😜", "Write something cute… 😜")}
          className="glass mt-1 h-16 min-h-16 resize-none rounded-2xl p-3 text-base"
        />
      </div>
    </Screen>
  )
}

/** Phone photos are 3–8MB; 1600px JPEG is plenty for a proof and uploads fast. Falls back to the original. */
async function shrink(f: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(f)
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement("canvas")
    c.width = Math.round(bmp.width * k)
    c.height = Math.round(bmp.height * k)
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.85))
  } catch {
    return f
  }
}
