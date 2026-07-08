import { expect } from "chai";
import { ethers } from "hardhat";

const TOTAL = ethers.parseEther("1000000000");
const SALE = ethers.parseEther("800000000");
const VTOKEN = ethers.parseEther("1073000000");
const VETH = ethers.parseEther("0.5");
const FEE_BPS = 100n;

const PLATFORM_SUPPLY = ethers.parseEther("1000000000");
const LP_TOKENS = (PLATFORM_SUPPLY * 10n) / 10000n; // 0.1%
const LP_ETH = ethers.parseEther("0.1");
const DEAD = "0x000000000000000000000000000000000000dEaD";

async function deployStack() {
  const [deployer, alice] = await ethers.getSigners();

  const swap = await (await ethers.getContractFactory("PumpSwapFactory")).deploy();
  await swap.waitForDeployment();

  const platform = await (
    await ethers.getContractFactory("Token")
  ).deploy("Fletch Cat", "FLETCH", PLATFORM_SUPPLY, deployer.address);
  await platform.waitForDeployment();

  const launchpad = await (
    await ethers.getContractFactory("LaunchpadFactory")
  ).deploy(await swap.getAddress(), deployer.address, TOTAL, SALE, VETH, VTOKEN, FEE_BPS);
  await launchpad.waitForDeployment();

  await (await swap.createPair(await platform.getAddress())).wait();
  const platformPair = await swap.getPair(await platform.getAddress());
  await (await platform.approve(platformPair, LP_TOKENS)).wait();
  const pair = await ethers.getContractAt("PumpSwapPair", platformPair);
  await (await pair.addLiquidity(LP_TOKENS, 0, 0, deployer.address, { value: LP_ETH })).wait();

  return { deployer, alice, swap, platform, launchpad, platformPair };
}

describe("Platform token + treasury buybacks", () => {
  it("splits supply 99.9% treasury / 0.1% LP", async () => {
    const { deployer, platform } = await deployStack();
    expect(await platform.balanceOf(deployer.address)).to.equal(PLATFORM_SUPPLY - LP_TOKENS);
  });

  it("routes launchpad graduation fees to the treasury wallet", async () => {
    const { deployer, alice, launchpad } = await deployStack();

    const treasuryBefore = await ethers.provider.getBalance(deployer.address);

    await (await launchpad.connect(alice).createToken("Meme", "MEME", "d", "🐸", "", "", "")).wait();
    const info = await launchpad.tokens(0);
    const curve = await ethers.getContractAt("BondingCurve", info.curve);

    const gradEth = await curve.graduationEth();
    await curve.connect(alice).buy(0, alice.address, { value: gradEth + ethers.parseEther("1") });

    const treasuryAfter = await ethers.provider.getBalance(deployer.address);
    const expectedFee = (gradEth * FEE_BPS) / 10000n;
    const gained = treasuryAfter - treasuryBefore;
    expect(gained).to.be.closeTo(expectedFee, ethers.parseEther("0.0001"));
  });

  it("manual buyback from treasury swaps ETH and burns tokens", async () => {
    const { deployer, alice, platform, launchpad, platformPair } = await deployStack();

    await (await launchpad.connect(alice).createToken("Meme", "MEME", "d", "🐸", "", "", "")).wait();
    const info = await launchpad.tokens(0);
    const curve = await ethers.getContractAt("BondingCurve", info.curve);
    const gradEth = await curve.graduationEth();
    await curve.connect(alice).buy(0, alice.address, { value: gradEth + ethers.parseEther("1") });

    const pair = await ethers.getContractAt("PumpSwapPair", platformPair);
    const burnedBefore = await platform.balanceOf(DEAD);
    const buybackEth = ethers.parseEther("0.01");

    await pair.connect(deployer).swapExactETHForTokens(0n, DEAD, { value: buybackEth });

    expect(await platform.balanceOf(DEAD)).to.be.gt(burnedBefore);
  });
});
