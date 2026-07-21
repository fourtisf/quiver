# ENVIRONMENT — Robinhood Chain (M0 verification)

Verified **2026-07-21** per spec §3. Method note: this session's sandbox blocks
direct HTTPS to most hosts (RPCs, explorers, docs sites all 403 at the egress
proxy), so facts below were verified against **fetchable primary registries** —
`ethereum-lists/chains` (the dataset behind chainlist.org / chainid.network),
Uniswap's own deployment registries (docs source, `Uniswap/contracts`
deployment logs, `sdk-core`), Offchain Labs' Orbit registry — each fact
cross-checked by an independent adversarial pass (26/29 load-bearing claims
confirmed, 0 addresses contradicted). Items that still need a **live** probe
are marked ⚠ with the exact command; run them from any normal machine before
M1 deploys anything.

---

## 1. Chain parameters

| | **Mainnet** | **Testnet** |
|---|---|---|
| Status | Live since **2026-07-01** | Live since **2026-02-10** |
| Chain ID | **4663** | **46630** |
| RPC | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com/rpc` (note the `/rpc` suffix) |
| Explorer | https://robinhoodchain.blockscout.com (Blockscout) | https://explorer.testnet.chain.robinhood.com |
| Faucet | — | https://faucet.testnet.chain.robinhood.com |
| Gas token | ETH (18 dec) | Sepolia ETH |
| Stack | Arbitrum Orbit ("Arbitrum Platform"), settles to **Ethereum L1** (not Arbitrum One), EIP-4844 blob DA | same, settles to Sepolia |
| Sequencer | Operated by Robinhood itself (not a RaaS chain); FCFS ordering, no Timeboost observed | same |
| Block time | ~**100 ms** (medium confidence — see ⚠1) | — |
| Docs | https://docs.robinhood.com/chain (token registry: `/chain/contracts/`, `/chain/protocol-contracts/`) | |

Public RPCs are rate-limited; Robinhood's docs name **Alchemy, QuickNode,
Blockdaemon, dRPC, Validation Cloud** as production providers (Alchemy:
`https://robinhood-mainnet.g.alchemy.com/v2/{key}`, has WebSockets + Debug API).

⚠1 `cast chain-id --rpc-url https://rpc.mainnet.chain.robinhood.com` → expect `4663`;
same for testnet → `46630`. Blocked from this sandbox; registry-attested only.

## 2. Uniswap deployments

**Canonical Uniswap v2 + v3 + v4 (+ UniswapX) are all live on mainnet (4663)**,
deployed ~2026-06-12, recorded in three independent Uniswap-org registries
(docs deployment pages, `Uniswap/contracts` `deployments/4663.md`, `sdk-core`
`ROBINHOOD_ADDRESSES`). **Nothing canonical is deployed on testnet 46630** —
the v4 testnet list and `deployments/46630.md` both come up empty.

### v4 (mainnet 4663)

| Contract | Address |
|---|---|
| **PoolManager** | `0x8366a39cc670b4001a1121b8f6a443a643e40951` |
| PositionManager | `0x58daec3116aae6d93017baaea7749052e8a04fa7` |
| V4Quoter | `0x8dc178efb8111bb0973dd9d722ebeff267c98f94` |
| StateView | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |
| PositionDescriptor | `0x9639443158e8c5efa35bd45287bf2effd3d8dc06` |

### v3 (mainnet 4663)

| Contract | Address |
|---|---|
| UniswapV3Factory | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` |
| NonfungiblePositionManager | `0x73991a25c818bf1f1128deaab1492d45638de0d3` |
| SwapRouter02 | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| QuoterV2 | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| TickLens | `0x7dfd4f31be6814d2906bde155c3e1b146eac1468` |

### Shared

| Contract | Address |
|---|---|
| UniversalRouter (v2/v3/v4) | `0x8876789976decbfcbbbe364623c63652db8c0904` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` (canonical cross-chain) |
| v2 Factory / Router02 | `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f` / `0x89e5db8b5aa49aa85ac63f691524311aeb649eba` |

