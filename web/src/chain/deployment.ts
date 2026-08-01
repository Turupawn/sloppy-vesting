import {createContext, useContext} from "react";
import {chainFor, explorerFor} from "./config";
import type {Deployment} from "./types";

/**
 * The addresses are written by the deploy script to
 * web/public/deployments.json and read when the page boots. The same
 * build works against anvil and against a testnet: the only thing
 * that changes is that file.
 */
export async function loadDeployment(): Promise<Deployment> {
  const res = await fetch("/deployments.json", {cache: "no-store"});
  if (!res.ok) throw new Error("no deployments.json");

  const json = await res.json();
  return {
    chainId: json.chainId,
    network: chainFor(json.chainId).name,
    explorer: explorerFor(json.chainId),
    token: json.token,
    sale: json.sale,
    dev: json.dev,
  };
}

const Context = createContext<Deployment | null>(null);

export const DeploymentProvider = Context.Provider;

export function useDeployment(): Deployment {
  const deployment = useContext(Context);
  if (!deployment) throw new Error("missing <Providers>");
  return deployment;
}
