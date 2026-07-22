import { ADDRESSES } from "./addresses";

export type TokenInfo = {
  /** "native" for ETH, otherwise the 0x address */
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  /** true for tokens that came from the Robinfun list */
  robinfun?: boolean;
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

export const CORE_TOKENS: TokenInfo[] = [NATIVE_ETH, USDG];

/**
 * Robinfun public API (read-only market data; see docs/ENVIRONMENT.md §4).
 * The live site is robinfun.live while server code defaults to robinfun.io —
 * the domain split is unresolved upstream, so both hosts are tried in order.
 */
const ROBINFUN_API_HOSTS = process.env.NEXT_PUBLIC_ROBINFUN_API
  ? [process.env.NEXT_PUBLIC_ROBINFUN_API]
  : ["https://robinfun.live/api/v1", "https://robinfun.io/api/v1"];

/* Parse defensively — the public API shape is only known from source, not a
 * fetched spec. Anything unparseable is skipped, never fatal. */
function parseToken(raw: unknown): TokenInfo | null {
  if (typeof raw !== "object" || raw === null) return null;
  const t = raw as Record<string, unknown>;
  const address = [t.contractAddress, t.address, t.token, t.id].find(
    (v): v is string => typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v),
  );
  if (!address) return null;
  const symbol = [t.symbol, t.ticker].find((v): v is string => typeof v === "string") ?? "?";
  const name = [t.name, t.title].find((v): v is string => typeof v === "string") ?? symbol;
  const logoURI = [t.logoURI, t.logo, t.image, t.imageUrl, t.img].find(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  const decimals =
    typeof t.decimals === "number" && Number.isInteger(t.decimals) && t.decimals >= 0 && t.decimals <= 36
      ? t.decimals
      : 18; // Robinfun standard; re-verified on-chain at selection time
  return { address, symbol, name, decimals, logoURI, robinfun: true };
}

export async function fetchRobinfunTokens(): Promise<TokenInfo[]> {
  for (const host of ROBINFUN_API_HOSTS) {
    for (const path of ["/tokens?limit=100", "/tokens"]) {
      try {
        const res = await fetch(`${host}${path}`, { headers: { accept: "application/json" } });
        if (!res.ok) continue;
        const body: unknown = await res.json();
        const list = Array.isArray(body)
          ? body
          : typeof body === "object" && body !== null
            ? ((body as Record<string, unknown>).tokens ??
               (body as Record<string, unknown>).data ??
               (body as Record<string, unknown>).items)
            : null;
        if (!Array.isArray(list)) continue;
        const parsed = list.map(parseToken).filter((t): t is TokenInfo => t !== null);
        if (parsed.length > 0) return parsed;
      } catch {
        // network / CORS / shape problems: fall through to next candidate
      }
    }
  }
  return [];
}

/** Deterministic orb color for the letter-fallback logo (matches prototype). */
export function orbColor(address: string): string {
  let h = 0;
  for (let i = 2; i < Math.min(address.length, 12); i++) {
    h = (h * 31 + address.charCodeAt(i)) % 360;
  }
  return `hsl(${h} 62% 46%)`;
}