Caveats: v4 addresses are **not** deterministic across chains (Uniswap docs
warn explicitly; do not copy Ethereum's vanity PoolManager address). A
third-party repo circulates a **wrong** UniversalRouter for 4663 — use the
Uniswap-org value above. UNI governance was voting (July 2026) on activating
protocol fees for v2/v3 on Robinhood Chain — irrelevant to v4 pools but track it.

⚠2 Preflight before M1 deploy: `cast code 0x8366a39cc670b4001a1121b8f6a443a643e40951 --rpc-url <mainnet-rpc>`
(and same for the v3 factory) must return non-empty bytecode.

### ✅ DECISION (spec §3 rule): **Uniswap v4**

v4 is canonically deployed on mainnet → the preference applies. Singleton
PoolManager makes per-token pool creation cheap (important when every Robinfun
graduate gets a pool), and hooks open the afterSwap TP/SL path (D3).
v3 remains a same-chain fallback; the router abstraction in M1 should keep the
v3 path compilable but v4 is the build target.

**Consequences accepted with this decision:**
1. **v4 has no built-in TWAP oracle** — oracles are hooks, and a pool's hook is
   fixed at `initialize` time. Every pool Quiver creates MUST therefore ship
   with our oracle(-capable) hook from day one, or TP/SL (§5.3, TWAP-mandatory)
   can't read manipulation-resistant prices for it. This is now an M1
   requirement, not an M5 nice-to-have. (See ARCHITECTURE.md D3, AUDIT-NOTES A4.)
2. **No canonical Uniswap on testnet 46630** → M1 "testnet" work happens
   against a **mainnet fork** (`forge test --fork-url`), and the live canary is
   a small-caps **mainnet** deploy (M6 already plans caps). If ALFA wants a true
   testnet rehearsal we must deploy our own v4 stack to 46630 alongside a
   Robinfun testnet factory.

## 3. Canonical tokens

| Token | Mainnet (4663) | Testnet (46630) | Notes |
|---|---|---|---|
| **WETH** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | `0x7943e237c7F95DA44E0301572D358911207852Fa` | Arbitrum-bridge child WETH (Offchain Labs Orbit registry `childWeth`), not a predeploy |
| **USDG** (Global Dollar, Paxos, 6 dec) | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | `0x7E955252E15c84f5768B83c41a71F9eba181802F` ⚠3 | First natively-issued stable on the chain; the chain's default DeFi settlement asset; supports EIP-3009 |
| USDe (Ethena, 18 dec) | `0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34` | — | FYI only; not a router pair asset in v1 |
| USDC | **none canonical** | — | Circle lists nothing; approved bridge routes deliver USDC *as USDG*. An unendorsed FiatTokenProxy exists at `0x3884…FeDF` — do not integrate |

Router pair-asset set (spec §5.1) confirmed workable: **WETH, native ETH
(auto-wrap), USDG**. USD pricing (spec §6) routes through USDG as planned —
Uniswap's own v4 indexer config for this chain uses USDG as the stable reference.

⚠3 Testnet USDG is community-attested only (widely used, on-chain checks
reported by third parties, but no official Paxos/Robinhood page fetched;
impostor tokens exist on testnet). Verify `symbol()`/`decimals()` on-chain
before using it in tests.

## 4. RobinfunFactory

**Found — and it's ours.** The full implementation is public at
**`github.com/fourtisf/robinfun`** (same GitHub owner as this repo).

- **Verification interface** (from source): `mapping(address => address) public curveOf`
  — *"Token → its bonding curve. Nonzero iff the token is ours."* Plus
  `isCurve(address)`, `allTokens(uint)` / `allTokensLength()`,
  `predictTokenAddress(creator, vanitySalt)`, and a rich `TokenCreated` event.
  There is **no `isLaunched()`**; the idiom is `factory.curveOf(token) != address(0)`.
  → `RobinfunGate.isRobinfunToken(t)` ≡ `curveOf(t) != 0`. Robinfun's own
  indexer uses exactly this one-line ABI.
- **Candidate mainnet factory:** `0xf0a093bc6ab5bb408ca1f084ec2161d879edaa57`
  (the default in Robinfun's own `server/stats.js` and tradebot config), with
  FeeRouter `0x10343c9f38ca2a4f543318e378f84c58a4bd10d1`. A third-party arb bot
  (July 2026) instead targets a "factory V5" singleton router at
  `0xd861cb5DC71A0171E8F0f6586cADb069f3A35E4d` exposing `curves(token)` +
  `buy(token,…)`/`sell(token,…)` — a *different architecture* (singleton router
  vs per-token EIP-1167 curve clones behind `curveOf`).
- **Memecoin mechanics that hit QuiverRouter (spec §5.1):** fixed 1B supply;
  graduation at ~2.6 ETH collected; **creator levy 0–10% in the token itself =
  fee-on-transfer is the *norm*, not the edge case** — the balance-diff
  accounting in the router spec is mandatory, and quotes must survive levies.
- Bonding-curve spot price for pool init (spec §5.1.3) is readable from the
  curve contract (`currentPrice()`), address via `curveOf(token)`.

**→ ALFA/§10.1 (still open, narrowed):** confirm (a) which address is the
canonical live mainnet factory — team default `0xf0a0…aa57` vs live-observed V5
`0xd861…5E4d`; (b) whether `betaMode` (allowlist gating) is currently on;
(c) a pinned **testnet** factory deployment for fork-free testing (the repo's
bootstrap script deploys a fresh stack per run — no pinned address exists).
M1 builds `RobinfunGate` against the `curveOf` interface with a mock either way.

⚠4 `cast call <factory> "curveOf(address)(address)" <any-robinfun-token> --rpc-url <mainnet-rpc>`
against both candidate addresses settles (a) in one command.

## 5. Keeper / automation

| Provider | Robinhood Chain support | Evidence |
|---|---|---|
| Chainlink **Automation** | **No** — absent from supported-networks; no announcement | medium-high |
| Gelato Automate / Web3 Functions | **No** — zero mentions across Gelato properties | medium |
| Chainlink Data **Feeds / Streams / CCIP** | **Yes, live since mainnet day one** (incl. tokenized-equity feeds) | high |
| OpenZeppelin Relayer / Defender | Workable via custom EVM network config (any-EVM path) | medium |

### ✅ DECISION: **self-run keeper bot** (`/keeper`, spec §5.3 fallback)

No hosted automation network covers the chain, and nothing blocks a self-run
bot: permissionless standard Nitro EVM, FCFS sequencer without fee-priority,
~10 commercial RPC/WSS providers. Trigger price remains the **pool TWAP**
(spec-mandated, never spot); Chainlink Data Streams can serve as an independent
sanity cross-check in the bot, not as the trigger. Re-check hosted support at
M5 kickoff; the chain is young and Gelato takes network requests.

## 6. Indexing

| Option | Support | Evidence |
|---|---|---|
| **Goldsky** | **Yes** — subgraphs + Mirror/Turbo pipelines + RPC, slug `robinhood-mainnet`. Production-proven: **Uniswap's own routing service queries a Goldsky-hosted `uniswap-v4-robinhood-mainnet` subgraph** | high |
| The Graph | In networks registry (Pinax Firehose/Substreams endpoints) but **Subgraph Studio deployment not enabled** (empty `services.subgraphs`, no indexing rewards) | high |
| Ponder | Works as with any EVM chain (self-hosted, needs archive-ish RPC; call-trace indexing needs `debug_trace*` — Alchemy advertises Debug API on this chain) | high |
| Others | Envio HyperIndex/HyperSync, SQD/Subsquid archive, Allium (testnet launch data partner) | medium |

### ✅ DECISION (spec §3 rule): **Goldsky subgraph** primary, **Ponder** fallback

The spec's rule ("Goldsky/The Graph if supported, else Ponder") resolves to
Goldsky — and it's the same infrastructure Uniswap itself runs on for this
chain, which de-risks v4 entity indexing significantly. Ponder remains the
fallback if Goldsky pricing/limits or the custom external-position logic (spec
§6) fight the subgraph model; revisit at M2 kickoff before wiring `/indexer`.
Note: Goldsky's *testnet* slug is unconfirmed — consistent with everything else
pointing M1/M2 at mainnet-fork + mainnet-canary rather than testnet.

## 7. Open items ledger

| # | Item | Owner | Blocking |
|---|---|---|---|
| ⚠1 | Live `cast chain-id` probes (both networks) | Michael (any non-sandboxed machine) | nothing (registry-attested) |
| ⚠2 | `cast code` preflight on PoolManager + v3 factory | M1 deploy script (automate it) | M1 deploy |
| ⚠3 | On-chain check of testnet USDG | M1 tests if testnet used | testnet path only |
| ⚠4 | Canonical live Robinfun factory address + betaMode + testnet deployment | **ALFA** (spec §10.1) | M1 ship (mock unblocks build) |
| — | Treasury multisig signers (spec §10.2) | ALFA | M1 ship |
| — | TP/SL execution fee 10 bps sign-off (spec §10.3) | ALFA | M5 |
| — | Name confirmation Quiver/$QVR (spec §10.4) | ALFA | M2 rename |
| — | WebSocket RPC URLs + public-RPC rate limits | M2 (pick provider) | indexer freshness target |

## 8. Primary sources

- `ethereum-lists/chains` `eip155-4663.json` / `eip155-46630.json` (chain params)
- Uniswap docs deployment pages + `Uniswap/contracts` `deployments/4663.md` + `sdk-core` `ROBINHOOD_ADDRESSES` (all Uniswap addresses)
- Offchain Labs `arbitrum-portal` Orbit registry (`childWeth`, bridge gateways)
- MetaMask `contract-metadata`, Chainlink CCIP configs, L2BEAT (token cross-checks)
- `github.com/fourtisf/robinfun` (factory interface, economics, candidate addresses)
- `graphprotocol/networks-registry`, `ponder-sh/ponder` docs, Goldsky chain page + `Uniswap/uniroute-public` (indexing)
- Robinhood newsroom / Arbitrum blog / Blockscout blog (launch facts, via search snippets — direct fetches proxy-blocked)
