const MILESTONES = [
  { id: "M0", label: "Environment — chain verified, repo scaffolded, CI green", state: "current" },
  { id: "M1", label: "Contracts core — QuiverRouter + RobinfunGate on testnet", state: "next" },
  { id: "M2", label: "Read path — indexer, pools list, candles, brand applied", state: "later" },
  { id: "M3", label: "Write path — create pool, swap, add liquidity", state: "later" },
  { id: "M4", label: "Positions & portfolio — incl. external positions", state: "later" },
  { id: "M5", label: "TP/SL — executor + keeper", state: "later" },
  { id: "M6", label: "Hardening — invariants, audit notes, canary", state: "later" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-limestone">
          Robinhood Chain · Arbitrum Orbit
        </p>
        <h1 className="font-disp text-5xl font-extrabold tracking-tight text-foam">
          QUIVER<span className="text-spring">.</span>
        </h1>
        <p className="max-w-xl text-base text-silt">
          The liquidity layer for Robinfun tokens. One-click Uniswap pools, 1% swap fees to LPs,
          non-custodial take-profit / stop-loss, live PnL on every position.
        </p>
        <p className="font-mono text-xs text-silt-dark">
          Launch on Robinfun → deploy liquidity on Quiver → lock LP in Strongroom.
        </p>
      </header>

      <section className="rounded-lg border border-stratum bg-basin p-6">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-silt">
          Build status
        </h2>
        <ol className="flex flex-col gap-2">
          {MILESTONES.map((m) => (
            <li key={m.id} className="flex items-baseline gap-3 font-mono text-sm">
              <span
                className={
                  m.state === "current"
                    ? "text-spring"
                    : m.state === "next"
                      ? "text-limestone"
                      : "text-silt-dark"
                }
              >
                {m.id}
              </span>
              <span className={m.state === "current" ? "text-foam" : "text-silt"}>{m.label}</span>
              {m.state === "current" ? (
                <span className="ml-auto rounded-sm bg-spring/10 px-2 py-0.5 text-xs text-spring">
                  in progress
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <footer className="text-xs text-silt-dark">
        Design source of truth: <span className="font-mono">design/quiver-prototype.html</span> —
        the full UI lands in M2. This page is a scaffold placeholder.
      </footer>
    </main>
  );
}
