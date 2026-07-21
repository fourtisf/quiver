# Quiver

**The liquidity layer for Robinfun tokens on Robinhood Chain.**

Launch on Robinfun → deploy liquidity on Quiver → lock LP in Strongroom.

Quiver is a non-custodial liquidity venue: any token launched on Robinfun gets a
one-click Uniswap pool, LPs earn 1% of every swap, and holders get on-chain
take-profit / stop-loss plus live PnL for every position they own — including
positions opened outside Quiver.

## Repo layout

| Package | What it is |
|---|---|
| [`/contracts`](contracts) | Foundry — Solidity 0.8.x router, gate, TP/SL executor, tests, deploy scripts |
| [`/indexer`](indexer) | Pools, swaps, positions, candles → typed API for the web app |
| [`/web`](web) | Next.js 14 App Router + TypeScript + Tailwind + wagmi v2/viem |
| [`/keeper`](keeper) | TypeScript bot (viem) — TP/SL execution fallback |
| [`/design`](design) | `quiver-prototype.html` — the single source of truth for UI/UX/copy |
| [`/docs`](docs) | [`ENVIRONMENT.md`](docs/ENVIRONMENT.md), [`ARCHITECTURE.md`](docs/ARCHITECTURE.md), runbooks |

The full product spec lives in [`QUIVER-CLAUDE-CODE-PROMPT.md`](QUIVER-CLAUDE-CODE-PROMPT.md).
Milestone status and demo instructions live in [`DEMO.md`](DEMO.md).

## Getting started

```bash
pnpm install          # workspace deps (web, indexer, keeper)
pnpm build            # build all packages
pnpm typecheck        # typecheck all packages

cd contracts
forge build           # requires Foundry — https://getfoundry.sh
forge test
```

Open `design/quiver-prototype.html` in a browser to see the design prototype.

## Product invariants (v1)

1. **Robinfun-gated** — tokens list only if they verify on-chain against the RobinfunFactory.
2. **1% swap fee tier** to LPs; protocol takes **0.1% of deposits** to the treasury. Nothing else.
3. **Non-custodial** — positions are standard Uniswap position NFTs in the user's wallet.
4. **Immutable** — no owner, no admin keys, no upgrade hooks on core contracts.
5. **Single-transaction UX** — verify → create pool → zap → mint → fee, one tx.
6. **TP/SL is non-custodial** — scoped, revocable approval; the position never leaves the wallet.
