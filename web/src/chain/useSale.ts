import {useState} from "react";
import {erc20Abi} from "viem";
import {useQueryClient} from "@tanstack/react-query";
import {
  useBalance,
  useBlock,
  useReadContracts,
  useWriteContractSync,
} from "wagmi";
import {saleAbi} from "./abis";
import {useClock} from "./schedule";
import {useDeployment} from "./deployment";
import {errorMessage} from "./errors";
import type {SaleState} from "./types";

/** How often we re-read the chain. */
const REFRESH = 2_000;

/**
 * The sale's state and the two actions you can take on it: buy, and
 * (if you are the owner) withdraw the ETH.
 *
 * After every transaction it invalidates all reads, so the screen
 * catches up without any component having to remember to refresh.
 */
export function useSale() {
  const deployment = useDeployment();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>();

  const purchase = useWriteContractSync();
  const withdrawal = useWriteContractSync();

  const {data: block} = useBlock({watch: true});
  // The clock that runs between blocks, so the number moves.
  const {now, nowMs} = useClock(block?.timestamp);
  const {data: balance} = useBalance({
    address: deployment.sale,
    query: {refetchInterval: REFRESH},
  });

  const {data} = useReadContracts({
    allowFailure: false,
    contracts: [
      {address: deployment.sale, abi: saleAbi, functionName: "TOKENS_PER_ETH"},
      {address: deployment.sale, abi: saleAbi, functionName: "DURATION"},
      {address: deployment.sale, abi: saleAbi, functionName: "CLIFF"},
      {address: deployment.sale, abi: saleAbi, functionName: "owner"},
      {address: deployment.sale, abi: saleAbi, functionName: "unsold"},
      {address: deployment.sale, abi: saleAbi, functionName: "totalSold"},
      {address: deployment.sale, abi: saleAbi, functionName: "totalRaised"},
      {address: deployment.token, abi: erc20Abi, functionName: "symbol"},
      {address: deployment.token, abi: erc20Abi, functionName: "decimals"},
    ],
    query: {refetchInterval: REFRESH},
  });

  let sale: SaleState | undefined;
  if (data && block) {
    const [
      tokensPerEth,
      duration,
      cliff,
      owner,
      unsold,
      totalSold,
      totalRaised,
      symbol,
      decimals,
    ] = data;

    sale = {
      address: deployment.sale,
      token: deployment.token,
      tokensPerEth,
      duration,
      cliff,
      owner,
      unsold,
      totalSold,
      totalRaised,
      ethNotWithdrawn: balance?.value ?? 0n,
      symbol,
      decimals,
      now,
      nowMs,
      soldOut: unsold === 0n,
    };
  }

  async function buy(eth: bigint) {
    setError(undefined);
    try {
      await purchase.mutateAsync({
        address: deployment.sale,
        abi: saleAbi,
        functionName: "buy",
        value: eth,
        // Pin the chain: without this, viem signs on whatever network
        // the wallet is on at that instant, and the disabled button is
        // the only guard. With it, a wrong-network send is rejected.
        chainId: deployment.chainId,
      });
      await queryClient.invalidateQueries();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function withdrawEth() {
    setError(undefined);
    try {
      await withdrawal.mutateAsync({
        address: deployment.sale,
        abi: saleAbi,
        functionName: "withdrawEth",
        chainId: deployment.chainId,
      });
      await queryClient.invalidateQueries();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return {
    sale,
    loading: !sale,
    buy,
    buying: purchase.isPending,
    withdrawEth,
    withdrawing: withdrawal.isPending,
    error,
  };
}
