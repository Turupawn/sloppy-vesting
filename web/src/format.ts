import {formatUnits, parseEther} from "viem";

/**
 * Numbers and dates for the screen.
 *
 * Uses viem only to convert wei to decimal and back. These are pure
 * arithmetic helpers, they never talk to a chain: all of that lives
 * in src/chain.
 */

const number = new Intl.NumberFormat("es-HN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function amount(value: bigint, decimals: number): string {
  return number.format(Number(formatUnits(value, decimals)));
}

/** Same formatting for a plain float: feeds the live counter. */
export function amountFloat(value: number): string {
  return number.format(Math.max(0, value));
}

/** An integer with thousands separators: 1000 -> "1,000". */
export function integer(value: bigint): string {
  return new Intl.NumberFormat("es-HN").format(value);
}

/** What the user typed, in wei. null if it is not a number. */
export function toWei(text: string): bigint | null {
  try {
    return parseEther(text.trim() === "" ? "0" : text.trim());
  } catch {
    return null;
  }
}

/**
 * Percentage computed in bigint. We keep four decimals before going
 * to number so the rounding happens at display time: truncating to
 * two would show 24.6575% as 24.65% instead of 24.66%.
 */
export function pct(part: bigint, total: bigint): number {
  if (total === 0n) return 0;
  return Number((part * 1_000_000n) / total) / 10_000;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * A short span as a stopwatch: "0:27", "9:05", "1:02:03". This demo
 * runs on minutes and seconds, so the seconds always show.
 */
export function stopwatch(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Countdown between two chain timestamps, as a stopwatch. */
export function remaining(from: bigint, to: bigint): string {
  return stopwatch(Number(to - from));
}
