"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Providers } from "@/app/providers";
import { ToastProvider } from "./Toasts";
import { SwapCard } from "./SwapCard";

export default function AppShell() {
  return (
    <Providers>
      <ToastProvider>
        <div className="flex min-h-screen flex-col">
          <nav className="sticky top-0 z-30 border-b border-stratum/50 bg-ink/70 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-5">
              <a href="/" className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-spring/40 bg-gradient-to-b from-basin-2 to-ink shadow-[0_0_18px_-4px_rgba(63,224,174,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]">
                  <svg viewBox="0 0 32 32" className="h-5.5 w-5.5 drop-shadow-[0_0_8px_rgba(63,224,174,0.6)]" aria-hidden="true" width="22" height="22">
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
              <span className="hidden rounded-full border border-limestone/25 bg-limestone/10 px-2.5 py-1 font-mono text-[10px] text-limestone sm:inline">
                ROBINHOOD CHAIN · 4663
              </span>
              <span className="ml-auto">
                <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
              </span>
            </div>
          </nav>

          <main className="flex flex-1 flex-col items-center px-5 pb-16 pt-10">
            <div className="mb-6 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-spring">
                Live
              </p>
              <h1 className="mt-1 font-disp text-2xl font-extrabold">Swap on Robinhood Chain</h1>
              <p className="mt-1 max-w-md text-sm text-silt">
                Routed through canonical Uniswap. Pools, add-liquidity and TP/SL land
                with the audited Hoodpool contracts.
              </p>
            </div>
            <SwapCard />
          </main>

          <footer className="border-t border-stratum/50 py-5 text-center font-mono text-[11px] text-silt-dark">
            © 2026 HOODPOOL · <a className="text-silt hover:text-spring" href="/">home</a> ·{" "}
            <a className="text-silt hover:text-spring" href="/preview/">design preview</a>
          </footer>
        </div>
      </ToastProvider>
    </Providers>
  );
}
