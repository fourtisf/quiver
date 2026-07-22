/**
 * Token logos, best-effort from two public keyless APIs:
 *  1. DexScreener  /tokens/v1/{chain}/{addrs}   (30 per call, CORS-open)
 *  2. GeckoTerminal /networks/{net}/tokens/multi/{addrs} (30 per call)
 * Chain slug on both is "robinhood" (verified via dexscreener.com/robinhood/…);
 * a runtime probe remains as fallback should they ever rename it.
 * Results (including "no logo anywhere") are cached for 24h.
 */

const DS_SLUGS = ["robinhood", "robinhoodchain", "robinhood-chain"];
const GT_NETWORKS = ["robinhood", "robinhood-chain"];
const SLUG_KEY = "hoodpool.ds.slug";
const CACHE_KEY = "hoodpool.logos.v2"; // v1 may hold false negatives from a failed slug probe
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

export function cachedSlug(): string {
  try { return localStorage.getItem(SLUG_KEY) ?? DS_SLUGS[0]; } catch { return DS_SLUGS[0]; }
}

type DsPair = { baseToken?: { address?: string }; info?: { imageUrl?: string } };

async function dsBatch(slug: string, addrs: string[]): Promise<DsPair[] | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/${slug}/${addrs.join(",")}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return Array.isArray(body) ? (body as DsPair[]) : null;
  } catch {
    return null;
  }
}

type GtToken = { attributes?: { address?: string; image_url?: string } };

async function gtBatch(network: string, addrs: string[]): Promise<GtToken[] | null> {
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/multi/${addrs.join(",")}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: GtToken[] };
    return Array.isArray(body.data) ? body.data : null;
  } catch {
    return null;
  }
}

function chunk30(list: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < list.length; i += 30) out.push(list.slice(i, i + 30));
  return out;
}

let inflight: Promise<Record<string, string>> | null = null;

/** addr(lowercase) -> imageUrl for every address that has one. */
export async function fetchTokenLogos(addresses: string[]): Promise<Record<string, string>> {
  if (inflight) await inflight.catch(() => undefined);
  const run = (async () => {
    const cache = readCache();
    const wanted = [...new Set(addresses.map((a) => a.toLowerCase()))];
    let missing = wanted.filter((a) => !(a in cache.map));
    if (missing.length === 0) return cache.map;

    // ---- pass 1: DexScreener ------------------------------------------------
    let slug: string | null = null;
    try { slug = localStorage.getItem(SLUG_KEY); } catch { /* ok */ }
    const found: Record<string, string> = {};
    for (const chunk of chunk30(missing)) {
      let pairs: DsPair[] | null = null;
      if (slug) {
        pairs = await dsBatch(slug, chunk);
      } else {
        for (const candidate of DS_SLUGS) {
          pairs = await dsBatch(candidate, chunk);
          if (pairs && pairs.length > 0) {
            slug = candidate;
            try { localStorage.setItem(SLUG_KEY, candidate); } catch { /* ok */ }
            break;
          }
        }
        if (!slug) break;
      }
      for (const p of pairs ?? []) {
        const base = p.baseToken?.address?.toLowerCase();
        const img = p.info?.imageUrl;
        if (base && img && !found[base]) found[base] = img;
      }
    }

    // ---- pass 2: GeckoTerminal for what's still missing ---------------------
    const stillMissing = missing.filter((a) => !found[a]);
    if (stillMissing.length > 0) {
      let network: string | null = null;
      for (const chunk of chunk30(stillMissing)) {
        let tokens: GtToken[] | null = null;
        if (network) {
          tokens = await gtBatch(network, chunk);
        } else {
          for (const candidate of GT_NETWORKS) {
            tokens = await gtBatch(candidate, chunk);
            if (tokens && tokens.length > 0) { network = candidate; break; }
          }
          if (!network) break;
        }
        for (const t of tokens ?? []) {
          const addr = t.attributes?.address?.toLowerCase();
          const img = t.attributes?.image_url;
          if (addr && img && !/missing\.png/.test(img) && !found[addr]) found[addr] = img;
        }
      }
    }

    // Cache positives, and negatives ONLY if at least one source was reachable
    // (a fully failed run must not poison 24h of lookups).
    const anySource = Object.keys(found).length > 0 || slug !== null;
    for (const a of missing) {
      if (found[a]) cache.map[a] = found[a];
      else if (anySource) cache.map[a] = "";
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
