import {useSale, useWallet} from "../chain";
import {amount} from "../format";

/**
 * Only shows up when the connected account deployed the sale. This is
 * everything the dev can do: take the ETH.
 */
export function DevPanel() {
  const {sale, withdrawEth, withdrawing, error} = useSale();
  const wallet = useWallet();

  if (!sale) return null;

  return (
    <section className="card card--dev" data-testid="dev-panel">
      <p className="card__eyebrow">
        Panel del dev
        <span className="card__address">esta cuenta desplegó la venta</span>
      </p>

      <div className="dev">
        <div>
          <span className="dev__label">ETH sin retirar</span>
          <span className="dev__amount" data-testid="eth-in-sale">
            {amount(sale.ethNotWithdrawn, 18)} ETH
          </span>
        </div>
        <button
          className="button"
          disabled={
            sale.ethNotWithdrawn === 0n || withdrawing || !wallet.rightNetwork
          }
          onClick={withdrawEth}
          data-testid="withdraw-eth"
        >
          {withdrawing
            ? "Confirmando…"
            : !wallet.rightNetwork
              ? `Cambiá a ${wallet.network}`
              : "Retirar el ETH"}
        </button>
      </div>

      <p className="actions__note">
        No hay ninguna función para sacar tokens. Lo que ya se vendió está en
        el stream de cada comprador y no vuelve.
      </p>
      {error && <p className="actions__note actions__note--error">{error}</p>}
    </section>
  );
}
