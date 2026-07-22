/**
 * Token logos via DexScreener's public API (CORS-open, no key).
 * Batch endpoint: /tokens/v1/{chainSlug}/{addr1,addr2,...} — up to 30 per call.
 * The chain's slug isn't documented for Robinhood Chain, so it's detected once
 * from a list of candidates and remembered. Results (including "no logo")
 * are cached for 24h so repeat visits cost zero requests.
 */

const SLUG_CANDIDATES = ["robinhoodchain", "robinhood", "robinhood-chain"];
const SLUG_KEY = "hoodpool.ds.slug";
const CACHE_KEY = "hoodpool.logos.v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type LogoCache = { at: number; map: Record<string, string> }; // "" = looked up, none found

function readCache(): LogoCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as LogoCache;
      if (Date.now() - c.at < CACHE_TTL_MS) return c;
    }
  } catch { /* fall through */ }
  return { at: Date.now(), map: {} };
}

function writeCache(c: LogoCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* full/blocked */ }
}

export function cachedSlug(): string | null {
  try { return localStorage.getItem(SLUG_KEY); } catch { return null; }
}

type DsPair = {
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
  info?: { imageUrl?: string };
};

async function queryBatch(slug: string, addrs: string[]): Promise<DsPair[] | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/tokens/v1/${slug}/${addrs.join(",")}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return Array.isArray(body) ? (body as DsPair[]) : null;
  } catch {
    return null;
  }
}

let inflight: Promise<Record<string, string>> | null = null;

/** addr(lowercase) -> imageUrl for every address that has one. */
export async function fetchTokenLogos(addresses: string[]): Promise<Record<string, string>> {
  if (inflight) await inflight.catch(() => undefined);
  const run = (async () => {
    const cache = readCache();
    const wanted = [...new Set(addresses.map((a) => a.toLowerCase()))];
    const missing = wanted.filter((a) => !(a in cache.map));
    if (missing.length === 0) return cache.map;

    let slug = cachedSlug();
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += 30) chunks.push(missing.slice(i, i + 30));

    for (const chunk of chunks) {
      let pairs: DsPair[] | null = null;
      if (slug) {
        pairs = await queryBatch(slug, chunk);
      } else {
        for (const candidate of SLUG_CANDIDATES) {
          pairs = await queryBatch(candidate, chunk);
          if (pairs && pairs.length > 0) {
            slug = candidate;
            try { localStorage.setItem(SLUG_KEY, candidate); } catch { /* ok */ }
            break;
          }
        }
        if (!slug) break; // chain unknown to DexScreener — stop trying
      }
      for (const a of chunk) cache.map[a] = cache.map[a] ?? "";
      for (const p of pairs ?? []) {
        const img = p.info?.imageUrl;
        if (!img) continue;
        const base = p.baseToken?.address?.toLowerCase();
        if (base && chunk.includes(base) && !cache.map[base]) cache.map[base] = img;
      }
    }
    writeCache(cache);
    return cache.map;
  })();
  inflight = run;
  try {
    return await run;
  } finally {
    inflight = null;
  }
}
