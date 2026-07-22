"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";
import { usePublicClient } from "wagmi";
import { erc20Abi } from "@/lib/abis";
import { CORE_TOKENS, fetchRobinfunTokens, type TokenInfo } from "@/lib/tokens";
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
  const [robinfun, setRobinfun] = useState<TokenInfo[]>([]);
  const [resolved, setResolved] = useState<TokenInfo | null>(null);
  const [resolving, setResolving] = useState(false);
  const client = usePublicClient();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchRobinfunTokens().then((list) => {
      if (!cancelled) setRobinfun(list);
    });
    return () => { cancelled = true; };
  }, [open]);

  // Pasting a 0x address resolves the token on-chain
  useEffect(() => {
    setResolved(null);
    if (!client || !isAddress(query)) return;
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

  const list = useMemo(() => {
    const all = [...CORE_TOKENS, ...robinfun].filter((t) => t.address !== exclude);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q,
    );
  }, [robinfun, query, exclude]);

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
          {resolved ? (
            <TokenRow token={resolved} onSelect={onSelect} note="resolved on-chain" />
          ) : null}
          {list.map((t) => (
            <TokenRow key={t.address} token={t} onSelect={onSelect} />
          ))}
          {list.length === 0 && !resolved && !resolving ? (
            <p className="px-1 py-3 text-sm text-silt">
              No match. Paste a token address to resolve it on-chain.
            </p>
          ) : null}
        </div>
        {robinfun.length === 0 ? (
          <p className="mt-3 border-t border-stratum/60 pt-3 font-mono text-[11px] text-silt-dark">
            Robinfun token list unreachable — core tokens + address paste still work.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TokenRow({
  token,
  onSelect,
  note,
}: {
  token: TokenInfo;
  onSelect: (t: TokenInfo) => void;
  note?: string;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-spring/10"
      onClick={() => onSelect(token)}
    >
      <TokenLogo token={token} />
      <span>
        <span className="block text-sm font-semibold">{token.symbol}</span>
        <span className="block text-xs text-silt">{token.name}</span>
      </span>
      <span className="ml-auto font-mono text-[11px] text-silt-dark">
        {note ?? (token.robinfun ? "robinfun" : token.address === "native" ? "" : shortAddr(token.address))}
      </span>
    </button>
  );
}
