/**
 * @quiver/keeper — TP/SL execution fallback bot (spec §5.3).
 *
 * M0 skeleton; the execution loop is wired in M5:
 *  - watch armed orders on TPSLExecutor
 *  - read pool TWAP (never spot) each poll interval
 *  - call execute(tokenId) when a trigger crosses; executor pays a fixed
 *    execution fee in bps from proceeds
 * Runs only if Chainlink Automation / Gelato don't support Robinhood Chain
 * (see docs/ENVIRONMENT.md).
 */
import { formatEther } from "viem";

const KEEPER_MILESTONE = "M5" as const;

function main(): void {
  // viem import exercised so typecheck covers the dependency wiring.
  const oneEth = formatEther(1_000_000_000_000_000_000n);
  console.log(`quiver-keeper skeleton (lands in ${KEEPER_MILESTONE}); 1e18 wei = ${oneEth} ETH`);
}

main();
