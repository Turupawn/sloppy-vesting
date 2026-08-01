// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {VestingWalletCliff} from "@openzeppelin/contracts/finance/VestingWalletCliff.sol";

/**
 * @title SloppyVesting
 * @notice One buyer's vesting stream. The sale deploys one per buyer,
 *         at the moment of purchase.
 *
 * @dev The whole schedule already lives in OpenZeppelin. This exists
 *      only because `VestingWalletCliff` is `abstract`: you cannot do
 *      `new VestingWalletCliff(...)`, someone has to write the concrete
 *      subclass that wires the two constructors together.
 *
 *      If we did not want a cliff, this contract would not exist:
 *      `VestingWallet` is concrete and can be instantiated directly.
 */
contract SloppyVesting is VestingWalletCliff {
    constructor(
        address beneficiary,
        uint64 startTimestamp,
        uint64 durationSeconds,
        uint64 cliffSeconds
    )
        VestingWallet(beneficiary, startTimestamp, durationSeconds)
        VestingWalletCliff(cliffSeconds)
    {}
}

/**
 * @title SloppySale
 * @notice A token sale that streams what you buy.
 *
 * Send ETH and the tokens start unlocking right away: your own
 * SloppyVesting is deployed in the same transaction, its clock starts
 * at your purchase, and after a short cliff the stream runs second by
 * second. Withdraw whatever has unlocked, whenever you want.
 *
 * The rules, all baked into the bytecode:
 *
 *  - 1 ETH buys 100,000 tokens. The stream runs for 10 minutes, with a
 *    30 second cliff: nothing unlocks, then 5% lands at once, then
 *    ~166.67 tokens per second per ETH until it is all yours.
 *  - One purchase per address. OpenZeppelin's wallet treats any token
 *    that arrives later as if it had been vesting since `start`, so a
 *    second buy into a running stream would be partly unlocked on
 *    arrival. One address, one stream, no shortcut.
 *  - The sale is open while there is inventory. No start date, no
 *    deadline: when it sells out, it is over.
 *  - The owner withdraws the ETH raised. There is no function that
 *    lets them touch the tokens: once sold, they belong to the buyer.
 *  - Unsold tokens stay locked in here forever. On purpose: only fund
 *    what you are willing to sell.
 *
 * @dev Meant for a standard 18-decimal ERC-20. Not for fee-on-transfer
 *      or rebase tokens.
 */
contract SloppySale is Ownable {
    using SafeERC20 for IERC20;

    /// @notice How many tokens one ETH buys.
    uint256 public constant TOKENS_PER_ETH = 100_000;

    /// @notice How long each buyer's stream runs, from their purchase.
    uint64 public constant DURATION = 10 minutes;

    /// @notice How long nothing unlocks, counted from the purchase.
    /// @dev A twentieth of the duration: 5% lands at the cliff.
    uint64 public constant CLIFF = 30 seconds;

    /// @notice The token being sold.
    IERC20 public immutable TOKEN;

    /// @notice Each buyer's stream. address(0) if they have not bought.
    mapping(address buyer => SloppyVesting) public vestingOf;

    /// @notice Tokens already committed to buyers.
    uint256 public totalSold;

    /// @notice ETH ever received, withdrawn or not.
    uint256 public totalRaised;

    event Purchase(address indexed buyer, uint256 eth, uint256 tokens, address vesting);
    event EthWithdrawn(address indexed to, uint256 amount);

    /// @dev buy() was called without sending ETH.
    error NoEth();

    /// @dev This address already has a running stream.
    error AlreadyBought(address vesting);

    /// @dev Not enough inventory left to cover the purchase.
    error InsufficientInventory(uint256 requested, uint256 available);

    /// @param token_ The ERC-20 being sold. The only thing you choose:
    ///        everything else is a constant above.
    constructor(IERC20 token_) Ownable(msg.sender) {
        TOKEN = token_;
    }

    /**
     * @notice Buy tokens by sending ETH. Your own vesting stream is
     *         deployed here and now, and its clock starts immediately.
     */
    function buy() external payable {
        if (msg.value == 0) revert NoEth();
        if (address(vestingOf[msg.sender]) != address(0)) {
            revert AlreadyBought(address(vestingOf[msg.sender]));
        }

        uint256 tokens = msg.value * TOKENS_PER_ETH;
        uint256 available = unsold();
        if (tokens > available) revert InsufficientInventory(tokens, available);

        SloppyVesting vesting =
            new SloppyVesting(msg.sender, uint64(block.timestamp), DURATION, CLIFF);
        vestingOf[msg.sender] = vesting;

        totalSold += tokens;
        totalRaised += msg.value;

        emit Purchase(msg.sender, msg.value, tokens, address(vesting));

        TOKEN.safeTransfer(address(vesting), tokens);
    }

    /// @notice Tokens still up for sale.
    function unsold() public view returns (uint256) {
        return TOKEN.balanceOf(address(this));
    }

    /// @notice The owner withdraws all the ETH raised so far.
    function withdrawEth() external onlyOwner {
        uint256 amount = address(this).balance;
        emit EthWithdrawn(owner(), amount);
        Address.sendValue(payable(owner()), amount);
    }
}
