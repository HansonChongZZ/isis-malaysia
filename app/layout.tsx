import type { Metadata } from 'next';
import { Inter_Tight, Funnel_Display, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import { Analytics } from '@vercel/analytics/next';

const fontSans = Inter_Tight({ subsets: ['latin'], variable: '--font-sans' });
const fontSerif = Funnel_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif',
});
const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Malaysia Occupational Space | ISIS Malaysia',
  description:
    'Interactive visualisation of Malaysian occupational skill similarity network, MASCO classification, and AI exposure analysis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} font-sans antialiased bg-background text-foreground flex flex-col h-dvh overflow-hidden`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
