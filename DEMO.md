# DEMO — M0 (Environment)

**For ALFA.** M0 is the pre-code milestone: verify the chain environment, make
the v4-vs-v3 call, scaffold the monorepo, get CI green. Nothing is deployed yet.

## What to look at

1. **`docs/ENVIRONMENT.md`** — the deliverable. Every row of the spec's §3
   verification table, with sources and confidence. Headlines:
   - Robinhood Chain **mainnet is live** (July 1, 2026, chain ID **4663**);
     testnet since Feb 10, 2026 (chain ID **46630**). Explorer, RPC, faucet
     recorded.
   - The Uniswap v4-vs-v3 decision and its evidence.
   - What could **not** be verified from here and exactly how to finish each
     item (one command each, marked ⚠).
2. **CI** — GitHub Actions on this branch: Foundry build+test and
   pnpm lint/typecheck/build across `web`, `indexer`, `keeper`, all green.
3. **The scaffold** — run it locally if you like:
   ```bash
   pnpm install && pnpm build     # web app builds; placeholder page at localhost:3000 via `pnpm --filter @quiver/web dev`
   cd contracts && forge test     # dependency-free sanity tests
   ```
4. **`design/quiver-prototype.html`** — open in a browser; unchanged, still the
   UI source of truth (rename to Quiver branding happens in M2 per the brief).
5. **`docs/ARCHITECTURE.md`** — decision log seeded (D1–D5);
   **`docs/AUDIT-NOTES.md`** — five audit flags already filed, including one
   real finding: at 100 ms blocks, a 5-minute TWAP is ~3000 observations —
   oracle buffer sizing needs care (A4).

## Answers M0 produced for your §10 open questions

- **§10.1 RobinfunFactory:** still needed from you/Michael — nothing public
  found; M1 builds against an interface + mock until then.
- Everything else unchanged.

## What M0 explicitly did not do

No contracts written, nothing deployed, no indexer running, no wallet flows —
that starts at M1 on your go.
