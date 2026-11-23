import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import Link from "next/link";
import { Header } from "@/components/header";
import { Logo } from "@/components/logo";
import { env } from "@/lib/env";
import "./globals.css";

const title = "Admit: tickets, paid in stablecoins";
const description = "A demo ticketing platform that takes tUSD8 on QDay Aevum through Aevify, from people and from AI agents.";

export const metadata: Metadata = {
  // Absolute base for link previews: STORE_URL, else Vercel's production domain.
  metadataBase: new URL(env.storeUrl() ?? "https://aevify-demo-store.vercel.app"),
  title: { default: title, template: "%s · Admit" },
  description,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: "Admit",
    title,
    description,
    url: "/",
    // Regenerate with scripts/og-image.py (renders /dev/og).
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Admit: tickets, paid in stablecoins" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const aevifyUrl = env.aevifyUrl();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <div className="border-b border-line px-5 py-2 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          Demo on QDay Aevum Testnet · test tUSD8 only ·{" "}
          <a href="https://faucet.qday.info/en" target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">
            Faucet
          </a>
        </div>
        <Header />
        <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-4">
              <Logo className="text-ink" />
              <span>Tickets, paid in stablecoins.</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/orders" className="hover:text-ink">Live sales</Link>
              <Link href="/agent" className="hover:text-ink">AI agent</Link>
              <a href={`${aevifyUrl}/docs`} className="hover:text-ink">Aevify docs</a>
              <a href={aevifyUrl} className="text-ink">Payments by Aevify ↗</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
