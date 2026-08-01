import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {anvil} from "viem/chains";

export const RPC = "http://127.0.0.1:8545";

/**
 * anvil's deterministic accounts. They are public and known to the
 * whole world: only good for the local chain.
 *
 * The dev deploys and collects the ETH. Ana and Beto buy.
 */
export const accounts = {
  dev: privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  ),
  ana: privateKeyToAccount(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  ),
  beto: privateKeyToAccount(
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  ),
};

export const publicClient = createPublicClient({
  chain: anvil,
  transport: http(RPC),
});

export const walletClient = createWalletClient({
  account: accounts.dev,
  chain: anvil,
  transport: http(RPC),
});

export const testClient = createTestClient({
  chain: anvil,
  mode: "anvil",
  transport: http(RPC),
});

/** Mines one block with an exact timestamp. */
export async function travelTo(timestamp: bigint) {
  await testClient.setNextBlockTimestamp({timestamp});
  await testClient.mine({blocks: 1});
}

/**
 * Fixes the next block's timestamp without mining it, so the incoming
 * transaction lands on the exact second we want and the test's numbers
 * are always the same.
 */
export async function pinNextBlock(timestamp: bigint) {
  await testClient.setNextBlockTimestamp({timestamp});
}
