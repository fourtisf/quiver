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

- **§10.1 RobinfunFactory:** mostly answered — the public repo
  `github.com/fourtisf/robinfun` fixes the verification interface:
  **`curveOf(token) != address(0)`** (there is no `isLaunched()`). Two candidate
  mainnet factory addresses found; you still need to confirm which is canonical,
  whether betaMode is on, and pin a testnet deployment (ENVIRONMENT.md §4, ⚠4 is
  a one-command check).
- **Decisions made under the spec's own rules:** Uniswap **v4** (canonically
  deployed on mainnet — but NOT on testnet, so M1 tests run on a mainnet fork);
  indexing via **Goldsky** (Uniswap itself runs on it for this chain); TP/SL
  keeper is **self-run** (neither Chainlink Automation nor Gelato supports the
  chain). One consequence worth your attention: v4 pools need our **oracle hook
  at creation time** for TWAP — that moved from M5 into M1 scope.
- §10.2 (treasury signers), §10.3 (10 bps execution fee), §10.4 (name) —
  still yours.

## What M0 explicitly did not do

No contracts written, nothing deployed, no indexer running, no wallet flows —
that starts at M1 on your go.
