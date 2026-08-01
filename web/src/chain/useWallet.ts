import {
  useAccount,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import {useDeployment} from "./deployment";
import {errorMessage} from "./errors";
import type {Address} from "./types";

/**
 * The user's wallet, without the component knowing wagmi or
 * connectors exist.
 */
export function useWallet() {
  const {address, isConnected, chainId} = useAccount();
  const deployment = useDeployment();
  const connectors = useConnectors();
  const {mutate: connect, isPending, error} = useConnect();
  const {mutate: disconnect} = useDisconnect();
  const {
    mutate: switchTo,
    isPending: switching,
    error: switchError,
  } = useSwitchChain();

  const injected =
    connectors.find((c) => c.id === "injected") ?? connectors.at(0);

  const connected = isConnected && !!address;

  // The wallet has its own network and it does not have to be the
  // deployment's. Reads go straight to the node, so the page looks
  // perfectly fine either way: the numbers, the price, the clock.
  // The only thing that breaks is signing. Without this check the
  // user sees a page that works and a button that fails silently.
  const rightNetwork = !connected || chainId === deployment.chainId;

  return {
    address: address as Address | undefined,
    connected,
    connecting: isPending,
    hasWallet: !!injected,
    error: error ? errorMessage(error) : undefined,
    connect: () => {
      if (injected) connect({connector: injected});
    },
    disconnect: () => disconnect(),
    rightNetwork,
    network: deployment.network,
    switchNetwork: () => switchTo({chainId: deployment.chainId}),
    switching,
    switchError: switchError ? errorMessage(switchError) : undefined,
  };
}
