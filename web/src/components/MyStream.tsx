import {unlockedAtMs, useMyStream, useSale, useWallet, useDeployment} from "../chain";
import {amount, amountFloat, remaining, shortAddress} from "../format";
import {Row} from "./Row";
import {StreamChart} from "./StreamChart";

/**
 * The hero of the page once you bought: the pump-style counter, the
 * live chart and the claim button. Before the cliff the same slot
 * holds the countdown — the suspense and the payoff share a stage.
 */
export function MyStream() {
  const deployment = useDeployment();
  const {sale} = useSale();
  const wallet = useWallet();
  const {stream, bought, claim, claiming, error} = useMyStream(sale);

  if (!wallet.connected) {
    return (
      <section className="card card--empty">
        <p className="card__hint">Conectá tu billetera para ver tu stream.</p>
      </section>
    );
  }

  if (!bought) {
    return (
      <section className="card card--empty" data-testid="no-purchase">
        <p className="card__hint">
          Todavía no compraste con esta cuenta. Cuando compres, tu stream
          arranca en ese mismo instante y aparece acá.
        </p>
      </section>
    );
  }

  if (!stream) return <p className="notice">Leyendo tu stream…</p>;

  // Everything the display needs, at millisecond precision. Floats,
  // display only: what you actually claim is computed on-chain.
  const scale = 10 ** stream.decimals;
  const totalNum = Number(stream.total) / scale;
  const claimedNum = Number(stream.claimed) / scale;
  const startMs = Number(stream.start) * 1000;
  const cliffMs = Number(stream.cliff) * 1000;
  const endMs = Number(stream.end) * 1000;

  const unlockedNow = unlockedAtMs(
    totalNum,
    startMs,
    cliffMs,
    endMs,
    stream.nowMs,
  );
  const claimableNow = Math.max(0, unlockedNow - claimedNum);

  const beforeCliff = stream.nowMs < cliffMs;
  const done = stream.now >= stream.end;
  const cliffDrop = totalNum / 20; // 5% lands at once
  const secondsToCliff = (cliffMs - stream.nowMs) / 1000;

  const explorer = deployment.explorer;

  return (
    <section className="card card--stream" data-testid="my-stream">
      <p className="card__eyebrow">
        Tu stream
        <a
          className="card__address"
          data-testid="stream-address"
          {...(explorer
            ? {href: `${explorer}/address/${stream.address}`, target: "_blank", rel: "noreferrer"}
            : {})}
        >
          {stream.address}
        </a>
      </p>

      {beforeCliff ? (
        <div className="hero hero--cliff" data-testid="cliff-countdown">
          <span className="hero__label">El cliff abre en</span>
          <span className="hero__number hero__number--amber">
            {Math.max(0, secondsToCliff).toFixed(1)}
            <span className="hero__symbol"> s</span>
          </span>
          <span className="hero__sub">
            y suelta {amountFloat(cliffDrop)} {stream.symbol} de una
          </span>
        </div>
      ) : (
        <div className="hero">
          <span className="hero__label">Para retirar</span>
          <span className="hero__number" data-testid="hero-number">
            {amountFloat(claimableNow)}
            <span className="hero__symbol"> {stream.symbol}</span>
          </span>
          <span className="hero__sub" data-testid="rate">
            {done
              ? "Stream completo. Ya no corre más."
              : `+${amount(stream.perSecond, stream.decimals)} ${stream.symbol} por segundo · termina en ${remaining(stream.now, stream.end)}`}
          </span>
        </div>
      )}

      <StreamChart
        startMs={startMs}
        cliffMs={cliffMs}
        endMs={endMs}
        nowMs={stream.nowMs}
        total={totalNum}
        claimed={claimedNum}
        symbol={stream.symbol}
      />

      <div className="actions">
        <button
          className="button button--primary"
          disabled={
            stream.claimableLive === 0n || claiming || !wallet.rightNetwork
          }
          onClick={claim}
          data-testid="claim"
        >
          {claiming
            ? "Confirmando…"
            : !wallet.rightNetwork
              ? `Cambiá tu billetera a ${wallet.network}`
              : stream.claimableLive === 0n
                ? "Nada para retirar todavía"
                : `Retirar ${amount(stream.claimableLive, stream.decimals)} ${stream.symbol}`}
        </button>
        {error && <p className="actions__note actions__note--error">{error}</p>}
      </div>

      <div className="book">
        <Row
          label="Te tocan en total"
          value={`${amount(stream.total, stream.decimals)} ${stream.symbol}`}
          testid="my-total"
        />
        <Row
          label="Ya retirado"
          value={`${amount(stream.claimed, stream.decimals)} ${stream.symbol}`}
          testid="claimed"
        />
        <Row
          label={`En tu billetera (${shortAddress(wallet.address ?? "")})`}
          value={`${amount(stream.inWallet, stream.decimals)} ${stream.symbol}`}
          testid="my-balance"
          href={
            explorer && wallet.address
              ? `${explorer}/address/${wallet.address}`
              : undefined
          }
        />
      </div>
    </section>
  );
}
