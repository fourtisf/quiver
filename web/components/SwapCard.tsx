"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { erc20Abi, v2RouterAbi } from "@/lib/abis";
import { ADDRESSES } from "@/lib/addresses";
import { NATIVE_ETH, type TokenInfo } from "@/lib/tokens";
import { fmtAmount } from "@/lib/format";
import { TokenLogo } from "./TokenLogo";
import { TokenSelect } from "./TokenSelect";
import { useToasts } from "./Toasts";

const SLIPPAGE_PRESETS = [0.5, 1, 3] as const;
const DEADLINE_MINUTES = 10;

function pathFor(tokenIn: TokenInfo, tokenOut: TokenInfo): Address[] {
  const weth = ADDRESSES.weth as Address;
  const a = tokenIn.address === "native" ? weth : (tokenIn.address as Address);
  const b = tokenOut.address === "native" ? weth : (tokenOut.address as Address);
  if (a.toLowerCase() === weth.toLowerCase() || b.toLowerCase() === weth.toLowerCase()) {
    return [a, b];
  }
  return [a, weth, b];
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
  const [selecting, setSelecting] = useState<"in" | "out" | null>(null);
  const [busy, setBusy] = useState(false);

  const amountIn: bigint | null = useMemo(() => {
    if (!amountRaw || Number(amountRaw) <= 0) return null;
    try {
      return parseUnits(amountRaw as `${number}`, tokenIn.decimals);
    } catch {
      return null;
    }
  }, [amountRaw, tokenIn.decimals]);

  const path = tokenOut ? pathFor(tokenIn, tokenOut) : null;

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

  // ---- quote --------------------------------------------------------------
  const quote = useReadContract({
    address: ADDRESSES.v2Router02 as Address,
    abi: v2RouterAbi,
    functionName: "getAmountsOut",
    args: amountIn && path ? [amountIn, path] : undefined,
    query: {
      enabled: Boolean(amountIn && path),
      refetchInterval: 15_000,
      retry: false,
    },
  });
  const amounts = quote.data as readonly bigint[] | undefined;
  const amountOut = amounts?.[amounts.length - 1];
  const minOut =
    amountOut !== undefined
      ? (amountOut * BigInt(Math.round((100 - slippage) * 1000))) / 100_000n
      : undefined;

  // ---- allowance (ERC20 input only) --------------------------------------
  const allowance = useReadContract({
    address: tokenIn.address !== "native" ? (tokenIn.address as Address) : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: account ? [account, ADDRESSES.v2Router02 as Address] : undefined,
    query: { enabled: isConnected && tokenIn.address !== "native" },
  });
  const needsApproval =
    tokenIn.address !== "native" &&
    amountIn !== null &&
    allowance.data !== undefined &&
    (allowance.data as bigint) < amountIn;

  // price line
  const priceLine = useMemo(() => {
    if (!amountIn || amountOut === undefined || !tokenOut) return null;
    const inF = Number(formatUnits(amountIn, tokenIn.decimals));
    const outF = Number(formatUnits(amountOut, tokenOut.decimals));
    if (!inF || !outF) return null;
    return `1 ${tokenIn.symbol} ≈ ${(outF / inF).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${tokenOut.symbol}`;
  }, [amountIn, amountOut, tokenIn, tokenOut]);

  useEffect(() => {
    // swapping direction resets the amount to avoid stale quotes
    setAmountRaw("");
  }, [tokenIn.address, tokenOut?.address]);

  const wrongNetwork = isConnected && chainId !== 4663;
  const quoteFailed = Boolean(amountIn && path && quote.isError);
  const insufficient =
    amountIn !== null && balanceIn !== undefined && amountIn > balanceIn;

  async function waitToast(hash: `0x${string}`, pendingText: string, doneText: string) {
    const id = toasts.push({ kind: "pending", text: pendingText, txHash: hash });
    try {
      const receipt = await client!.waitForTransactionReceipt({ hash });
      toasts.update(id, {
        kind: receipt.status === "success" ? "success" : "error",
        text: receipt.status === "success" ? doneText : "Transaction reverted",
      });
      return receipt.status === "success";
    } catch (e) {
      toasts.update(id, { kind: "error", text: "Transaction failed to confirm" });
      return false;
    }
  }

  async function onApprove() {
    if (!amountIn || tokenIn.address === "native") return;
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        address: tokenIn.address as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [ADDRESSES.v2Router02 as Address, amountIn],
      });
      const ok = await waitToast(hash, `Approving ${tokenIn.symbol}…`, `${tokenIn.symbol} approved`);
      if (ok) await allowance.refetch();
    } catch {
      toasts.push({ kind: "error", text: "Approval rejected" });
    } finally {
      setBusy(false);
    }
  }

  async function onSwap() {
    if (!amountIn || !minOut || !path || !account || !tokenOut) return;
    setBusy(true);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_MINUTES * 60);
    const label = `${fmtAmount(amountIn, tokenIn.decimals)} ${tokenIn.symbol} → ${tokenOut.symbol}`;
    try {
      let hash: `0x${string}`;
      if (tokenIn.address === "native") {
        hash = await writeContractAsync({
          address: ADDRESSES.v2Router02 as Address,
          abi: v2RouterAbi,
          functionName: "swapExactETHForTokensSupportingFeeOnTransferTokens",
          args: [minOut, path, account, deadline],
          value: amountIn,
        });
      } else if (tokenOut.address === "native") {
        hash = await writeContractAsync({
          address: ADDRESSES.v2Router02 as Address,
          abi: v2RouterAbi,
          functionName: "swapExactTokensForETHSupportingFeeOnTransferTokens",
          args: [amountIn, minOut, path, account, deadline],
        });
      } else {
        hash = await writeContractAsync({
          address: ADDRESSES.v2Router02 as Address,
          abi: v2RouterAbi,
          functionName: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
          args: [amountIn, minOut, path, account, deadline],
        });
      }
      const ok = await waitToast(hash, `Swapping ${label}…`, `Swapped ${label}`);
      if (ok) {
        setAmountRaw("");
        nativeBal.refetch();
        tokenInBal.refetch();
      }
    } catch {
      toasts.push({ kind: "error", text: "Swap rejected" });
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

  const action = !isConnected
    ? { label: "Connect a wallet to swap", disabled: true }
    : wrongNetwork
      ? { label: "Switch to Robinhood Chain", disabled: true }
      : !tokenOut
        ? { label: "Select a token", disabled: true }
        : !amountIn
          ? { label: "Enter an amount", disabled: true }
          : insufficient
            ? { label: `Insufficient ${tokenIn.symbol}`, disabled: true }
            : quoteFailed
              ? { label: "No route / liquidity", disabled: true }
              : quote.isFetching && amountOut === undefined
                ? { label: "Fetching quote…", disabled: true }
                : needsApproval
                  ? { label: busy ? "Approving…" : `Approve ${tokenIn.symbol}`, disabled: busy, onClick: onApprove }
                  : { label: busy ? "Swapping…" : "Swap", disabled: busy, onClick: onSwap };

  return (
    <div className="w-full max-w-md rounded-lg border border-stratum bg-basin p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-disp text-lg font-bold">Swap</h2>
        <div className="flex items-center gap-1 font-mono text-[11px] text-silt">
          slippage
          {SLIPPAGE_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`rounded-md px-2 py-1 ${slippage === s ? "bg-spring/15 text-spring" : "hover:text-foam"}`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* input side */}
      <TokenBox
        label="You pay"
        token={tokenIn}
        amount={amountRaw}
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

      {/* output side */}
      <TokenBox
        label="You receive (estimated)"
        token={tokenOut}
        amount={
          amountOut !== undefined && tokenOut ? fmtAmount(amountOut, tokenOut.decimals) : ""
        }
        readOnly
        onPick={() => setSelecting("out")}
      />

      {/* details */}
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
            <span className="text-foam">{path?.length === 3 ? `${tokenIn.symbol} → WETH → ${tokenOut?.symbol}` : "direct"}</span>
          </div>
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
        Routed through canonical Uniswap v2 on Robinhood Chain, fee-on-transfer safe.
        Robinfun tokens with a creator levy may need a higher slippage setting.
      </p>

      <TokenSelect
        open={selecting !== null}
        exclude={selecting === "in" ? tokenOut?.address : tokenIn.address}
        onClose={() => setSelecting(null)}
        onSelect={(t) => {
          if (selecting === "in") setTokenIn(t);
          else setTokenOut(t);
          setSelecting(null);
        }}
      />
    </div>
  );
}

function TokenBox({
  label,
  token,
  amount,
  onAmount,
  onPick,
  readOnly,
  balance,
  onMax,
}: {
  label: string;
  token: TokenInfo | null;
  amount: string;
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
            {onMax ? (
              <button className="ml-1.5 text-spring" onClick={onMax}>max</button>
            ) : null}
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
            const v = e.target.value;
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
    </div>
  );
}
