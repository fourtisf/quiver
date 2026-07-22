"use client";

import { useEffect, useMemo, useState } from "react";
import { orbColor, type TokenInfo } from "@/lib/tokens";
import { cachedSlug } from "@/lib/logos";

export function TokenLogo({ token, size = 28 }: { token: TokenInfo; size?: number }) {
  // ordered candidates: explicit logo -> DexScreener CDN guess -> orb fallback
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (token.logoURI) list.push(token.logoURI);
    if (token.address !== "native" && /^0x[a-fA-F0-9]{40}$/.test(token.address)) {
      const slug = typeof window !== "undefined" ? cachedSlug() : null;
      if (slug) {
        list.push(`https://dd.dexscreener.com/ds-data/tokens/${slug}/${token.address.toLowerCase()}.png?size=lg`);
      }
    }
    return list;
  }, [token.address, token.logoURI]);

  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [token.address, token.logoURI]);

  if (idx < candidates.length) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidates[idx]}
        alt=""
        width={size}
        height={size}
        className="rounded-full ring-2 ring-ink-2 object-cover"
        style={{ width: size, height: size }}
        onError={() => setIdx((i) => i + 1)}
      />
    );
  }
  // Fallback: colored orb + first letter (prototype behavior)
  return (
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
}
