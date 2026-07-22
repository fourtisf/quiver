import type { Address, PublicClient } from "viem";
import { quoterV2Abi, v2RouterAbi } from "./abis";
import { ADDRESSES } from "./addresses";
import { candidatePaths } from "./routes";
import type { TokenInfo } from "./tokens";

/** Best swap route across Uniswap v2 and v3 for a given input amount. */
export type Route =
  | { kind: "v2"; path: Address[]; amountOut: bigint }
  | { kind: "v3"; tokenIn: Address; tokenOut: Address; fee: number; amountOut: bigint };

const V3_FEE_TIERS = [100, 500, 3000, 10000] as const;

/** Which router must be approved to spend the input token for this route. */
export function spenderFor(route: Route): Address {
  return (route.kind === "v3" ? ADDRESSES.v3SwapRouter02 : ADDRESSES.v2Router02) as Address;
}

export function routeLabel(route: Route | undefined, inSym: string, outSym: string): string {
  if (!route) return "—";
  if (route.kind === "v3") return `Uniswap v3 · ${route.fee / 10000}%`;
  if (route.path.length === 2) return "v2 · direct";
  const weth = ADDRESSES.weth.toLowerCase(), usdg = ADDRESSES.usdg.toLowerCase();
  const mids = route.path.slice(1, -1).map((a) =>
    a.toLowerCase() === weth ? "WETH" : a.toLowerCase() === usdg ? "USDG" : "…");
  return `v2 · ${inSym} → ${mids.join(" → ")} → ${outSym}`;
}

/**
 * Quote every candidate route (v2 multi-hop paths + v3 single-hop at each fee
 * tier) in one multicall and return the one with the largest output.
 */
export async function bestRoute(
  client: PublicClient,
  amountIn: bigint,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
): Promise<Route | null> {
  const weth = ADDRESSES.weth as Address;
  const a = (tokenIn.address === "native" ? weth : tokenIn.address) as Address;
  const b = (tokenOut.address === "native" ? weth : tokenOut.address) as Address;
  if (a.toLowerCase() === b.toLowerCase()) return null; // wrap/unwrap, not a swap

  const v2paths = candidatePaths(tokenIn, tokenOut);
  const v2Calls = v2paths.map((p) => ({
    address: ADDRESSES.v2Router02 as Address,
    abi: v2RouterAbi,
    functionName: "getAmountsOut" as const,
    args: [amountIn, p] as const,
  }));
  const v3Calls = V3_FEE_TIERS.map((fee) => ({
    address: ADDRESSES.v3QuoterV2 as Address,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle" as const,
    args: [{ tokenIn: a, tokenOut: b, amountIn, fee, sqrtPriceLimitX96: 0n }] as const,
  }));

  const res = await client.multicall({
    contracts: [...v2Calls, ...v3Calls] as never,
    allowFailure: true,
  }) as Array<{ status: "success" | "failure"; result?: unknown }>;

  let best: Route | null = null;
  const better = (out: bigint) => out > 0n && (best === null || out > best.amountOut);

  for (let i = 0; i < v2paths.length; i++) {
    const r = res[i];
    if (r.status !== "success") continue;
    const amts = r.result as readonly bigint[];
    const out = amts[amts.length - 1];
    if (better(out)) best = { kind: "v2", path: v2paths[i], amountOut: out };
  }
  for (let j = 0; j < V3_FEE_TIERS.length; j++) {
    const r = res[v2paths.length + j];
    if (r.status !== "success") continue;
    const out = (r.result as readonly [bigint, bigint, number, bigint])[0];
    if (better(out)) best = { kind: "v3", tokenIn: a, tokenOut: b, fee: V3_FEE_TIERS[j], amountOut: out };
  }
  return best;
}
