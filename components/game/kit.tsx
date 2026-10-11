"use client"

import { useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { Check, ChevronLeft, Flame, Heart, Loader2, Smile, Volume2, VolumeX, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Float, TypingDots, useEnter } from "./fx"
import { rememberAvatar, rememberName, savedAvatar, savedName } from "@/lib/client"
import { setMuted, useMuted } from "@/lib/sfx"
import type { Avatar as AvatarKind, Level } from "@/lib/game"
import { cn } from "@/lib/utils"

type Glow = [x: number, y: number, size: number, color: "pink" | "purple"]

/**
 * 390-wide phone column with the Figma glow blobs; animates [data-enter] children in. Pads for notches and home bars.
 * With `footer`, the screen is app-shaped: content scrolls in the middle on short phones while the actions stay pinned
 * in the thumb zone. `compact` is a single dense screen (gameplay) that scrolls as a whole only if it must.
 */
export function Screen({
  glows,
  children,
  footer,
  className,
  enterKey,
  compact,
}: {
  glows: Glow[]
  children: ReactNode
  footer?: ReactNode
  className?: string
  enterKey?: unknown
  compact?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  useEnter(ref, enterKey)
  // Fixed, clipped layer: the blobs sit past the column edges by design and must never widen the page.
  const blobs = (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="relative mx-auto h-full max-w-[390px]">
        {glows.map(([x, y, s, c], i) => (
          <div
            key={i}
            className="absolute rounded-full blur-[90px]"
            style={{ left: x, top: y, width: s, height: s, background: c === "pink" ? "rgb(255 160 205 / 0.5)" : "rgb(205 180 255 / 0.5)" }}
          />
        ))}
      </div>
    </div>
  )

  if (footer)
    return (
      <main ref={ref} className="relative isolate mx-auto flex h-dvh w-full max-w-[390px] flex-col overflow-clip">
        {blobs}
        <div
          className={cn(
            // Children never shrink (a card would clip its content); short phones scroll this area instead.
            "no-scrollbar flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-6 *:shrink-0 pt-[max(1.5rem,calc(env(safe-area-inset-top)+0.75rem))] pb-2 [mask-image:linear-gradient(to_bottom,black_calc(100%-18px),transparent)]",
            className,
          )}
        >
          {children}
        </div>
        <div className="shrink-0 px-6 pt-2 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.5rem))]">{footer}</div>
      </main>
    )

  return (
    <main
      ref={ref}
      className={cn(
        "relative isolate mx-auto flex w-full max-w-[390px] flex-col",
        compact
          ? "h-dvh min-h-dvh justify-between overflow-x-hidden overflow-y-auto px-4 *:shrink-0 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          : "min-h-dvh overflow-clip px-6 pt-[max(3rem,calc(env(safe-area-inset-top)+1.25rem))] pb-[max(2.25rem,calc(env(safe-area-inset-bottom)+1rem))]",
        className,
      )}
    >
      {blobs}
      {children}
    </main>
  )
}

export function Header({ title, back = "/", right }: { title: string; back?: string | (() => void); right?: ReactNode }) {
  const icon = <ChevronLeft className="size-5" />
  return (
    <header data-enter className="flex h-11 items-center gap-3">
      {typeof back === "string" ? (
        <Button asChild variant="glass" size="icon" className="size-11 rounded-2xl">
          <Link href={back} aria-label="Back">{icon}</Link>
        </Button>
      ) : (
        <Button variant="glass" size="icon" className="size-11 rounded-2xl" onClick={back} aria-label="Back">
          {icon}
        </Button>
      )}
      <h1 className="text-lg font-bold">{title}</h1>
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  )
}

/** Sound on/off; haptics stay on (the phone's own vibration setting governs those). */
export function SoundToggle({ className }: { className?: string }) {
  const muted = useMuted()
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={!muted}
      aria-label={muted ? "Sound on karo" : "Sound off karo"}
      className={cn(
        "glass grid size-10 shrink-0 place-items-center rounded-full text-foreground/80 transition-transform duration-150 active:scale-90",
        className,
      )}
    >
      {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
    </button>
  )
}

export const LEVEL_ICON: Record<Level, LucideIcon> = { friendly: Smile, couple: Heart, extreme: Flame }

export const AVATARS: Record<AvatarKind, { src: string; label: string }> = {
  boy: { src: "/avatars/he.webp", label: "He" },
  girl: { src: "/avatars/she.webp", label: "She" },
}

const TENOR = {
  fight: "https://media.tenor.com/DOi0JRWSaA0AAAAj/bubududu-panda.gif",
  fireworks: "https://media.tenor.com/XesYJjyNYgAAAAAj/fireworks-putukan.gif",
} as const

export type GifName =
  | "hero" | "loading" | "blowkiss" | "peek" | "waiting" | "joined" | "thumbs" | "yay"
  | "cry" | "shy" | "celebrate" | "dance" | "kiss" | "eyes" | "fight" | "fireworks"

export function Gif({ name, size, className }: { name: GifName; size: number; className?: string }) {
  const src = name === "fight" || name === "fireworks" ? TENOR[name] : `/gifs/${name}.webp`
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized // keep the animation; next/image would flatten it
      draggable={false}
      className={cn("object-contain drop-shadow-[0_10px_18px_rgb(160_80_140/0.22)]", className)}
      style={{ width: size, height: size }}
    />
  )
}

export type DecoType = "flower" | "daisy" | "blossom" | "heart" | "sparkle"

const PETALS = [0, 72, 144, 216, 288]

/** Hand-drawn-ish SVG flowers/hearts/sparkles (no emoji). */
export function DecoArt({ type, size, color }: { type: DecoType; size: number; color?: string }) {
  const svg = { width: size, height: size, viewBox: "0 0 40 40", "aria-hidden": true } as const
  switch (type) {
    case "flower":
      return (
        <svg {...svg}>
          {PETALS.map((r) => <ellipse key={r} cx="20" cy="10.5" rx="7" ry="9.5" fill={color ?? "#ff8cc4"} transform={`rotate(${r} 20 20)`} />)}
          <circle cx="20" cy="20" r="6" fill="#fcd34d" />
          <circle cx="18" cy="18" r="1.6" fill="#fff" opacity=".8" />
        </svg>
      )
    case "daisy":
      return (
        <svg {...svg}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => <ellipse key={r} cx="20" cy="9" rx="4.2" ry="8.5" fill="#fff" stroke="#f5c2dc" strokeWidth="1" transform={`rotate(${r} 20 20)`} />)}
          <circle cx="20" cy="20" r="5.5" fill="#fbbf24" />
        </svg>
      )
    case "blossom":
      return (
        <svg {...svg}>
          {PETALS.map((r) => <circle key={r} cx="20" cy="11" r="8" fill={color ?? "#c4b5fd"} transform={`rotate(${r} 20 20)`} />)}
          <circle cx="20" cy="20" r="5" fill="#fff7ed" />
          <circle cx="20" cy="20" r="2.5" fill="#f472b6" />
        </svg>
      )
    case "heart":
      return (
        <svg {...svg}>
          <path d="M20 35s-13-7.6-16-15.4C1.9 13.9 5.4 7.5 11.6 7.5c3.6 0 6.1 2 7.4 4.2h2c1.3-2.2 3.8-4.2 7.4-4.2 6.2 0 9.7 6.4 7.6 12.1C33 27.4 20 35 20 35z" fill={color ?? "#ff5fa8"} />
          <ellipse cx="11.5" cy="14" rx="2.6" ry="1.6" fill="#fff" opacity=".7" transform="rotate(-35 11.5 14)" />
        </svg>
      )
    case "sparkle":
      return (
        <svg {...svg}>
          <path d="M20 2c1.6 10 6.4 14.6 18 18-11.6 3.4-16.4 8-18 18-1.6-10-6.4-14.6-18-18C13.6 16.6 18.4 12 20 2z" fill={color ?? "#fcd34d"} />
        </svg>
      )
  }
}

