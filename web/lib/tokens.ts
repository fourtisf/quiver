import { ADDRESSES } from "./addresses";

export type TokenInfo = {
  /** "native" for ETH, otherwise the 0x address */
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  /** pool depth in USD when known (discovery source) — helps spot clones */
  tvlUsd?: number | null;
};

export const NATIVE_ETH: TokenInfo = {
  address: "native",
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
  logoURI:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23627EEA'/%3E%3Cpath d='M16 5v8.1l6.9 3.1L16 5z' fill='%23fff' fill-opacity='.6'/%3E%3Cpath d='M16 5 9 16.2l7-3.1V5z' fill='%23fff'/%3E%3Cpath d='M16 21.7V27l7-9.7-7 4.4z' fill='%23fff' fill-opacity='.6'/%3E%3Cpath d='M16 27v-5.3l-7-4.4L16 27z' fill='%23fff'/%3E%3Cpath d='m16 20.4 6.9-4.2-6.9-3.1v7.3z' fill='%23fff' fill-opacity='.2'/%3E%3Cpath d='m9 16.2 7 4.2v-7.3l-7 3.1z' fill='%23fff' fill-opacity='.6'/%3E%3C/svg%3E",
};

export const USDG: TokenInfo = {
  address: ADDRESSES.usdg,
  symbol: "USDG",
  name: "Global Dollar",
  decimals: 6,
  logoURI:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%234A7DFF'/%3E%3Ctext x='16' y='21' font-family='Arial' font-size='13' font-weight='bold' fill='white' text-anchor='middle'%3E%24G%3C/text%3E%3C/svg%3E",
};

export const USDE: TokenInfo = {
  address: "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34",
  symbol: "USDe",
  name: "Ethena USDe",
  decimals: 18,
  logoURI:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23101014'/%3E%3Ctext x='16' y='21' font-family='Arial' font-size='12' font-weight='bold' fill='%23E8E8F0' text-anchor='middle'%3EUSDe%3C/text%3E%3C/svg%3E",
};

export const CORE_TOKENS: TokenInfo[] = [NATIVE_ETH, USDG, USDE];

/** Deterministic orb color for the letter-fallback logo (matches prototype). */
export function orbColor(address: string): string {
  let h = 0;
  for (let i = 2; i < Math.min(address.length, 12); i++) {
    h = (h * 31 + address.charCodeAt(i)) % 360;
  }
  return `hsl(${h} 62% 46%)`;
}
