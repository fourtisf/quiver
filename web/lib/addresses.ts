/**
 * Canonical addresses on Robinhood Chain mainnet (4663).
 * Source: docs/ENVIRONMENT.md §2–§3 (Uniswap-org registries, Orbit registry).
 * Robinfun tokens graduate into Uniswap v2 WETH pools, so the live swap path
 * uses the v2 Router02; Hoodpool's own v4 router arrives with M1.
 */
export const ADDRESSES = {
  v2Router02: "0x89e5db8b5aa49aa85ac63f691524311aeb649eba",
  v2Factory: "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f",
  // Uniswap v3 (docs/ENVIRONMENT.md §2) — for big-cap tokens whose liquidity is on v3
  v3SwapRouter02: "0xcaf681a66d020601342297493863e78c959e5cb2",
  v3QuoterV2: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7",
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
} as const;

export const EXPLORER = "https://robinhoodchain.blockscout.com";
