import { expect } from "chai";
import { ethers } from "hardhat";

const TOTAL = ethers.parseEther("1000000000");
const VTOKEN = ethers.parseEther("1073000000");
const VETH = ethers.parseEther("0.5");
const PLATFORM_SKIM_BPS = 200n; // 2%
const SALE_BPS_OF_CURVE = 8000n; // 80% of post-skim supply
const MAX_FEE_BPS = 500n; // 5% at launch
const MIN_FEE_BPS = 100n; // 1% floor
const FEE_DECAY_STEP = 50n; // -0.5% per graduation
const FEE_TO_LP_BPS = 7000n; // 70% of fee ETH thickens LP
const DEAD = "0x000000000000000000000000000000000000dEaD";

const CURVE_SUPPLY = (TOTAL * (10_000n - PLATFORM_SKIM_BPS)) / 10_000n;
const SALE = (CURVE_SUPPLY * SALE_BPS_OF_CURVE) / 10_000n;
const MIGRATION = CURVE_SUPPLY - SALE;
const SKIM = TOTAL - CURVE_SUPPLY;

async function deployAll() {
  const [deployer, alice, bob, fee] = await ethers.getSigners();

  const WETH9 = await ethers.getContractFactory("WETH9");
  const weth = await WETH9.deploy();
  await weth.waitForDeployment();

  const V2Factory = await ethers.getContractFactory("UniswapV2Factory");
  const v2factory = await V2Factory.deploy(deployer.address);
  await v2factory.waitForDeployment();

  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(await v2factory.getAddress(), await weth.getAddress());
  await router.waitForDeployment();

  const LaunchpadFactoryV2 = await ethers.getContractFactory("LaunchpadFactoryV2");
  const launchpad = await LaunchpadFactoryV2.deploy(
    await router.getAddress(),
    fee.address,
    TOTAL,
    VETH,
    VTOKEN,
    SALE_BPS_OF_CURVE,
    PLATFORM_SKIM_BPS,
    MAX_FEE_BPS,
    MIN_FEE_BPS,
    FEE_DECAY_STEP,
    1n,
    FEE_TO_LP_BPS
  );
  await launchpad.waitForDeployment();

  return { deployer, alice, bob, fee, weth, v2factory, router, launchpad };
}

