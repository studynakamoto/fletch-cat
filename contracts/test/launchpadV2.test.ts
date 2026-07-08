import { expect } from "chai";
import { ethers } from "hardhat";

const TOTAL = ethers.parseEther("1000000000");
const SALE = ethers.parseEther("800000000");
const VTOKEN = ethers.parseEther("1073000000");
const VETH = ethers.parseEther("0.5");
const FEE_BPS = 100n;
const DEAD = "0x000000000000000000000000000000000000dEaD";

async function deployAll() {
  const [deployer, alice, bob, fee] = await ethers.getSigners();

  // full Uniswap v2 stack (stands in for the canonical RH Chain deployment)
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
    SALE,
    VETH,
    VTOKEN,
    FEE_BPS
  );
  await launchpad.waitForDeployment();

  return { deployer, alice, bob, fee, weth, v2factory, router, launchpad };
}

async function createToken(launchpad: any, signer: any, value = 0n) {
  const tx = await launchpad
    .connect(signer)
    .createToken("Test", "TST", "desc", "img", "", "", "", { value });
  await tx.wait();
  const info = await launchpad.tokens(0);
  return { token: info.token, curve: info.curve };
}

describe("LaunchpadV2 + BondingCurveV2 + Uniswap v2 graduation", () => {
  it("creates a token seeded into its curve", async () => {
    const { launchpad, alice } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);

    const Token = await ethers.getContractAt("Token", token);
    expect(await Token.totalSupply()).to.equal(TOTAL);
    expect(await Token.balanceOf(curve)).to.equal(TOTAL);
    expect(await launchpad.tokenCount()).to.equal(1n);
  });

  it("quotes and curve math match the V1 curve", async () => {
    const { launchpad, alice } = await deployAll();
    const { curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurveV2", curve);

    // graduation target identical to V1: K/(Y0-sale) - X0
    const K = VETH * VTOKEN;
    const expected = K / (VTOKEN - SALE) - VETH;
    expect(await Curve.graduationEth()).to.equal(expected);

    const [tokensOut] = await Curve.getBuyQuote(ethers.parseEther("0.1"));
    expect(tokensOut).to.be.gt(0n);
  });

  it("enforces min-out slippage bounds on buy and sell", async () => {
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

  it("graduates into a Uniswap v2 WETH/token pair with LP burned", async () => {
    const { launchpad, alice, fee, weth, v2factory } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurveV2", curve);
    const Token = await ethers.getContractAt("Token", token);

    const gradEth = await Curve.graduationEth();
    const feeBefore = await ethers.provider.getBalance(fee.address);

    // overshoot; excess refunded
    await Curve.connect(alice).buy(0, alice.address, { value: gradEth + ethers.parseEther("1") });

    expect(await Curve.graduated()).to.equal(true);

    // pair exists on the v2 factory and is recorded on the curve
    const pairAddr = await v2factory.getPair(token, await weth.getAddress());
    expect(pairAddr).to.not.equal(ethers.ZeroAddress);
    expect(await Curve.pair()).to.equal(pairAddr);

    // migration tokens + raised ETH (minus fee) seeded as WETH
    expect(await Token.balanceOf(pairAddr)).to.equal(TOTAL - SALE);
    const expectedFee = (gradEth * FEE_BPS) / 10000n;
    const WethAt = await ethers.getContractAt("WETH9", await weth.getAddress());
    expect(await WethAt.balanceOf(pairAddr)).to.equal(gradEth - expectedFee);

    // LP locked at the dead address, fee paid to treasury
    const Pair = await ethers.getContractAt("UniswapV2Pair", pairAddr);
    expect(await Pair.balanceOf(DEAD)).to.be.gt(0n);
    expect(await ethers.provider.getBalance(fee.address)).to.equal(feeBefore + expectedFee);

    // curve closed
    await expect(
      Curve.connect(alice).buy(0, alice.address, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("GRADUATED");
  });

  it("trades on the v2 router after graduation (the DEXScreener-visible path)", async () => {
    const { launchpad, alice, bob, weth, router } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurveV2", curve);
    const Token = await ethers.getContractAt("Token", token);

    const gradEth = await Curve.graduationEth();
    await Curve.connect(alice).buy(0, alice.address, { value: gradEth + ethers.parseEther("1") });

    const wethAddr = await weth.getAddress();
    const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 600;

    // bob buys via the router (standard Uniswap v2 swap → Swap/Sync events)
    await router
      .connect(bob)
      .swapExactETHForTokens(0, [wethAddr, token], bob.address, deadline, {
        value: ethers.parseEther("0.1"),
      });
    const bobBal = await Token.balanceOf(bob.address);
    expect(bobBal).to.be.gt(0n);

    // and sells back
    await Token.connect(bob).approve(await router.getAddress(), bobBal);
    await router
      .connect(bob)
      .swapExactTokensForETH(bobBal, 0, [token, wethAddr], bob.address, deadline + 600);
    expect(await Token.balanceOf(bob.address)).to.equal(0n);
  });

  it("supports a dev buy at creation", async () => {
    const { launchpad, alice } = await deployAll();
    const { token } = await createToken(launchpad, alice, ethers.parseEther("0.05"));
    const Token = await ethers.getContractAt("Token", token);
    expect(await Token.balanceOf(alice.address)).to.be.gt(0n);
  });
});
