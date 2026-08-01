import {createWalletClient, http, parseAbi, type Address} from "viem";
import {anvil} from "viem/chains";
import {publicClient, RPC} from "./accounts";
import type {PrivateKeyAccount} from "viem/accounts";

const saleAbi = parseAbi(["function buy() payable"]);

/**
 * Buys from outside the browser, to set a scene up fast. Returns the
 * purchase's block timestamp: that is when this buyer's stream
 * started, and the tests hang their clocks off it.
 */
export async function buyAs(
  account: PrivateKeyAccount,
  sale: Address,
  eth: bigint,
): Promise<bigint> {
  const wallet = createWalletClient({
    account,
    chain: anvil,
    transport: http(RPC),
  });
  const hash = await wallet.writeContract({
    address: sale,
    abi: saleAbi,
    functionName: "buy",
    value: eth,
  });
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  const block = await publicClient.getBlock({blockHash: receipt.blockHash});
  return block.timestamp;
}