async function createToken(launchpad: any, signer: any) {
  const tx = await launchpad
    .connect(signer)
    .createToken("Test", "TST", "img", "desc", "", "", "");
  const receipt = await tx.wait();
  const created = receipt!.logs
    .map((l: any) => {
      try {
        return launchpad.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e: any) => e?.name === "TokenCreated");
  return { token: created!.args.token, curve: created!.args.curve };
}

describe("LaunchpadV2 fee model", () => {
  it("skims 2% platform tokens to treasury on create", async () => {
    const { launchpad, alice, fee } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);

    const Token = await ethers.getContractAt("Token", token);
    expect(await Token.totalSupply()).to.equal(TOTAL);
    expect(await Token.balanceOf(fee.address)).to.equal(SKIM);
    expect(await Token.balanceOf(curve)).to.equal(CURVE_SUPPLY);
    expect(await launchpad.saleSupply()).to.equal(SALE);
    expect(await launchpad.migrationSupply()).to.equal(MIGRATION);
  });

  it("starts at 5% graduation fee and decays to 1% floor", async () => {
    const { launchpad } = await deployAll();
    expect(await launchpad.currentGraduationFeeBps()).to.equal(MAX_FEE_BPS);

    // simulate 8 graduations → 500 - 8*50 = 100 bps
    for (let i = 0; i < 8; i++) {
      const { curve } = await createToken(launchpad, (await ethers.getSigners())[0]);
      const Curve = await ethers.getContractAt("BondingCurveV2", curve);
      const gradEth = await Curve.graduationEth();
      const buyer = (await ethers.getSigners())[0];
      await Curve.connect(buyer).buy(0, buyer.address, {
        value: gradEth + ethers.parseEther("0.01"),
      });
    }
    expect(await launchpad.graduationCount()).to.equal(8n);
    expect(await launchpad.currentGraduationFeeBps()).to.equal(MIN_FEE_BPS);
  });

  it("quotes graduation ETH from virtual reserves", async () => {
    const { launchpad, alice } = await deployAll();
    const { curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurveV2", curve);

    const K = VETH * VTOKEN;
    const expected = K / (VTOKEN - SALE) - VETH;
    expect(await Curve.graduationEth()).to.equal(expected);

    const [tokensOut] = await Curve.getBuyQuote(ethers.parseEther("0.1"));
    expect(tokensOut).to.be.gt(0n);
  });

  it("enforces slippage bounds on buy and sell", async () => {
    const { launchpad, alice } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurveV2", curve);
    const Token = await ethers.getContractAt("Token", token);

    const [quote] = await Curve.getBuyQuote(ethers.parseEther("0.1"));
    await expect(
      Curve.connect(alice).buy(quote + 1n, alice.address, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("SLIPPAGE");

    await Curve.connect(alice).buy(quote, alice.address, { value: ethers.parseEther("0.1") });

    const bal = await Token.balanceOf(alice.address);
    await Token.connect(alice).approve(curve, bal);
    const ethQuote = await Curve.getSellQuote(bal);
    await expect(
      Curve.connect(alice).sell(bal, ethQuote + 1n, alice.address)
    ).to.be.revertedWith("SLIPPAGE");
  });

  it("graduates with 70% fee to LP / 30% to treasury", async () => {
    const { launchpad, alice, fee, weth, v2factory } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurveV2", curve);
    const Token = await ethers.getContractAt("Token", token);

    const gradEth = await Curve.graduationEth();
    const feeBefore = await ethers.provider.getBalance(fee.address);

    await Curve.connect(alice).buy(0, alice.address, { value: gradEth + ethers.parseEther("1") });

    expect(await Curve.graduated()).to.equal(true);

    const pairAddr = await v2factory.getPair(token, await weth.getAddress());
    expect(pairAddr).to.not.equal(ethers.ZeroAddress);
    expect(await Curve.pair()).to.equal(pairAddr);

    const totalFee = (gradEth * MAX_FEE_BPS) / 10_000n;
    const treasuryFee = totalFee - (totalFee * FEE_TO_LP_BPS) / 10_000n;
    const ethLiquidity = gradEth - treasuryFee;

    expect(await Token.balanceOf(pairAddr)).to.equal(MIGRATION);
    const WethAt = await ethers.getContractAt("WETH9", await weth.getAddress());
    expect(await WethAt.balanceOf(pairAddr)).to.equal(ethLiquidity);

    const Pair = await ethers.getContractAt("UniswapV2Pair", pairAddr);
    expect(await Pair.balanceOf(DEAD)).to.be.gt(0n);
    expect(await ethers.provider.getBalance(fee.address)).to.equal(feeBefore + treasuryFee);
    expect(await launchpad.graduationCount()).to.equal(1n);

    await expect(
      Curve.connect(alice).buy(0, alice.address, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("GRADUATED");
  });

  it("trades on the v2 router after graduation", async () => {
    const { launchpad, alice, bob, weth, router } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurveV2", curve);
    const Token = await ethers.getContractAt("Token", token);

    const gradEth = await Curve.graduationEth();
    await Curve.connect(alice).buy(0, alice.address, { value: gradEth + ethers.parseEther("1") });

    const wethAddr = await weth.getAddress();
    const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 600;

    await router
      .connect(bob)
      .swapExactETHForTokens(0, [wethAddr, token], bob.address, deadline, {
        value: ethers.parseEther("0.1"),
      });
    const bobBal = await Token.balanceOf(bob.address);
    expect(bobBal).to.be.gt(0n);

    await Token.connect(bob).approve(await router.getAddress(), bobBal);
    await router
      .connect(bob)
      .swapExactTokensForETH(bobBal, 0, [token, wethAddr], bob.address, deadline + 600);
    expect(await Token.balanceOf(bob.address)).to.equal(0n);
  });
});
