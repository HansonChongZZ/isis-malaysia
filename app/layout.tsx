import type { Metadata } from "next"
import { Montserrat, Merriweather, Fira_Code } from "next/font/google"
import "./globals.css"
import ThemeProvider from "@/components/ThemeProvider"
import ThemeToggle from "@/components/ThemeToggle"
import TutorialButton from "@/components/tutorial/TutorialButton"

const fontSans = Montserrat({ subsets: ["latin"], variable: "--font-sans" })
const fontSerif = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-serif" })
const fontMono = Fira_Code({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Malaysia Occupational Space | ISIS Malaysia",
  description:
    "Interactive visualization of Malaysian occupational skill similarity network, MASCO classification, and AI exposure analysis.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} font-sans antialiased bg-background text-foreground flex flex-col h-screen overflow-hidden`}>
        <ThemeProvider>
          {/* Header */}
          <header className="flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3 bg-card border-b border-border shrink-0">
            {/* Logo placeholder */}
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
              IS
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">
                Malaysia Occupational Space
              </h1>
              <p className="text-xs text-muted-foreground leading-tight">ISIS Malaysia · MASCO Research</p>
            </div>
            <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
              Force-directed skill similarity network
            </div>
            <TutorialButton />
            <ThemeToggle />
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
