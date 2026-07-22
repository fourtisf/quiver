"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";
import { usePublicClient } from "wagmi";
import { erc20Abi } from "@/lib/abis";
import { CORE_TOKENS, type TokenInfo } from "@/lib/tokens";
import { discoverOnchainTokens } from "@/lib/discover";
import { fetchTopTokens } from "@/lib/gecko";
import { TokenLogo } from "./TokenLogo";
import { shortAddr } from "@/lib/format";

export function TokenSelect({
  open,
  onClose,
  onSelect,
  exclude,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (t: TokenInfo) => void;
  exclude?: string;
}) {
  const [query, setQuery] = useState("");
  const [discovered, setDiscovered] = useState<TokenInfo[]>([]);
  const [geckoTop, setGeckoTop] = useState<TokenInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [resolved, setResolved] = useState<TokenInfo | null>(null);
  const [resolving, setResolving] = useState(false);
  const client = usePublicClient();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (client) {
      setScanning(true);
      discoverOnchainTokens(client)
        .then((list) => { if (!cancelled) setDiscovered(list); })
        .catch(() => { /* discovery is best-effort */ })
        .finally(() => { if (!cancelled) setScanning(false); });
    }
    // Big-cap tokens whose liquidity is on Uniswap v3/v4 come from GeckoTerminal's
    // top-pools feed (keyless, all-DEX) so the picker looks like Uniswap's.
    fetchTopTokens()
      .then((list) => { if (!cancelled) setGeckoTop(list); })
      .catch(() => { /* best-effort */ });
    return () => { cancelled = true; };
  }, [open, client]);

  // Escape closes the modal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Pasting a 0x address resolves the token on-chain
  useEffect(() => {
    setResolved(null);
    if (!client || !isAddress(query)) {
      setResolving(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    Promise.all([
      client.readContract({ address: query, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: query, abi: erc20Abi, functionName: "name" }),
      client.readContract({ address: query, abi: erc20Abi, functionName: "decimals" }),
    ])
      .then(([symbol, name, decimals]) => {
        if (!cancelled) setResolved({ address: query, symbol, name, decimals });
      })
      .catch(() => { /* not an ERC20 */ })
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  }, [query, client]);

  const isExcluded = (addr: string) =>
    !!exclude && addr.toLowerCase() === exclude.toLowerCase();

  const list = useMemo(() => {
    const coreKeys = new Set(CORE_TOKENS.map((t) => t.address.toLowerCase()));
    // Merge the two discovery sources (on-chain v2 + GeckoTerminal v3/v4) into a
    // single deduped set. On collision keep the deeper pool and prefer a real logo.
    const extra = new Map<string, TokenInfo>();
    for (const t of [...discovered, ...geckoTop]) {
      const key = t.address.toLowerCase();
      if (coreKeys.has(key)) continue;
      const prev = extra.get(key);
      if (!prev) {
        extra.set(key, t);
      } else {
        const mc = [prev.marketCapUsd, t.marketCapUsd]
          .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        extra.set(key, {
          ...prev,
          logoURI: prev.logoURI ?? t.logoURI,
          tvlUsd: Math.max(prev.tvlUsd ?? 0, t.tvlUsd ?? 0) || prev.tvlUsd || t.tvlUsd,
          marketCapUsd: mc.length ? Math.max(...mc) : (prev.marketCapUsd ?? t.marketCapUsd ?? null),
          name: prev.name || t.name,
        });
      }
    }
    const ranked = [...extra.values()].sort(
      (a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0),
    );
    const merged = [...CORE_TOKENS, ...ranked];
    // flag repeated symbols: first occurrence (deepest pool) is trusted,
    // later ones are likely on-chain clones and get a warning badge
    const symbolSeen = new Set<string>();
    const withDup = merged.map((t) => {
      const key = t.symbol.toLowerCase();
      const dup = symbolSeen.has(key);
      symbolSeen.add(key);
      return { ...t, __dup: dup } as TokenInfo & { __dup: boolean };
    });
    const all = withDup.filter((t) => !isExcluded(t.address));
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovered, geckoTop, query, exclude]);

  function selectVerified(t: TokenInfo) {
    onSelect(t); // discovered tokens carry on-chain-read decimals already
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-5 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Select a token"
    >
      <div
        className="w-full max-w-md rounded-lg border border-stratum bg-basin-2 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-disp text-base font-bold">Select token</h3>
          <button className="text-silt hover:text-foam" onClick={onClose} aria-label="Close">×</button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, symbol, or paste 0x address"
          className="mb-3 w-full rounded-md border border-stratum bg-ink px-3 py-2.5 font-mono text-sm outline-none placeholder:text-silt-dark focus:border-spring/50"
        />
        <div className="max-h-72 overflow-y-auto">
          {resolving ? (
            <p className="px-1 py-2 font-mono text-xs text-silt">Resolving address…</p>
          ) : null}
          {resolved && !isExcluded(resolved.address) ? (
            <TokenRow token={resolved} onSelect={selectVerified} note="resolved on-chain" />
          ) : null}
          {resolved && isExcluded(resolved.address) ? (
            <p className="px-1 py-2 font-mono text-xs text-silt">
              That token is already selected on the other side.
            </p>
          ) : null}
          {list.map((t) => (
            <TokenRow
              key={t.address.toLowerCase()}
              token={t}
              dup={(t as TokenInfo & { __dup?: boolean }).__dup}
              onSelect={selectVerified}
            />
          ))}
          {list.length === 0 && !resolved && !resolving ? (
            <p className="px-1 py-3 text-sm text-silt">
              No match. Paste a token address to resolve it on-chain.
            </p>
          ) : null}
        </div>
        <p className="mt-3 border-t border-stratum/60 pt-3 font-mono text-[11px] text-silt-dark">
          {scanning && discovered.length === 0 && geckoTop.length === 0
            ? "Scanning on-chain pools…"
            : discovered.length + geckoTop.length > 0
              ? `${list.length} tokens across Uniswap v2/v3 — paste any address to add more.`
              : "No extra pools found — paste any token address to resolve it."}
        </p>
      </div>
    </div>
  );
}

function fmtUsd(v: number | null | undefined): string | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function TokenRow({
  token,
  onSelect,
  note,
  dup,
}: {
  token: TokenInfo;
  onSelect: (t: TokenInfo) => void;
  note?: string;
  dup?: boolean;
}) {
  const mc = fmtUsd(token.marketCapUsd);
  const tvl = fmtUsd(token.tvlUsd);
  return (
    <button
      className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-spring/10"
      onClick={() => onSelect(token)}
    >
      <TokenLogo token={token} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {token.symbol}
          {dup ? (
            <span
              className="rounded-full border border-amber/40 bg-amber/10 px-1.5 py-px font-mono text-[9px] font-medium text-amber"
              title="Same symbol as a deeper pool — verify the address before trading"
            >
              ⚠ clone?
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-silt">{token.name}</span>
      </span>
      <span className="ml-auto text-right font-mono text-[11px] leading-tight text-silt-dark">
        {note ?? (token.address === "native" ? "" : shortAddr(token.address))}
        {mc ? <span className="block text-[10px] text-silt">MC {mc}</span> : null}
        {tvl ? <span className="block text-[10px] text-silt-dark">TVL {tvl}</span> : null}
      </span>
    </button>
  );
}
