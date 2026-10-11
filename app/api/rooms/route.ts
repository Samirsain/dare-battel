import { errorResponse, newRoom, playerId } from "@/lib/server"

export async function POST(req: Request) {
  try {
    const { secret, name, avatar } = await req.json()
    const room = await newRoom(secret, name, avatar)
    return Response.json({ room, me: playerId(secret), now: Date.now() })
  } catch (e) {
    return errorResponse(e)
  }
}
