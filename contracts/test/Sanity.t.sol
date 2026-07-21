// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Dependency-free sanity test: proves the Foundry toolchain compiles and
/// runs tests in CI. Replaced by real QuiverRouter / RobinfunGate / TPSLExecutor
/// tests in M1 (which will pull in forge-std).
contract SanityTest {
    uint256 internal constant PROTOCOL_FEE_BPS = 10; // 0.1% of deposits -> treasury
    uint24 internal constant POOL_FEE = 10_000; // Uniswap 1% swap fee tier, to LPs

    function testProtocolFeeMath() public pure {
        uint256 amountIn = 1 ether;
        uint256 fee = (amountIn * PROTOCOL_FEE_BPS) / 10_000;
        assert(fee == 0.001 ether);
        assert(amountIn - fee == 0.999 ether);
    }

    function testPoolFeeTierIsOnePercent() public pure {
        // Uniswap fee units are hundredths of a bip; 10_000 == 1%.
        assert(POOL_FEE == 10_000);
    }
}
