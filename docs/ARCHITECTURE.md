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
| D1 | Uniswap v4 vs v3 | **v4 preferred, pending on-chain confirmation** | Spec decision rule §3; singleton PoolManager, cheap pool creation, hooks for TP/SL. See ENVIRONMENT.md — canonical v4 presence on Robinhood Chain must be confirmed on explorer before M1 code freezes the choice. | open until M1 |
| D2 | Indexing engine | **Ponder self-hosted (default), Goldsky if support confirmed** | See ENVIRONMENT.md §Indexing. Ponder works against any EVM RPC; hosted support for a 3-week-old chain is unconfirmed. | open until M2 |
| D3 | TP/SL trigger mechanism | **keeper bot fallback guaranteed; v4 afterSwap hook to be evaluated** | Spec §5.3 requires documenting hook-vs-keeper trade-offs here before choosing. | open until M5 |
| D4 | TWAP source | v4 oracle hook / v3 `observe`, window ≥ 5 min — never spot | Single-block price manipulation must not trigger executions. | fixed by spec |
| D5 | Fee constants | 1% pool fee tier (LPs), 0.1% deposit fee (treasury), TP/SL execution fee ~10 bps | Spec invariants §2; execution fee awaiting ALFA sign-off (open question §10.3). | fixed / pending §10.3 |

## Trade-off log

### v4 afterSwap hook vs keeper polling for TP/SL (due before M5)
- To be written when D3 is decided. Must cover: gas cost per swap for all users vs
  polling cost, censorship/liveness, MEV exposure of `execute`, hook audit surface.

## Package notes

- **contracts** — Foundry, Solidity 0.8.26, `evm_version = cancun` (v4 needs
  transient storage; ArbOS on recent Orbit chains supports it — re-verify on
  Robinhood Chain before deploy).
- **indexer** — skeleton only at M0. Entity model per spec §6.
- **web** — Next.js 14 App Router. `design/quiver-prototype.html` is the 1:1 UI
  source of truth (M2). Placeholder page ships the color tokens only.
- **keeper** — skeleton only at M0; loop lands in M5 if no hosted automation.
