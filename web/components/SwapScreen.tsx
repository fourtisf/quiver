"use client";

import Shell from "./Shell";
import { SwapCard } from "./SwapCard";

export default function SwapScreen() {
  return (
    <Shell tab="swap">
      <div className="mb-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-spring">Live</p>
        <h1 className="mt-1 font-disp text-2xl font-extrabold">Swap on Robinhood Chain</h1>
        <p className="mt-1 max-w-md text-sm text-silt">
          Routed through canonical Uniswap. Pools, add-liquidity and TP/SL land
          with the audited Hoodpool contracts.
        </p>
      </div>
      <SwapCard />
    </Shell>
  );
}
