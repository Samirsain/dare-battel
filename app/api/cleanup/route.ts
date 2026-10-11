import { admin, purge } from "@/lib/server"
import { ROOM_TTL } from "@/lib/game"

// Vercel Cron (vercel.json) — deletes rooms idle > 2h and their proofs, and month-old push subscriptions.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }
  const db = admin()
  const cutoff = new Date(Date.now() - ROOM_TTL).toISOString()
  const { data: rooms } = await db.from("rooms").select("code").lt("updated_at", cutoff)
  let files = 0
  for (const { code } of rooms ?? []) files += await purge(code)
  await db.from("push_subs").delete().lt("updated_at", new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString())
  return Response.json({ rooms: rooms?.length ?? 0, files })
}