/** Figma "Sticker · *" slots, redrawn as floating flowers at frame coordinates. */
export function Deco({ type, x, y, size, color, delay }: { type: DecoType; x: number; y: number; size: number; color?: string; delay?: number }) {
  return (
    <Float className="absolute -z-[1] drop-shadow-[0_6px_10px_rgb(200_90_150/0.25)]" style={{ left: x, top: y }} delay={delay}>
      <DecoArt type={type} size={size} color={color} />
    </Float>
  )
}

/** He = violet story-ring, She = pink. Same everywhere a player appears. */
export function Face({ name, avatar = "boy", size = 28, className }: { name: string; avatar?: AvatarKind; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  const big = size >= 40
  return (
    <Avatar
      className={cn(
        "relative shrink-0 overflow-visible bg-white ring-offset-white after:hidden",
        big ? "ring-[3px] ring-offset-2" : "ring-2 ring-offset-1",
        avatar === "girl" ? "ring-[#ff7ab8]" : "ring-[#9f7cf5]",
        "shadow-[0_6px_14px_-6px_rgb(120_50_140/0.45)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {!broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny local sticker, next/image adds nothing here
        <img
          src={AVATARS[avatar].src}
          alt={name}
          draggable={false}
          onError={() => setBroken(true)}
          className="size-full scale-[1.12] rounded-full object-cover"
        />
      ) : (
        <AvatarFallback
          className="bg-[linear-gradient(135deg,#dc1474,#9b3df0)] font-bold text-white"
          style={{ fontSize: size * 0.45 }}
        >
          {name.charAt(0).toUpperCase() || "?"}
        </AvatarFallback>
      )}
    </Avatar>
  )
}

export function LoadingScreen({ message = "Load ho raha hai…" }: { message?: string }) {
  return (
    <Screen glows={[[-90, 90, 280, "purple"], [170, 560, 300, "pink"]]} className="items-center justify-center gap-6 text-center">
      <Float amp={10} className="pointer-events-none">
        <Gif name="loading" size={180} />
      </Float>
      <div data-enter>
        <p className="text-gradient text-3xl font-extrabold">Dare Battles</p>
        <p className="mt-1 text-sm text-muted-foreground" role="status" aria-live="polite">
          {message}
        </p>
      </div>
      <TypingDots />
    </Screen>
  )
}

/** Asks for a display name and He/She avatar before create/join. */
export function NameDialog({
  open,
  onOpenChange,
  onSubmit,
  busy,
  cta,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSubmit: (name: string, avatar: AvatarKind) => void
  busy?: boolean
  cta: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet className="glass gap-5 bg-white/95 px-6 pt-6">
        <DialogHeader className="items-center text-center">
          <Gif name="eyes" size={72} />
          <DialogTitle className="text-xl font-bold">Tumhara profile</DialogTitle>
          <DialogDescription>He ya She chuno, phir apna naam likho</DialogDescription>
        </DialogHeader>
        {open && <NameForm onSubmit={onSubmit} busy={busy} cta={cta} />}
      </DialogContent>
    </Dialog>
  )
}

function NameForm({ onSubmit, busy, cta }: { onSubmit: (name: string, avatar: AvatarKind) => void; busy?: boolean; cta: string }) {
  const [name, setName] = useState(savedName)
  const [avatar, setAvatar] = useState<AvatarKind>(savedAvatar)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const n = name.trim()
        if (!n) return
        rememberName(n)
        rememberAvatar(avatar)
        onSubmit(n, avatar)
      }}
    >
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <Input
        autoFocus={!name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        placeholder="Tumhara naam, e.g. Aarav / Meera"
        aria-label="Your name"
        autoComplete="given-name"
        enterKeyHint="go"
        className="h-13 rounded-2xl bg-white px-4 text-base"
      />
      <Button type="submit" variant="glow" size="cta" disabled={!name.trim() || busy}>
        {busy && <Loader2 className="animate-spin" />}
        {cta}
      </Button>
    </form>
  )
}

export function AvatarPicker({ value, onChange }: { value: AvatarKind; onChange: (a: AvatarKind) => void }) {
  return (
    <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-2 gap-3">
      {(["boy", "girl"] as const).map((a) => {
        const on = value === a
        const she = a === "girl"
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(a)}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-3xl border-2 px-3 pt-4 pb-3 transition-[border-color,background-color,transform,box-shadow] duration-200 ease-out active:scale-[0.96]",
              on
                ? she
                  ? "border-[#ff7ab8] bg-[#fff0f7] shadow-[0_10px_24px_-14px_rgb(214_31_116/0.7)]"
                  : "border-[#9f7cf5] bg-[#f5f0ff] shadow-[0_10px_24px_-14px_rgb(124_58_237/0.7)]"
                : "border-transparent bg-[#f6eefc]/70",
            )}
          >
            <Face name={AVATARS[a].label} avatar={a} size={64} />
            <span className="text-base font-bold">{AVATARS[a].label}</span>
            {on && (
              <span
                className={cn(
                  "absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full text-white animate-in zoom-in-50 duration-200",
                  she ? "bg-[#d61f74]" : "bg-[#7c3aed]",
                )}
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
