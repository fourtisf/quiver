/**
 * @quiver/indexer — pools, swaps, positions, candles.
 *
 * M0 skeleton. The indexing engine (Ponder self-hosted vs Goldsky/The Graph
 * hosted) is decided in docs/ENVIRONMENT.md and wired up in M2, along with:
 *  - entities: Token, Pool, Swap, PoolHourData/PoolDayData, Position,
 *    PositionFeeSnapshot
 *  - external-position tracking: every canonical position-manager NFT whose
 *    pool contains a Robinfun-verified token, not just router-minted ones
 *  - typed API for the web app (pools list, pool detail + candles, positions
 *    by owner, portfolio aggregates), freshness target <= 10s behind head
 */
export const INDEXER_MILESTONE = "M2" as const;
