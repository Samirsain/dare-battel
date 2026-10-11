import type { NextRequest } from "next/server"
import { act, admin, BUCKET, errorResponse, getRoom, playerId, redact } from "@/lib/server"
import { GameError, type Action, type Proof } from "@/lib/game"

export async function GET(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]">) {
  try {
    const { code } = await ctx.params
    const room = await getRoom(code)
    if (!room) return Response.json({ error: "Room nahi mila ya expire ho gaya" }, { status: 404 })
    const secret = req.headers.get("x-player")
    const me = secret ? playerId(secret) : null
    const player = room.players.some((p) => p.id === me)
    return Response.json({ room: player ? room : redact(room), me, now: Date.now() })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]">) {
  try {
    const { code } = await ctx.params
    const { secret, action } = (await req.json()) as { secret: string; action: Action & { proof?: unknown } }
    if (action?.type === "complete" && action.proof) action.proof = await signProof(code, action.proof)
    const room = await act(code, secret, action)
    return Response.json({ room, me: playerId(secret), now: Date.now() })
  } catch (e) {
    return errorResponse(e)
  }
}

const KINDS: Proof["kind"][] = ["image", "video", "audio"]

// Cloudinary photos come back as URLs; Supabase uploads (all voice notes) as bucket paths we sign for 24h.
async function signProof(code: string, p: unknown): Promise<Proof> {
  const { path, url, kind, caption } = (p ?? {}) as Record<string, unknown>
  const safeCaption = typeof caption === "string" ? caption.slice(0, 140) : ""
  const safeKind = KINDS.includes(kind as Proof["kind"]) ? (kind as Proof["kind"]) : "image"

  if (typeof url === "string" && url.startsWith("https://res.cloudinary.com/")) {
    return { url, kind: safeKind, caption: safeCaption }
  }

  if (typeof path === "string" && path.startsWith(`${code}/`) && !path.includes("..")) {
    const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24)
    if (!error && data) return { url: data.signedUrl, kind: safeKind, caption: safeCaption }
  }

  throw new GameError("Proof upload fail hua")
}
