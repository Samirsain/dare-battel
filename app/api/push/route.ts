import { admin, errorResponse, playerId, pushReady } from "@/lib/server"
import { GameError } from "@/lib/game"

// Saves (or with sub: null, removes) this device's push subscription, keyed by the player's hashed secret.
export async function POST(req: Request) {
  try {
    if (!pushReady) throw new GameError("Notifications abhi setup nahi hain")
    const { secret, sub } = await req.json()
    const player = playerId(secret)
    const db = admin()
    if (!sub) {
      await db.from("push_subs").delete().eq("player", player)
      return Response.json({ ok: true })
    }
    if (typeof sub?.endpoint !== "string" || !sub.endpoint.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
      throw new GameError("Notification subscription galat hai")
    }
    const { error } = await db
      .from("push_subs")
      .upsert({ player, sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, updated_at: new Date().toISOString() })
    if (error) throw new Error("Notifications save nahi hui, dobara try karo")
    return Response.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
