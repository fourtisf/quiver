import type { Address, PublicClient } from "viem";
import { erc20Abi, v2FactoryAbi, v2PairAbi } from "./abis";
import { ADDRESSES } from "./addresses";
import type { TokenInfo } from "./tokens";

/**
 * On-chain token discovery: enumerate the newest Uniswap v2 pairs straight
 * from the factory, keep every pair quoted against WETH, and resolve the
 * counter-token's metadata. No indexer, no API — if it trades, it shows up.
 */

const MAX_PAIRS = 400; // newest N pairs scanned
const CACHE_KEY = "hoodpool.discovered.v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

type Cached = { at: number; tokens: TokenInfo[] };

function readCache(): TokenInfo[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (Date.now() - c.at > CACHE_TTL_MS) return null;
    return c.tokens;
  } catch {
    return null;
  }
}

function writeCache(tokens: TokenInfo[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), tokens } satisfies Cached));
  } catch {
    /* storage full/blocked — fine */
  }
}

export async function discoverOnchainTokens(client: PublicClient): Promise<TokenInfo[]> {
  const cached = readCache();
  if (cached) return cached;

  const weth = ADDRESSES.weth.toLowerCase();
  const factory = ADDRESSES.v2Factory as Address;

  const length = Number(
    await client.readContract({ address: factory, abi: v2FactoryAbi, functionName: "allPairsLength" }),
  );
  if (!length) return [];

  const from = Math.max(0, length - MAX_PAIRS);
  const indexes = Array.from({ length: length - from }, (_, i) => BigInt(from + i));

  // 1) pair addresses (multicall with graceful sequential fallback)
  let pairs: Address[];
  try {
    const res = await client.multicall({
      contracts: indexes.map((i) => ({
        address: factory, abi: v2FactoryAbi, functionName: "allPairs" as const, args: [i] as const,
      })),
      allowFailure: true,
    });
    pairs = res.filter((r) => r.status === "success").map((r) => r.result as Address);
  } catch {
    // no Multicall3 on chain: cap the sequential scan to stay polite to the RPC
    const capped = indexes.slice(-40);
    pairs = [];
    for (const i of capped) {
      try {
        pairs.push(
          await client.readContract({ address: factory, abi: v2FactoryAbi, functionName: "allPairs", args: [i] }),
        );
      } catch {
        break;
      }
    }
  }
  if (pairs.length === 0) return [];

  // 2) token0/token1 per pair
  const sides = await client.multicall({
    contracts: pairs.flatMap((p) => [
      { address: p, abi: v2PairAbi, functionName: "token0" as const },
      { address: p, abi: v2PairAbi, functionName: "token1" as const },
    ]),
    allowFailure: true,
  }).catch(() => null);
  if (!sides) return [];

  const counters = new Set<string>();
  for (let i = 0; i < pairs.length; i++) {
    const t0 = sides[i * 2], t1 = sides[i * 2 + 1];
    if (t0?.status !== "success" || t1?.status !== "success") continue;
    const a = (t0.result as string).toLowerCase();
    const b = (t1.result as string).toLowerCase();
    if (a === weth && b !== weth) counters.add(b);
    else if (b === weth && a !== weth) counters.add(a);
  }
  counters.delete(ADDRESSES.usdg.toLowerCase()); // core token, already listed
  const addrs = [...counters] as Address[];
  if (addrs.length === 0) return [];

  // 3) metadata (symbol/name/decimals) — tokens with reverting metadata are skipped
  const meta = await client.multicall({
    contracts: addrs.flatMap((a) => [
      { address: a, abi: erc20Abi, functionName: "symbol" as const },
      { address: a, abi: erc20Abi, functionName: "name" as const },
      { address: a, abi: erc20Abi, functionName: "decimals" as const },
    ]),
    allowFailure: true,
  }).catch(() => null);
  if (!meta) return [];

  const tokens: TokenInfo[] = [];
  for (let i = 0; i < addrs.length; i++) {
    const sym = meta[i * 3], nam = meta[i * 3 + 1], dec = meta[i * 3 + 2];
    if (sym?.status !== "success" || dec?.status !== "success") continue;
    tokens.push({
      address: addrs[i],
      symbol: String(sym.result).slice(0, 12),
      name: nam?.status === "success" ? String(nam.result).slice(0, 48) : String(sym.result),
      decimals: Number(dec.result),
    });
  }

  // newest pools first (enumeration order was oldest->newest within the window)
  tokens.reverse();
  writeCache(tokens);
  return tokens;
}
