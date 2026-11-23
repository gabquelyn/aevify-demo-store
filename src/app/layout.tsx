import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import Link from "next/link";
import { Header } from "@/components/header";
import { Logo } from "@/components/logo";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Admit: tickets, paid in stablecoins", template: "%s · Admit" },
  description: "A demo ticketing platform that takes tUSD8 on QDay Aevum through Aevify, from people and from AI agents.",
  icons: { icon: "/favicon.svg" },
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
