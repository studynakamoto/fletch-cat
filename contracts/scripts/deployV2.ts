import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys LaunchpadFactoryV2 ("FletchPad v2") with fee model v2:
 *   - 2% of every launch skimmed to treasury (platform token allocation)
 *   - Graduation fee starts at 5%, decays 0.5% per graduation down to 1% floor
 *   - 70% of graduation fee ETH thickens the Uniswap v2 LP; 30% to treasury
 *
 * ROUTER_ADDRESS — Uniswap v2 Router02 for graduation venue:
 *   Robinhood Chain canonical: 0x89e5db8b5aa49aa85ac63f691524311aeb649eba
 *
 * DO NOT run on mainnet until deployer wallet migration is complete.
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

  const TOTAL_SUPPLY = ethers.parseEther("1000000000");
  const VIRTUAL_TOKEN = ethers.parseEther("1073000000");
  const VIRTUAL_ETH = ethers.parseEther(process.env.VIRTUAL_ETH || "0.5");

  const PLATFORM_TOKEN_BPS = 200n; // 2% skim
  const SALE_BPS_OF_CURVE = 8000n; // 80% of post-skim on curve
  const MAX_GRADUATION_FEE_BPS = 500n; // 5%
  const MIN_GRADUATION_FEE_BPS = 100n; // 1% floor
  const FEE_DECAY_STEP_BPS = 50n; // -0.5% per graduation
  const FEE_DECAY_INTERVAL = 1n;
  const FEE_TO_LP_BPS = 7000n; // 70% of fee ETH → LP

  console.log(`Network:   ${network.name}`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Treasury:  ${treasury}`);
  console.log(`Router:    ${routerAddr}`);
  console.log(`Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

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
    VIRTUAL_ETH,
    VIRTUAL_TOKEN,
    SALE_BPS_OF_CURVE,
    PLATFORM_TOKEN_BPS,
    MAX_GRADUATION_FEE_BPS,
    MIN_GRADUATION_FEE_BPS,
    FEE_DECAY_STEP_BPS,
    FEE_DECAY_INTERVAL,
    FEE_TO_LP_BPS
  );
  await launchpad.waitForDeployment();
  const launchpadAddr = await launchpad.getAddress();
  console.log(`LaunchpadFactoryV2: ${launchpadAddr}`);
  console.log(`Initial graduation fee: ${await launchpad.currentGraduationFeeBps()} bps`);

  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  const record = {
    chainId,
    network: network.name,
    version: "v2-fee-model",
    launchpadFactoryV2: launchpadAddr,
    router: routerAddr,
    v2Factory: v2factory,
    weth,
    treasury,
    deployer: deployer.address,
    feeModel: {
      platformTokenBps: Number(PLATFORM_TOKEN_BPS),
      maxGraduationFeeBps: Number(MAX_GRADUATION_FEE_BPS),
      minGraduationFeeBps: Number(MIN_GRADUATION_FEE_BPS),
      feeDecayStepBps: Number(FEE_DECAY_STEP_BPS),
      feeToLpBps: Number(FEE_TO_LP_BPS),
    },
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

  console.log("\nSet these in web/.env.local (or Vercel) after mainnet deploy:");
  console.log(`NEXT_PUBLIC_LAUNCHPAD_FACTORY_V2=${launchpadAddr}`);
  console.log(`NEXT_PUBLIC_DEX_ROUTER=${routerAddr}`);
  console.log(`NEXT_PUBLIC_DEX_FACTORY=${v2factory}`);
  console.log(`NEXT_PUBLIC_WETH=${weth}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
