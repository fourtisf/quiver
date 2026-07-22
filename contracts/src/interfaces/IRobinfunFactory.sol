// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Minimal view of the launch factory's registry, per the public
/// Robinfun implementation: `curveOf(token)` is nonzero iff the token was
/// launched there. There is no `isLaunched()` — this mapping IS the check.
/// (docs/ENVIRONMENT.md §4; final deployed address is ALFA's open item ⚠4.)
interface IRobinfunFactory {
    /// @return curve The token's bonding curve, or address(0) if not launched here.
    function curveOf(address token) external view returns (address curve);
}
