// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IRobinfunFactory} from "./interfaces/IRobinfunFactory.sol";

/// @title RobinfunGate
/// @notice Thin, immutable wrapper around the launch factory's registry.
/// The only listing control in the protocol (spec §2.1): a token is eligible
/// iff the factory knows its bonding curve. No storage, no owner, no admin —
/// what is deployed is what runs, forever (spec §2.4).
contract RobinfunGate {
    /// @notice Token was not launched through the configured factory.
    error NotRobinfunToken(address token);
    /// @notice Factory address must be nonzero at deployment.
    error ZeroFactory();

    /// @notice The launch factory this gate verifies against. Fixed at deploy.
    IRobinfunFactory public immutable FACTORY;

    constructor(IRobinfunFactory factory_) {
        if (address(factory_) == address(0)) revert ZeroFactory();
        FACTORY = factory_;
    }

    /// @notice True iff `token` was launched through the factory.
    function isRobinfunToken(address token) public view returns (bool) {
        return FACTORY.curveOf(token) != address(0);
    }

    /// @notice Reverts with `NotRobinfunToken` unless `token` is verified.
    /// @dev The router calls this as step 1 of every deposit (spec §5.1.1).
    function requireLaunched(address token) external view {
        if (!isRobinfunToken(token)) revert NotRobinfunToken(token);
    }

    /// @notice The token's bonding curve (spot-price source for pool init).
    function curveOf(address token) external view returns (address) {
        return FACTORY.curveOf(token);
    }
}
