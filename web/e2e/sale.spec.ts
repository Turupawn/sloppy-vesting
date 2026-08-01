import {parseEther} from "viem";
import {buyAs} from "../local/actions";
import {accounts, pinNextBlock, travelTo} from "../local/accounts";
import {CLIFF, DURATION} from "../local/deploy";
import {expect, test} from "./fixtures";
import {connectAs} from "./helpers/wallet";

/**
 * End-to-end walk of the whole product: real browser, real frontend,
 * wagmi signing against the contracts.
 *
 * Two notes about the numbers:
 *
 *  - Before each transaction we pin the next block's timestamp, so
 *    what gets claimed is always the same exact figure.
 *  - The big number runs ten times a second by design, so it is
 *    checked by range. Exact figures are checked in the book rows,
 *    which come straight from the chain.
 */

const INVENTORY = "10,000,000.00 SLOP";
const PER_ETH = "100,000.00 SLOP";
const AT_THE_CLIFF = "5,000.00 SLOP"; // 30 seconds of 10 minutes: 5%
const HALFWAY = "50,000.00 SLOP";

/**
 * Right after the cliff the counter reads 5,0xx and climbs at ~166.67
 * per second. [5-9] keeps the match alive for ~30 real seconds; a
 * tighter 5,\d{3} would stop matching after ~6, right at Playwright's
 * default expect timeout, and flake on a slow machine.
 */
const NEAR_THE_CLIFF = /Retirar [5-9],\d{3}\.\d{2} SLOP/;

/** "12,345.67" from a text that may carry symbols around it. */
const readNumber = (text: string) =>
  Number(text.replace(/[^\d.]/g, "").replace(/\.(?=.*\.)/g, ""));

test("la venta muestra el precio y el inventario", async ({
  page,
  deployment,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("sale-address")).toHaveText(deployment.sale);
  await expect(page.getByTestId("price")).toContainText("100,000 SLOP");
  await expect(page.getByTestId("unsold")).toHaveText(INVENTORY);
  await expect(page.getByTestId("total-sold")).toHaveText("0.00 SLOP");
  await expect(page.getByTestId("total-raised")).toHaveText("0.00 ETH");
  await expect(page.getByTestId("buy")).toBeDisabled();
});

test("comprar 1 ETH arranca el stream en ese mismo instante", async ({
  page,
  deployment,
}) => {
  await connectAs(page, accounts.ana.address);

  await expect(page.getByTestId("no-purchase")).toBeVisible();
  await expect(page.getByTestId("quote")).toHaveText(PER_ETH);

  await page.getByTestId("buy").click();

  await expect(page.getByTestId("my-stream")).toBeVisible();
  await expect(page.getByTestId("my-total")).toHaveText(PER_ETH);
  await expect(page.getByTestId("my-balance")).toHaveText("0.00 SLOP");
  await expect(page.getByTestId("total-sold")).toHaveText(PER_ETH);
  await expect(page.getByTestId("total-raised")).toHaveText("1.00 ETH");
  await expect(page.getByTestId("unsold")).toHaveText("9,900,000.00 SLOP");

  // The clock started at the purchase: the cliff countdown is already
  // running and nothing can be claimed yet.
  await expect(page.getByTestId("cliff-countdown")).toBeVisible();
  await expect(page.getByTestId("claim")).toBeDisabled();

  const stream = await page.getByTestId("stream-address").textContent();
  expect(stream).not.toBe(deployment.sale);
});

// The deployment fixture matters even when the test never reads it:
// it is what gives this test a fresh sale where ana has not bought.
test("la cotizacion sigue lo que escribis", async ({page, deployment}) => {
  void deployment;
  await connectAs(page, accounts.ana.address);

  await page.getByTestId("eth-input").fill("2.5");
  await expect(page.getByTestId("quote")).toHaveText("250,000.00 SLOP");
  await expect(page.getByTestId("buy")).toHaveText("Comprar 250,000.00 SLOP");

  await page.getByTestId("eth-input").fill("0");
  await expect(page.getByTestId("buy")).toBeDisabled();
});

test("no se puede comprar dos veces con la misma cuenta", async ({
  page,
  deployment,
}) => {
  await buyAs(accounts.ana, deployment.sale, parseEther("1"));

  await connectAs(page, accounts.ana.address);

  await expect(page.getByTestId("already-bought")).toBeVisible();
  await expect(page.getByTestId("buy")).toHaveCount(0);
  await expect(page.getByTestId("my-total")).toHaveText(PER_ETH);
});

test("antes del cliff no se puede retirar y el countdown corre", async ({
  page,
  deployment,
}) => {
  await buyAs(accounts.ana, deployment.sale, parseEther("1"));

  // No time travel: the page anchors to the purchase block, so the
  // whole 30 second cliff is margin for the assertions below.
  await connectAs(page, accounts.ana.address);

  await expect(page.getByTestId("cliff-countdown")).toBeVisible();
  await expect(page.getByTestId("cliff-countdown")).toContainText(
    "5,000.00 SLOP",
  );
  await expect(page.getByTestId("claim")).toBeDisabled();
});

