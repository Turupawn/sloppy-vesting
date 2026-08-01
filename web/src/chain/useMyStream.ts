import {useState} from "react";
import {erc20Abi} from "viem";
import {useQueryClient} from "@tanstack/react-query";
import {useReadContract, useReadContracts, useWriteContractSync} from "wagmi";
import {NO_STREAM, saleAbi, streamAbi} from "./abis";
import {perSecond, unlockedAt} from "./schedule";
import {useDeployment} from "./deployment";
import {errorMessage} from "./errors";
import {useWallet} from "./useWallet";
import type {SaleState, StreamState} from "./types";

const REFRESH = 2_000;

const min = (a: bigint, b: bigint) => (a < b ? a : b);

/**
 * The connected buyer's stream, if they bought.
 *
 * Takes the sale's state because the token metadata and the stream
 * shape (duration, cliff) come from there: they are the same for every
 * buyer and not worth re-reading. The stream's own clock is not — each
 * stream starts at its buyer's purchase, so `start` is read from the
 * buyer's own vesting contract.
 */
export function useMyStream(sale: SaleState | undefined) {
  const deployment = useDeployment();
  const {address} = useWallet();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>();
  const claimTx = useWriteContractSync();

  const {data: streamAddress} = useReadContract({
    address: deployment.sale,
    abi: saleAbi,
    functionName: "vestingOf",
    args: [address ?? NO_STREAM],
    query: {enabled: !!address, refetchInterval: REFRESH},
  });

  const has = !!streamAddress && streamAddress !== NO_STREAM;
  const myStream = streamAddress ?? NO_STREAM;

  const {data} = useReadContracts({
    allowFailure: false,
    contracts: [
      {address: myStream, abi: streamAbi, functionName: "start"},
      {
        address: myStream,
        abi: streamAbi,
        functionName: "releasable",
        args: [deployment.token],
      },
      {
        address: myStream,
        abi: streamAbi,
        functionName: "released",
        args: [deployment.token],
      },
      {
        address: deployment.token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [myStream],
      },
      {
        address: deployment.token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address ?? NO_STREAM],
      },
    ],
    query: {enabled: has, refetchInterval: REFRESH},
  });

  let stream: StreamState | undefined;
  if (has && data && sale) {
    const [start, claimable, claimed, inStream, inWallet] = data;
    const total = inStream + claimed;
    const cliff = start + sale.cliff;
    const end = start + sale.duration;

    // What the chain already confirmed, plus what has run since then.
    // Never more than what is left inside the stream.
    const unlockedLive = unlockedAt(total, start, cliff, end, sale.now);
    const claimableLive =
      unlockedLive > claimed ? min(unlockedLive - claimed, inStream) : 0n;

    stream = {
      address: myStream,
      total,
      claimable,
      claimableLive,
      unlockedLive,
      perSecond: perSecond(total, start, end),
      claimed,
      inWallet,
      start,
      cliff,
      end,
      now: sale.now,
      nowMs: sale.nowMs,
      symbol: sale.symbol,
      decimals: sale.decimals,
    };
  }

  async function claim() {
    setError(undefined);
    try {
      await claimTx.mutateAsync({
        address: myStream,
        abi: streamAbi,
        functionName: "release",
        args: [deployment.token],
        // Same reason as buy(): never sign on the wrong network.
        chainId: deployment.chainId,
      });
      await queryClient.invalidateQueries();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return {
    stream,
    bought: has,
    loading: has && !stream,
    claim,
    claiming: claimTx.isPending,
    error,
  };
}
