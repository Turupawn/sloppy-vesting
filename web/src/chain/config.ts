import {createConfig, http, injected, webSocket} from "wagmi";
import {anvil, hoodi, sepolia, type Chain} from "wagmi/chains";
import type {Deployment} from "./types";

/**
 * The networks this frontend knows how to run on. Adding another one
 * is one line here (plus its explorer below, if it has one).
 *
 * Holesky is not here: it was shut down in September 2025.
 */
const CHAINS: Record<number, Chain> = {
  [anvil.id]: anvil,
  [hoodi.id]: hoodi,
  [sepolia.id]: sepolia,
};

/**
 * Blockscout instances, for the "see it on the explorer" links. anvil
 * has none: a local chain has no explorer, so the links just hide.
 */
const EXPLORERS: Record<number, string> = {
  [hoodi.id]: "https://eth-hoodi.blockscout.com",
  [sepolia.id]: "https://eth-sepolia.blockscout.com",
};

export function chainFor(chainId: number): Chain {
  const chain = CHAINS[chainId];
  if (!chain) {
    throw new Error(
      `La red ${chainId} no está en src/chain/config.ts. Agregala ahí.`,
    );
  }
  return chain;
}

export function explorerFor(chainId: number): string | undefined {
  return EXPLORERS[chainId];
}

/**
 * Builds the wagmi config for the network the sale was deployed to.
 *
 * Reads go straight to the node, so the page works with no wallet
 * connected. By default it uses the network's public RPC; point it
 * somewhere else with VITE_RPC_URL.
 *
 * If that URL is `ws://` or `wss://`, blocks arrive pushed over a
 * websocket instead of polled. Careful with the expectation: that does
 * NOT make the counter smoother. The number runs on the local clock in
 * `schedule.ts`, not on the transport; blocks land every ~12s either
 * way. What the websocket buys is re-anchoring the moment a block
 * arrives instead of up to 2s later.
 *
 *   VITE_RPC_URL=wss://0xrpc.io/hoodi pnpm dev
 */
export function makeConfig(deployment: Deployment) {
  const chain = chainFor(deployment.chainId);
  const rpc = import.meta.env.VITE_RPC_URL as string | undefined;
  const isWs = !!rpc && /^wss?:\/\//.test(rpc);

  return createConfig({
    chains: [chain],
    connectors: [injected()],
    transports: {[chain.id]: isWs ? webSocket(rpc) : http(rpc)},
    // Re-read the block every 2s instead of every 4: the number on
    // screen runs by itself between blocks, but when a new one lands
    // we want to re-anchor fast. Over websocket wagmi subscribes and
    // this stops mattering.
    pollingInterval: 2_000,
  });
}
