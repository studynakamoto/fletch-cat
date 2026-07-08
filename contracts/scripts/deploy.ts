import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = process.env.FEE_RECIPIENT || deployer.address;

  // ---- curve economics ----
  const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1B
  const SALE_SUPPLY = ethers.parseEther("800000000"); // 800M sold on the curve
  const VIRTUAL_TOKEN = ethers.parseEther("1073000000"); // Y0
  const VIRTUAL_ETH = ethers.parseEther(process.env.VIRTUAL_ETH || "0.5"); // X0
  const GRADUATION_FEE_BPS = 100n; // 1% of raised ETH at graduation -> treasury

  // ---- platform token (the "default first token to ape") ----
  const PLATFORM_NAME = process.env.PLATFORM_NAME || "Fletch Cat";
  const PLATFORM_SYMBOL = process.env.PLATFORM_SYMBOL || "FLETCH";
  const PLATFORM_SUPPLY = ethers.parseEther("1000000000"); // 1B
  const PLATFORM_LP_BPS = 10n; // 0.1% goes into the LP; 99.9% stays with treasury
  const PLATFORM_LP_ETH = ethers.parseEther(process.env.PLATFORM_LP_ETH || "0.1");
  const lpTokens = (PLATFORM_SUPPLY * PLATFORM_LP_BPS) / 10000n;

  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Treasury (fee recipient): ${treasury}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // 1. AMM factory
  const PumpSwapFactory = await ethers.getContractFactory("PumpSwapFactory");
  const swap = await PumpSwapFactory.deploy();
  await swap.waitForDeployment();
  const swapAddr = await swap.getAddress();
  console.log(`PumpSwapFactory:  ${swapAddr}`);

  // 2. Platform token (whole supply minted to the treasury/deployer)
  const Token = await ethers.getContractFactory("Token");
  const platform = await Token.deploy(PLATFORM_NAME, PLATFORM_SYMBOL, PLATFORM_SUPPLY, deployer.address);
  await platform.waitForDeployment();
  const platformAddr = await platform.getAddress();
  console.log(`Platform token:   ${platformAddr} (${PLATFORM_SYMBOL})`);

  // 3. Launchpad — graduation fees flow directly to the treasury wallet
  const LaunchpadFactory = await ethers.getContractFactory("LaunchpadFactory");
  const launchpad = await LaunchpadFactory.deploy(
    swapAddr,
    treasury,
    TOTAL_SUPPLY,
    SALE_SUPPLY,
    VIRTUAL_ETH,
    VIRTUAL_TOKEN,
    GRADUATION_FEE_BPS
  );
  await launchpad.waitForDeployment();
  const launchpadAddr = await launchpad.getAddress();
  console.log(`LaunchpadFactory: ${launchpadAddr}`);

  // 4. Seed the platform token's PumpSwap pool with 0.1% supply + ETH
  await (await swap.createPair(platformAddr)).wait();
  const platformPair = await swap.getPair(platformAddr);
  await (await platform.approve(platformPair, lpTokens)).wait();
  const pair = await ethers.getContractAt("PumpSwapPair", platformPair);
  await (
    await pair.addLiquidity(lpTokens, 0, 0, deployer.address, { value: PLATFORM_LP_ETH })
  ).wait();
  console.log(`Platform pair:    ${platformPair}`);
  console.log(
    `Seeded LP: ${ethers.formatEther(lpTokens)} ${PLATFORM_SYMBOL} + ${ethers.formatEther(PLATFORM_LP_ETH)} ETH (0.1%)`
  );
  console.log(
    `Treasury holds:   ${ethers.formatEther(await platform.balanceOf(deployer.address))} ${PLATFORM_SYMBOL} (99.9%)`
  );

  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  const record = {
    chainId,
    network: network.name,
    launchpadFactory: launchpadAddr,
    pumpSwapFactory: swapAddr,
    platformToken: platformAddr,
    platformPair,
    treasury,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(__dirname, "..", "deployments.json"), JSON.stringify(record, null, 2));

  const webLib = path.join(__dirname, "..", "..", "web", "lib");
  if (fs.existsSync(webLib)) {
    fs.writeFileSync(path.join(webLib, `addresses.${chainId}.json`), JSON.stringify(record, null, 2));
    console.log(`\nWrote web/lib/addresses.${chainId}.json`);
  }

  console.log("\nSet these in web/.env.local:");
  console.log(`NEXT_PUBLIC_CHAIN_ID=${chainId}`);
  console.log(`NEXT_PUBLIC_LAUNCHPAD_FACTORY=${launchpadAddr}`);
  console.log(`NEXT_PUBLIC_PUMPSWAP_FACTORY=${swapAddr}`);
  console.log(`NEXT_PUBLIC_PLATFORM_TOKEN=${platformAddr}`);
  console.log(`NEXT_PUBLIC_PLATFORM_PAIR=${platformPair}`);
  console.log(`NEXT_PUBLIC_TREASURY=${treasury}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
