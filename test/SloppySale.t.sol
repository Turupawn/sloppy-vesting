// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SloppySale, SloppyVesting} from "../src/SloppySale.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Tests for the whole sale against the spec in SPEC.md.
///         Concrete numbers: 1 ETH = 100,000 SLOP, a 10 minute stream
///         with a 30 second cliff.
contract SloppySaleTest is Test {
    // January 1st 2026, 00:00 UTC. Fixed, so the tests do not depend
    // on when they run.
    uint64 internal constant T0 = 1_767_225_600;

    uint256 internal constant TOKENS_PER_ETH = 100_000;
    uint256 internal constant INVENTORY = 10_000_000e18;

    /// 1 ETH buys this.
    uint256 internal constant PER_ETH = 100_000e18;
    /// What lands at once at the cliff: 30 seconds of 10 minutes, 5%.
    uint256 internal constant AT_THE_CLIFF = PER_ETH / 20;

    MockERC20 internal token;
    SloppySale internal sale;

    address internal dev = makeAddr("dev");
    address internal ana = makeAddr("ana");
    address internal beto = makeAddr("beto");

    event Purchase(address indexed buyer, uint256 eth, uint256 tokens, address vesting);

    function setUp() public {
        vm.warp(T0);

        token = new MockERC20("Sloppy Token", "SLOP", 18);

        vm.prank(dev);
        sale = new SloppySale(IERC20(address(token)));

        // The dev funds the sale with the inventory they want to sell.
        token.mint(address(sale), INVENTORY);

        vm.deal(ana, 100 ether);
        vm.deal(beto, 100 ether);
    }

    function _buy(address who, uint256 eth) internal returns (SloppyVesting) {
        vm.prank(who);
        sale.buy{value: eth}();
        return sale.vestingOf(who);
    }

    function _claim(address who) internal {
        vm.prank(who);
        sale.vestingOf(who).release(address(token));
    }

    // ---------------------------------------------------------------
    // How the sale comes wired
    // ---------------------------------------------------------------

    function test_EverythingIsBakedIn() public view {
        assertEq(sale.owner(), dev, "the dev owns the sale");
        assertEq(address(sale.TOKEN()), address(token), "token");
        assertEq(sale.TOKENS_PER_ETH(), TOKENS_PER_ETH, "price");
        assertEq(sale.DURATION(), 10 minutes, "10 minute stream");
        assertEq(sale.CLIFF(), 30 seconds, "30 second cliff");
        assertEq(sale.unsold(), INVENTORY, "inventory");
    }

    // ---------------------------------------------------------------
    // Buying
    // ---------------------------------------------------------------

    function test_BuyingOneEthStartsAStreamWithAHundredThousandTokens() public {
        // The vesting's address is deterministic (CREATE, sale's nonce),
        // so the event can be checked whole: buyer, eth, tokens and the
        // stream's address. A partial check here would let buy() emit
        // garbage data and still pass the suite.
        address expectedVesting =
            vm.computeCreateAddress(address(sale), vm.getNonce(address(sale)));
        vm.expectEmit(address(sale));
        emit Purchase(ana, 1 ether, PER_ETH, expectedVesting);

        SloppyVesting vesting = _buy(ana, 1 ether);
        assertEq(address(vesting), expectedVesting, "announced address");

        assertTrue(address(vesting) != address(0), "the stream exists");
        assertEq(token.balanceOf(address(vesting)), PER_ETH, "tokens");
        assertEq(token.balanceOf(ana), 0, "nothing unlocked yet");

        assertEq(sale.totalSold(), PER_ETH, "sold");
        assertEq(sale.totalRaised(), 1 ether, "raised");
        assertEq(address(sale).balance, 1 ether, "the eth stays");
        assertEq(sale.unsold(), INVENTORY - PER_ETH, "inventory");
    }

    function test_TheClockStartsAtThePurchase() public {
        vm.warp(T0 + 123);
        SloppyVesting vesting = _buy(ana, 1 ether);

        assertEq(vesting.owner(), ana, "the stream belongs to ana");
        assertEq(vesting.start(), T0 + 123, "starts right now");
        assertEq(vesting.cliff(), T0 + 123 + 30, "cliff 30s later");
        assertEq(vesting.end(), T0 + 123 + 10 minutes, "ends 10min later");
    }

    function test_EachBuyerGetsTheirOwnClock() public {
        SloppyVesting anas = _buy(ana, 1 ether);

        vm.warp(T0 + 60);
        SloppyVesting betos = _buy(beto, 2 ether);

        assertTrue(address(anas) != address(betos), "separate streams");
        assertEq(anas.owner(), ana);
        assertEq(betos.owner(), beto);
        assertEq(anas.start(), T0, "ana's clock");
        assertEq(betos.start(), T0 + 60, "beto's own clock");
        assertEq(token.balanceOf(address(betos)), 2 * PER_ETH);
    }

    function test_RevertWhen_BuyingTwice() public {
        SloppyVesting vesting = _buy(ana, 1 ether);

        // A second buy would land tokens in a stream that already ran
        // for a while, and OpenZeppelin treats late arrivals as vested
        // from `start`. One address, one stream.
        vm.warp(T0 + 5 minutes);
        vm.expectRevert(
            abi.encodeWithSelector(SloppySale.AlreadyBought.selector, address(vesting))
        );
        vm.prank(ana);
        sale.buy{value: 1 ether}();
    }

    function test_RevertWhen_BuyingWithoutEth() public {
        vm.expectRevert(SloppySale.NoEth.selector);
        vm.prank(ana);
        sale.buy{value: 0}();
    }

    function test_RevertWhen_InventoryDoesNotCover() public {
        uint256 tooMuch = 1001 ether; // would ask for 100,100,000 tokens
        vm.deal(ana, tooMuch);

        vm.expectRevert(
            abi.encodeWithSelector(
                SloppySale.InsufficientInventory.selector,
                tooMuch * TOKENS_PER_ETH,
                INVENTORY
            )
        );
        vm.prank(ana);
        sale.buy{value: tooMuch}();
    }

    function test_EthOnlyEntersThroughBuy() public {
        vm.prank(ana);
        (bool ok,) = address(sale).call{value: 1 ether}("");

        assertFalse(ok, "no receive, no fallback");
        assertEq(address(sale).balance, 0);
    }

    // ---------------------------------------------------------------
    // Claiming from the stream
    // ---------------------------------------------------------------

    function test_NothingUnlocksBeforeTheCliff() public {
        SloppyVesting vesting = _buy(ana, 1 ether);

        vm.warp(T0 + 30 - 1);
        assertEq(vesting.releasable(address(token)), 0, "one second before");

        _claim(ana);
        assertEq(token.balanceOf(ana), 0, "nothing came out");
    }

    function test_TheCliffDropsFivePercentAtOnce() public {
        SloppyVesting vesting = _buy(ana, 1 ether);

        vm.warp(T0 + 30);
        assertEq(vesting.releasable(address(token)), AT_THE_CLIFF);

        _claim(ana);
        assertEq(token.balanceOf(ana), AT_THE_CLIFF, "5,000 SLOP");
        assertEq(vesting.releasable(address(token)), 0, "nothing left over");
    }

    function test_HalfwayThroughHalfIsUnlocked() public {
        SloppyVesting vesting = _buy(ana, 1 ether);

        vm.warp(T0 + 5 minutes);
        assertEq(vesting.releasable(address(token)), PER_ETH / 2);
    }

    /// @dev At this rate ~166.67 tokens unlock per second. That is the
    ///      whole point of the demo: you watch the number run.
    function test_EverySecondUnlocksItsShare() public {
        SloppyVesting vesting = _buy(ana, 1 ether);

        vm.warp(T0 + 5 minutes);
        uint256 before = vesting.releasable(address(token));

        vm.warp(T0 + 5 minutes + 1);
        uint256 later = vesting.releasable(address(token));

        assertEq(later - before, PER_ETH / (10 minutes), "per second");
        assertApproxEqAbs(later - before, 166.67e18, 0.01e18, "~166.67 SLOP");
    }

    function test_AtTheEndEverythingIsClaimable() public {
        SloppyVesting vesting = _buy(ana, 1 ether);

        vm.warp(T0 + 10 minutes);
        _claim(ana);

        assertEq(token.balanceOf(ana), PER_ETH, "100,000 SLOP");
        assertEq(token.balanceOf(address(vesting)), 0, "stream drained");
    }

    function test_ClaimingInSipsEqualsClaimingInOneGulp() public {
        _buy(ana, 1 ether);
        _buy(beto, 1 ether);

        // Ana claims at the cliff, at the half and at the end.
        vm.warp(T0 + 30);
        _claim(ana);
        vm.warp(T0 + 5 minutes);
        _claim(ana);
        vm.warp(T0 + 10 minutes);
        _claim(ana);

        // Beto waits and claims once.
        _claim(beto);

        assertEq(token.balanceOf(ana), token.balanceOf(beto));
        assertEq(token.balanceOf(ana), PER_ETH);
    }

    function test_AnyoneCanTriggerTheClaimButTheBuyerGetsPaid() public {
        SloppyVesting vesting = _buy(ana, 1 ether);
        vm.warp(T0 + 10 minutes);

        // Even the dev can pay the gas for ana's claim.
        vm.prank(dev);
        vesting.release(address(token));

        assertEq(token.balanceOf(ana), PER_ETH, "ana gets paid");
        assertEq(token.balanceOf(dev), 0, "the dev does not");
    }

    // ---------------------------------------------------------------
    // The dev's ETH
    // ---------------------------------------------------------------

    function test_TheDevWithdrawsTheEthRaised() public {
        _buy(ana, 1 ether);
        _buy(beto, 2 ether);

        vm.prank(dev);
        sale.withdrawEth();

        assertEq(dev.balance, 3 ether, "the dev got paid");
        assertEq(address(sale).balance, 0, "the sale is empty");
        assertEq(sale.totalRaised(), 3 ether, "history does not change");
    }

    function test_RevertWhen_AStrangerWithdrawsTheEth() public {
        _buy(ana, 1 ether);

        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ana)
        );
        vm.prank(ana);
        sale.withdrawEth();
    }

    /// @dev The property that matters: the dev collects the ETH and can
    ///      never touch the tokens already sold. The function is not there.
    function test_TheDevCannotTouchSoldTokens() public {
        SloppyVesting vesting = _buy(ana, 1 ether);

        vm.startPrank(dev);
        (bool ok,) = address(sale).call(abi.encodeWithSignature("withdrawTokens()"));
        assertFalse(ok, "withdrawTokens does not exist");

        (ok,) = address(vesting)
            .call(abi.encodeWithSignature("transferOwnership(address)", dev));
        assertFalse(ok, "the stream is not theirs");
        vm.stopPrank();

        assertEq(token.balanceOf(address(vesting)), PER_ETH, "untouched");
        assertEq(vesting.owner(), ana, "still ana's");
    }

    // ---------------------------------------------------------------
    // Fuzzing
    // ---------------------------------------------------------------

    function testFuzz_TokensAreProportionalToEth(uint256 eth) public {
        eth = bound(eth, 1, INVENTORY / TOKENS_PER_ETH);
        vm.deal(ana, eth);

        SloppyVesting vesting = _buy(ana, eth);

        assertEq(token.balanceOf(address(vesting)), eth * TOKENS_PER_ETH);
        assertEq(sale.totalRaised(), eth);
    }

    function testFuzz_YouNeverClaimMoreThanYouBought(uint256 eth, uint64 t) public {
        eth = bound(eth, 1, 50 ether);
        vm.deal(ana, eth);
        _buy(ana, eth);

        t = uint64(bound(t, T0, type(uint64).max));
        vm.warp(t);
        _claim(ana);

        assertLe(token.balanceOf(ana), eth * TOKENS_PER_ETH);
    }

    function testFuzz_WhatLeavesTheSaleIsExactlyWhatWasSold(
        uint256 ethAna,
        uint256 ethBeto
    ) public {
        ethAna = bound(ethAna, 1, 50 ether);
        ethBeto = bound(ethBeto, 1, 50 ether);
        vm.deal(ana, ethAna);
        vm.deal(beto, ethBeto);

        _buy(ana, ethAna);
        _buy(beto, ethBeto);

        assertEq(
            sale.unsold() + sale.totalSold(),
            INVENTORY,
            "inventory is neither created nor lost"
        );
    }

    /// @dev The claimable amount never exceeds the linear schedule, at
    ///      any point in time, no matter when the buyer bought.
    function testFuzz_TheStreamNeverRunsAheadOfItsSchedule(
        uint64 buyDelay,
        uint64 elapsed
    ) public {
        buyDelay = uint64(bound(buyDelay, 0, 30 days));
        elapsed = uint64(bound(elapsed, 0, 20 minutes));

        vm.warp(T0 + buyDelay);
        SloppyVesting vesting = _buy(ana, 1 ether);
        uint64 start = uint64(block.timestamp);

        vm.warp(start + elapsed);
        uint256 claimable = vesting.releasable(address(token));

        if (elapsed < 30) {
            assertEq(claimable, 0, "cliff still closed");
        } else if (elapsed >= 10 minutes) {
            assertEq(claimable, PER_ETH, "all of it");
        } else {
            assertEq(claimable, PER_ETH * elapsed / (10 minutes), "linear");
        }
    }

    // ---------------------------------------------------------------
    // For the demo: forge test --mt test_Schedule -vv
    // ---------------------------------------------------------------

    function test_Schedule() public {
        SloppyVesting vesting = _buy(ana, 1 ether);

        console2.log("Ana sends 1 ETH and 100,000 SLOP start streaming");
        console2.log("");
        _row(vesting, "purchase (clock starts)", T0);
        _row(vesting, "1 s before the cliff   ", T0 + 29);
        _row(vesting, "the cliff (30 s)       ", T0 + 30);
        _row(vesting, "1 minute               ", T0 + 1 minutes);
        _row(vesting, "2 minutes 30           ", T0 + 150);
        _row(vesting, "5 minutes (half)       ", T0 + 5 minutes);
        _row(vesting, "10 minutes (the end)   ", T0 + 10 minutes);
    }

    function _row(SloppyVesting vesting, string memory label, uint64 t) internal view {
        uint256 free = vesting.vestedAmount(address(token), t);
        console2.log(
            string.concat(
                label,
                " | ",
                _dec2(free, 1e18),
                " SLOP (",
                _dec2(free * 100, PER_ETH),
                "%)"
            )
        );
    }

    /// @dev Prints `v / unit` with two decimals, rounding.
    function _dec2(uint256 v, uint256 unit) internal pure returns (string memory) {
        uint256 whole = v / unit;
        uint256 cents = ((v % unit) * 100 + unit / 2) / unit;
        if (cents >= 100) {
            whole += 1;
            cents = 0;
        }
        return
            string.concat(
                vm.toString(whole), ".", cents < 10 ? "0" : "", vm.toString(cents)
            );
    }
}
