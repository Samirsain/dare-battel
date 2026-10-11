"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Action, ProofInput, Room } from "./game"

let sb: SupabaseClient | undefined
export const supabase = () =>
  (sb ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!))

// localStorage can throw (private mode, blocked storage) — fall back to memory for the tab.
const mem: Record<string, string> = {}
export const load = (k: string) => {
  try {
    return localStorage.getItem(k) ?? mem[k] ?? null
  } catch {
    return mem[k] ?? null
  }
}
export const save = (k: string, v: string) => {
  mem[k] = v
  try {
    localStorage.setItem(k, v)
  } catch {}
}

export const secret = () => {
  let s = load("db:secret")
  if (!s) save("db:secret", (s = crypto.randomUUID() + crypto.randomUUID()))
  return s
}
export const savedName = () => load("db:name") ?? ""
export const rememberName = (n: string) => save("db:name", n)
export const savedAvatar = (): "boy" | "girl" => (load("db:avatar") as "boy" | "girl") || "boy"
export const rememberAvatar = (a: "boy" | "girl") => save("db:avatar", a)
const english = () => load("db:lang") === "en" // same key as lib/i18n; read directly to avoid an import cycle

/** The room this device last played in, so reopening the installed app can resume it. */
export const lastRoom = () => load("db:room")
export const rememberRoom = (code: string) => save("db:room", code)
export const forgetRoom = (code: string) => lastRoom() === code && save("db:room", "")

type RoomRes = { room: Room; me: string | null; now?: number }
export type ClientAction = Action | { type: "complete"; proof: ProofInput }

// Timers compare against server-issued deadlines, so track how far this phone's clock is off.
let skew = 0
export const serverNow = () => Date.now() + skew

/** Re-renders every `ms` with the (skew-corrected) server time. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export async function api<T = RoomRes>(path: string, body?: object): Promise<T> {
  const res = await fetch(
    path,
    body
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: secret(), ...body }) }
      : { headers: { "x-player": secret() }, cache: "no-store" },
  )
  const json = await res.json().catch(() => ({}))
  if (typeof json.now === "number") skew = json.now - Date.now()
  if (!res.ok) throw new Error((english() && json.en) || json.error || (english() ? "Network issue, please try again" : "Network issue, dobara try karo"))
  return json
}

/** Live room: initial fetch + Supabase broadcast, refetch on resubscribe/focus. Newer `v` always wins. */
export function useRoom(code: string) {
  const [state, setState] = useState<RoomRes | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accept = useCallback(
    (room: Room, me?: string | null) =>
      setState((s) => (!s || room.v >= s.room.v ? { room, me: me ?? s?.me ?? null } : s)),
    [],
  )
  const refresh = useCallback(
    () => api(`/api/rooms/${code}`).then((r) => accept(r.room, r.me), (e: Error) => setError(e.message)),
    [code, accept],
  )

  useEffect(() => {
    void refresh() // show the room now; the realtime socket can take 1–3s on mobile data
    const ch = supabase()
      .channel(`room:${code}`)
      // The channel is public, so private bits (proof links, custom dares) arrive blanked; fetch them with our secret.
      .on("broadcast", { event: "state" }, ({ payload }) => (payload.redacted ? refresh() : accept(payload as Room)))
      .subscribe((status) => status === "SUBSCRIBED" && refresh())
    const onFocus = () => document.visibilityState === "visible" && refresh()
    document.addEventListener("visibilitychange", onFocus)
    addEventListener("online", refresh)
    return () => {
      supabase().removeChannel(ch)
      document.removeEventListener("visibilitychange", onFocus)
      removeEventListener("online", refresh)
    }
  }, [code, accept, refresh])

  const act = useCallback(
    async (action: ClientAction) => {
      const r = await api(`/api/rooms/${code}`, { action })
      accept(r.room, r.me)
      return r.room
    },
    [code, accept],
  )

  return { room: state?.room, me: state?.me, error, act }
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const standalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true

/** "on" | "off" | "blocked" | "install" (iPhone needs the home-screen app) | "unsupported" */
export async function pushState() {
  if (!VAPID || !("serviceWorker" in navigator)) return "unsupported"
  if (!("PushManager" in window)) return /iPhone|iPad/.test(navigator.userAgent) && !standalone() ? "install" : "unsupported"
  if (Notification.permission === "denied") return "blocked"
  const reg = await navigator.serviceWorker.ready
  return (await reg.pushManager.getSubscription()) ? "on" : "off"
}

export async function enablePush() {
  if ((await Notification.requestPermission()) !== "granted") throw new Error(english() ? "Notifications weren't allowed" : "Notifications allow nahi hui")
  const reg = await navigator.serviceWorker.ready
  const key = Uint8Array.from(atob(VAPID!.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }))
  await api("/api/push", { sub: sub.toJSON() })
}

export async function disablePush() {
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
  await sub?.unsubscribe()
  await api("/api/push", { sub: null })
}

export const inviteText = (code: string) =>
  english()
    ? `Play Dare Battles with me? Room code: *${code}*\nJoin: ${location.origin}/join?code=${code}`
    : `Dare Battle khelega? Mera room code: *${code}*\nJoin karo: ${location.origin}/join?code=${code}`

export const openWhatsApp = (text: string) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")

/** Share the generated result card as an image where the OS share sheet supports files, else WhatsApp text. */
export async function shareResult(q: { a: string; as: number; b: string; bs: number; r: number }) {
  const champ = q.as >= q.bs ? q.a : q.b
  const text = english()
    ? `${champ} is the Dare Champion (${q.as}–${q.bs})\nPlay too: ${location.origin}`
    : `${champ} bana Dare Champion (${q.as}–${q.bs})\nTum bhi khelo: ${location.origin}`
  try {
    const params = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)]))
    const blob = await (await fetch(`/api/card?${params}`)).blob()
    const file = new File([blob], "dare-battles.png", { type: "image/png" })
    if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text })
  } catch (e) {
    if ((e as Error).name === "AbortError") return
  }
  openWhatsApp(text)
}
