"use client";

import { useEffect, useState } from "react";
import { orbColor, type TokenInfo } from "@/lib/tokens";

export function TokenLogo({ token, size = 28 }: { token: TokenInfo; size?: number }) {
  const [failed, setFailed] = useState(false);

  // a new token (or a new logo URL) deserves a fresh attempt
  useEffect(() => {
    setFailed(false);
  }, [token.address, token.logoURI]);

  if (token.logoURI && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={token.logoURI}
        alt=""
        width={size}
        height={size}
        className="rounded-full ring-2 ring-ink-2"
        onError={() => setFailed(true)}
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
