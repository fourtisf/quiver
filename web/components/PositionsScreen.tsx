"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { discoverPools } from "@/lib/discover";
import { fetchLpPositions, type LpPosition } from "@/lib/wallet";
import { fmtAmount } from "@/lib/format";
import { EXPLORER } from "@/lib/addresses";
import { TokenLogo } from "./TokenLogo";
import Shell from "./Shell";

function fmtUsd(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return v >= 1000
    ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`;
}

function PositionsScreenInner() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [positions, setPositions] = useState<LpPosition[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!client || !address) return;
    setLoading(true);
    setError(false);
    discoverPools(client)
      .then((snap) => fetchLpPositions(client, address, snap.pools, snap.ethUsd))
      .then(setPositions)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [client, address]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="w-full max-w-3xl">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-disp text-2xl font-extrabold">Positions</h1>
            <p className="mt-1 text-sm text-silt">
              Your Uniswap v2 LP positions, read straight from the chain.
            </p>
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
            <p className="text-sm text-silt">Connect a wallet to see your LP positions.</p>
          </div>
        ) : loading && positions === null ? (
          <p className="py-8 text-center font-mono text-xs text-silt">
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-spring/25 border-t-spring align-middle" />
            Reading positions…
          </p>
        ) : error ? (
          <p className="py-8 text-center font-mono text-xs text-coral">RPC unreachable — try Refresh.</p>
        ) : positions && positions.length === 0 ? (
          <div className="rounded-lg border border-stratum bg-basin p-8 text-center">
            <p className="text-sm text-silt">
              No LP positions found across the newest on-chain pools.
            </p>
            <p className="mt-2 font-mono text-[11px] text-silt-dark">
              One-click add-liquidity ships with the audited Hoodpool router.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(positions ?? []).map((pos) => (
              <div key={pos.pool.pair} className="rounded-lg border border-stratum bg-basin p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <TokenLogo token={pos.pool.token} size={30} />
                  <span className="font-disp text-base font-bold">{pos.pool.token.symbol} / {pos.pool.quote}</span>
                  <span className="rounded-full border border-spring/30 bg-spring/10 px-2 py-0.5 font-mono text-[10.5px] text-spring">
                    v2 LP
                  </span>
                  <a
                    className="ml-auto font-mono text-[11px] text-silt hover:text-spring"
                    href={`${EXPLORER}/address/${pos.pool.pair}`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    pair ⧉
                  </a>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-silt">Value</div>
                    <div className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-foam">{fmtUsd(pos.valueUsd)}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-silt">Pool share</div>
                    <div className="mt-1 font-mono text-[15px] font-semibold tabular-nums">{pos.sharePct.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-silt">{pos.pool.token.symbol}</div>
                    <div className="mt-1 font-mono text-[15px] font-semibold tabular-nums">
                      {fmtAmount(pos.underlyingToken, pos.pool.token.decimals)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-silt">{pos.pool.quote}</div>
                    <div className="mt-1 font-mono text-[15px] font-semibold tabular-nums">
                      {fmtAmount(pos.underlyingQuote, pos.pool.quote === "USDG" ? 6 : 18)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 font-mono text-[10.5px] text-silt-dark">
          Scans v2 LP tokens across the deepest on-chain pools. Concentrated
          (v4) positions and TP/SL arrive with the Hoodpool contracts.
        </p>
      </div>
    </>
  );
}

export default function PositionsScreen() {
  return (
    <Shell tab="positions">
      <PositionsScreenInner />
    </Shell>
  );
}
