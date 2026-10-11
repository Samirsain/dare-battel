"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Pause, Play, RotateCcw, Square } from "lucide-react"
import { cue } from "@/lib/sfx"
import { cn } from "@/lib/utils"

export const MAX_VOICE = 60 // seconds

// Prefer AAC/MP4: it plays on every phone. Chrome falls back to WebM/Opus.
const MIME = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]

export const audioExt = (type: string) =>
  ({ "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav" })[
    type.split(";")[0]
  ] ?? "webm"

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

type Take = { blob: Blob; url: string; seconds: number }

/** Tap to record, tap to stop. Hands the finished take (or null on re-record) to `onTake`. */
export function VoiceRecorder({ onTake, disabled }: { onTake: (t: Take | null) => void; disabled?: boolean }) {
  const [phase, setPhase] = useState<"idle" | "rec" | "done" | "denied">("idle")
  const [elapsed, setElapsed] = useState(0)
  const [take, setTake] = useState<Take | null>(null)
  const bars = useRef<HTMLDivElement>(null)
  const stopRef = useRef<() => void>(() => {})

  useEffect(() => () => stopRef.current(), [])
  useEffect(() => () => void (take && URL.revokeObjectURL(take.url)), [take])

  async function start() {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      return setPhase("denied")
    }
    const mimeType = MIME.find((t) => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64_000 } : undefined)
    const chunks: Blob[] = []
    const t0 = performance.now()
    let raf = 0
    const ctx = new AudioContext()
    const an = ctx.createAnalyser()
    an.fftSize = 64
    ctx.createMediaStreamSource(stream).connect(an)
    const levels = new Uint8Array(an.frequencyBinCount)
    const draw = () => {
      an.getByteFrequencyData(levels)
      bars.current?.childNodes.forEach((el, i) => {
        ;(el as HTMLElement).style.transform = `scaleY(${0.15 + (levels[(i * 2) % levels.length] / 255) * 0.85})`
      })
      raf = requestAnimationFrame(draw)
    }

    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      const seconds = Math.min(MAX_VOICE, (performance.now() - t0) / 1000)
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" })
      const t = { blob, url: URL.createObjectURL(blob), seconds }
      setTake(t)
      onTake(t)
      setPhase("done")
    }

    rec.start(250)
    cue("rec")
    setElapsed(0)
    setPhase("rec")
    raf = requestAnimationFrame(draw)
    const tick = setInterval(() => {
      const s = (performance.now() - t0) / 1000
      setElapsed(s)
      if (s >= MAX_VOICE) stop()
    }, 200)
    stopRef.current = () => {
      cancelAnimationFrame(raf)
      clearInterval(tick)
      if (rec.state !== "inactive") rec.stop()
      stream.getTracks().forEach((tr) => tr.stop())
      void ctx.close()
      stopRef.current = () => {}
    }
  }

  function stop() {
    cue("rec")
    stopRef.current()
  }

  function redo() {
    setTake(null)
    onTake(null)
    setPhase("idle")
  }

  if (phase === "done" && take)
    return (
      <div className="glass flex flex-col gap-3 rounded-3xl p-4 animate-in fade-in zoom-in-95 duration-300">
        <VoicePlayer src={take.url} seconds={take.seconds} />
        <button
          type="button"
          onClick={redo}
          disabled={disabled}
          className="mx-auto flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-foreground/75 transition-colors hover:bg-white/70 disabled:opacity-50"
        >
          <RotateCcw className="size-4" /> Dobara record karo
        </button>
      </div>
    )

  const rec = phase === "rec"
  return (
    <div className="glass flex flex-col items-center rounded-3xl px-4 pt-6 pb-5 text-center">
      <div className="relative grid size-[96px] place-items-center">
        {rec && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#ff5c7a]/30" />}
        <button
          type="button"
          onClick={rec ? stop : start}
          disabled={disabled}
          aria-label={rec ? "Recording roko" : "Voice note record karo"}
          className={cn(
            "relative grid size-20 place-items-center rounded-full text-white transition-[transform,background-color,box-shadow] duration-200 ease-out active:scale-90 disabled:opacity-50",
            rec
              ? "bg-[#e11d48] shadow-[0_10px_28px_-8px_rgb(225_29_72/0.8)]"
              : "bg-[linear-gradient(135deg,#dc1474,#9b3df0)] shadow-[0_12px_30px_-8px_rgb(220_20_116/0.75)]",
          )}
        >
          {rec ? <Square className="size-7 fill-current" /> : <Mic className="size-8" />}
        </button>
      </div>

      <div ref={bars} aria-hidden className={cn("mt-4 flex h-8 items-center gap-[3px]", !rec && "opacity-30")}>
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className="h-full w-[4px] origin-center rounded-full bg-[linear-gradient(180deg,#ff5c9e,#9b3df0)] transition-transform duration-75"
            style={{ transform: "scaleY(0.15)" }}
          />
        ))}
      </div>

      {phase === "denied" ? (
        <p className="mt-3 text-[13px] leading-snug text-[#be123c]" role="alert">
          Mic ki permission nahi mili. Browser settings mein microphone allow karo, phir dobara tap karo.
        </p>
      ) : (
        <p className="mt-3 text-sm font-semibold tabular-nums" aria-live="polite">
          {rec ? (
            <span className="text-[#be123c]">
              Recording… {clock(elapsed)} / {clock(MAX_VOICE)}
            </span>
          ) : (
            "Tap karke record karo"
          )}
        </p>
      )}
      <p className="mt-0.5 text-xs text-muted-foreground">{rec ? "Ho gaya? Stop dabao" : `Max ${MAX_VOICE} sec • sirf partner sunega`}</p>
    </div>
  )
}

