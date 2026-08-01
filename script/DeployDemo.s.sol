// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SloppySale} from "../src/SloppySale.sol";

/// @notice Toy token for the demo. In production you sell your own.
contract DemoToken is ERC20 {
    constructor(uint256 supply) ERC20("Sloppy Token", "SLOP") {
        _mint(msg.sender, supply);
    }
}

/**
 * @notice One command and everything is live: token, sale, inventory
 *         already transferred. At the end it writes the addresses to
 *         web/public/deployments.json, which is where the frontend
 *         reads them from.
 *
 * On anvil:  make deploy-local
 * On Hoodi:  make deploy-hoodi
 */
contract DeployDemo is Script {
    uint256 public constant INVENTORY = 10_000_000e18;

    function run() external returns (DemoToken token, SloppySale sale) {
        vm.startBroadcast();

        token = new DemoToken(INVENTORY);
        sale = new SloppySale(IERC20(address(token)));
        require(token.transfer(address(sale), INVENTORY), "funding failed");

        vm.stopBroadcast();

        require(sale.unsold() == INVENTORY, "the sale has no stock");
        require(sale.owner() == tx.origin, "wrong owner");

        _writeDeployments(address(token), address(sale));
        _print(address(token), address(sale));
    }

    /// @dev What the frontend reads on boot.
    function _writeDeployments(address token, address sale) internal {
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "token", token);
        vm.serializeAddress(obj, "sale", sale);
        string memory json = vm.serializeAddress(obj, "dev", tx.origin);
        vm.writeJson(json, "./web/public/deployments.json");
    }

    function _print(address token, address sale) internal view {
        console2.log("");
        console2.log("=== Live ===");
        console2.log("chain id :", block.chainid);
        console2.log("token    :", token);
        console2.log("sale     :", sale);
        console2.log("dev      :", tx.origin);
        console2.log("");
        console2.log("price    : 1 ETH = 100,000 SLOP");
        console2.log("stock    : 10,000,000 SLOP");
        console2.log("stream   : 10 minutes, 30 second cliff");
        console2.log("rate     : ~166.67 SLOP per second per ETH");
        console2.log("");
        console2.log("Buy whenever: each purchase starts its own stream.");
        console2.log("Addresses written to web/public/deployments.json");
        console2.log("Start the frontend with:  make web");
    }
}
