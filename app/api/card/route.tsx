import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

// 1080×1920 story card for "Share Result" (PRD: shareable for Instagram Stories / WhatsApp).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const a = (q.get("a") ?? "You").slice(0, 20)
  const b = (q.get("b") ?? "Partner").slice(0, 20)
  const as = Number(q.get("as")) || 0
  const bs = Number(q.get("bs")) || 0
  const champ = as === bs ? null : as > bs ? a : b

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          background: "radial-gradient(circle at 50% 20%, #5b1a7a 0%, #1a0f26 45%, #0d0614 100%)",
        }}
      >
        <div style={{ fontSize: 44, letterSpacing: 12, color: "#ff8cc4", fontWeight: 700 }}>DARE BATTLES</div>
        <div style={{ fontSize: 260, marginTop: 60 }}>{champ ? "🔥" : "🤝"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 80, marginTop: 40 }}>
          {[
            [a, as],
            [b, bs],
          ].map(([n, s], i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 200, fontWeight: 800, color: s === Math.max(as, bs) && champ ? "#ff8cc4" : "rgba(255,255,255,0.75)" }}>{s}</div>
              <div style={{ fontSize: 48, color: "rgba(255,255,255,0.7)" }}>{n}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, marginTop: 80, textAlign: "center", maxWidth: 900 }}>
          {champ ? `${champ} is the Dare Champion!` : "Barabar ki takkar!"}
        </div>
        <div style={{ fontSize: 40, marginTop: 120, color: "rgba(255,255,255,0.6)" }}>Tum bhi khelo 🔥 Couple dare game</div>
      </div>
    ),
    { width: 1080, height: 1920, emoji: "twemoji" },
  )
}
