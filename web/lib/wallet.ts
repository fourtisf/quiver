import type { Address, PublicClient } from "viem";
import { formatUnits } from "viem";
import { erc20Abi } from "./abis";
import { ADDRESSES } from "./addresses";
import { USDE, USDG, type TokenInfo } from "./tokens";
import type { PoolInfo } from "./discover";

const lpAbi = [
  ...erc20Abi,
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export type LpPosition = {
  pool: PoolInfo;
  lpBalance: bigint;
  sharePct: number;
  underlyingToken: bigint;
  underlyingWeth: bigint;
  valueUsd: number | null;
};

/** Wallet's v2 LP positions across the discovered pools. */
export async function fetchLpPositions(
  client: PublicClient,
  owner: Address,
  pools: PoolInfo[],
  ethUsd: number | null,
): Promise<LpPosition[]> {
  if (pools.length === 0) return [];
  const res = await client.multicall({
    contracts: pools.flatMap((p) => [
      { address: p.pair, abi: lpAbi, functionName: "balanceOf" as const, args: [owner] as const },
      { address: p.pair, abi: lpAbi, functionName: "totalSupply" as const },
    ]),
    allowFailure: true,
  });
  const out: LpPosition[] = [];
  for (let i = 0; i < pools.length; i++) {
    const bal = res[i * 2], sup = res[i * 2 + 1];
    if (bal?.status !== "success" || sup?.status !== "success") continue;
    const lpBalance = bal.result as bigint;
    const totalSupply = sup.result as bigint;
    if (lpBalance === 0n || totalSupply === 0n) continue;
    const p = pools[i];
    const underlyingToken = (p.reserveToken * lpBalance) / totalSupply;
    const underlyingWeth = (p.reserveWeth * lpBalance) / totalSupply;
    const sharePct = Number((lpBalance * 1_000_000n) / totalSupply) / 10_000;
    const valueUsd = ethUsd !== null ? 2 * Number(formatUnits(underlyingWeth, 18)) * ethUsd : null;
    out.push({ pool: p, lpBalance, sharePct, underlyingToken, underlyingWeth, valueUsd });
  }
  return out.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
}

export type Holding = {
  token: TokenInfo;
  balance: bigint;
  valueUsd: number | null;
};

/** ETH + stables + every discovered token with a nonzero balance. */
export async function fetchHoldings(
  client: PublicClient,
  owner: Address,
  pools: PoolInfo[],
  ethUsd: number | null,
): Promise<Holding[]> {
  const ethBal = await client.getBalance({ address: owner });
  const holdings: Holding[] = [];
  if (ethBal > 0n) {
    holdings.push({
      token: { address: "native", symbol: "ETH", name: "Ether", decimals: 18 },
      balance: ethBal,
      valueUsd: ethUsd !== null ? Number(formatUnits(ethBal, 18)) * ethUsd : null,
    });
  }

  const priced: Array<{ token: TokenInfo; priceUsd: number | null }> = [
    { token: { ...USDG }, priceUsd: 1 },
    { token: { ...USDE }, priceUsd: 1 },
    { token: { address: ADDRESSES.weth, symbol: "WETH", name: "Wrapped Ether", decimals: 18 }, priceUsd: ethUsd },
    ...pools.map((p) => ({ token: p.token, priceUsd: p.priceUsd })),
  ];

  const res = await client.multicall({
    contracts: priced.map((x) => ({
      address: x.token.address as Address, abi: erc20Abi, functionName: "balanceOf" as const, args: [owner] as const,
    })),
    allowFailure: true,
  });
  for (let i = 0; i < priced.length; i++) {
    const r = res[i];
    if (r?.status !== "success") continue;
    const balance = r.result as bigint;
    if (balance === 0n) continue;
    const { token, priceUsd } = priced[i];
    holdings.push({
      token,
      balance,
      valueUsd: priceUsd !== null ? Number(formatUnits(balance, token.decimals)) * priceUsd : null,
    });
  }
  return holdings.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
}
