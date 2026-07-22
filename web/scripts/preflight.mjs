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
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
};

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

console.log(failures === 0 ? "\nPreflight PASSED" : `\nPreflight FAILED (${failures} fatal)`);
process.exit(failures === 0 ? 0 : 1);
