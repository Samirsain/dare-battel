"use client"

import { useSyncExternalStore } from "react"
import { load, save } from "./client"
import type { Lang } from "./game"

// Hinglish is the default; English is opt-in from the home screen. Strings live next to their use:
// t("Room banao", "Create room") — no key files to keep in sync.
const listeners = new Set<() => void>()
export const getLang = (): Lang => (load("db:lang") === "en" ? "en" : "hi")
export function setLang(l: Lang) {
  save("db:lang", l)
  document.documentElement.lang = l === "en" ? "en" : "hi-Latn"
  listeners.forEach((f) => f())
}
export const useLang = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    getLang,
    () => "hi" as Lang,
  )

export type T = (hinglish: string, english: string) => string
export function useT(): T {
  const en = useLang() === "en"
  return (hi, eng) => (en ? eng : hi)
}
