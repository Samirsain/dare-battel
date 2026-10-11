import fs from "node:fs"
import path from "node:path"
import { ImageResponse } from "next/og"

// WhatsApp link preview for every invite link.
export const alt = "Dare Battles — couple dare game"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OG() {
  const file = fs.readFileSync(path.join(process.cwd(), "public", "icon.jpg"))
  const base64 = `data:image/jpeg;base64,${file.toString("base64")}`

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
          background: "radial-gradient(circle at 50% 10%, #4a154b 0%, #150a21 55%, #08030d 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={base64}
          alt="Dare Battles Logo"
          style={{ width: 180, height: 180, borderRadius: 36, boxShadow: "0 0 60px rgba(255,61,154,0.4)" }}
        />
        <div style={{ fontSize: 80, fontWeight: 800, marginTop: 24, letterSpacing: "-0.02em" }}>Dare Battles</div>
        <div style={{ fontSize: 34, marginTop: 12, color: "#ff8cc4", fontWeight: 500 }}>
          Room join karo — kaun banega Dare Champion? 🔥
        </div>
      </div>
    ),
    { ...size },
  )
}
