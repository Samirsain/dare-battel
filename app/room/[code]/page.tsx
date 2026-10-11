import { Suspense } from "react"
import { LoadingScreen } from "@/components/game/kit"
import { RoomView } from "@/components/game/room"

export default function RoomPage({ params }: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RoomView params={params} />
    </Suspense>
  )
}
