import type { Address } from "viem";
import { ADDRESSES } from "./addresses";
import type { TokenInfo } from "./tokens";

/**
 * Candidate v2 swap paths between two tokens, using WETH and USDG as
 * connectors. The quote step evaluates all of them and picks the best output,
 * so tokens that only have a USDG pool are still swappable.
 */
export function candidatePaths(tokenIn: TokenInfo, tokenOut: TokenInfo): Address[][] {
  const weth = ADDRESSES.weth as Address;
  const usdg = ADDRESSES.usdg as Address;
  const a = (tokenIn.address === "native" ? weth : tokenIn.address) as Address;
  const b = (tokenOut.address === "native" ? weth : tokenOut.address) as Address;
  const eq = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();
  if (eq(a, b)) return []; // wrap/unwrap or identical — not a swap

  const paths: Address[][] = [[a, b]];
  for (const mid of [weth, usdg]) {
    if (!eq(a, mid) && !eq(b, mid)) paths.push([a, mid, b]);
  }
  // two-hop stable/eth bridge for exotic pairs (token↔token via WETH+USDG)
  if (!eq(a, weth) && !eq(a, usdg) && !eq(b, weth) && !eq(b, usdg)) {
    paths.push([a, weth, usdg, b]);
    paths.push([a, usdg, weth, b]);
  }

  const seen = new Set<string>();
  const out: Address[][] = [];
  for (const p of paths) {
    const k = p.map((x) => x.toLowerCase()).join(">");
    if (!seen.has(k)) { seen.add(k); out.push(p); }
  }
  return out;
}
