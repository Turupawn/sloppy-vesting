import type {Page} from "@playwright/test";
import type {Address} from "viem";
import {RPC} from "../../local/accounts";

/**
 * Injects a real EIP-1193 wallet into the page before it loads, the
 * same way an extension would.
 *
 * It signs nothing by itself: every call is forwarded to anvil's RPC,
 * which has these accounts unlocked. The test walks the same path a
 * MetaMask user does (connect, eth_sendTransaction, wait for the
 * receipt) without depending on an extension.
 */
export async function injectWallet(page: Page, account: Address) {
  await page.addInitScript(
    ({account, rpc}: {account: string; rpc: string}) => {
      let id = 1;
      // Starts unauthorized, like a wallet that has not granted this
      // site anything yet. The test has to actually press "Conectar"
      // instead of finding the session already open.
      let authorized = false;

      const provider = {
        isMetaMask: true,
        async request({
          method,
          params,
        }: {
          method: string;
          params?: unknown[];
        }) {
          if (method === "eth_requestAccounts") {
            authorized = true;
            return [account];
          }
          if (method === "eth_accounts") {
            return authorized ? [account] : [];
          }
          if (method === "wallet_switchEthereumChain") return null;
          if (method.startsWith("wallet_")) {
            throw Object.assign(new Error(`${method} not supported`), {
              code: 4200,
            });
          }

          const res = await fetch(rpc, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: id++,
              method,
              params: params ?? [],
            }),
          });
          const body = await res.json();
          if (body.error) {
            throw Object.assign(new Error(body.error.message), {
              code: body.error.code,
            });
          }
          return body.result;
        },
        on() {},
        removeListener() {},
      };

      (window as unknown as {ethereum: unknown}).ethereum = provider;

      // EIP-6963, which is how wagmi discovers wallets today.
      const info = {
        uuid: "00000000-0000-4000-8000-000000000001",
        name: "Anvil",
        icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
        rdns: "dev.anvil.wallet",
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: Object.freeze({info, provider}),
          }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    {account, rpc: RPC},
  );
}

/** Injects the wallet, opens the page and presses "Conectar". */
export async function connectAs(page: Page, account: Address) {
  await injectWallet(page, account);
  await page.goto("/");
  await page.getByTestId("connect").click();
  await page.getByTestId("account").waitFor();
}
