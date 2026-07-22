// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {RobinfunGate} from "../src/RobinfunGate.sol";
import {IRobinfunFactory} from "../src/interfaces/IRobinfunFactory.sol";

contract MockFactory is IRobinfunFactory {
    mapping(address => address) public curves;

    function setCurve(address token, address curve) external {
        curves[token] = curve;
    }

    function curveOf(address token) external view returns (address) {
        return curves[token];
    }
}

contract RevertingFactory is IRobinfunFactory {
    function curveOf(address) external pure returns (address) {
        revert("factory down");
    }
}

contract RobinfunGateTest is Test {
    MockFactory internal factory;
    RobinfunGate internal gate;

    address internal constant TOKEN = address(0xBEEF);
    address internal constant CURVE = address(0xCAFE);

    function setUp() public {
        factory = new MockFactory();
        gate = new RobinfunGate(IRobinfunFactory(address(factory)));
    }

    function test_constructor_revertsOnZeroFactory() public {
        vm.expectRevert(RobinfunGate.ZeroFactory.selector);
        new RobinfunGate(IRobinfunFactory(address(0)));
    }

    function test_factoryIsImmutableAndExposed() public view {
        assertEq(address(gate.FACTORY()), address(factory));
    }

    function test_isRobinfunToken_trueWhenCurveSet() public {
        factory.setCurve(TOKEN, CURVE);
        assertTrue(gate.isRobinfunToken(TOKEN));
    }

    function test_isRobinfunToken_falseWhenUnknown() public view {
        assertFalse(gate.isRobinfunToken(TOKEN));
    }

    function test_requireLaunched_passesForLaunchedToken() public {
        factory.setCurve(TOKEN, CURVE);
        gate.requireLaunched(TOKEN); // must not revert
    }

    function test_requireLaunched_revertsForUnknownToken() public {
        vm.expectRevert(abi.encodeWithSelector(RobinfunGate.NotRobinfunToken.selector, TOKEN));
        gate.requireLaunched(TOKEN);
    }

    function test_curveOf_passthrough() public {
        factory.setCurve(TOKEN, CURVE);
        assertEq(gate.curveOf(TOKEN), CURVE);
        assertEq(gate.curveOf(address(0xD00D)), address(0));
    }

    function test_factoryRevertBubblesUp() public {
        RobinfunGate broken = new RobinfunGate(IRobinfunFactory(address(new RevertingFactory())));
        vm.expectRevert(bytes("factory down"));
        broken.requireLaunched(TOKEN);
    }

    /// forge-config: default.fuzz.runs = 512
    function testFuzz_gateMatchesFactoryState(address token, address curve) public {
        factory.setCurve(token, curve);
        assertEq(gate.isRobinfunToken(token), curve != address(0));
        if (curve == address(0)) {
            vm.expectRevert(abi.encodeWithSelector(RobinfunGate.NotRobinfunToken.selector, token));
            gate.requireLaunched(token);
        } else {
            gate.requireLaunched(token);
        }
    }
}
