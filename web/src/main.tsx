import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import "@fontsource-variable/unbounded";
import "@fontsource-variable/jetbrains-mono";
import {loadDeployment, Providers} from "./chain";
import {App} from "./components/App";
import {MissingDeployment} from "./components/MissingDeployment";
import "./index.css";

// The addresses are read before mounting anything: they also say which
// network we are on, and the wagmi config is built from that.
const deployment = await loadDeployment().catch((e: unknown) => {
  console.error(e);
  return e instanceof Error ? e.message : String(e);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {typeof deployment === "string" ? (
      <MissingDeployment reason={deployment} />
    ) : (
      <Providers deployment={deployment}>
        <App />
      </Providers>
    )}
  </StrictMode>,
);
