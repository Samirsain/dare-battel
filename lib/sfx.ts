"use client"

import { useSyncExternalStore } from "react"
import { load, save } from "./client"

// Synthesized cues: no audio files to download or cache, and they play offline.
// [frequency Hz, start s, length s, glide-to Hz?]
type Note = [number, number, number, number?]
type Cue = { wave: OscillatorType; vol: number; notes: Note[]; buzz: number | number[] }

const CUES = {
  pop: { wave: "sine", vol: 0.18, notes: [[620, 0, 0.09, 940]], buzz: 12 },
  reveal: { wave: "triangle", vol: 0.14, notes: [[330, 0, 0.22, 880], [990, 0.16, 0.12]], buzz: 18 },
  join: { wave: "sine", vol: 0.2, notes: [[784, 0, 0.14], [1047, 0.12, 0.26]], buzz: [20, 60, 25] },
  success: { wave: "triangle", vol: 0.16, notes: [[523, 0, 0.1], [659, 0.08, 0.1], [784, 0.16, 0.1], [1047, 0.24, 0.3]], buzz: [18, 40, 30] },
  skip: { wave: "square", vol: 0.05, notes: [[420, 0, 0.28, 160]], buzz: 40 },
  timeout: { wave: "sawtooth", vol: 0.05, notes: [[180, 0, 0.18], [140, 0.2, 0.3]], buzz: [70, 40, 70] },
  tick: { wave: "sine", vol: 0.1, notes: [[1320, 0, 0.04]], buzz: 8 },
  rec: { wave: "sine", vol: 0.14, notes: [[880, 0, 0.07]], buzz: 22 },
  win: {
    wave: "triangle",
    vol: 0.16,
    notes: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.38, 0.5], [784, 0.38, 0.5]],
    buzz: [30, 50, 30, 50, 80],
  },
} satisfies Record<string, Cue>

export type CueName = keyof typeof CUES

let ctx: AudioContext | undefined
const listeners = new Set<() => void>()
export const isMuted = () => load("db:mute") === "1"
export function setMuted(m: boolean) {
  save("db:mute", m ? "1" : "")
  listeners.forEach((l) => l())
}
export const useMuted = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    isMuted,
    () => false,
  )

/** Browsers only start audio after a gesture; call from the first tap anywhere. */
export function unlockAudio() {
  ctx ??= new AudioContext()
  if (ctx.state === "suspended") void ctx.resume()
}

export const haptic = (pattern: number | number[]) => void navigator.vibrate?.(pattern)

export function cue(name: CueName) {
  const c: Cue = CUES[name]
  haptic(c.buzz)
  if (isMuted() || !ctx || ctx.state !== "running") return
  const t0 = ctx.currentTime + 0.01
  for (const [f, at, len, to] of c.notes) {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = c.wave
    osc.frequency.setValueAtTime(f, t0 + at)
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + at + len)
    amp.gain.setValueAtTime(0.0001, t0 + at)
    amp.gain.exponentialRampToValueAtTime(c.vol, t0 + at + 0.012)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len)
    osc.connect(amp).connect(ctx.destination)
    osc.start(t0 + at)
    osc.stop(t0 + at + len + 0.02)
  }
}
