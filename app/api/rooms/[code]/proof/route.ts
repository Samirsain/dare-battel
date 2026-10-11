import type { NextRequest } from "next/server"
import { createHash } from "node:crypto"
import { admin, BUCKET, errorResponse, getRoom, playerId } from "@/lib/server"
import { GameError } from "@/lib/game"

const EXT = ["jpg", "jpeg", "png", "webp", "heic", "gif", "mp4", "mov", "webm", "m4a", "aac", "ogg", "mp3", "wav"]

// Voice notes -> private Supabase bucket (signed upload URL). Photos -> Cloudinary when configured, else Supabase.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]/proof">) {
  try {
    const { code } = await ctx.params
    const { secret, ext, kind } = await req.json()
    const room = await getRoom(code)
    if (!room?.players.some((p) => p.id === playerId(secret))) throw new GameError("Tum is room mein nahi ho", "You're not in this room")
    const e = String(ext).toLowerCase()
    if (!EXT.includes(e)) throw new GameError("Sirf photo ya voice note upload karo", "Only photos or voice notes can be uploaded")

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (kind !== "audio" && cloudName && apiKey && apiSecret) {
      const timestamp = Math.round(Date.now() / 1000)
      const folder = `dare-battles/${code}`
      // Alphabetical param order for Cloudinary signature
      const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex")
      return Response.json({ provider: "cloudinary", cloudName, apiKey, timestamp, signature, folder })
    }

    const path = `${code}/${crypto.randomUUID()}.${e}`
    const { data, error } = await admin().storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) throw new GameError("Upload link nahi bana, dobara try karo", "Couldn't prepare the upload, please try again")
    return Response.json({ provider: "supabase", path, token: data.token })
  } catch (e) {
    return errorResponse(e)
  }
}
