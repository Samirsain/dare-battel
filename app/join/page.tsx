"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Swords } from "lucide-react"
import { toast } from "sonner"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Gif, Header, LoadingScreen, NameDialog, Screen } from "@/components/game/kit"
import { Float } from "@/components/game/fx"
import { api } from "@/lib/client"

// Figma 03 · Join Room
export default function JoinPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Join />
    </Suspense>
  )
}

function Join() {
  const router = useRouter()
  const params = useSearchParams()
  const [code, setCode] = useState(() => (params.get("code") ?? "").replace(/\D/g, "").slice(0, 6))
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const ready = code.length === 6

  async function join(name: string, avatar: "boy" | "girl") {
    setBusy(true)
    try {
      await api(`/api/rooms/${code}`, { action: { type: "join", name, avatar } })
      router.push(`/room/${code}`)
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
      setAsking(false)
    }
  }

  return (
    <Screen
      glows={[[180, 60, 300, "purple"], [-150, 520, 300, "pink"]]}
      footer={
        <>
          <div data-enter>
            <Button variant="glow" size="cta" disabled={!ready} onClick={() => setAsking(true)}>
              <Swords /> Join Battle
            </Button>
          </div>
          <p data-enter className="mt-2.5 text-center text-[13px] text-muted-foreground" aria-live="polite">
            {ready ? "Ready! Join karo" : "6 digit ka code daalo"}
          </p>
        </>
      }
    >
      <Header title="Join Room" />

      <h2 data-enter className="mt-8 text-center text-[28px] leading-[34px] font-bold">
        Enter room code
      </h2>
      <p data-enter className="mt-2 text-center text-sm text-muted-foreground">
        Apne partner se 6-digit code maango
      </p>

      <div data-enter className="mt-8">
        <InputOTP
          maxLength={6}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          autoFocus
          value={code}
          onChange={setCode}
          onComplete={() => setAsking(true)}
          placeholder="000000"
          aria-label="Room code"
          containerClassName="justify-center"
        >
          <InputOTPGroup className="glass h-[104px] w-full justify-center rounded-3xl px-3 has-[[data-active=true]]:border-pink/60 has-[[data-active=true]]:shadow-[0_0_0_4px_rgb(255_61_154/0.15)]">
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className="h-16 w-11 border-0 bg-transparent! text-[44px] font-extrabold ring-0! first:border-0 last:border-0"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <p data-enter className="mx-auto mt-3.5 max-w-[300px] text-center text-[13px] leading-[17px] text-muted-foreground">
        Code WhatsApp pe aaya hai? Long-press karke paste karo
      </p>

      <div className="flex min-h-28 flex-1 items-end justify-center">
        <Float amp={5}>
          <Gif name="peek" size={140} />
        </Float>
      </div>

      <NameDialog open={asking} onOpenChange={setAsking} onSubmit={join} busy={busy} cta="Battle join karo" />
    </Screen>
  )
}
