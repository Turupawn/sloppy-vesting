import {parseAbi} from "viem";

/**
 * Only what the page needs from the contracts. Written by hand and in
 * plain sight, not generated: it is a handful of functions and they
 * read at a glance.
 *
 * UPPERCASE means nobody can change it, not even the dev. The `pure`
 * ones are constants of the contract, identical in every deployment;
 * TOKEN was chosen when this sale was deployed.
 */
export const saleAbi = parseAbi([
  "function TOKEN() view returns (address)",
  "function TOKENS_PER_ETH() pure returns (uint256)",
  "function DURATION() pure returns (uint64)",
  "function CLIFF() pure returns (uint64)",
  "function owner() view returns (address)",
  "function unsold() view returns (uint256)",
  "function totalSold() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function vestingOf(address buyer) view returns (address)",
  "function buy() payable",
  "function withdrawEth()",
]);

export const streamAbi = parseAbi([
  "function start() view returns (uint256)",
  "function releasable(address token) view returns (uint256)",
  "function released(address token) view returns (uint256)",
  "function release(address token)",
]);

export const NO_STREAM = "0x0000000000000000000000000000000000000000" as const;
