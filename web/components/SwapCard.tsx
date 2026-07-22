"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { encodeFunctionData, formatUnits, isAddress, parseUnits, type Address } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { erc20Abi, swapRouter02Abi, v2RouterAbi } from "@/lib/abis";
import { ADDRESSES } from "@/lib/addresses";
import { NATIVE_ETH, type TokenInfo } from "@/lib/tokens";
import { discoverPools, getEthUsd } from "@/lib/discover";
import { bestRoute, routeLabel as fmtRoute, spenderFor, type Route } from "@/lib/quote";
import { useQuery } from "@tanstack/react-query";
import { fmtAmount } from "@/lib/format";
import { TokenLogo } from "./TokenLogo";
import { TokenSelect } from "./TokenSelect";
import { useToasts } from "./Toasts";

const SLIPPAGE_PRESETS = [0.5, 1, 3] as const;
const DEADLINE_MINUTES = 10;
const ADDRESS_THIS = "0x0000000000000000000000000000000000000002" as Address;
const USDE_ADDR = "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34".toLowerCase();

function sameToken(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}


function errText(e: unknown, fallback: string): string {
  const msg =
    (e as { shortMessage?: string })?.shortMessage ??
    (e as { message?: string })?.message ??
    "";
  if (/user rejected|user denied|rejected the request|4001/i.test(msg)) {
    return "Rejected in wallet";
  }
  const first = msg.split("\n")[0].trim();
  return first ? `${fallback}: ${first.slice(0, 110)}` : fallback;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SwapCard() {
  const { address: account, isConnected, chainId } = useAccount();
  const client = usePublicClient();
  const toasts = useToasts();
  const { writeContractAsync } = useWriteContract();

  const [tokenIn, setTokenIn] = useState<TokenInfo>(NATIVE_ETH);
  const [tokenOut, setTokenOut] = useState<TokenInfo | null>(null);
  const [amountRaw, setAmountRaw] = useState("");
  const [slippage, setSlippage] = useState<number>(1);
  const [customSlip, setCustomSlip] = useState("");
  const [selecting, setSelecting] = useState<"in" | "out" | null>(null);
  const [busy, setBusy] = useState(false);
  const [ethUsd, setEthUsd] = useState<number | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    getEthUsd(client).then((v) => { if (!cancelled) setEthUsd(v); });
    // warm the pool/token scan on page load so the token picker opens with
    // the full list already populated instead of scanning after it's clicked
    discoverPools(client).catch(() => { /* best-effort prefetch */ });
    return () => { cancelled = true; };
  }, [client]);

  // deep link: /app/?token=0x... preselects the output token (Pools "Trade")
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !client) return;
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t || !isAddress(t)) return;
    deepLinked.current = true;
    Promise.all([
      client.readContract({ address: t, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: t, abi: erc20Abi, functionName: "name" }),
      client.readContract({ address: t, abi: erc20Abi, functionName: "decimals" }),
    ])
      .then(([symbol, name, decimals]) => setTokenOut({ address: t, symbol, name, decimals }))
      .catch(() => { /* bad address in URL — ignore */ });
  }, [client]);

  // amount only resets when the INPUT token changes (its decimals change);
  // picking the output token must not wipe what the user typed
  const prevIn = useRef(tokenIn.address);
  useEffect(() => {
    if (prevIn.current !== tokenIn.address) {
      prevIn.current = tokenIn.address;
      setAmountRaw("");
    }
  }, [tokenIn.address]);

  const amountIn: bigint | null = useMemo(() => {
    if (!amountRaw || Number(amountRaw) <= 0) return null;
    try {
      return parseUnits(amountRaw as `${number}`, tokenIn.decimals);
    } catch {
      return null;
    }
  }, [amountRaw, tokenIn.decimals]);
  const debouncedAmountIn = useDebounced(amountIn, 400);

  const degenerateRoute =
    tokenOut !== null && sameToken(
      tokenIn.address === "native" ? ADDRESSES.weth : tokenIn.address,
      tokenOut.address === "native" ? ADDRESSES.weth : tokenOut.address,
    );
  const CORE = new Set(["native", ADDRESSES.weth.toLowerCase(), ADDRESSES.usdg.toLowerCase()]);
  const hasMemeLeg =
    !CORE.has(tokenIn.address.toLowerCase()) || (tokenOut !== null && !CORE.has(tokenOut.address.toLowerCase()));

  // ---- balances -----------------------------------------------------------
  const nativeBal = useBalance({ address: account, query: { enabled: isConnected } });
  const tokenInBal = useReadContract({
    address: tokenIn.address !== "native" ? (tokenIn.address as Address) : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: isConnected && tokenIn.address !== "native", refetchInterval: 12_000 },
  });
  const balanceIn =
    tokenIn.address === "native" ? nativeBal.data?.value : (tokenInBal.data as bigint | undefined);

  // ---- best route quote (debounced): best of Uniswap v2 + v3 --------------
  const quoteQuery = useQuery({
    queryKey: ["route", tokenIn.address, tokenOut?.address, debouncedAmountIn?.toString() ?? ""],
    enabled: Boolean(client && debouncedAmountIn && tokenOut && !degenerateRoute),
    refetchInterval: 15_000,
    retry: 1,
    queryFn: async () => {
      const r = await bestRoute(client!, debouncedAmountIn!, tokenIn, tokenOut!);
      if (!r) throw new Error("no route with liquidity");
      return r;
    },
  });
  // only trust a quote whose input matches the current (debounced == live) amount
  const route: Route | undefined =
    debouncedAmountIn === amountIn && !quoteQuery.isError ? quoteQuery.data : undefined;
  const amountOut = route?.amountOut;
  const minOut =
    amountOut !== undefined
      ? (amountOut * BigInt(Math.round((100 - slippage) * 1000))) / 100_000n
      : undefined;
  const dustOutput = amountOut !== undefined && (amountOut === 0n || minOut === 0n);

  // ---- allowance (ERC20 input only; spender depends on chosen route) -------
  const isErc20In = tokenIn.address !== "native";
  const spender = (route ? spenderFor(route) : ADDRESSES.v2Router02) as Address;
  const allowance = useReadContract({
    address: isErc20In ? (tokenIn.address as Address) : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: account ? [account, spender] : undefined,
    query: { enabled: isConnected && isErc20In },
  });
  const allowanceUnknown =
    isErc20In && amountIn !== null && route !== undefined && allowance.data === undefined;
  const needsApproval =
    isErc20In &&
    amountIn !== null &&
    allowance.data !== undefined &&
    (allowance.data as bigint) < amountIn;

  const priceLine = useMemo(() => {
    if (!debouncedAmountIn || amountOut === undefined || !tokenOut) return null;
    const inF = Number(formatUnits(debouncedAmountIn, tokenIn.decimals));
    const outF = Number(formatUnits(amountOut, tokenOut.decimals));
    if (!inF || !outF) return null;
    return `1 ${tokenIn.symbol} ≈ ${(outF / inF).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${tokenOut.symbol}`;
  }, [debouncedAmountIn, amountOut, tokenIn, tokenOut]);

  const routeLabel = fmtRoute(route, tokenIn.symbol, tokenOut?.symbol ?? "");

  const wrongNetwork = isConnected && chainId !== 4663;
  const quoteFailed = Boolean(debouncedAmountIn && tokenOut && !degenerateRoute && quoteQuery.isError);
  const insufficient = amountIn !== null && balanceIn !== undefined && amountIn > balanceIn;

  function applyCustomSlip(v: string) {
    if (!/^\d*\.?\d*$/.test(v)) return;
    setCustomSlip(v);
    const n = Number(v);
    if (n >= 0.1 && n <= 49) setSlippage(n);
  }

  async function waitToast(hash: `0x${string}`, pendingText: string, doneText: string) {
    const id = toasts.push({ kind: "pending", text: pendingText, txHash: hash });
    try {
      const receipt = await client!.waitForTransactionReceipt({ hash });
      toasts.update(id, {
        kind: receipt.status === "success" ? "success" : "error",
        text:
          receipt.status === "success"
            ? doneText
            : "Transaction reverted on-chain (for fee-on-transfer tokens, try higher slippage)",
      });
      return receipt.status === "success";
    } catch {
      toasts.update(id, { kind: "error", text: "Transaction failed to confirm" });
      return false;
    }
  }

  async function approveAmount(value: bigint, label: string): Promise<boolean> {
    const hash = await writeContractAsync({
      address: tokenIn.address as Address,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, value], // v2 router or v3 SwapRouter02, per the chosen route
    });
    return waitToast(hash, `${label}…`, `${label} confirmed`);
  }

  async function onApprove() {
    if (!amountIn || !isErc20In) return;
    setBusy(true);
    try {
      const current = (allowance.data as bigint | undefined) ?? 0n;
      // USDT-style tokens revert on nonzero->nonzero approve; reset first
      if (current > 0n && current < amountIn) {
        const ok = await approveAmount(0n, `Resetting ${tokenIn.symbol} approval`);
        if (!ok) return;
      }
      const ok = await approveAmount(amountIn, `Approving ${tokenIn.symbol}`);
      if (ok) await allowance.refetch();
    } catch (e) {
      toasts.push({ kind: "error", text: errText(e, "Approval failed") });
    } finally {
      setBusy(false);
    }
  }

  async function onSwap() {
    if (!amountIn || !minOut || minOut === 0n || !route || !account || !tokenOut) return;
    setBusy(true);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_MINUTES * 60);
    const label = `${fmtAmount(amountIn, tokenIn.decimals)} ${tokenIn.symbol} → ${tokenOut.symbol}`;
    try {
      let hash: `0x${string}`;
      if (route.kind === "v2") {
        const path = route.path;
        if (tokenIn.address === "native") {
          hash = await writeContractAsync({
            address: ADDRESSES.v2Router02 as Address, abi: v2RouterAbi,
            functionName: "swapExactETHForTokensSupportingFeeOnTransferTokens",
            args: [minOut, path, account, deadline], value: amountIn,
          });
        } else if (tokenOut.address === "native") {
          hash = await writeContractAsync({
            address: ADDRESSES.v2Router02 as Address, abi: v2RouterAbi,
            functionName: "swapExactTokensForETHSupportingFeeOnTransferTokens",
            args: [amountIn, minOut, path, account, deadline],
          });
        } else {
          hash = await writeContractAsync({
            address: ADDRESSES.v2Router02 as Address, abi: v2RouterAbi,
            functionName: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
            args: [amountIn, minOut, path, account, deadline],
          });
        }
      } else {
        // Uniswap v3 via SwapRouter02, deadline enforced through multicall(deadline, …)
        const ethOut = tokenOut.address === "native";
        const params = {
          tokenIn: route.tokenIn, tokenOut: route.tokenOut, fee: route.fee,
          recipient: ethOut ? ADDRESS_THIS : account,
          amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n,
        };
        const calls: `0x${string}`[] = [
          encodeFunctionData({ abi: swapRouter02Abi, functionName: "exactInputSingle", args: [params] }),
        ];
        if (ethOut) {
          calls.push(encodeFunctionData({ abi: swapRouter02Abi, functionName: "unwrapWETH9", args: [minOut, account] }));
        }
        hash = await writeContractAsync({
          address: ADDRESSES.v3SwapRouter02 as Address, abi: swapRouter02Abi,
          functionName: "multicall", args: [deadline, calls],
          value: tokenIn.address === "native" ? amountIn : undefined,
        });
      }
      const ok = await waitToast(hash, `Swapping ${label}…`, `Swapped ${label}`);
      if (ok) {
        setAmountRaw("");
        nativeBal.refetch();
        tokenInBal.refetch();
        allowance.refetch(); // spent allowance must not linger as "approved"
      }
    } catch (e) {
      toasts.push({ kind: "error", text: errText(e, "Swap failed") });
    } finally {
      setBusy(false);
    }
  }

  function flip() {
    if (!tokenOut) return;
    const a = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(a);
  }

  function handleSelect(t: TokenInfo) {
    const other = selecting === "in" ? tokenOut : tokenIn;
    if (other && sameToken(t.address, other.address)) {
      flip(); // picking the opposite side's token just swaps direction
    } else if (selecting === "in") {
      setTokenIn(t);
    } else {
      setTokenOut(t);
    }
    setSelecting(null);
  }

  // ---- USD: price the core leg (ETH/WETH via ethUsd, stables at $1), then
  // the swap's dollar size carries to the other side (≈ equal, minus fees) ---
  const wethLower = ADDRESSES.weth.toLowerCase();
  const usdgLower = ADDRESSES.usdg.toLowerCase();
  function priceCore(token: TokenInfo | null, amount: bigint | undefined): number | null {
    if (!token || amount === undefined) return null;
    const addr = token.address.toLowerCase();
    if (token.address === "native" || addr === wethLower) {
      return ethUsd === null ? null : Number(formatUnits(amount, 18)) * ethUsd;
    }
    if (addr === usdgLower) return Number(formatUnits(amount, 6));
    if (addr === USDE_ADDR) return Number(formatUnits(amount, 18));
    return null; // not a directly-priceable token
  }
  const usdIn = priceCore(tokenIn, amountIn ?? undefined);
  const usdOut = priceCore(tokenOut, amountOut);
  const usdSize = usdIn ?? usdOut; // dollar size of the swap from whichever side is core
  const fmtUsdVal = (v: number | null): string | undefined =>
    v !== null && Number.isFinite(v) ? `≈ $${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : undefined;
  const usdPay = fmtUsdVal(usdIn ?? usdSize);
  const usdReceive = fmtUsdVal(usdOut ?? usdSize);

  const action = !isConnected
    ? { label: "Connect a wallet to swap", disabled: true }
    : wrongNetwork
      ? { label: "Switch to Robinhood Chain", disabled: true }
      : !tokenOut
        ? { label: "Select a token", disabled: true }
        : degenerateRoute
          ? { label: "Wrap/unwrap not supported yet", disabled: true }
          : !amountIn
            ? { label: "Enter an amount", disabled: true }
            : insufficient
              ? { label: `Insufficient ${tokenIn.symbol}`, disabled: true }
              : quoteFailed
                ? { label: "No route / liquidity for this pair", disabled: true }
                : amountOut === undefined
                  ? { label: "Fetching quote…", disabled: true }
                  : dustOutput
                    ? { label: "Amount too small", disabled: true }
                    : allowanceUnknown
                      ? { label: "Checking allowance…", disabled: true }
                      : needsApproval
                        ? { label: busy ? "Approving…" : `Approve ${tokenIn.symbol}`, disabled: busy, onClick: onApprove }
                        : { label: busy ? "Swapping…" : "Swap", disabled: busy, onClick: onSwap };

  return (
    <div className="w-full max-w-md rounded-lg border border-stratum bg-basin p-5 shadow-2xl">
      <div className="mb-4">
        <h2 className="mb-3 font-disp text-lg font-bold">Swap</h2>
        <div className="flex items-center gap-1 rounded-lg border border-stratum/70 bg-ink/50 p-1">
          <span className="px-1.5 font-mono text-[10px] uppercase tracking-wider text-silt-dark">
            Slippage
          </span>
          {SLIPPAGE_PRESETS.map((s) => {
            const active = slippage === s && customSlip === "";
            return (
              <button
                key={s}
                onClick={() => { setSlippage(s); setCustomSlip(""); }}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition ${
                  active ? "bg-spring/15 text-spring" : "text-silt hover:text-foam"
                }`}
              >
                {s}%
              </button>
            );
          })}
          <div
            className={`ml-auto flex items-center rounded-md border px-2 py-1 transition ${
              customSlip !== "" ? "border-spring/40 bg-spring/10" : "border-stratum/70"
            }`}
          >
            <input
              value={customSlip}
              onChange={(e) => applyCustomSlip(e.target.value)}
              placeholder="Custom"
              inputMode="decimal"
              aria-label="Custom slippage percent"
              className={`w-14 bg-transparent text-right font-mono text-[11px] outline-none placeholder:text-silt-dark ${
                customSlip !== "" ? "text-spring" : "text-foam"
              }`}
            />
            <span className={`pl-0.5 font-mono text-[11px] ${customSlip !== "" ? "text-spring" : "text-silt-dark"}`}>
              %
            </span>
          </div>
        </div>
      </div>

      <TokenBox
        label="You pay"
        token={tokenIn}
        amount={amountRaw}
        usd={usdPay}
        onAmount={setAmountRaw}
        onPick={() => setSelecting("in")}
        balance={balanceIn}
        onMax={
          balanceIn !== undefined && tokenIn.address !== "native"
            ? () => setAmountRaw(formatUnits(balanceIn, tokenIn.decimals))
            : undefined
        }
      />

      <div className="relative z-10 -my-2.5 flex justify-center">
        <button
          onClick={flip}
          aria-label="Flip tokens"
          className="rounded-lg border border-stratum bg-basin-2 px-2.5 py-1 text-spring transition hover:border-spring/40"
        >
          ↓↑
        </button>
      </div>

      <TokenBox
        label="You receive (estimated)"
        token={tokenOut}
        amount={amountOut !== undefined && tokenOut ? fmtAmount(amountOut, tokenOut.decimals) : ""}
        usd={usdReceive}
        readOnly
        onPick={() => setSelecting("out")}
      />

      {priceLine ? (
        <div className="mt-3 space-y-1 rounded-md border border-stratum/60 bg-ink/40 px-3 py-2.5 font-mono text-[11.5px] text-silt">
          <div className="flex justify-between"><span>Rate</span><span className="text-foam">{priceLine}</span></div>
          {minOut !== undefined && tokenOut ? (
            <div className="flex justify-between">
              <span>Min received ({slippage}%)</span>
              <span className="text-foam">{fmtAmount(minOut, tokenOut.decimals)} {tokenOut.symbol}</span>
            </div>
          ) : null}
          <div className="flex justify-between"><span>Route</span>
            <span className="text-foam">{routeLabel}</span>
          </div>
          {hasMemeLeg ? (
            <p className="border-t border-stratum/60 pt-1.5 text-amber">
              Some tokens take a transfer tax. If the swap reverts or receipt is
              below the estimate, raise slippage above the token&apos;s tax.
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        className="mt-4 w-full rounded-md bg-gradient-to-b from-spring-bright to-spring py-3.5 font-semibold text-ink transition enabled:hover:brightness-105 disabled:opacity-40"
        disabled={action.disabled}
        onClick={action.onClick}
      >
        {action.label}
      </button>

      <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-silt-dark">
        Auto-routed across Uniswap v2 &amp; v3 on Robinhood Chain, fee-on-transfer safe.
        Tokens still on their launch bonding curve have no pool here yet.
      </p>

      <TokenSelect
        open={selecting !== null}
        exclude={selecting === "in" ? tokenOut?.address : tokenIn.address}
        onClose={() => setSelecting(null)}
        onSelect={handleSelect}
      />
    </div>
  );
}

function TokenBox({
  label,
  token,
  amount,
  usd,
  onAmount,
  onPick,
  readOnly,
  balance,
  onMax,
}: {
  label: string;
  token: TokenInfo | null;
  amount: string;
  usd?: string;
  onAmount?: (v: string) => void;
  onPick: () => void;
  readOnly?: boolean;
  balance?: bigint;
  onMax?: () => void;
}) {
  return (
    <div className="rounded-md border border-stratum/70 bg-ink/50 p-3.5">
      <div className="mb-1.5 flex justify-between font-mono text-[10.5px] uppercase tracking-wider text-silt">
        <span>{label}</span>
        {balance !== undefined && token ? (
          <span>
            bal {fmtAmount(balance, token.decimals)}
            {onMax ? <button className="ml-1.5 text-spring" onClick={onMax}>max</button> : null}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <input
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          readOnly={readOnly}
          onChange={(e) => {
            const v = e.target.value.replace(/,/g, "");
            if (/^\d*\.?\d*$/.test(v)) onAmount?.(v);
          }}
          className="w-full bg-transparent font-mono text-2xl font-semibold outline-none placeholder:text-silt-dark"
        />
        <button
          onClick={onPick}
          className="flex flex-shrink-0 items-center gap-2 rounded-full border border-stratum bg-basin-2 py-1.5 pl-1.5 pr-3 text-sm font-semibold transition hover:border-spring/40"
        >
          {token ? (
            <>
              <TokenLogo token={token} size={24} />
              {token.symbol}
            </>
          ) : (
            <span className="pl-1.5 text-spring">Select ▾</span>
          )}
        </button>
      </div>
      {usd ? <div className="mt-1 font-mono text-[11px] text-silt-dark">{usd}</div> : null}
    </div>
  );
}
