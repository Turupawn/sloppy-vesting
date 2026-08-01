/**
 * ─────────────────────────────────────────────────────────────────
 *  The chain layer. The trunk of the frontend.
 * ─────────────────────────────────────────────────────────────────
 *
 * This folder is the only place in the frontend that knows wagmi and
 * viem exist. Everything else — components, styles — talks only to
 * what is exported right below, in bigint and string.
 *
 * If something is going to move funds or misread a balance, the bug
 * lives in this folder. This is where to look slowly; the rest can
 * be swapped out without fear.
 *
 * The linter enforces it: `src/components/**` is forbidden from
 * importing wagmi or viem (see .oxlintrc.json).
 */

export {Providers} from "./Providers";
export {loadDeployment, useDeployment} from "./deployment";
export {useWallet} from "./useWallet";
export {useSale} from "./useSale";
export {perSecond, unlockedAt, unlockedAtMs} from "./schedule";
export {useMyStream} from "./useMyStream";
export type {
  Address,
  Deployment,
  SaleState,
  StreamState,
} from "./types";
