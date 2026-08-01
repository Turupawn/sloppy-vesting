import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {
  getAddress,
  parseAbi,
  parseEther,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import {accounts, publicClient, walletClient} from "./accounts";

/** The contract's constants, mirrored for the tests' arithmetic. */
export const DURATION = 10n * 60n; // 10 minutes
export const CLIFF = 30n; // 30 seconds
export const INVENTORY = parseEther("10000000"); // 10,000,000 SLOP

export type Deployments = {
  chainId: number;
  token: Address;
  sale: Address;
  dev: Address;
};

/** Walks up from cwd until it finds the Foundry project root. */
function foundryRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(resolve(dir, "foundry.toml"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("No foundry.toml walking up from " + process.cwd());
}

/**
 * Reads an artifact compiled by forge.
 *
 * Checks that it carries bytecode: an artifact can be stale or
 * half-written in `out/`, and without this check the error you see is
 * a "Cannot read properties of undefined" that tells you nothing.
 */
function artifact(path: string): {abi: Abi; bytecode: Hex} {
  const file = resolve(foundryRoot(), "out", path);
  if (!existsSync(file)) {
    throw new Error(`Missing ${file}. Run \`forge build\` at the root.`);
  }

  const json = JSON.parse(readFileSync(file, "utf8"));
  const bytecode: unknown = json?.bytecode?.object;
  if (
    typeof bytecode !== "string" ||
    !bytecode.startsWith("0x") ||
    bytecode.length <= 2
  ) {
    throw new Error(
      `Artifact ${path} carries no bytecode. It is stale or incomplete: ` +
        "run `forge build --force` at the root.",
    );
  }

  return {abi: json.abi, bytecode: bytecode as Hex};
}

async function deployContract(
  path: string,
  args: readonly unknown[],
): Promise<Address> {
  const {abi, bytecode} = artifact(path);
  const hash = await walletClient.deployContract({abi, bytecode, args});
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  if (!receipt.contractAddress) throw new Error(`${path} did not deploy`);
  return getAddress(receipt.contractAddress);
}

/**
 * The full local scene: the token, the sale, the inventory already
 * transferred. Streams start per buyer, at their purchase.
 *
 * This exists only for the e2e suite, which needs a fresh sale per
 * test and cannot afford to shell out to forge each time. The deploy
 * people actually use is script/DeployDemo.s.sol, and the numbers
 * here (price, inventory) are the same as there.
 */
export async function deploy(): Promise<Deployments> {
  const token = await deployContract("MockERC20.sol/MockERC20.json", [
    "Sloppy Token",
    "SLOP",
    18,
  ]);

  const sale = await deployContract("SloppySale.sol/SloppySale.json", [token]);

  // The dev funds the sale with what they are willing to sell.
  const hash = await walletClient.writeContract({
    address: token,
    abi: parseAbi(["function mint(address to, uint256 amount)"]),
    functionName: "mint",
    args: [sale, INVENTORY],
  });
  await publicClient.waitForTransactionReceipt({hash});

  return {
    chainId: await publicClient.getChainId(),
    token,
    sale,
    dev: accounts.dev.address,
  };
}

/** Leaves the addresses where the frontend reads them at runtime. */
export function writeDeployments(deployments: Deployments) {
  const {chainId, token, sale, dev} = deployments;
  const dir = resolve(foundryRoot(), "web", "public");
  mkdirSync(dir, {recursive: true});
  writeFileSync(
    resolve(dir, "deployments.json"),
    JSON.stringify({chainId, token, sale, dev}, null, 2) + "\n",
  );
}
