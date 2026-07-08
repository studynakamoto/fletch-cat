import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys the PumpSwap V2 (Uniswap v2-style) DEX: Factory + Router.
 *
 * WETH resolution:
 *   - If WETH_ADDRESS is set in the environment, that address is used as-is
 *     (e.g. the canonical Robinhood Chain WETH 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73).
 *   - Otherwise a fresh WETH9 is deployed (handy for local/dev networks).
 *
 * The feeToSetter defaults to the deployer unless FEE_TO_SETTER is provided.
 * The protocol fee is left OFF (feeTo == address(0)); enable later via
 * factory.setFeeTo(...) using the feeToSetter account.
 *
 * This script only deploys to whatever --network you pass. It does NOT touch
 * mainnet unless you explicitly target it.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  const feeToSetter = process.env.FEE_TO_SETTER || deployer.address;

  console.log(`Network:      ${network.name} (chainId ${chainId})`);
  console.log(`Deployer:     ${deployer.address}`);
  console.log(`Balance:      ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log(`feeToSetter:  ${feeToSetter}\n`);

  // 1. WETH — use existing if configured, otherwise deploy WETH9
  let wethAddr = process.env.WETH_ADDRESS;
  let deployedWeth = false;
  if (wethAddr && ethers.isAddress(wethAddr)) {
    console.log(`WETH:         ${wethAddr} (from WETH_ADDRESS)`);
  } else {
    const WETH9 = await ethers.getContractFactory("WETH9");
    const weth = await WETH9.deploy();
    await weth.waitForDeployment();
    wethAddr = await weth.getAddress();
    deployedWeth = true;
    console.log(`WETH:         ${wethAddr} (freshly deployed WETH9)`);
  }

  // 2. Factory
  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(feeToSetter);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log(`Factory:      ${factoryAddr}`);

  // 3. Router
  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(factoryAddr, wethAddr);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log(`Router02:     ${routerAddr}`);

  const record = {
    chainId,
    network: network.name,
    factory: factoryAddr,
    router: routerAddr,
    weth: wethAddr,
    wethDeployedByScript: deployedWeth,
    feeToSetter,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  // write repo-level record
  const outFile = path.join(__dirname, "..", "deployments.dex.json");
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2));
  console.log(`\nWrote ${path.relative(process.cwd(), outFile)}`);

  // write web frontend record if the web/lib folder exists
  const webLib = path.join(__dirname, "..", "..", "web", "lib");
  if (fs.existsSync(webLib)) {
    const webFile = path.join(webLib, `dex.${chainId}.json`);
    fs.writeFileSync(webFile, JSON.stringify(record, null, 2));
    console.log(`Wrote web/lib/dex.${chainId}.json`);
  }

  console.log("\nSet these in web/.env.local:");
  console.log(`NEXT_PUBLIC_DEX_FACTORY=${factoryAddr}`);
  console.log(`NEXT_PUBLIC_DEX_ROUTER=${routerAddr}`);
  console.log(`NEXT_PUBLIC_WETH=${wethAddr}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
