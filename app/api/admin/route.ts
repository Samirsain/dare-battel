import { NextResponse, type NextRequest } from "next/server"
import { ADMIN_COOKIE, admin, adminEnabled, adminToken, checkAdminPassword, isAdmin, isCode, purge } from "@/lib/server"
import type { Room } from "@/lib/game"

const SESSION = 12 * 60 * 60 // seconds
const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin" } as const
const denied = () => Response.json({ error: adminEnabled ? "Login karo" : "Admin off hai — ADMIN_PASSWORD set karo" }, { status: 401 })

export type AdminRoom = { code: string; updatedAt: string; state: Room }

/** Every room still in the database, newest activity first, unredacted (proof links included). */
export async function GET(req: NextRequest) {
  if (!isAdmin(req.cookies.get(ADMIN_COOKIE)?.value)) return denied()
  const { data, error } = await admin().from("rooms").select("code, state, updated_at").order("updated_at", { ascending: false }).limit(300)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const rooms: AdminRoom[] = data.map((d) => ({ code: d.code, updatedAt: d.updated_at, state: d.state as Room }))
  return Response.json({ rooms }, { headers: { "Cache-Control": "no-store" } })
}

/** { password } logs in, { logout: true } logs out. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { password?: unknown; logout?: boolean }
  const res = NextResponse.json({ ok: true })
  if (body.logout) {
    res.cookies.set(ADMIN_COOKIE, "", { ...cookie, maxAge: 0 })
    return res
  }
  if (!checkAdminPassword(body.password)) {
    return Response.json({ error: adminEnabled ? "Galat password" : "Admin off hai — ADMIN_PASSWORD set karo" }, { status: 401 })
  }
  res.cookies.set(ADMIN_COOKIE, adminToken(Date.now() + SESSION * 1000), { ...cookie, maxAge: SESSION })
  return res
}

/** ?code=123456 — removes the room and all of its voice notes and photos. */
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req.cookies.get(ADMIN_COOKIE)?.value)) return denied()
  const code = req.nextUrl.searchParams.get("code") ?? ""
  if (!isCode(code)) return Response.json({ error: "Galat room code" }, { status: 400 })
  return Response.json({ ok: true, files: await purge(code) })
}
