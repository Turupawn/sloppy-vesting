/**
 * The types the chain layer exposes to the outside.
 *
 * Deliberately no wagmi or viem types here: components work with
 * bigint, string and number, nothing else.
 */

export type Address = `0x${string}`;

/** What the deploy script wrote. */
export type Deployment = {
  chainId: number;
  /** Human-readable network name, for the header. */
  network: string;
  /** Block explorer base URL, if this network has one. */
  explorer?: string;
  token: Address;
  sale: Address;
  dev: Address;
};

/** Everything the page needs to know about the sale. */
export type SaleState = {
  address: Address;
  token: Address;
  tokensPerEth: bigint;
  /** Stream length and cliff, in seconds. Constants of the contract. */
  duration: bigint;
  cliff: bigint;
  owner: Address;
  unsold: bigint;
  totalSold: bigint;
  totalRaised: bigint;
  ethNotWithdrawn: bigint;
  symbol: string;
  decimals: number;
  /** The clock, anchored to the last block, running between blocks. */
  now: bigint;
  /** Same clock with millisecond precision. Display only. */
  nowMs: number;
  soldOut: boolean;
};

/** The connected buyer's stream. */
export type StreamState = {
  address: Address;
  total: bigint;
  /** What the chain said on the last read. */
  claimable: bigint;
  /** Same, but running second by second. What gates the button. */
  claimableLive: bigint;
  unlockedLive: bigint;
  /** Tokens per second, to show how fast it runs. */
  perSecond: bigint;
  claimed: bigint;
  inWallet: bigint;
  start: bigint;
  cliff: bigint;
  end: bigint;
  now: bigint;
  nowMs: number;
  symbol: string;
  decimals: number;
};
