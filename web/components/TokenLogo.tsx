"use client";

import { useEffect, useMemo, useState } from "react";
import { getAddress } from "viem";
import { orbColor, type TokenInfo } from "@/lib/tokens";

/**
 * Logo resolution, in order — each falls through to the next on load error:
 *  1. an explicit logoURI already on the token
 *  2. DexScreener token CDN (dd.dexscreener.com), lowercase then checksum addr
 *  3. GeckoTerminal / CoinGecko-style CDN guess
 *  4. colored orb + first letter
 *
 * Images are loaded via <img>, which is NOT subject to CORS — so this works
 * even where a fetch() to the JSON APIs would be blocked in the browser.
 */
function candidateUrls(token: TokenInfo): string[] {
  const list: string[] = [];
  if (token.logoURI) list.push(token.logoURI);
  if (token.address !== "native" && /^0x[a-fA-F0-9]{40}$/.test(token.address)) {
    const lower = token.address.toLowerCase();
    let checksum = lower;
    try { checksum = getAddress(token.address); } catch { /* keep lower */ }
    const base = "https://dd.dexscreener.com/ds-data/tokens/robinhood";
    // DexScreener's CDN keys EVM tokens by checksum address (documented format);
    // try that first, then lowercase, then the launchpad-metadata thumbnail size.
    list.push(`${base}/${checksum}.png`);
    if (lower !== checksum) list.push(`${base}/${lower}.png`);
    list.push(`${base}/${checksum}.png?size=lg`);
  }
  return list;
}

export function TokenLogo({ token, size = 28 }: { token: TokenInfo; size?: number }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const candidates = useMemo(() => candidateUrls(token), [token.address, token.logoURI]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [token.address, token.logoURI]);

  const inner =
    idx < candidates.length ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidates[idx]}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="rounded-full object-cover ring-2 ring-ink-2"
        style={{ width: size, height: size }}
        onError={() => setIdx((i) => i + 1)}
      />
    ) : (
      // Fallback: colored orb + first letter (prototype behavior)
      <span
        aria-hidden
        className="flex items-center justify-center rounded-full font-mono font-semibold text-ink ring-2 ring-ink-2"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.38,
          background: `radial-gradient(circle at 32% 28%, #ffffff55, transparent 40%), ${orbColor(token.address)}`,
        }}
      >
        {token.symbol.slice(0, 1).toUpperCase()}
      </span>
    );

  // Every token here lives on Robinhood Chain — stamp the chain badge on the
  // corner of the logo, the way Uniswap marks a token with its network.
  return (
    <span className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
      {inner}
      <ChainBadge size={size} />
    </span>
  );
}

/** Small Robinhood-green disc in the bottom-right corner = "on Robinhood Chain". */
function ChainBadge({ size }: { size: number }) {
  const b = Math.max(9, Math.round(size * 0.42));
  const off = -Math.round(b * 0.18);
  return (
    <span
      aria-hidden
      title="Robinhood Chain"
      className="absolute rounded-full border-2 border-ink-2 bg-[#00C805]"
      style={{ width: b, height: b, right: off, bottom: off }}
    />
  );
}
