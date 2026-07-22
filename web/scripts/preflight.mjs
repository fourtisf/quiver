/**
 * On-chain preflight: proves the swap app's assumptions against the LIVE
 * Robinhood Chain RPC. Run in CI (network available) or on any machine:
 *   pnpm --filter @quiver/web preflight
 *
 * Fatal checks (exit 1): chain id, bytecode at router/factory/WETH/USDG,
 * token metadata sanity. Diagnostic checks (warn only): WETH/USDG v2 pair +
 * live quote — that pair's existence is market-dependent, not a code fact.
 */
import { createPublicClient, http, formatUnits, getAddress, parseAbi } from "viem";

const RPC = process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const EXPECTED_CHAIN_ID = 4663;

const ADDRESSES = {
  v2Router02: "0x89e5db8b5aa49aa85ac63f691524311aeb649eba",
  v2Factory: "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f",
  v3SwapRouter02: "0xcaf681a66d020601342297493863e78c959e5cb2",
  v3QuoterV2: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7",
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
};

const V3_FEE_TIERS = [100, 500, 3000, 10000];

const erc20 = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);
const router = parseAbi([
  "function factory() view returns (address)",
  "function WETH() view returns (address)",
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
]);
const factory = parseAbi([
  "function getPair(address, address) view returns (address)",
]);
// QuoterV2.quoteExactInputSingle is nonpayable on-chain but eth_call-able;
// declared view here so viem will read it (matches web/lib/abis.ts).
const quoterV2 = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const client = createPublicClient({
  transport: http(RPC, { retryCount: 5, retryDelay: 1500 }),
});
let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ FAIL  ${msg}`); };
const pass = (msg) => console.log(`  ✓ PASS  ${msg}`);
const warn = (msg) => console.warn(`  ⚠ WARN  ${msg}`);

console.log(`Preflight against ${RPC}\n`);

// 1. chain id
const chainId = await client.getChainId();
chainId === EXPECTED_CHAIN_ID
  ? pass(`chain id ${chainId}`)
  : fail(`chain id ${chainId}, expected ${EXPECTED_CHAIN_ID}`);

// 2. bytecode present at every address the app calls
for (const [name, addr] of Object.entries(ADDRESSES)) {
  const code = await client.getCode({ address: getAddress(addr) });
  code && code !== "0x"
    ? pass(`${name} has bytecode (${(code.length - 2) / 2} bytes) at ${addr}`)
    : fail(`${name} has NO bytecode at ${addr}`);
}

// 3. router self-consistency: its factory/WETH must match our constants
try {
  const [rFactory, rWeth] = await Promise.all([
    client.readContract({ address: ADDRESSES.v2Router02, abi: router, functionName: "factory" }),
    client.readContract({ address: ADDRESSES.v2Router02, abi: router, functionName: "WETH" }),
  ]);
  rFactory.toLowerCase() === ADDRESSES.v2Factory.toLowerCase()
    ? pass(`router.factory() == v2Factory`)
    : fail(`router.factory() = ${rFactory}, expected ${ADDRESSES.v2Factory}`);
  rWeth.toLowerCase() === ADDRESSES.weth.toLowerCase()
    ? pass(`router.WETH() == WETH`)
    : fail(`router.WETH() = ${rWeth}, expected ${ADDRESSES.weth}`);
} catch (e) {
  fail(`router self-check reverted: ${e.shortMessage ?? e.message}`);
}

// 4. token metadata
try {
  const [wSym, uSym, uDec] = await Promise.all([
    client.readContract({ address: ADDRESSES.weth, abi: erc20, functionName: "symbol" }),
    client.readContract({ address: ADDRESSES.usdg, abi: erc20, functionName: "symbol" }),
    client.readContract({ address: ADDRESSES.usdg, abi: erc20, functionName: "decimals" }),
  ]);
  wSym === "WETH" ? pass(`WETH.symbol() == "WETH"`) : fail(`WETH.symbol() == "${wSym}"`);
  uSym === "USDG" ? pass(`USDG.symbol() == "USDG"`) : fail(`USDG.symbol() == "${uSym}"`);
  uDec === 6 ? pass(`USDG.decimals() == 6`) : fail(`USDG.decimals() == ${uDec}, app assumes 6`);
} catch (e) {
  fail(`token metadata read reverted: ${e.shortMessage ?? e.message}`);
}

// 5. diagnostic: WETH/USDG v2 pair + a real quote through the router
try {
  const pair = await client.readContract({
    address: ADDRESSES.v2Factory, abi: factory, functionName: "getPair",
    args: [getAddress(ADDRESSES.weth), getAddress(ADDRESSES.usdg)],
  });
  if (pair === "0x0000000000000000000000000000000000000000") {
    warn(`no WETH/USDG v2 pair — USDG routes will show "No route / liquidity" (expected until one exists)`);
  } else {
    pass(`WETH/USDG v2 pair exists: ${pair}`);
    const amounts = await client.readContract({
      address: ADDRESSES.v2Router02, abi: router, functionName: "getAmountsOut",
      args: [10n ** 18n, [getAddress(ADDRESSES.weth), getAddress(ADDRESSES.usdg)]],
    });
    pass(`LIVE QUOTE via router: 1 WETH = ${formatUnits(amounts[1], 6)} USDG`);
  }
} catch (e) {
  warn(`quote diagnostic failed: ${e.shortMessage ?? e.message}`);
}

// 6. diagnostic: Multicall3 (token discovery) + v2 pair count
try {
  const MC3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
  const code = await client.getCode({ address: MC3 });
  code && code !== "0x"
    ? pass(`Multicall3 deployed at ${MC3} (token discovery uses batched calls)`)
    : warn(`Multicall3 missing at ${MC3} — discovery falls back to capped sequential reads`);
  const pairFactoryAbi = parseAbi(["function allPairsLength() view returns (uint256)"]);
  const nPairs = await client.readContract({
    address: ADDRESSES.v2Factory, abi: pairFactoryAbi, functionName: "allPairsLength",
  });
  pass(`v2 factory reports ${nPairs} pairs (picker discovery source)`);
} catch (e) {
  warn(`discovery diagnostic failed: ${e.shortMessage ?? e.message}`);
}

// 7. diagnostic: Uniswap v3 QuoterV2 answers a live single-hop quote.
// Which fee tier holds WETH/USDG liquidity is market-dependent, so this is a
// warn (not fatal) — the win condition is "at least one tier quotes non-zero",
// proving the v3 router path the SwapCard uses is actually reachable.
try {
  let quoted = false;
  for (const fee of V3_FEE_TIERS) {
    try {
      const [amountOut] = await client.readContract({
        address: ADDRESSES.v3QuoterV2, abi: quoterV2, functionName: "quoteExactInputSingle",
        args: [{
          tokenIn: getAddress(ADDRESSES.weth), tokenOut: getAddress(ADDRESSES.usdg),
          amountIn: 10n ** 18n, fee, sqrtPriceLimitX96: 0n,
        }],
      });
      if (amountOut > 0n) {
        pass(`LIVE v3 QUOTE @ ${fee / 10000}% fee: 1 WETH = ${formatUnits(amountOut, 6)} USDG`);
        quoted = true;
      }
    } catch {
      /* this tier has no pool — try the next */
    }
  }
  if (!quoted) {
    warn(`no WETH/USDG v3 pool at any fee tier — v3 routes appear only for pairs that do (QuoterV2 is live: bytecode checked above)`);
  }
} catch (e) {
  warn(`v3 quote diagnostic failed: ${e.shortMessage ?? e.message}`);
}

console.log(failures === 0 ? "\nPreflight PASSED" : `\nPreflight FAILED (${failures} fatal)`);
process.exit(failures === 0 ? 0 : 1);
