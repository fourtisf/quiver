import { ADDRESSES } from "./addresses";
import type { TokenInfo } from "./tokens";

/**
 * Top tokens on Robinhood Chain from GeckoTerminal's top-pools endpoint —
 * this covers ALL DEX versions (v2/v3/v4), so the big-cap tokens whose
 * liquidity lives on Uniswap v3 show up in the picker like they do on Uniswap.
 * Public, keyless, CORS-open. Results cached 10 min.
 */

const NETWORK = "robinhood";
const PAGES = 5;
const CACHE_KEY = "hoodpool.gecko.tokens.v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

type Ranked = TokenInfo & { tvlUsd: number };

function readCache(): TokenInfo[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { at: number; tokens: TokenInfo[] };
    if (Date.now() - c.at > CACHE_TTL_MS) return null;
    return c.tokens;
  } catch {
    return null;
  }
}
function writeCache(tokens: TokenInfo[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), tokens })); } catch { /* ok */ }
}

type GtToken = { attributes?: { address?: string; name?: string; symbol?: string; decimals?: number; image_url?: string } };
type GtPool = {
  attributes?: { reserve_in_usd?: string; market_cap_usd?: string | null; fdv_usd?: string | null };
  relationships?: Record<string, { data?: { id?: string } }>;
};

let inflight: Promise<TokenInfo[]> | null = null;

export async function fetchTopTokens(): Promise<TokenInfo[]> {
  const cached = readCache();
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = scan().finally(() => { inflight = null; });
  return inflight;
}

async function scan(): Promise<TokenInfo[]> {
  const stables = new Set(
    [ADDRESSES.weth, ADDRESSES.usdg, "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34"].map((a) => a.toLowerCase()),
  );
  const byAddr = new Map<string, Ranked>();

  for (let page = 1; page <= PAGES; page++) {
    let body: { data?: GtPool[]; included?: GtToken[] } | null = null;
    try {
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/${NETWORK}/pools?include=base_token,quote_token&page=${page}`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) break;
      body = await res.json();
    } catch {
      break;
    }
    const tokens = new Map<string, NonNullable<GtToken["attributes"]>>();
    for (const inc of body?.included ?? []) {
      const t = inc as { id?: string; type?: string; attributes?: GtToken["attributes"] };
      if (t.type === "token" && t.id && t.attributes) tokens.set(t.id, t.attributes);
    }
    for (const pool of body?.data ?? []) {
      const tvl = Number(pool.attributes?.reserve_in_usd ?? 0);
      // market cap belongs to the pool's BASE token (fall back to FDV)
      const mcRaw = pool.attributes?.market_cap_usd ?? pool.attributes?.fdv_usd;
      const poolMcap = mcRaw != null && Number.isFinite(Number(mcRaw)) && Number(mcRaw) > 0 ? Number(mcRaw) : null;
      for (const side of ["base_token", "quote_token"]) {
        const id = pool.relationships?.[side]?.data?.id;
        const attr = id ? tokens.get(id) : undefined;
        if (!attr?.address) continue;
        const addr = attr.address.toLowerCase();
        if (stables.has(addr)) continue;
        if (/^0x0+$/.test(addr)) continue; // native/placeholder address, not a real ERC20
        const thisMcap = side === "base_token" ? poolMcap : null;
        const prev = byAddr.get(addr);
        // keep whichever pool is deepest for metadata, but let market cap stick
        // once any pool reports it (a token is base in some pools, quote in others)
        const mergedMcap =
          thisMcap != null && (prev?.marketCapUsd == null || thisMcap > prev.marketCapUsd)
            ? thisMcap
            : prev?.marketCapUsd ?? null;
        if (!prev || tvl > prev.tvlUsd) {
          byAddr.set(addr, {
            address: attr.address,
            symbol: (attr.symbol || "?").slice(0, 12),
            name: (attr.name || attr.symbol || "?").slice(0, 48),
            decimals: Number.isInteger(attr.decimals) ? (attr.decimals as number) : 18,
            logoURI:
              typeof attr.image_url === "string" && attr.image_url.length > 0 && !/missing/.test(attr.image_url)
                ? attr.image_url
                : undefined,
            tvlUsd: tvl,
            marketCapUsd: mergedMcap,
          });
        } else if (mergedMcap != null) {
          prev.marketCapUsd = mergedMcap;
        }
      }
    }
    if (page < PAGES) await new Promise((r) => setTimeout(r, 260)); // GT free tier ~30 req/min
  }

  const out = [...byAddr.values()].sort((a, b) => b.tvlUsd - a.tvlUsd);
  if (out.length > 0) writeCache(out);
  return out;
}
