import {test as base} from "@playwright/test";
import {deploy, writeDeployments, type Deployments} from "../local/deploy";

type Fixtures = {
  /** A freshly deployed sale, fully funded, no buyers yet. */
  deployment: Deployments;
};

/**
 * Every test gets its own token and its own sale on the same anvil.
 * Since chain time only moves forward, a fresh deployment per test is
 * simpler than reverting snapshots, and leaves each case isolated
 * from the previous one.
 */
export const test = base.extend<Fixtures>({
  // The first parameter must be destructured even when no fixture is
  // used: that is how Playwright detects dependencies. Playwright's
  // `use` callback is renamed `provide` so the linter does not read
  // it as React's `use` hook.
  // eslint-disable-next-line no-empty-pattern
  deployment: async ({}, provide) => {
    const deployment = await deploy();
    writeDeployments(deployment);
    await provide(deployment);
  },
});

export {expect} from "@playwright/test";
