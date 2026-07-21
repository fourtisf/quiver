# CLAUDE CODE PROMPT — QUIVER
### The liquidity layer for Robinfun tokens on Robinhood Chain

> **For Michael:** start Claude Code in a fresh repo. Put this file at the repo root and put the design prototype at `/design/quiver-prototype.html` (the file ALFA sent — it is the single source of truth for UI, UX, and copy). Then tell Claude Code: *"Read QUIVER-CLAUDE-CODE-PROMPT.md and /design/quiver-prototype.html, then execute milestone M0."*
>
> **Branding:** final name is **Quiver** (token **$QVR**). The prototype file still says "Aquifer/$AQFR" — find-and-replace during M2 (Aquifer→Quiver, AQFR→QVR). If ALFA reverts to Aquifer, skip the rename. The logo mark becomes a quiver/arrow instead of the droplet; keep the strata background lines.

---

## 1. Mission

Build the Rock Protocol equivalent for **our** launchpad: a non-custodial liquidity venue where any token launched on **Robinfun** gets a one-click Uniswap pool, LPs earn 1% of every swap, and holders get on-chain take-profit / stop-loss plus live PnL for every position they own — including positions opened outside Quiver.

Reference competitor (study, do not copy code): https://www.rockprotocol.io — they do this for the PONS launchpad. We do it for Robinfun, tighter and better-designed.

Ecosystem story to preserve everywhere in copy: **Launch on Robinfun → deploy liquidity on Quiver → lock LP in Strongroom.**

---

## 2. Product invariants (do not change without asking ALFA)

1. **Robinfun-gated:** a token appears on Quiver only if it verifies on-chain against the RobinfunFactory. No allowlists, no manual curation.
2. **Fees:** every pool uses the **1% swap fee tier** (fee to LPs). Protocol takes **0.1% of deposits**, routed to the treasury (later: $QVR buyback). Nothing else.
3. **Non-custodial:** positions are standard Uniswap position NFTs in the user's wallet. Quiver contracts never hold user positions or funds between transactions.
4. **Immutable:** no owner, no admin keys, no upgrade hooks on core contracts. Treasury is a Gnosis Safe multisig. If a parameter must be tunable, ask ALFA first — default answer is "hardcode it."
5. **Single-transaction UX:** verify → create pool (if absent) → zap/balance → mint position → take fee, all in one tx from the user's point of view.
6. **TP/SL is non-custodial:** the position never leaves the wallet; the executor acts under a scoped, revocable approval.

---

## 3. M0 — ENVIRONMENT VERIFICATION (do this before writing any code)

Robinhood Chain is an Arbitrum Orbit L2. **Do not assume any address or chain parameter — verify each item and record it in `/docs/ENVIRONMENT.md`:**

