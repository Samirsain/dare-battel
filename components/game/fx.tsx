"use client"

import { useRef, type CSSProperties, type ReactNode, type RefObject } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP)

export const calm = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches

/** Entrances start hidden, so never let a stalled clock (backgrounded tab, slow phone) keep content invisible. */
export function safety(tw: gsap.core.Animation, ms = 2000) {
  const t = setTimeout(() => tw.progress(1), ms)
  return () => clearTimeout(t)
}

/** Staggered pop-in of every [data-enter] inside scope. Re-runs when `key` changes (new phase/round). */
export function useEnter(scope: RefObject<HTMLElement | null>, key?: unknown) {
  useGSAP(
    () => {
      const els = gsap.utils.toArray<HTMLElement>("[data-enter]")
      if (calm()) return void gsap.set(els, { autoAlpha: 1 })
      const tw = gsap.fromTo(
        els,
        { autoAlpha: 0, y: 22, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out", stagger: { each: 0.05, amount: 0.4 }, clearProps: "transform" },
      )
      return safety(tw)
    },
    { scope, dependencies: [key], revertOnUpdate: true },
  )
}

/** Gentle bob + tilt forever; used for stickers and GIF heroes. */
export function Float({ children, className, style, amp = 8, delay = 0 }: { children: ReactNode; className?: string; style?: CSSProperties; amp?: number; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      if (calm()) return
      gsap.to(ref.current, { y: -amp, rotation: gsap.utils.random(-8, 8), duration: gsap.utils.random(1.6, 2.6), ease: "sine.inOut", yoyo: true, repeat: -1, delay })
    },
    { scope: ref },
  )
  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none select-none", className)} style={style}>
      {children}
    </div>
  )
}

/** Soft heartbeat scale loop. */
export function Pulse({ children, className, scale = 1.08 }: { children?: ReactNode; className?: string; scale?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    if (!calm()) gsap.to(ref.current, { scale, duration: 0.7, ease: "sine.inOut", yoyo: true, repeat: -1 })
  }, { scope: ref })
  return <div ref={ref} className={className}>{children}</div>
}

export function TypingDots() {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    if (!calm()) gsap.to(".dot", { y: -6, opacity: 1, duration: 0.4, ease: "sine.inOut", stagger: { each: 0.15, repeat: -1, yoyo: true } })
  }, { scope: ref })
  return (
    <div ref={ref} className="flex h-[22px] items-center justify-center gap-1.5" aria-label="Waiting">
      {[0, 1, 2].map((i) => (
        <span key={i} className="dot size-2.5 rounded-full bg-pink opacity-50" />
      ))}
    </div>
  )
}

/** Tweens a number up to `value` whenever it changes. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  useGSAP(() => {
    const o = { n: from.current }
    from.current = value
    ref.current!.textContent = String(calm() ? value : o.n)
    if (calm()) return
    const tl = gsap
      .timeline()
      .to(o, { n: value, duration: 1.1, ease: "power2.out", onUpdate: () => void (ref.current!.textContent = String(Math.round(o.n))) })
      .fromTo(ref.current, { scale: 1.35 }, { scale: 1, duration: 0.6, ease: "elastic.out(1,0.45)" }, 0)
    return safety(tl) // the score must never stick at a half-counted number
  }, { dependencies: [value] })
  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)}>
      {value}
    </span>
  )
}

/** Countdown ring (Figma: Timer). Turns hot pink and throbs in the last 10s. */
export function TimerRing({ left, total, size = 150 }: { left: number; total: number; size?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const R = 67
  const C = 2 * Math.PI * R
  const urgent = left <= 10
  useGSAP(() => {
    gsap.to(".arc", { strokeDashoffset: C * (1 - left / total), duration: 0.9, ease: "power1.out" })
    if (urgent && left > 0 && !calm()) gsap.fromTo(".num", { scale: 1.2 }, { scale: 1, duration: 0.45, ease: "expo.out" })
  }, { scope: ref, dependencies: [left] })
  return (
    <div ref={ref} className="relative" style={{ width: size, height: size }} role="timer" aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 150 150" className="size-full -rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={urgent ? "#ff5c7a" : "#ff3d9a"} />
            <stop offset="1" stopColor={urgent ? "#e11d74" : "#a855f7"} />
          </linearGradient>
        </defs>
        <circle cx="75" cy="75" r={R} fill="none" stroke="rgb(58 31 77 / 0.07)" strokeWidth="10" />
        <circle className="arc" cx="75" cy="75" r={R} fill="none" stroke="url(#ring)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={0} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("num leading-none font-extrabold tabular-nums", urgent && "text-[#d61f74]")} style={{ fontSize: size * 0.29 }}>
          {left}
        </span>
        <span className="mt-0.5 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">SEC</span>
      </div>
    </div>
  )
}

const CONFETTI = ["#ff3d9a", "#a855f7", "#fbbf24", "#22c55e", "#38bdf8", "#ff8cc4"]

/** One-shot confetti burst from the top-center (Figma: Confetti layers). */
export function Confetti({ count = 36, fire = 0 }: { count?: number; fire?: unknown }) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      if (calm()) return
      gsap.utils.toArray<HTMLElement>(".bit", ref.current).forEach((el) => {
        gsap.fromTo(
          el,
          { x: 0, y: 0, rotation: 0, opacity: 1 },
          {
            x: gsap.utils.random(-190, 190),
            y: gsap.utils.random(260, 720),
            rotation: gsap.utils.random(-540, 540),
            opacity: 0,
            duration: gsap.utils.random(1.6, 2.8),
            ease: "power2.out",
            delay: gsap.utils.random(0, 0.25),
          },
        )
      })
    },
    { scope: ref, dependencies: [fire], revertOnUpdate: true },
  )
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="bit absolute opacity-0"
          style={{
            width: 7 + (i % 4) * 3,
            height: i % 3 === 0 ? 9 : 14,
            borderRadius: i % 3 === 0 ? 999 : 3,
            background: CONFETTI[i % CONFETTI.length],
          }}
        />
      ))}
    </div>
  )
}
