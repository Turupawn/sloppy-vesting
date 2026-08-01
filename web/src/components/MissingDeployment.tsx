/**
 * What you see when there is no web/public/deployments.json, i.e.
 * nothing has been deployed for this chain yet.
 */
export function MissingDeployment({reason}: {reason: string}) {
  return (
    <main className="page">
      <header className="topbar">
        <h1 className="topbar__brand">
          Sloppy<span className="topbar__brand-accent">Sale</span>
        </h1>
      </header>
      <div className="notice notice--error">
        <p>No encontré las direcciones desplegadas.</p>
        <p className="notice__action">
          Levantá <code>anvil</code> y corré <code>make deploy-local</code>, o
          desplegá en una testnet con <code>make deploy-hoodi</code>.
        </p>
        <p className="notice__action">{reason}</p>
      </div>
    </main>
  );
}
