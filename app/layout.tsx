import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "Malaysia Occupational Space | ISIS Malaysia",
  description:
    "Interactive visualization of Malaysian occupational skill similarity network, MASCO classification, and AI exposure analysis.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-gray-950 text-white flex flex-col h-screen overflow-hidden`}>
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-700/60 flex-shrink-0">
          {/* Logo placeholder */}
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            IS
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">
              Malaysia Occupational Space
            </h1>
            <p className="text-xs text-gray-400 leading-tight">ISIS Malaysia · MASCO Research</p>
          </div>
          <div className="ml-auto text-xs text-gray-500 hidden sm:block">
            Force-directed skill similarity network
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
