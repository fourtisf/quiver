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
              <a href="/" className="flex items-center gap-2.5">
                <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
                  <rect width="32" height="32" rx="8" fill="#050E10" />
                  <path d="M16 6c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z" fill="#3FE0AE" />
                </svg>
                <span className="font-disp text-base font-extrabold tracking-[0.14em] text-foam">
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
                Live · Beta
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
            <a className="text-silt hover:text-spring" href="/preview/">design preview</a> ·{" "}
            <a
              className="text-silt hover:text-spring"
              href="https://github.com/fourtisf/quiver"
              rel="noopener noreferrer"
              target="_blank"
            >
              github
            </a>
          </footer>
        </div>
      </ToastProvider>
    </Providers>
  );
}
