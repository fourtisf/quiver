# Audit notes

Running list of audit-worthy surfaces, flagged as we build (spec §5.5). ALFA
books an external audit against this list before real TVL.

| # | Flagged at | Surface | Concern |
|---|---|---|---|
| A1 | M0 | RobinfunGate ↔ RobinfunFactory trust boundary | The gate's launch check is the only listing control. Its verification method (open question §10.1) must be a factory-immutable fact, not a mutable registry an attacker or admin can write to. |
| A2 | M0 | Fee-on-transfer / rebasing memecoins in QuiverRouter | Balance-diff accounting required on every transfer in/out; reconciliation tolerance must be tight enough that it can't be farmed. |
| A3 | M0 | TPSLExecutor approval scope | Position-manager `approve(executor, tokenId)` is per-token but a malicious executor upgrade path must not exist (immutability invariant §2.4). Cancel-on-revoke semantics need an explicit test. |
| A4 | M0 | TWAP window vs 100 ms block times | Robinhood Chain blocks are ~100 ms — a "5 minute" TWAP is ~3000 blocks, not ~25. Observation cardinality / oracle hook buffer sizing must be validated for this block cadence, or TWAP reads may fail or shorten silently. |
| A5 | M0 | Pool initialization price | `createAndDeposit` initializes price from Robinfun's bonding curve or caller input with "sanity bounds" — those bounds are a manipulation surface for the first LP; define them adversarially in M1. |
| A6 | M0 | v4 oracle hook is load-bearing from day one | v4 has no native TWAP; our oracle hook is fixed at pool `initialize` and can never be swapped. A bug in it is permanent per pool and TP/SL depends on it entirely — highest-priority audit target. |
| A7 | M0 | Creator levy (fee-on-transfer) is the norm, not the edge | Robinfun tokens carry 0–10% transfer levies configured per token. A2's balance-diff accounting must be tested against every levy step (0–10% in 0.5% increments), including levy-changes-mid-flight if the token allows it. |

## Web app audit — 2026-07-22 (swap beta)

33-agent review (5 dimensions + adversarial verification): 28 raw findings,
27 confirmed after verification (~17 unique). All actionable ones fixed in the
same pass; highlights worth remembering:

- **Slippage vs levy (high):** presets capped at 3% while Robinfun levies go to
  10% — levy>3% tokens were deterministically unswappable. Fixed with a custom
  slippage input + per-token levy warning in the quote panel.
- **Robinfun API host (high):** default host was the unverified robinfun.io;
  now tries robinfun.live then robinfun.io (env-overridable). Still unresolved
  upstream (domain split, ENVIRONMENT.md §4).
- **Quote overstates receipt for levy tokens (medium):** `getAmountsOut`
  cannot see transfer taxes; UI now warns per-token. A true post-levy quote
  needs the factory levy read — arrives with M1's RobinfunGate.
- **On-chain preflight (CI job `preflight`)** proves chain id, bytecode at
  router/factory/WETH/USDG, router self-consistency, USDG decimals, and a live
  router quote on every push. First run: `1 WETH = 1918.151652 USDG` via the
  real WETH/USDG pair 0x8803c117ccae7B5146297876c2A25DF135141C4d.
- Remaining accepted gaps: no graduation check for curve-stage tokens (needs
  the RobinfunFactory address — ALFA ⚠4; UI shows "No pool yet" honestly), no
  focus trap in the token modal, WalletConnect QR needs a real projectId.
