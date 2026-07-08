import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys LaunchpadFactoryV2 ("FletchPad v2") — bonding curves that graduate
 * into standard Uniswap v2 WETH/token pools, so every graduated token is
 * automatically indexable by DEX aggregators (DEXScreener etc.).
 *
 * ROUTER_ADDRESS selects the graduation venue:
 *   - Robinhood Chain mainnet canonical Uniswap v2 Router02:
 *       0x89e5db8b5aa49aa85ac63f691524311aeb649eba
 *   - or our own FletchSwap router from `npm run deploy:dex:*`
 *     (see deployments.dex.json)
 *
 * Curve economics match scripts/deploy.ts (1B supply, 800M sale, 1% fee).
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = process.env.FEE_RECIPIENT || deployer.address;

  const routerAddr = process.env.ROUTER_ADDRESS;
  if (!routerAddr || !ethers.isAddress(routerAddr)) {
    throw new Error(
      "Set ROUTER_ADDRESS to a Uniswap v2-compatible Router02 (canonical RH Chain: 0x89e5db8b5aa49aa85ac63f691524311aeb649eba)"
    );
  }

  const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1B
  const SALE_SUPPLY = ethers.parseEther("800000000"); // 800M sold on the curve
  const VIRTUAL_TOKEN = ethers.parseEther("1073000000"); // Y0
  const VIRTUAL_ETH = ethers.parseEther(process.env.VIRTUAL_ETH || "0.5"); // X0
  const GRADUATION_FEE_BPS = 100n; // 1%

  console.log(`Network:   ${network.name}`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Treasury:  ${treasury}`);
  console.log(`Router:    ${routerAddr}`);
  console.log(`Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // sanity: the router must expose factory() and WETH()
  const router = await ethers.getContractAt("IUniswapV2Router02", routerAddr);
  const v2factory = await router.factory();
  const weth = await router.WETH();
  console.log(`Router.factory(): ${v2factory}`);
  console.log(`Router.WETH():    ${weth}\n`);

  const LaunchpadFactoryV2 = await ethers.getContractFactory("LaunchpadFactoryV2");
  const launchpad = await LaunchpadFactoryV2.deploy(
    routerAddr,
    treasury,
    TOTAL_SUPPLY,
    SALE_SUPPLY,
    VIRTUAL_ETH,
    VIRTUAL_TOKEN,
    GRADUATION_FEE_BPS
  );
  await launchpad.waitForDeployment();
  const launchpadAddr = await launchpad.getAddress();
  console.log(`LaunchpadFactoryV2: ${launchpadAddr}`);

  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  const record = {
    chainId,
    network: network.name,
    launchpadFactoryV2: launchpadAddr,
    router: routerAddr,
    v2Factory: v2factory,
    weth,
    treasury,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outFile = path.join(__dirname, "..", "deployments.v2.json");
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2));
  console.log(`\nWrote ${path.relative(process.cwd(), outFile)}`);

  const webLib = path.join(__dirname, "..", "..", "web", "lib");
  if (fs.existsSync(webLib)) {
    fs.writeFileSync(path.join(webLib, `launchpad-v2.${chainId}.json`), JSON.stringify(record, null, 2));
    console.log(`Wrote web/lib/launchpad-v2.${chainId}.json`);
  }

  console.log("\nSet these in web/.env.local (or Vercel):");
  console.log(`NEXT_PUBLIC_LAUNCHPAD_FACTORY=${launchpadAddr}`);
  console.log(`NEXT_PUBLIC_DEX_ROUTER=${routerAddr}`);
  console.log(`NEXT_PUBLIC_DEX_FACTORY=${v2factory}`);
  console.log(`NEXT_PUBLIC_WETH=${weth}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
