# @quiver/contracts

Foundry package for the Quiver core contracts (spec: repo root `QUIVER-CLAUDE-CODE-PROMPT.md` §5).

| Contract | Milestone | Status |
|---|---|---|
| `QuiverRouter` — zap + deposit entry point | M1 | not started |
| `RobinfunGate` — launch-factory check | M1 | **written + tested** (deploy awaits factory address, ALFA ⚠4) |
| `TPSLExecutor` — non-custodial take-profit / stop-loss | M5 | not started |
| `Treasury` — Gnosis Safe (no custom code v1) | M1 | not started |

```bash
forge build
forge test
```

M0 ships only a dependency-free sanity test so CI proves the toolchain.
forge-std and the Uniswap interfaces come in with M1.
