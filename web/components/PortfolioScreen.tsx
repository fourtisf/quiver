"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { discoverPools } from "@/lib/discover";
import { fetchHoldings, fetchLpPositions, type Holding, type LpPosition } from "@/lib/wallet";
import { fmtAmount } from "@/lib/format";
import { TokenLogo } from "./TokenLogo";
import Shell from "./Shell";

function fmtUsd(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function PortfolioScreenInner() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [positions, setPositions] = useState<LpPosition[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!client || !address) return;
    setLoading(true);
    setError(false);
    discoverPools(client)
      .then((snap) =>
        Promise.all([
          fetchHoldings(client, address, snap.pools, snap.ethUsd),
          fetchLpPositions(client, address, snap.pools, snap.ethUsd),
        ]),
      )
      .then(([h, p]) => { setHoldings(h); setPositions(p); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [client, address]);

  useEffect(() => { load(); }, [load]);

  const walletUsd = holdings?.reduce((s, h) => s + (h.valueUsd ?? 0), 0) ?? 0;
  const lpUsd = positions?.reduce((s, p) => s + (p.valueUsd ?? 0), 0) ?? 0;
  const ready = holdings !== null && positions !== null;

  return (
    <>
      <div className="w-full max-w-3xl">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-disp text-2xl font-extrabold">Portfolio</h1>
            <p className="mt-1 text-sm text-silt">Wallet + LP value, priced from on-chain reserves.</p>
          </div>
          {isConnected ? (
            <button
              onClick={load}
              className="rounded-md border border-stratum bg-basin-2 px-3 py-2 text-xs font-semibold text-silt transition hover:border-spring/40 hover:text-foam"
            >
              ↻ Refresh
            </button>
          ) : null}
        </div>

        {!isConnected ? (
          <div className="rounded-lg border border-stratum bg-basin p-8 text-center">
            <p className="text-sm text-silt">Connect a wallet to see your portfolio.</p>
          </div>
        ) : loading && !ready ? (
          <p className="py-8 text-center font-mono text-xs text-silt">
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-spring/25 border-t-spring align-middle" />
            Valuing portfolio…
          </p>
        ) : error ? (
          <p className="py-8 text-center font-mono text-xs text-coral">RPC unreachable — try Refresh.</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-stratum bg-basin p-5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-silt">Total value</div>
                <div className="mt-1.5 bg-gradient-to-b from-[#FBFFFE] to-[#A9D8C8] bg-clip-text font-mono text-2xl font-semibold tabular-nums text-transparent">
                  {fmtUsd(walletUsd + lpUsd)}
                </div>
              </div>
              <div className="rounded-lg border border-stratum bg-basin p-5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-silt">Wallet</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums">{fmtUsd(walletUsd)}</div>
              </div>
              <div className="rounded-lg border border-stratum bg-basin p-5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-silt">In LP positions</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums">{fmtUsd(lpUsd)}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-stratum bg-basin">
              {(holdings ?? []).map((h) => (
                <div key={h.token.address} className="flex items-center gap-3 border-b border-stratum/30 px-4 py-3 last:border-0">
                  <TokenLogo token={h.token} size={26} />
                  <span>
                    <span className="block text-sm font-semibold">{h.token.symbol}</span>
                    <span className="block text-xs text-silt">{h.token.name}</span>
                  </span>
                  <span className="ml-auto text-right">
                    <span className="block font-mono text-sm font-semibold tabular-nums">
                      {fmtAmount(h.balance, h.token.decimals)}
                    </span>
                    <span className="block font-mono text-xs tabular-nums text-silt">{fmtUsd(h.valueUsd)}</span>
                  </span>
                </div>
              ))}
              {(positions ?? []).map((p) => (
                <div key={p.pool.pair} className="flex items-center gap-3 border-b border-stratum/30 px-4 py-3 last:border-0">
                  <TokenLogo token={p.pool.token} size={26} />
                  <span>
                    <span className="block text-sm font-semibold">{p.pool.token.symbol}/{p.pool.quote} LP</span>
                    <span className="block text-xs text-silt">{p.sharePct.toFixed(2)}% of pool</span>
                  </span>
                  <span className="ml-auto text-right">
                    <span className="block font-mono text-sm font-semibold tabular-nums text-foam">{fmtUsd(p.valueUsd)}</span>
                    <span className="block font-mono text-xs text-silt">v2 LP</span>
                  </span>
                </div>
              ))}
              {ready && (holdings?.length ?? 0) === 0 && (positions?.length ?? 0) === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-silt">Nothing here yet.</p>
              ) : null}
            </div>

            <p className="mt-3 font-mono text-[10.5px] text-silt-dark">
              Tokens without a discovered WETH pool are valued as — . Historical
              PnL and cost basis arrive with the indexer.
            </p>
          </>
        )}
      </div>
    </>
  );
}

export default function PortfolioScreen() {
  return (
    <Shell tab="portfolio">
      <PortfolioScreenInner />
    </Shell>
  );
}
