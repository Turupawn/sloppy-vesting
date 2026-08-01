/**
 * Translates chain errors into something readable on screen. viem
 * carries the summary in `shortMessage`; the rest of the message is
 * the call stack and helps nobody.
 */
export function errorMessage(e: unknown): string {
  const short = (e as {shortMessage?: string})?.shortMessage;
  const text =
    short ?? (e instanceof Error ? e.message.split("\n")[0] : String(e));

  if (/user rejected|user denied/i.test(text)) {
    return "Rechazaste la firma en la billetera.";
  }
  if (/AlreadyBought/.test(text)) {
    return "Esta dirección ya tiene su stream. Una compra por dirección.";
  }
  if (/NoEth/.test(text)) return "Tenés que mandar ETH para comprar.";
  if (/InsufficientInventory/.test(text)) {
    return "No queda tanto inventario sin vender.";
  }
  if (/insufficient funds/i.test(text)) {
    return "No te alcanza el ETH para esta transacción.";
  }
  return text;
}