/** Deterministic waveform from the URL, so both phones draw the same shape for the same note. */
function wave(src: string, n: number) {
  let h = 2166136261
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619)
  return Array.from({ length: n }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    const base = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.55))
    return 0.2 + 0.8 * (((h >>> 0) % 1000) / 1000) * base
  })
}

/** Play/pause + tap-to-seek waveform. `seconds` covers WebM notes whose header has no duration. */
export function VoicePlayer({ src, seconds, compact }: { src: string; seconds?: number; compact?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null)
  const played = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [length, setLength] = useState(seconds ?? 0)
  const [at, setAt] = useState(0)
  const heights = wave(src, compact ? 18 : 28)

  useEffect(() => {
    const a = audio.current!
    let raf = 0
    const paint = () => {
      const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : length || 1
      played.current?.style.setProperty("clip-path", `inset(0 ${100 - Math.min(100, (a.currentTime / d) * 100)}% 0 0)`)
      setAt(a.currentTime)
      if (!a.paused) raf = requestAnimationFrame(paint)
    }
    const onPlay = () => (setPlaying(true), (raf = requestAnimationFrame(paint)))
    const onPause = () => (setPlaying(false), cancelAnimationFrame(raf), paint())
    const onMeta = () => {
      if (Number.isFinite(a.duration)) setLength(a.duration)
    }
    a.addEventListener("play", onPlay)
    a.addEventListener("pause", onPause)
    a.addEventListener("ended", onPause)
    a.addEventListener("loadedmetadata", onMeta)
    a.addEventListener("durationchange", onMeta)
    return () => {
      cancelAnimationFrame(raf)
      a.removeEventListener("play", onPlay)
      a.removeEventListener("pause", onPause)
      a.removeEventListener("ended", onPause)
      a.removeEventListener("loadedmetadata", onMeta)
      a.removeEventListener("durationchange", onMeta)
    }
  }, [length])

  const toggle = () => {
    const a = audio.current!
    if (a.paused) void a.play().catch(() => {})
    else a.pause()
  }

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = audio.current!
    const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : length
    if (!d) return
    const box = e.currentTarget.getBoundingClientRect()
    a.currentTime = Math.max(0, Math.min(d, ((e.clientX - box.left) / box.width) * d))
    if (a.paused) void a.play().catch(() => {})
  }

  const bars = (cls: string) =>
    heights.map((v, i) => <span key={i} className={cn("w-[3px] shrink-0 rounded-full", cls)} style={{ height: `${v * 100}%` }} />)

  return (
    <div className={cn("flex w-full items-center", compact ? "gap-2" : "gap-3")}>
      <audio ref={audio} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Voice note suno"}
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#dc1474,#9b3df0)] text-white shadow-[0_8px_18px_-8px_rgb(220_20_116/0.8)] transition-transform active:scale-90",
          compact ? "size-9" : "size-12",
        )}
      >
        {playing ? <Pause className={cn("fill-current", compact ? "size-4" : "size-5")} /> : <Play className={cn("ml-0.5 fill-current", compact ? "size-4" : "size-5")} />}
      </button>
      <div
        role="slider"
        aria-label="Voice note position"
        aria-valuemin={0}
        aria-valuemax={Math.round(length)}
        aria-valuenow={Math.round(at)}
        tabIndex={-1}
        onPointerDown={seek}
        className={cn("relative flex min-w-0 flex-1 cursor-pointer items-center justify-between", compact ? "h-7" : "h-9")}
      >
        <div className="absolute inset-0 flex items-center justify-between">{bars("bg-[#3a1f4d]/18")}</div>
        <div ref={played} className="absolute inset-0 flex items-center justify-between" style={{ clipPath: "inset(0 100% 0 0)" }}>
          {bars("bg-[#d61f74]")}
        </div>
      </div>
      <span className={cn("shrink-0 text-right font-semibold text-muted-foreground tabular-nums", compact ? "w-8 text-[11px]" : "w-10 text-xs")}>
        {clock(playing || at > 0 ? at : length)}
      </span>
    </div>
  )
}
