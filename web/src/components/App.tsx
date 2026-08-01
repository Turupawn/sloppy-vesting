import {useDeployment, useMyStream, useSale, useWallet} from "../chain";
import {DevPanel} from "./DevPanel";
import {MyStream} from "./MyStream";
import {Sale} from "./Sale";
import {Wallet} from "./Wallet";

export function App() {
  const deployment = useDeployment();
  const {sale, loading} = useSale();
  const wallet = useWallet();
  const {bought} = useMyStream(sale);

  const isDev =
    !!wallet.address &&
    !!sale &&
    wallet.address.toLowerCase() === sale.owner.toLowerCase();

  return (
    <main className="page">
      <header className="topbar">
        <h1 className="topbar__brand">
          Sloppy<span className="topbar__brand-accent">Sale</span>
        </h1>
        <Wallet />
        <p className="topbar__sub">
          <a
            className="topbar__address"
            data-testid="sale-address"
            {...(deployment.explorer
              ? {
                  href: `${deployment.explorer}/address/${deployment.sale}`,
                  target: "_blank",
                  rel: "noreferrer",
                }
              : {})}
          >
            {deployment.sale}
          </a>
          <span className="topbar__network" data-testid="network">
            {deployment.network} · {deployment.chainId}
          </span>
        </p>
      </header>

      {wallet.connected && !wallet.rightNetwork && (
        <div className="notice notice--error" data-testid="wrong-network">
          <p>
            Tu billetera está en otra red. Las lecturas de abajo salen del
            nodo, por eso se ven bien, pero para firmar tenés que estar en{" "}
            {wallet.network}.
          </p>
          <p className="notice__action">
            <button
              className="button"
              onClick={wallet.switchNetwork}
              disabled={wallet.switching}
              data-testid="switch-network"
            >
              {wallet.switching ? "Cambiando…" : `Cambiar a ${wallet.network}`}
            </button>
          </p>
          {wallet.switchError && (
            <p className="notice__action">{wallet.switchError}</p>
          )}
        </div>
      )}

      {/* The arc of the page: the buy card is the hero until you buy;
          the moment you do, your stream takes the stage. */}
      {loading ? (
        <p className="notice">Leyendo la venta…</p>
      ) : bought ? (
        <>
          <MyStream />
          <Sale />
        </>
      ) : (
        <>
          <Sale />
          <MyStream />
        </>
      )}
      {isDev && <DevPanel />}
    </main>
  );
}
