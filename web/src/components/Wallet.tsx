import {useWallet} from "../chain";
import {shortAddress} from "../format";

export function Wallet() {
  const wallet = useWallet();

  if (wallet.connected && wallet.address) {
    return (
      <div className="wallet">
        <span className="wallet__account" data-testid="account">
          {shortAddress(wallet.address)}
        </span>
        <button
          className="button button--ghost"
          onClick={wallet.disconnect}
          data-testid="disconnect"
        >
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <div className="wallet">
      {wallet.error && <span className="wallet__error">{wallet.error}</span>}
      <button
        className="button"
        disabled={!wallet.hasWallet || wallet.connecting}
        onClick={wallet.connect}
        data-testid="connect"
      >
        {wallet.connecting ? "Conectando…" : "Conectar billetera"}
      </button>
    </div>
  );
}
