import {parseEther} from "viem";
import {buyAs} from "../local/actions";
import {accounts, travelTo} from "../local/accounts";
import {test} from "./fixtures";
import {connectAs} from "./helpers/wallet";

/**
 * Not a test: regenerates the README screenshots in media/. Skipped
 * unless asked for explicitly:
 *
 *   MEDIA=1 pnpm exec playwright test media
 *
 * Two separate tests on purpose: connectAs injects a wallet via
 * addInitScript, and injecting twice on the same page would stack two
 * providers fighting over window.ethereum.
 */
test.skip(process.env.MEDIA !== "1", "solo corre con MEDIA=1");

test.use({viewport: {width: 1180, height: 860}, deviceScaleFactor: 2});

test("captura la venta", async ({page, deployment}) => {
  void deployment;
  await connectAs(page, accounts.ana.address);
  await page.getByTestId("quote").waitFor();
  await page.screenshot({path: "../media/sale.png"});
});

test("captura el cliff y el stream", async ({page, deployment}) => {
  const bought = await buyAs(accounts.beto, deployment.sale, parseEther("1"));
  await connectAs(page, accounts.beto.address);

  // Bought: the countdown to the cliff.
  await page.getByTestId("cliff-countdown").waitFor();
  await page.screenshot({path: "../media/cliff.png"});

  // The stream running, needle past the cliff.
  await travelTo(bought + 150n);
  await page.getByTestId("hero-number").waitFor();
  await page.waitForTimeout(2_500); // let the page re-anchor and run
  await page.screenshot({path: "../media/stream.png"});
});
