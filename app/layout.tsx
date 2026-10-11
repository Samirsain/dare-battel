import type { Metadata, Viewport } from "next"
import { Poppins } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { PwaKit } from "@/components/pwa"
import "./globals.css"

const poppins = Poppins({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] })

const description = "Real-time couple dare game. Voice notes aur photos ke dares — room banao, partner ko WhatsApp karo, proof bhejo aur Dare Champion bano."

// Icons come from app/favicon.ico, app/icon.png and app/apple-icon.png; the share image from app/opengraph-image.tsx.
export const metadata: Metadata = {
  title: "Dare Battles — Couple Dare Game",
  description,
  applicationName: "Dare Battles",
  appleWebApp: { capable: true, title: "Dare Battles", statusBarStyle: "default" },
  formatDetection: { telephone: false }, // room codes are 6 digits; iOS would turn them into phone links
  openGraph: { title: "Dare Battles", description: "Couple dare game — kaun banega Dare Champion?", type: "website" },
}

export const viewport: Viewport = {
  themeColor: "#fff7fb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        {/* Before first paint: lets CSS hide [data-enter] for GSAP without hiding anything when JS is off */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        {children}
        <PwaKit />
        <Toaster
          theme="light"
          position="top-center"
          richColors
          mobileOffset={{ top: "max(12px, env(safe-area-inset-top))" }}
          toastOptions={{ style: { borderRadius: 18 } }}
        />
      </body>
    </html>
  )
}
