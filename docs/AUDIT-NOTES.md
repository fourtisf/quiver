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
