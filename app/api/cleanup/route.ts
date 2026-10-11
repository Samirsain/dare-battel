import { admin, BUCKET } from "@/lib/server"
import { ROOM_TTL } from "@/lib/game"

// Vercel Cron (vercel.json) — deletes rooms idle > 2h and their proofs.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }
  const db = admin()
  const cutoff = new Date(Date.now() - ROOM_TTL).toISOString()
  const { data: rooms } = await db.from("rooms").delete().lt("updated_at", cutoff).select("code")
  await db.from("push_subs").delete().lt("updated_at", new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString())
  let files = 0
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  const cloudAuth = apiKey && apiSecret ? `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}` : null

  for (const { code } of rooms ?? []) {
    // Clean Supabase storage if used
    const { data } = await db.storage.from(BUCKET).list(code)
    if (data?.length) {
      await db.storage.from(BUCKET).remove(data.map((f) => `${code}/${f.name}`))
      files += data.length
    }

    // Clean Cloudinary folder if configured
    if (cloudName && cloudAuth) {
      for (const resType of ["image", "video"]) {
        await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/${resType}/upload?prefix=dare-battles/${code}/`, {
          method: "DELETE",
          headers: { Authorization: cloudAuth },
        }).catch(() => {})
      }
      await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/folders/dare-battles/${code}`, {
        method: "DELETE",
        headers: { Authorization: cloudAuth },
      }).catch(() => {})
    }
  }
  return Response.json({ rooms: rooms?.length ?? 0, files })
}
