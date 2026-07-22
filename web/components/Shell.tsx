"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Providers } from "@/app/providers";
import { ToastProvider } from "./Toasts";

const TABS = [
  { key: "swap", label: "Swap", href: "/" },
  { key: "pools", label: "Pools", href: "/pools/" },
  { key: "positions", label: "Positions", href: "/positions/" },
  { key: "portfolio", label: "Portfolio", href: "/portfolio/" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export default function Shell({ tab, children }: { tab: TabKey; children: React.ReactNode }) {
  return (
    <Providers>
      <ToastProvider>
        <div className="flex min-h-screen flex-col">
          <nav className="sticky top-0 z-30 border-b border-stratum/50 bg-ink/70 backdrop-blur-md">
            <div className="mx-auto max-w-6xl px-4">
              {/* top row: brand + wallet (always visible) */}
              <div className="flex h-16 items-center gap-3">
                <a href="/" className="flex flex-shrink-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-spring/40 bg-gradient-to-b from-basin-2 to-ink shadow-[0_0_18px_-4px_rgba(63,224,174,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <svg viewBox="0 0 32 32" aria-hidden="true" width="22" height="22" className="drop-shadow-[0_0_8px_rgba(63,224,174,0.6)]">
                      <defs>
                        <linearGradient id="navg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#6FF5CB" />
                          <stop offset="1" stopColor="#2FCB9A" />
                        </linearGradient>
                      </defs>
                      <path d="M16 5c-4.4 5.5-6.6 8.8-6.6 12.1a6.6 6.6 0 0 0 13.2 0C22.6 13.8 20.4 10.5 16 5z" fill="url(#navg)" />
                    </svg>
                  </span>
                  <span className="bg-gradient-to-b from-[#F6FDFA] to-[#9FC9BC] bg-clip-text font-disp text-base font-extrabold tracking-[0.14em] text-transparent">
                    HOODPOOL
                  </span>
                </a>

                {/* tabs inline on desktop */}
                <div className="ml-2 hidden items-center gap-1 rounded-xl border border-stratum/60 bg-ink/50 p-1 md:flex">
                  {TABS.map((t) => (
                    <Link
                      key={t.key}
                      href={t.href}
                      className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                        tab === t.key
                          ? "bg-spring/15 text-spring shadow-[inset_0_0_0_1px_rgba(63,224,174,0.25)]"
                          : "text-silt hover:text-foam"
                      }`}
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>

                <span className="ml-auto flex flex-shrink-0 items-center gap-2">
                  <a
                    href="https://x.com/Hoodpoolfun"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Hoodpool on X"
                    title="@Hoodpoolfun"
                    className="hidden h-9 w-9 items-center justify-center rounded-[10px] border border-stratum/70 bg-ink/50 text-silt transition hover:border-spring/40 hover:text-foam sm:flex"
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" label="Connect" />
                </span>
              </div>

              {/* tabs on their own scrollable row on mobile */}
              <div className="-mx-1 flex items-center gap-1 overflow-x-auto pb-2 md:hidden">
                {TABS.map((t) => (
                  <Link
                    key={t.key}
                    href={t.href}
                    className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-semibold transition ${
                      tab === t.key
                        ? "bg-spring/15 text-spring shadow-[inset_0_0_0_1px_rgba(63,224,174,0.25)]"
                        : "text-silt hover:text-foam"
                    }`}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <main className="flex w-full flex-1 flex-col items-center px-5 pb-16 pt-8">{children}</main>

          <footer className="border-t border-stratum/50 py-5 text-center font-mono text-[11px] text-silt-dark">
            © 2026 HOODPOOL · <a className="text-silt hover:text-spring" href="/">home</a> ·{" "}
            <a className="text-silt hover:text-spring" href="/docs/">docs</a> ·{" "}
            <a
              className="text-silt hover:text-spring"
              href="https://x.com/Hoodpoolfun"
              rel="noopener noreferrer"
              target="_blank"
            >
              @Hoodpoolfun ⧉
            </a>
          </footer>
        </div>
      </ToastProvider>
    </Providers>
  );
}
