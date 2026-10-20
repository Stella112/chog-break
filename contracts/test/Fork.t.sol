// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ChogBreakRegistry} from "../src/ChogBreakRegistry.sol";

/// Opt-in fork tests against Monad mainnet (chain 143). Skipped unless MONAD_RPC_URL is set:
///   MONAD_RPC_URL=https://rpc.monad.xyz forge test --match-contract Fork -vv
/// Read-only: nothing is broadcast; transfers happen only inside the local fork.
contract ForkTest is Test {
    address constant CHOG_GENESIS = 0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763;
    address constant CHOG_TOKEN = 0x350035555E10d9AfAF1566AaebfCeD5BA6C27777;
    bool forked;

    function setUp() public {
        string memory rpc = vm.envOr("MONAD_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;
    }

    function test_fork_chainIs143() public {
        if (!forked) vm.skip(true);
        assertEq(block.chainid, 143);
    }

    function test_fork_ownerOf1Succeeds() public {
        if (!forked) vm.skip(true);
        address o = IERC721(CHOG_GENESIS).ownerOf(1);
        assertTrue(o != address(0));
        console2.log("ownerOf(1)", o);
    }

    function test_fork_decimalsRecorded() public {
        if (!forked) vm.skip(true);
        uint8 d = IERC20Metadata(CHOG_TOKEN).decimals();
        console2.log("CHOG decimals", d);
        assertEq(d, 18, "chain.ts assumes 18 (verified in Phase 0)");
    }

    /// No fee-on-transfer / rebasing: the receiver gets exactly what was sent.
    function test_fork_chogTransferIsExact() public {
        if (!forked) vm.skip(true);
        IERC20Metadata t = IERC20Metadata(CHOG_TOKEN);
        // borrow the balance of the current owner of Chog #1 inside the fork only if it has some; else deal
        address from = makeAddr("sender");
        address to = makeAddr("receiver");
        deal(CHOG_TOKEN, from, 1_000e18);
        assertEq(t.balanceOf(from), 1_000e18, "deal worked on the real token");
        vm.prank(from);
        assertTrue(t.transfer(to, 123_456_789));
        assertEq(t.balanceOf(to), 123_456_789, "exact amount received");
        assertEq(t.balanceOf(from), 1_000e18 - 123_456_789, "exact amount sent");
    }

    /// The whole flow against the real collection and token, inside the fork.
    function test_fork_recordSpliceAgainstRealContracts() public {
        if (!forked) vm.skip(true);
        address prize = makeAddr("prize");
        ChogBreakRegistry reg = new ChogBreakRegistry(
            IERC721(CHOG_GENESIS), IERC20Metadata(CHOG_TOKEN), 10_000e18, 100e18, prize, address(this)
        );
        address lo = IERC721(CHOG_GENESIS).ownerOf(1);
        address hi = IERC721(CHOG_GENESIS).ownerOf(2);
        uint256 lo0 = IERC20Metadata(CHOG_TOKEN).balanceOf(lo);
        uint256 hi0 = IERC20Metadata(CHOG_TOKEN).balanceOf(hi);
        address splicer = makeAddr("splicer");
        deal(CHOG_TOKEN, splicer, 100e18);
        vm.startPrank(splicer);
        IERC20Metadata(CHOG_TOKEN).approve(address(reg), 100e18);
        assertTrue(reg.recordSplice(2, 1));
        vm.stopPrank();
        if (lo == hi) {
            assertEq(IERC20Metadata(CHOG_TOKEN).balanceOf(lo) - lo0, 70e18);
        } else {
            assertEq(IERC20Metadata(CHOG_TOKEN).balanceOf(lo) - lo0, 35e18);
            assertEq(IERC20Metadata(CHOG_TOKEN).balanceOf(hi) - hi0, 35e18);
        }
        assertEq(IERC20Metadata(CHOG_TOKEN).balanceOf(prize), 20e18);
    }
}
