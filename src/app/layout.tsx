import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Geist_Mono, Lora } from "next/font/google"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Tomeo — La bibliothèque des lecteurs français",
  description: "Découvrez, notez et partagez vos lectures.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${jakarta.variable} ${lora.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
