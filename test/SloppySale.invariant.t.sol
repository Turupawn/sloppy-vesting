// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SloppySale, SloppyVesting} from "../src/SloppySale.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Hammers the sale with random sequences of "someone buys",
///         "time passes", "someone claims" and "the dev withdraws".
contract SaleHandler is Test {
    SloppySale public sale;
    MockERC20 public token;
    address public dev;
    address[5] public buyers;

    /// @dev Ghost variable: ETH the dev already took.
    uint256 public ethWithdrawn;

    /// @dev Ghost variable: when each buyer's stream started.
    mapping(address buyer => uint256) public boughtAt;

    constructor(
        SloppySale sale_,
        MockERC20 token_,
        address dev_,
        address[5] memory buyers_
    ) {
        sale = sale_;
        token = token_;
        dev = dev_;
        buyers = buyers_;
    }

    function buyer(uint256 seed) public view returns (address) {
        return buyers[bound(seed, 0, buyers.length - 1)];
    }

    function buy(uint256 whoSeed, uint256 eth) external {
        address who = buyer(whoSeed);
        if (address(sale.vestingOf(who)) != address(0)) return; // one per address
        eth = bound(eth, 1, 5 ether);
        if (eth * sale.TOKENS_PER_ETH() > sale.unsold()) return;

        vm.deal(who, eth);
        vm.prank(who);
        sale.buy{value: eth}();
        boughtAt[who] = block.timestamp;
    }

    function passTime(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1, 4 minutes));
    }

    function claim(uint256 whoSeed) external {
        SloppyVesting vesting = sale.vestingOf(buyer(whoSeed));
        if (address(vesting) == address(0)) return;
        vesting.release(address(token));
    }

    function withdrawEth() external {
        uint256 amount = address(sale).balance;
        vm.prank(dev);
        sale.withdrawEth();
        ethWithdrawn += amount;
    }
}

contract SloppySaleInvariantTest is Test {
    uint64 internal constant T0 = 1_767_225_600;
    uint256 internal constant INVENTORY = 10_000_000e18;

    MockERC20 internal token;
    SloppySale internal sale;
    SaleHandler internal handler;

    address internal dev = makeAddr("dev");
    address[5] internal buyers = [
        makeAddr("ana"),
        makeAddr("beto"),
        makeAddr("carla"),
        makeAddr("dario"),
        makeAddr("eva")
    ];

    function setUp() public {
        vm.warp(T0);

        token = new MockERC20("Sloppy Token", "SLOP", 18);
        vm.prank(dev);
        sale = new SloppySale(IERC20(address(token)));
        token.mint(address(sale), INVENTORY);

        handler = new SaleHandler(sale, token, dev, buyers);

        targetContract(address(handler));
    }

    /// @dev Tokens are neither created nor lost: what is left unsold
    ///      plus what was sold is always the original inventory.
    function invariant_TheInventoryAddsUp() public view {
        assertEq(sale.unsold() + sale.totalSold(), INVENTORY);
    }

    /// @dev Every sold token sits in its buyer's stream or already in
    ///      their pocket. Nowhere else.
    function invariant_EverySoldTokenBelongsToItsBuyer() public view {
        uint256 sum;
        for (uint256 i = 0; i < buyers.length; i++) {
            SloppyVesting vesting = sale.vestingOf(buyers[i]);
            if (address(vesting) == address(0)) continue;
            sum += token.balanceOf(address(vesting));
            sum += token.balanceOf(buyers[i]);
        }
        assertEq(sum, sale.totalSold());
    }

    /// @dev The ETH can only be in the sale or in the dev's hands.
    function invariant_TheEthAddsUp() public view {
        assertEq(address(sale).balance + handler.ethWithdrawn(), sale.totalRaised());
    }

    /// @dev Before their own cliff, no buyer has a single token. Each
    ///      stream has its own clock, so the check is per buyer.
    function invariant_BeforeTheirCliffBuyersHaveNothing() public view {
        for (uint256 i = 0; i < buyers.length; i++) {
            SloppyVesting vesting = sale.vestingOf(buyers[i]);
            if (address(vesting) == address(0)) continue;
            if (block.timestamp >= vesting.cliff()) continue;
            assertEq(token.balanceOf(buyers[i]), 0);
        }
    }

    /// @dev The dev collects ETH, never tokens.
    function invariant_TheDevNeverHoldsTokens() public view {
        assertEq(token.balanceOf(dev), 0);
    }

    /// @dev Each stream belongs to its buyer and its clock started at
    ///      their purchase, cliff 30s later, end 10min later.
    function invariant_EachStreamRunsOnItsBuyersClock() public view {
        for (uint256 i = 0; i < buyers.length; i++) {
            SloppyVesting vesting = sale.vestingOf(buyers[i]);
            if (address(vesting) == address(0)) continue;
            uint256 boughtAt = handler.boughtAt(buyers[i]);
            assertEq(vesting.owner(), buyers[i]);
            assertEq(vesting.start(), boughtAt);
            assertEq(vesting.cliff(), boughtAt + 30 seconds);
            assertEq(vesting.end(), boughtAt + 10 minutes);
        }
    }
}