test("en el cliff caen 5,000 de golpe y se pueden retirar", async ({
  page,
  deployment,
}) => {
  const bought = await buyAs(accounts.ana, deployment.sale, parseEther("1"));

  const cliff = bought + CLIFF;
  await travelTo(cliff);
  await connectAs(page, accounts.ana.address);

  await expect(page.getByTestId("claim")).toHaveText(NEAR_THE_CLIFF);
  await expect(page.getByTestId("rate")).toContainText("por segundo");

  // The transaction lands on the exact second, so what is claimed is
  // a fixed figure even while the counter above keeps running.
  await pinNextBlock(cliff);
  await page.getByTestId("claim").click();

  await expect(page.getByTestId("my-balance")).toHaveText(AT_THE_CLIFF);
  await expect(page.getByTestId("claimed")).toHaveText(AT_THE_CLIFF);
});

test("el numero sube solo mientras miras la pagina", async ({
  page,
  deployment,
}) => {
  const bought = await buyAs(accounts.ana, deployment.sale, parseEther("1"));
  await travelTo(bought + 60n); // one minute in, well past the cliff
  await connectAs(page, accounts.ana.address);

  const counter = page.getByTestId("hero-number");
  const before = readNumber((await counter.innerText()) ?? "");
  await page.waitForTimeout(2_000);
  const after = readNumber((await counter.innerText()) ?? "");

  // ~166.67 SLOP per second, checked by rate and not just direction:
  // a units bug in the display math (per minute, per block) would
  // still "go up". Generous band for timer jitter and re-anchors.
  const delta = after - before;
  expect(delta).toBeGreaterThan(100); // at least ~0.6s worth
  expect(delta).toBeLessThan(1_000); // at most ~6s worth
});

test("la aguja de la grafica avanza en vivo", async ({page, deployment}) => {
  const bought = await buyAs(accounts.ana, deployment.sale, parseEther("1"));
  await travelTo(bought + 60n);
  await connectAs(page, accounts.ana.address);

  // A vertical <line> has a zero-width box, so toBeVisible() would
  // always fail; attached is the right check for SVG strokes.
  const needle = page.getByTestId("chart-needle");
  await needle.waitFor({state: "attached"});

  const before = Number(await needle.getAttribute("x1"));
  await page.waitForTimeout(2_000);
  const after = Number(await needle.getAttribute("x1"));

  expect(after).toBeGreaterThan(before);
});

test("al final del stream se retira todo", async ({page, deployment}) => {
  const bought = await buyAs(accounts.ana, deployment.sale, parseEther("1"));

  const end = bought + DURATION;
  await travelTo(end);
  await connectAs(page, accounts.ana.address);

  await pinNextBlock(end);
  await page.getByTestId("claim").click();

  await expect(page.getByTestId("my-balance")).toHaveText(PER_ETH);
  await expect(page.getByTestId("claimed")).toHaveText(PER_ETH);
  await expect(page.getByTestId("rate")).toContainText("Stream completo");
});

test("dos retiros: en el cliff y a la mitad", async ({page, deployment}) => {
  const bought = await buyAs(accounts.ana, deployment.sale, parseEther("1"));

  const cliff = bought + CLIFF;
  await travelTo(cliff);
  await connectAs(page, accounts.ana.address);

  await pinNextBlock(cliff);
  await page.getByTestId("claim").click();
  await expect(page.getByTestId("my-balance")).toHaveText(AT_THE_CLIFF);

  const halfway = bought + DURATION / 2n;
  await travelTo(halfway);
  await pinNextBlock(halfway);
  await page.getByTestId("claim").click();

  await expect(page.getByTestId("my-balance")).toHaveText(HALFWAY);
  await expect(page.getByTestId("claimed")).toHaveText(HALFWAY);
});

test("el dev retira el ETH y no ve ninguna forma de sacar tokens", async ({
  page,
  deployment,
}) => {
  await buyAs(accounts.ana, deployment.sale, parseEther("1"));
  await buyAs(accounts.beto, deployment.sale, parseEther("2"));

  await connectAs(page, accounts.dev.address);

  const panel = page.getByTestId("dev-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("eth-in-sale")).toHaveText("3.00 ETH");
  await expect(panel).toContainText("No hay ninguna función para sacar");

  await page.getByTestId("withdraw-eth").click();

  await expect(page.getByTestId("eth-in-sale")).toHaveText("0.00 ETH");
  await expect(page.getByTestId("withdraw-eth")).toBeDisabled();
  // The raised total does not change even after the ETH is gone.
  await expect(page.getByTestId("total-raised")).toHaveText("3.00 ETH");
});

test("un comprador no ve el panel del dev", async ({page, deployment}) => {
  await buyAs(accounts.ana, deployment.sale, parseEther("1"));

  await connectAs(page, accounts.ana.address);

  await expect(page.getByTestId("my-stream")).toBeVisible();
  await expect(page.getByTestId("dev-panel")).toHaveCount(0);
});

test("cada comprador ve solo lo suyo", async ({page, deployment}) => {
  await buyAs(accounts.ana, deployment.sale, parseEther("1"));
  await buyAs(accounts.beto, deployment.sale, parseEther("3"));

  await connectAs(page, accounts.ana.address);

  await expect(page.getByTestId("my-total")).toHaveText(PER_ETH);
  await expect(page.getByTestId("total-sold")).toHaveText("400,000.00 SLOP");
});
