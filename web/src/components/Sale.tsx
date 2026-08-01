import {useState} from "react";
import {useMyStream, useSale, useWallet} from "../chain";
import {amount, integer, toWei} from "../format";
import {Row} from "./Row";

export function Sale() {
  const {sale, buy, buying, error} = useSale();
  const wallet = useWallet();
  const {bought} = useMyStream(sale);
  const [eth, setEth] = useState("1");

  if (!sale) return null;

  const value = toWei(eth);
  const tokens = value === null ? 0n : value * sale.tokensPerEth;
  const covered = tokens > 0n && tokens <= sale.unsold;

  return (
    <section className="card">
      <div className="price">
        <span className="price__amount" data-testid="price">
          1 ETH = {integer(sale.tokensPerEth)} {sale.symbol}
        </span>
        <span className="price__terms">
          el stream corre {Number(sale.duration) / 60} minutos · a los{" "}
          {Number(sale.cliff)} segundos cae el 5% de golpe
        </span>
      </div>

      {bought ? (
        <p className="state" data-testid="already-bought">
          Tu stream ya está corriendo. Una compra por dirección: así nadie
          mete tokens nuevos a un reloj que ya avanzó.
        </p>
      ) : sale.soldOut ? (
        <p className="state" data-testid="sold-out">
          Se agotó. Los {integer(sale.totalSold / 10n ** BigInt(sale.decimals))}{" "}
          {sale.symbol} están en los streams de sus compradores.
        </p>
      ) : (
        <>
          <div className="purchase">
            <label className="purchase__field">
              <span className="purchase__label">Mandás</span>
              <span className="purchase__entry">
                <input
                  className="purchase__input"
                  value={eth}
                  onChange={(e) => setEth(e.target.value)}
                  inputMode="decimal"
                  aria-label="ETH a mandar"
                  data-testid="eth-input"
                />
                <span className="purchase__unit">ETH</span>
              </span>
            </label>

            <span className="purchase__arrow" aria-hidden="true">
              →
            </span>

            <div className="purchase__field">
              <span className="purchase__label">Empieza a streamear</span>
              <span className="purchase__quote" data-testid="quote">
                {value === null
                  ? "—"
                  : `${amount(tokens, sale.decimals)} ${sale.symbol}`}
              </span>
            </div>
          </div>

          <button
            className="button button--primary"
            disabled={
              !wallet.connected || !wallet.rightNetwork || !covered || buying
            }
            onClick={() => value !== null && buy(value)}
            data-testid="buy"
          >
            {buying
              ? "Confirmando…"
              : !wallet.rightNetwork
                ? `Cambiá tu billetera a ${wallet.network}`
                : value === null
                  ? "Escribí un monto válido"
                  : !covered
                    ? "No alcanza el inventario"
                    : `Comprar ${amount(tokens, sale.decimals)} ${sale.symbol}`}
          </button>

          {!wallet.connected && (
            <p className="actions__note">Conectá una billetera para comprar.</p>
          )}
          {error && (
            <p className="actions__note actions__note--error">{error}</p>
          )}
        </>
      )}

      <div className="book">
        <Row
          label="Sin vender"
          value={`${amount(sale.unsold, sale.decimals)} ${sale.symbol}`}
          testid="unsold"
        />
        <Row
          label="Vendido"
          value={`${amount(sale.totalSold, sale.decimals)} ${sale.symbol}`}
          testid="total-sold"
        />
        <Row
          label="Recaudado"
          value={`${amount(sale.totalRaised, 18)} ETH`}
          testid="total-raised"
        />
      </div>
    </section>
  );
}
