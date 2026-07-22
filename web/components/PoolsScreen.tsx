"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { discoverPools, type PoolsSnapshot } from "@/lib/discover";
import { fmtAmount } from "@/lib/format";
import { TokenLogo } from "./TokenLogo";
import Shell from "./Shell";

function fmtUsd(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.0001) return `$${v.toFixed(5)}`;
  if (v > 0) return `$${v.toExponential(2)}`;
  return "$0";
}

function PoolsScreenInner() {
  const client = usePublicClient();
  const [snap, setSnap] = useState<PoolsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback((force: boolean) => {
    if (!client) return;
    setLoading(true);
    setError(false);
    discoverPools(client, force)
      .then(setSnap)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [client]);

  useEffect(() => { load(false); }, [load]);

  const pools = (snap?.pools ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.token.symbol.toLowerCase().includes(q) ||
      p.token.name.toLowerCase().includes(q) ||
      p.token.address.toLowerCase() === q
    );
  });

  return (
    <>
      <div className="w-full max-w-4xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-disp text-2xl font-extrabold">Pools</h1>
            <p className="mt-1 text-sm text-silt">
              Live from the canonical Uniswap v2 factory — every WETH-quoted pool
              in the newest {snap?.scannedPairs ?? "…"} pairs.
              {snap?.ethUsd ? (
                <span className="font-mono text-silt-dark"> · ETH ≈ ${snap.ethUsd.toFixed(0)}</span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol / address"
              className="w-52 rounded-md border border-stratum bg-ink px-3 py-2 font-mono text-xs outline-none placeholder:text-silt-dark focus:border-spring/50"
            />
            <button
              onClick={() => load(true)}
              className="rounded-md border border-stratum bg-basin-2 px-3 py-2 text-xs font-semibold text-silt transition hover:border-spring/40 hover:text-foam"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-stratum bg-basin">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-stratum/60 font-mono text-[10.5px] uppercase tracking-wider text-silt">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Pool</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">TVL</th>
                <th className="px-4 py-3 text-right font-medium">Depth</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pools.map((p, i) => (
                <tr key={p.pair} className="border-b border-stratum/30 transition hover:bg-spring/5">
                  <td className="px-4 py-3 font-mono text-xs text-silt-dark">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <TokenLogo token={p.token} size={26} />
                      <span>
                        <span className="block text-sm font-semibold">{p.token.symbol} / {p.quote}</span>
                        <span className="block text-xs text-silt">{p.token.name}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">{fmtUsd(p.priceUsd)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foam">{fmtUsd(p.tvlUsd)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-silt">
                    {fmtAmount(p.reserveQuote, p.quote === "USDG" ? 6 : 18, p.quote === "USDG" ? 0 : 3)} {p.quote}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/?token=${p.token.address}`}
                      className="rounded-md bg-spring/12 px-3 py-1.5 text-xs font-semibold text-spring transition hover:bg-spring/20"
                    >
                      Trade
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading ? (
            <p className="px-4 py-6 text-center font-mono text-xs text-silt">
              <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-spring/25 border-t-spring align-middle" />
              Scanning on-chain pools…
            </p>
          ) : error ? (
            <p className="px-4 py-6 text-center font-mono text-xs text-coral">
              RPC unreachable — try Refresh.
            </p>
          ) : pools.length === 0 ? (
            <p className="px-4 py-6 text-center font-mono text-xs text-silt">No pools match.</p>
          ) : null}
        </div>

        <p className="mt-3 font-mono text-[10.5px] text-silt-dark">
          Prices &amp; TVL derived from pair reserves via the WETH/USDG pool. Volume,
          fees and candles arrive with the indexer.
        </p>
      </div>
    </>
  );
}

export default function PoolsScreen() {
  return (
    <Shell tab="pools">
      <PoolsScreenInner />
    </Shell>
  );
}
