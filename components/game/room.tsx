"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Gif, LoadingScreen, Screen } from "./kit"
import { Lobby, ShareCode } from "./lobby"
import { PickPhase } from "./pick"
import { DarePhase } from "./dare"
import { Final, RoundResult } from "./result"
import { forgetRoom, rememberRoom, useRoom } from "@/lib/client"
import { cue, type CueName } from "@/lib/sfx"
import { useT } from "@/lib/i18n"
import type { Action, Room } from "@/lib/game"

export function RoomView({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const t = useT()
  const { room, me, error, act } = useRoom(code)
  const [continued, setContinued] = useState(false)
  const you = room?.players.find((p) => p.id === me)
  const partner = room?.players.find((p) => p.id !== me)
  const outsider = !!room && !you
  useGameCues(room, me)

  // Opened someone's room link directly → go through Join (asks for a name).
  useEffect(() => {
    if (outsider) router.replace(`/join?code=${code}`)
  }, [outsider, code, router])

  useEffect(() => {
    if (you) rememberRoom(code)
    if (error) forgetRoom(code)
  }, [you, error, code])

  const run = useCallback((a: Action) => act(a).catch((e: Error) => void toast.error(e.message)), [act])

  if (error) return <Gone message={error} />
  if (!room || !you) return <LoadingScreen message={t("Room se connect ho rahe hain…", "Connecting to the room…")} />

  switch (room.phase) {
    case "lobby":
      return !partner && room.hostId === you.id && !continued ? (
        <ShareCode room={room} onContinue={() => setContinued(true)} />
      ) : (
        <Lobby room={room} you={you} partner={partner} run={run} />
      )
    case "pick":
      return <PickPhase room={room} you={you} partner={partner!} act={act} />
    case "dare":
      return <DarePhase room={room} you={you} partner={partner!} act={act} />
    case "result":
      return <RoundResult room={room} you={you} partner={partner!} run={run} />
    case "final":
      return <Final room={room} you={you} partner={partner!} run={run} />
  }
}

/** One sound + buzz per meaningful change between two room versions. Your own taps cue themselves. */
function useGameCues(room: Room | undefined, me: string | null | undefined) {
  const prev = useRef<Room | undefined>(undefined)
  useEffect(() => {
    const p = prev.current
    prev.current = room
    if (!p || !room || !me || p.v === room.v) return
    const pick = (): CueName | null => {
      const you = room.players.find((x) => x.id === me)
      const them = room.players.find((x) => x.id !== me)
      const was = (id?: string) => p.players.find((x) => x.id === id)?.turn?.status
      if (p.players.length < room.players.length) return "join"
      if (room.phase === "pick" && (p.phase !== "pick" || p.round !== room.round)) return "reveal"
      if (room.phase === "dare" && p.phase !== "dare") return "reveal"
      if (room.phase === "pick" && them && !p.picks?.[them.id] && room.picks?.[them.id]) return "pop"
      if (room.phase === "final" && p.phase !== "final") return "win"
      if (was(me) === "pending" && you?.turn?.status !== "pending") return you?.turn?.status === "timeout" ? "timeout" : null
      if (room.phase === "result" && p.phase !== "result") return you?.turn?.status === "done" ? "win" : "pop"
      if (was(them?.id) === "pending" && them?.turn?.status === "done") return "pop"
      if (was(them?.id) === "pending" && them?.turn?.status === "skipped") return "skip"
      const head = room.feed[0]
      if (head?.kind === "banter" && head.by !== me && (head.at !== p.feed[0]?.at || head.text !== p.feed[0]?.text)) return "pop"
      return null
    }
    const c = pick()
    if (c) cue(c)
  }, [room, me])
}

function Gone({ message }: { message: string }) {
  const t = useT()
  return (
    <Screen glows={[[-90, 90, 280, "purple"], [170, 560, 300, "pink"]]} className="items-center justify-center gap-5 text-center">
      <div data-enter>
        <Gif name="cry" size={160} />
      </div>
      <h1 data-enter className="text-2xl font-bold text-balance">
        {message}
      </h1>
      <div data-enter className="w-full">
        <Button asChild variant="glow" size="cta">
          <Link href="/">{t("Naya room banao", "Create a new room")}</Link>
        </Button>
      </div>
    </Screen>
  )
}