| Item | How to verify |
|---|---|
| Chain ID, RPC URL, explorer | Official Robinhood Chain docs + `cast chain-id --rpc-url <rpc>` |
| Canonical **Uniswap v4 PoolManager** deployed? Address? | Uniswap deployments docs / explorer / Rock Protocol's verified contracts as a cross-check |
| Canonical **Uniswap v3** factory + NonfungiblePositionManager (fallback) | Same |
| WETH address | Chain docs / explorer |
| USDG address (the chain's stable) | Chain docs / explorer |
| **RobinfunFactory** address + ABI + the exact view method that proves a token was launched there (e.g. `isLaunched(address)` or a `tokenOf` registry) | **Our Robinfun repo — ask ALFA/Michael.** If Robinfun is not deployed yet, build against its interface and wire a mock in tests |
| Keeper infra available on this Orbit chain: Chainlink Automation? Gelato? | Provider docs. If neither supports the chain, we run our own keeper bot (see §5.3 and `/keeper`) |
| Indexing: does Goldsky / The Graph support this chain? | Provider docs. If not, use **Ponder** self-hosted |

**Decision rule:** prefer **Uniswap v4** (singleton PoolManager, cheap pool creation, hooks). Fall back to v3 only if v4 is not canonically deployed. Record the decision and its reason in ENVIRONMENT.md.

---

## 4. Repo layout (monorepo, pnpm workspaces)

```
/contracts   Foundry — Solidity 0.8.x, tests, deploy scripts
/indexer     Ponder (or subgraph if supported) — pools, swaps, positions, candles
/web         Next.js 14 App Router + TypeScript + Tailwind + wagmi v2/viem + RainbowKit + TanStack Query
/keeper      TypeScript bot (viem) — TP/SL execution fallback if no Chainlink/Gelato
/design      quiver-prototype.html (source of truth) + extracted design tokens
/docs        ENVIRONMENT.md, ARCHITECTURE.md, runbooks
```

---

## 5. Contracts spec (`/contracts`)

### 5.1 `QuiverRouter` (zap + deposit, the main entry point)
- `createAndDeposit(token, pairAsset, tickLower, tickUpper, amountIn, minLiquidity, deadline)`
  1. `RobinfunGate.requireLaunched(token)` — revert `NotRobinfunToken()` otherwise.
  2. Take 0.1% of `amountIn` → Treasury. Emit `ProtocolFee`.
  3. If the 1%-tier pool doesn't exist: initialize it (v4 `initialize` / v3 `createAndInitializePoolIfNecessary`) at the Robinfun bonding-curve spot price (read from Robinfun) or caller-supplied sqrtPrice with sanity bounds.
  4. Zap: swap part of the single-sided deposit through the pool (or USDG/WETH route) to match the range ratio.
  5. Mint the position NFT **directly to msg.sender**.
- `deposit(...)` — same without pool creation, for existing pools.
- Support depositing either side (token or pair asset). Pair assets: **WETH, native ETH (auto-wrap), USDG** only.
- **Memecoin reality:** handle fee-on-transfer and rebasing tokens defensively — measure balances before/after, revert with a clear error if transfer amounts don't reconcile beyond a small tolerance. Slippage (`minLiquidity`) and `deadline` on every state-changing call. ReentrancyGuard. Use Permit2 for approvals where possible.
- Events for everything the indexer needs: `PoolCreated`, `Deposited(tokenId, owner, ...)`, `ProtocolFee`.

### 5.2 `RobinfunGate`
- Thin library/contract wrapping the RobinfunFactory check. One external view: `isRobinfunToken(address) → bool`. Used by the router and by the frontend/indexer for listing. No storage, no owner.

### 5.3 `TPSLExecutor`
- `arm(tokenId, takeProfitSqrtPrice, stopLossSqrtPrice, minAmountOutBps, payoutAsset, deadline)` — stores an order; requires the user has called `approve(executor, tokenId)` on the position manager (scoped to that tokenId; revocable any time = cancel).
- `cancel(tokenId)` — owner only; also implicitly cancelled if approval is revoked.
- `execute(tokenId)` — callable by anyone (keeper-compatible, MEV-tolerant):
  1. Read pool price as a **TWAP** (v4 oracle hook / v3 `observe`, window ≥ 5 min) — never spot, or a single-block manipulation drains people.
  2. Require TWAP crossed TP or SL trigger.
  3. `decreaseLiquidity` → `collect` → swap proceeds to `payoutAsset` respecting `minAmountOutBps` → transfer to position owner.
  4. Pay executor a fixed execution fee in bps (hardcode, e.g. 10 bps) from proceeds. Emit `Executed(tokenId, trigger, amounts)`.
- If v4: evaluate implementing trigger checks as an **afterSwap hook** on our pools (cheaper, no polling) with the keeper path kept as fallback. Document trade-offs in ARCHITECTURE.md before choosing.

### 5.4 `Treasury`
- Gnosis Safe (no custom code v1). Router sends the 0.1% fee here. $QVR buyback logic is explicitly **out of scope v1**.

### 5.5 Testing & security bar
- Foundry: unit + fork tests (fork Robinhood Chain RPC). Invariant tests on the router (fees always exact 0.1%, NFT always ends at msg.sender, router token balance always 0 after tx).
- Slither + custom checks in CI. Testnet/canary deployment with small caps before mainnet. Flag anything audit-worthy in `/docs/AUDIT-NOTES.md` as you go — ALFA will book an external audit before real TVL.

---

## 6. Indexer spec (`/indexer`)

Entities: `Token` (address, symbol, name, logoURI from Robinfun metadata/IPFS, launchedAt), `Pool` (pair, fee, tvlUSD, createdAt), `Swap`, `PoolHourData` / `PoolDayData` (OHLC for candles, volumeUSD, feesUSD), `Position` (owner, range, liquidity, depositedUSD), `PositionFeeSnapshot`.

- **External-position tracking (the Rock killer feature):** index **every** position minted on the canonical position manager whose pool contains a Robinfun-verified token — not just positions created through our router. That is how the Positions/Portfolio pages show "Opened on Uniswap" entries.
- USD pricing: derive token prices from pool ticks routed through USDG (and WETH/USDG). Persist hourly.
- Expose a typed API (tRPC or REST) the web app consumes: pools list w/ sort, pool detail + candles + recent swaps, positions by owner, portfolio aggregates.
- Target freshness ≤ 10s behind head; web app polls or uses websocket push.

---

## 7. Frontend spec (`/web`)

**The prototype at `/design/quiver-prototype.html` is the spec.** Open it in a browser first. Reproduce it 1:1 — layout, motion, and copy — then wire real data. Extract into `/design/tokens.ts`:

- Colors: `--ink #050E10`, `--spring #3FE0AE`, `--spring-bright #6FF5CB`, `--limestone #CBB891`, `--silt #82989B`, `--foam #EDF7F4`, `--coral #F0705C`, `--amber #E8B45A`, surfaces `#0D1E21/#122528/#183034`.
- Type: display **Bricolage Grotesque**, body **Albert Sans**, data/mono **IBM Plex Mono** (tabular numerals for all numbers).
- Signature elements to keep: gradient hairline card borders, cursor-follow glow, ambient aurora + grain, sliding tab glider, token orbs with the custom SVG icon set, strata/waterline range visualization with hover price tooltip, conic light ring on the swap card, pending→confirmed transaction toasts, live-ticking table cells.

Routes: `/pools` (default), `/pools/[poolId]` (the drawer from the prototype becomes a route; render as drawer on desktop, full page on mobile), `/create`, `/swap`, `/positions`, `/portfolio`, `/docs`.

Wiring notes:
- Wallet: RainbowKit + wagmi v2. Every write: simulate → submit → pending toast (spinner) → `useWaitForTransactionReceipt` → confirmed toast. Exactly the cadence in the prototype.
- Token logos: `logoURI` from Robinfun launch metadata (IPFS via our gateway). Fallback = colored orb + first letter (already in prototype). The prototype's hand-drawn icon set is placeholder art for mock tokens — real tokens use their uploaded logo.
- Search: symbol/name via indexer; pasting a `0x…` address resolves the token and lists **all** its pools.
- Create flow: live RobinfunGate check on address input (the verify step in the prototype), range presets Full / ±50% / ±15% / custom, deposit-either-side with quote preview, single `createAndDeposit` tx.
- Swap: quote via Uniswap Quoter (v4 quoter / v3 QuoterV2), routes limited to ETH/WETH/USDG/Robinfun tokens, price-impact warning tiers as in prototype, slippage presets 0.5/1/3%.
- Positions: in-range state, uncollected fees (live), Collect / Set TP/SL / Close actions; external positions read-only with "Manage on Uniswap ⧉".
- Portfolio: total value, per-position PnL vs. deposited cost basis (from indexer), lifetime fees, sparkline.
- Charts on pool page: `lightweight-charts` fed by PoolHourData candles.
- Docs page: port the four cards from the prototype verbatim, including the trust-model bullets and the flow line (Robinfun → Quiver → Strongroom), plus real contract addresses once deployed.
- Perf/a11y bar: Lighthouse ≥ 90 mobile, `prefers-reduced-motion` respected (already handled in prototype CSS — keep it), keyboard focus visible.

---

## 8. Milestones (each ends with a working demo + a short DEMO.md for ALFA)

- **M0 — Environment:** ENVIRONMENT.md complete, v4-vs-v3 decision made, repo scaffolded, CI green.
- **M1 — Contracts core:** QuiverRouter + RobinfunGate on testnet, fork tests green, one real pool created end-to-end via `cast`.
- **M2 — Read path:** indexer live; web app shows real Pools list, pool detail w/ candles + recent swaps, brand rename applied. (No writes yet.)
- **M3 — Write path:** wallet connect, Create-pool flow, Swap, Add-liquidity, with the full pending→confirmed toast UX.
- **M4 — Positions & Portfolio:** incl. external-position indexing and Collect/Close.
- **M5 — TP/SL:** executor deployed, keeper running (or Chainlink/Gelato job), arm/cancel/execute demoed on testnet with a forced price move.
- **M6 — Hardening:** invariant tests, Slither clean, AUDIT-NOTES.md, mainnet canary with deposit caps, docs page live.

Work milestone by milestone. After each, stop and produce DEMO.md with what to click. Do not start the next milestone in the same session without being asked.

---

## 9. Out of scope v1 (park these, don't build)
$QVR token + buyback mechanics · limit orders beyond TP/SL · multi-hop exotic routing · analytics dashboards · Strongroom integration hooks (design the events so Strongroom can index them later, nothing more) · mobile app.

## 10. Open questions for ALFA (answer before M1 ships)
1. RobinfunFactory: final address + verification method signature.
2. Treasury multisig signers.
3. Execution fee for TP/SL keepers — 10 bps OK?
4. Final call on name: Quiver ($QVR) confirmed, or stay Aquifer? (Affects M2 rename + domain.)
