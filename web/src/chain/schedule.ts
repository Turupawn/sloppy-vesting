import {useEffect, useRef, useState} from "react";

/**
 * The same formula as the contract, to estimate what has run between
 * one block and the next so the number moves on screen.
 *
 * Careful: this is for display. The truth is always the chain, and
 * what you actually claim is computed by the contract in the block
 * where the transaction lands.
 */
export function unlockedAt(
  total: bigint,
  start: bigint,
  cliff: bigint,
  end: bigint,
  t: bigint,
): bigint {
  if (t < cliff) return 0n;
  if (t >= end) return total;
  return (total * (t - start)) / (end - start);
}

/** How many tokens per second the stream releases once it runs. */
export function perSecond(total: bigint, start: bigint, end: bigint) {
  const seconds = end - start;
  return seconds > 0n ? total / seconds : 0n;
}

/**
 * Millisecond version of the schedule, as a float. Display only: it
 * feeds the pump-style counter and the chart needle, never a
 * transaction. `total` comes pre-converted to a plain number.
 */
export function unlockedAtMs(
  total: number,
  startMs: number,
  cliffMs: number,
  endMs: number,
  tMs: number,
): number {
  if (tMs < cliffMs) return 0;
  if (tMs >= endMs) return total;
  return (total * (tMs - startMs)) / (endMs - startMs);
}

/**
 * A clock that runs smooth, anchored to the last block we saw.
 *
 * Without this the number would only move when a new block lands:
 * every ~12 seconds on a testnet, and never on an idle anvil.
 * Anchoring to the block and adding the real time elapsed since we
 * read it, the count advances without ever drifting from what the
 * contract sees — every new block re-anchors it.
 *
 * Returns the chain-equivalent time twice: in whole seconds as bigint
 * (for anything that mirrors contract math) and in milliseconds as a
 * number (for the counter and the chart needle, which tick ~10 times
 * a second so the stream *feels* like a stream).
 *
 * Under `prefers-reduced-motion` the fast tick drops to once per
 * second: the numbers still update, they just stop spinning.
 */
export function useClock(block: bigint | undefined): {
  now: bigint;
  nowMs: number;
} {
  const anchor = useRef<{chain: bigint; local: number}>(undefined);
  const shownMs = useRef(0);
  const [, force] = useState(0);

  if (block !== undefined && anchor.current?.chain !== block) {
    anchor.current = {chain: block, local: Date.now()};
  }

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const id = setInterval(() => force((n) => n + 1), reduced ? 1000 : 100);
    return () => clearInterval(id);
  }, []);

  if (!anchor.current) return {now: 0n, nowMs: 0};

  const elapsedMs = Math.max(0, Date.now() - anchor.current.local);
  let nowMs = Number(anchor.current.chain) * 1000 + elapsedMs;

  // Monotonic clamp. Re-anchoring is honest but not monotonic: if the
  // previous block was observed fresh and this one arrived stale, the
  // new anchor implies an *earlier* time and the counter would visibly
  // step backwards (and could flip the claim button off right at the
  // cliff). When that happens we hold the shown time still until the
  // chain catches up, instead of rewinding it. Exception: a jump of
  // more than one slot backwards is not observation jitter, it is the
  // chain actually being reset (a fresh anvil) — follow it.
  if (nowMs < shownMs.current && shownMs.current - nowMs < 15_000) {
    nowMs = shownMs.current;
  }
  shownMs.current = nowMs;

  return {now: BigInt(Math.floor(nowMs / 1000)), nowMs};
}
