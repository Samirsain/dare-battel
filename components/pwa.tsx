"use client"

import { useEffect, useSyncExternalStore } from "react"
import { WifiOff } from "lucide-react"
import { haptic, unlockAudio } from "@/lib/sfx"
import { cn } from "@/lib/utils"

const onNet = (l: () => void) => {
  addEventListener("online", l)
  addEventListener("offline", l)
  return () => {
    removeEventListener("online", l)
    removeEventListener("offline", l)
  }
}

/** App-wide PWA plumbing: service worker, tap haptics + audio unlock, offline banner. */
export function PwaKit() {
  const online = useSyncExternalStore(onNet, () => navigator.onLine, () => true)

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {})
    const tap = (e: PointerEvent) => {
      unlockAudio()
      if ((e.target as Element).closest?.("button:not(:disabled), a[href], [role=button], [role=radio]")) haptic(8)
    }
    addEventListener("pointerdown", tap, { passive: true })
    return () => removeEventListener("pointerdown", tap)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "glass pointer-events-none fixed inset-x-0 top-[max(10px,env(safe-area-inset-top))] z-[60] mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-foreground transition-[translate,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        online ? "-translate-y-24 opacity-0" : "translate-y-0 opacity-100",
      )}
    >
      {!online && (
        <>
          <WifiOff className="size-4 text-[#d61f74]" /> Offline — connection aate hi sync hoga
        </>
      )}
    </div>
  )
}
