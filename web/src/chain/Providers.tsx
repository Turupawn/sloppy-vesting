import {useState, type ReactNode} from "react";
import {WagmiProvider} from "wagmi";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {makeConfig} from "./config";
import {DeploymentProvider} from "./deployment";
import type {Deployment} from "./types";

/**
 * Wraps the app with everything it needs to talk to the chain. This
 * is all main.tsx knows about wagmi.
 */
export function Providers({
  deployment,
  children,
}: {
  deployment: Deployment;
  children: ReactNode;
}) {
  const [config] = useState(() => makeConfig(deployment));
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <DeploymentProvider value={deployment}>{children}</DeploymentProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
