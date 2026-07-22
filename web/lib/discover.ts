import type { Address, PublicClient } from "viem";
import { formatUnits } from "viem";
import { erc20Abi, v2FactoryAbi, v2PairAbi } from "./abis";
import { ADDRESSES } from "./addresses";
import type { TokenInfo } from "./tokens";

/**
 * On-chain discovery: enumerate the newest Uniswap v2 pairs straight from the
 * factory, keep every WETH-quoted pair, resolve counter-token metadata and
 * reserves. Powers the token picker, the Pools page, Positions and Portfolio —
 * no indexer, no API. ETH/USD comes from the WETH/USDG pair.
 */

export type PoolInfo = {
  pair: Address;
  token: TokenInfo;
  reserveToken: bigint;
  reserveWeth: bigint;
  /** null when ETH/USD is unavailable */
  tvlUsd: number | null;
  priceUsd: number | null;
};

export type PoolsSnapshot = {
  at: number;
  ethUsd: number | null;
  pools: PoolInfo[];
  scannedPairs: number;
};

const MAX_PAIRS = 400;
const META_TOP = 150; // metadata fetched for the deepest N pools
const CACHE_KEY = "hoodpool.pools.v2";
const CACHE_TTL_MS = 5 * 60 * 1000;

type Persisted = {
  at: number;
  ethUsd: number | null;
  scannedPairs: number;
  pools: Array<{ pair: string; token: TokenInfo; reserveToken: string; reserveWeth: string }>;
};

function readCache(): PoolsSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    if (Date.now() - p.at > CACHE_TTL_MS) return null;
    return {
      at: p.at,
      ethUsd: p.ethUsd,
      scannedPairs: p.scannedPairs,
      pools: p.pools.map((x) => finalizePool({
        pair: x.pair as Address,
        token: x.token,
        reserveToken: BigInt(x.reserveToken),
        reserveWeth: BigInt(x.reserveWeth),
      }, p.ethUsd)),
    };
  } catch {
    return null;
  }
}

function writeCache(s: PoolsSnapshot) {
  try {
    const p: Persisted = {
      at: s.at,
      ethUsd: s.ethUsd,
      scannedPairs: s.scannedPairs,
      pools: s.pools.map((x) => ({
        pair: x.pair, token: x.token,
        reserveToken: x.reserveToken.toString(), reserveWeth: x.reserveWeth.toString(),
      })),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(p));
  } catch { /* storage blocked — fine */ }
}

function finalizePool(
  base: { pair: Address; token: TokenInfo; reserveToken: bigint; reserveWeth: bigint },
  ethUsd: number | null,
): PoolInfo {
  let tvlUsd: number | null = null;
  let priceUsd: number | null = null;
  if (ethUsd !== null && base.reserveWeth > 0n) {
    const weth = Number(formatUnits(base.reserveWeth, 18));
    tvlUsd = 2 * weth * ethUsd;
    const tok = Number(formatUnits(base.reserveToken, base.token.decimals));
    if (tok > 0) priceUsd = (weth * ethUsd) / tok;
  }
  return { ...base, tvlUsd, priceUsd };
}

/** Spot ETH/USD from the WETH/USDG v2 pair (module-cached 60s). */
let ethUsdCache: { at: number; value: number | null } | null = null;
export async function getEthUsd(client: PublicClient): Promise<number | null> {
  if (ethUsdCache && Date.now() - ethUsdCache.at < 60_000) return ethUsdCache.value;
  let value: number | null = null;
  try {
    const pair = await client.readContract({
      address: ADDRESSES.v2Factory as Address, abi: v2FactoryAbi, functionName: "getPair",
      args: [ADDRESSES.weth as Address, ADDRESSES.usdg as Address],
    });
    if (pair !== "0x0000000000000000000000000000000000000000") {
      const [reserves, token0] = await Promise.all([
        client.readContract({ address: pair, abi: v2PairAbi, functionName: "getReserves" }),
        client.readContract({ address: pair, abi: v2PairAbi, functionName: "token0" }),
      ]);
      const wethIs0 = token0.toLowerCase() === ADDRESSES.weth.toLowerCase();
      const rWeth = Number(formatUnits(wethIs0 ? reserves[0] : reserves[1], 18));
      const rUsdg = Number(formatUnits(wethIs0 ? reserves[1] : reserves[0], 6));
      if (rWeth > 0) value = rUsdg / rWeth;
    }
  } catch { /* leave null */ }
  ethUsdCache = { at: Date.now(), value };
  return value;
}

let inflight: Promise<PoolsSnapshot> | null = null;

export async function discoverPools(client: PublicClient, force = false): Promise<PoolsSnapshot> {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  if (inflight) return inflight;
  inflight = scan(client).finally(() => { inflight = null; });
  return inflight;
}

