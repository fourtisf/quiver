# Quiver — Architecture

> Living document. Seeded at M0; each milestone fills in its section.
> The product spec is `../QUIVER-CLAUDE-CODE-PROMPT.md`; the environment facts
> behind every decision here are in `ENVIRONMENT.md`.

## System overview

```
Robinfun launchpad ──verifies──▶ RobinfunGate ◀──checks── QuiverRouter ──mints──▶ Uniswap position NFT (user wallet)
                                                              │
                                                              ├─ 0.1% deposit fee ──▶ Treasury (Gnosis Safe)
                                                              └─ pool create @ 1% fee tier

TPSLExecutor ◀─scoped NFT approval─ user      keeper bot / automation ──execute()──▶ TPSLExecutor
indexer ◀─events/logs─ chain                  web (Next.js) ◀─typed API─ indexer
```

## Decisions

| # | Decision | Choice | Why | Status |
|---|---|---|---|---|
| D1 | Uniswap v4 vs v3 | **v4** | Spec decision rule §3: canonical v4 IS deployed on mainnet 4663 (PoolManager `0x8366…0951`, three Uniswap-org registries agree). Cheap per-token pools, hooks for TP/SL. v3 (also canonical on-chain) kept compilable as fallback. ⚠ `cast code` preflight in M1 deploy script. | **decided M0** |
| D2 | Indexing engine | **Goldsky subgraph primary, Ponder fallback** | Spec rule resolves to Goldsky: supported (slug `robinhood-mainnet`) and production-proven — Uniswap's own router queries a Goldsky v4 subgraph on this chain. The Graph's Studio isn't enabled for 4663. Revisit only if external-position logic fights the subgraph model. | **decided M0**, re-confirm at M2 kickoff |
| D3 | TP/SL trigger mechanism | **keeper bot required (no hosted automation on chain); v4 afterSwap hook still to be evaluated** | Chainlink Automation and Gelato do NOT support chain 4663 (Data Feeds/Streams do). New M0 finding: **v4 has no built-in oracle — TWAP requires an oracle hook, and hooks are fixed at pool `initialize`**, so Quiver pools must carry our oracle(-capable) hook from M1, whatever M5 decides about trigger checks. | keeper decided M0; hook trade-off due before M5 |
| D4 | TWAP source | v4 oracle hook / v3 `observe`, window ≥ 5 min — never spot | Single-block price manipulation must not trigger executions. | fixed by spec |
| D5 | Fee constants | 1% pool fee tier (LPs), 0.1% deposit fee (treasury), TP/SL execution fee ~10 bps | Spec invariants §2; execution fee awaiting ALFA sign-off (open question §10.3). | fixed / pending §10.3 |

## Trade-off log

### v4 afterSwap hook vs keeper polling for TP/SL (due before M5)
- To be written when D3's hook question is decided. Must cover: gas cost per swap
  for all users vs polling cost, censorship/liveness, MEV exposure of `execute`,
  hook audit surface.
- Fixed input from M0: the pool's hook must exist at creation regardless (oracle
  duty), so the marginal question is only whether trigger *checks* also live in
  afterSwap or stay in the keeper.

### RobinfunGate interface (fixed by upstream source, M0)
- Robinfun's factory has **no `isLaunched()`**; the verification idiom is
  `factory.curveOf(token) != address(0)` (plus `isCurve`, `allTokens`,
  `TokenCreated` event). `RobinfunGate.isRobinfunToken(t)` wraps exactly that.
- Bonding-curve spot for pool init: `curveOf(token) → curve`, `curve.currentPrice()`.
- Robinfun tokens can carry a 0–10% creator levy **in the token itself** —
  fee-on-transfer is the norm; router accounting is balance-diff everywhere.
- Live factory address, betaMode status, and a pinned testnet deployment are
  ALFA's §10.1 answer (candidates in ENVIRONMENT.md §4); M1 uses a mock + the
  interface until confirmed.

## Package notes

- **contracts** — Foundry, Solidity 0.8.26, `evm_version = cancun` (v4 needs
  transient storage; ArbOS on recent Orbit chains supports it — re-verify on
  Robinhood Chain before deploy).
- **indexer** — skeleton only at M0. Entity model per spec §6.
- **web** — Next.js 14 App Router. `design/quiver-prototype.html` is the 1:1 UI
  source of truth (M2). Placeholder page ships the color tokens only.
- **keeper** — skeleton only at M0; loop lands in M5 if no hosted automation.
