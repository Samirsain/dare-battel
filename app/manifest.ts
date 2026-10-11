import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  const icon = [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }]
  return {
    id: "/",
    name: "Dare Battles — Couple Dare Game",
    short_name: "Dare Battles",
    description: "Real-time couple dare game. Voice notes aur photos ke dares, proof bhejo aur Dare Champion bano.",
    lang: "en-IN",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff7fb",
    theme_color: "#fff7fb",
    categories: ["games", "entertainment", "lifestyle"],
    icons: [
      ...icon,
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Room join karo", short_name: "Join", url: "/join", icons: icon }],
  }
}