async function scan(client: PublicClient): Promise<PoolsSnapshot> {
  const weth = ADDRESSES.weth.toLowerCase();
  const factory = ADDRESSES.v2Factory as Address;

  const [ethUsd, lengthBn] = await Promise.all([
    getEthUsd(client),
    client.readContract({ address: factory, abi: v2FactoryAbi, functionName: "allPairsLength" }),
  ]);
  const length = Number(lengthBn);
  const empty: PoolsSnapshot = { at: Date.now(), ethUsd, pools: [], scannedPairs: 0 };
  if (!length) return empty;

  const from = Math.max(0, length - MAX_PAIRS);
  const indexes = Array.from({ length: length - from }, (_, i) => BigInt(from + i));

  // 1) pair addresses
  let pairs: Address[] = [];
  try {
    const res = await client.multicall({
      contracts: indexes.map((i) => ({
        address: factory, abi: v2FactoryAbi, functionName: "allPairs" as const, args: [i] as const,
      })),
      allowFailure: true,
    });
    pairs = res.filter((r) => r.status === "success").map((r) => r.result as Address);
  } catch {
    for (const i of indexes.slice(-40)) {
      try {
        pairs.push(await client.readContract({ address: factory, abi: v2FactoryAbi, functionName: "allPairs", args: [i] }));
      } catch { break; }
    }
  }
  if (pairs.length === 0) return empty;

  // 2) token0 / token1 / reserves per pair
  const detail = await client.multicall({
    contracts: pairs.flatMap((p) => [
      { address: p, abi: v2PairAbi, functionName: "token0" as const },
      { address: p, abi: v2PairAbi, functionName: "token1" as const },
      { address: p, abi: v2PairAbi, functionName: "getReserves" as const },
    ]),
    allowFailure: true,
  }).catch(() => null);
  if (!detail) return empty;

  type Raw = { pair: Address; tokenAddr: string; reserveToken: bigint; reserveWeth: bigint };
  const raw: Raw[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const t0 = detail[i * 3], t1 = detail[i * 3 + 1], rs = detail[i * 3 + 2];
    if (t0?.status !== "success" || t1?.status !== "success" || rs?.status !== "success") continue;
    const a = (t0.result as string).toLowerCase();
    const b = (t1.result as string).toLowerCase();
    const [r0, r1] = rs.result as readonly [bigint, bigint, number];
    if (a === weth && b !== weth) raw.push({ pair: pairs[i], tokenAddr: b, reserveToken: r1, reserveWeth: r0 });
    else if (b === weth && a !== weth) raw.push({ pair: pairs[i], tokenAddr: a, reserveToken: r0, reserveWeth: r1 });
  }
  // dedup by token, keep deepest pool; drop the USDG pricing pair from listings
  const byToken = new Map<string, Raw>();
  for (const r of raw) {
    if (r.tokenAddr === ADDRESSES.usdg.toLowerCase()) continue;
    const prev = byToken.get(r.tokenAddr);
    if (!prev || r.reserveWeth > prev.reserveWeth) byToken.set(r.tokenAddr, r);
  }
  const ranked = [...byToken.values()].sort((x, y) => (y.reserveWeth > x.reserveWeth ? 1 : -1));
  const top = ranked.slice(0, META_TOP);
  if (top.length === 0) return { ...empty, scannedPairs: pairs.length };

  // 3) metadata for the deepest pools
  const meta = await client.multicall({
    contracts: top.flatMap((r) => [
      { address: r.tokenAddr as Address, abi: erc20Abi, functionName: "symbol" as const },
      { address: r.tokenAddr as Address, abi: erc20Abi, functionName: "name" as const },
      { address: r.tokenAddr as Address, abi: erc20Abi, functionName: "decimals" as const },
    ]),
    allowFailure: true,
  }).catch(() => null);
  if (!meta) return { ...empty, scannedPairs: pairs.length };

  const pools: PoolInfo[] = [];
  for (let i = 0; i < top.length; i++) {
    const sym = meta[i * 3], nam = meta[i * 3 + 1], dec = meta[i * 3 + 2];
    if (sym?.status !== "success" || dec?.status !== "success") continue;
    pools.push(finalizePool({
      pair: top[i].pair,
      token: {
        address: top[i].tokenAddr,
        symbol: String(sym.result).slice(0, 12),
        name: nam?.status === "success" ? String(nam.result).slice(0, 48) : String(sym.result),
        decimals: Number(dec.result),
      },
      reserveToken: top[i].reserveToken,
      reserveWeth: top[i].reserveWeth,
    }, ethUsd));
  }

  const snapshot: PoolsSnapshot = { at: Date.now(), ethUsd, pools, scannedPairs: pairs.length };
  writeCache(snapshot);
  return snapshot;
}

/** Token list for the picker — deepest liquidity first. */
export async function discoverOnchainTokens(client: PublicClient): Promise<TokenInfo[]> {
  const snap = await discoverPools(client);
  return snap.pools.map((p) => p.token);
}
