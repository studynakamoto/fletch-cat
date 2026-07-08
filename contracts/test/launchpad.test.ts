import { expect } from "chai";
import { ethers } from "hardhat";

const TOTAL = ethers.parseEther("1000000000");
const SALE = ethers.parseEther("800000000");
const VTOKEN = ethers.parseEther("1073000000");
const VETH = ethers.parseEther("0.5");
const FEE_BPS = 100n;

async function deployAll() {
  const [deployer, alice, bob, fee] = await ethers.getSigners();

  const PumpSwapFactory = await ethers.getContractFactory("PumpSwapFactory");
  const swap = await PumpSwapFactory.deploy();
  await swap.waitForDeployment();

  const LaunchpadFactory = await ethers.getContractFactory("LaunchpadFactory");
  const launchpad = await LaunchpadFactory.deploy(
    await swap.getAddress(),
    fee.address,
    TOTAL,
    SALE,
    VETH,
    VTOKEN,
    FEE_BPS
  );
  await launchpad.waitForDeployment();

  return { deployer, alice, bob, fee, swap, launchpad };
}

async function createToken(launchpad: any, signer: any, value = 0n) {
  const tx = await launchpad
    .connect(signer)
    .createToken("Test", "TST", "desc", "img", "", "", "", { value });
  const receipt = await tx.wait();
  const info = await launchpad.tokens(0);
  return { token: info.token, curve: info.curve, receipt };
}

describe("Launchpad + BondingCurve + PumpSwap", () => {
  it("creates a token seeded into its curve", async () => {
    const { launchpad } = await deployAll();
    const { token, curve } = await createToken(launchpad, (await ethers.getSigners())[1]);

    const Token = await ethers.getContractAt("Token", token);
    expect(await Token.totalSupply()).to.equal(TOTAL);
    expect(await Token.balanceOf(curve)).to.equal(TOTAL);
    expect(await launchpad.tokenCount()).to.equal(1n);
  });

  it("buys tokens along the curve and increases price", async () => {
    const { launchpad, alice } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurve", curve);
    const Token = await ethers.getContractAt("Token", token);

    const p0 = await Curve.currentPrice();
    await Curve.connect(alice).buy(0, alice.address, { value: ethers.parseEther("0.1") });
    const p1 = await Curve.currentPrice();

    expect(await Token.balanceOf(alice.address)).to.be.gt(0n);
    expect(p1).to.be.gt(p0);
    expect(await Curve.ethReserve()).to.equal(ethers.parseEther("0.1"));
  });

  it("sells tokens back to the curve", async () => {
    const { launchpad, alice } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurve", curve);
    const Token = await ethers.getContractAt("Token", token);

    await Curve.connect(alice).buy(0, alice.address, { value: ethers.parseEther("0.2") });
    const bal = await Token.balanceOf(alice.address);

    await Token.connect(alice).approve(curve, bal);
    const ethBefore = await ethers.provider.getBalance(alice.address);
    await Curve.connect(alice).sell(bal, 0, alice.address);
    const ethAfter = await ethers.provider.getBalance(alice.address);

    expect(ethAfter).to.be.gt(ethBefore - ethers.parseEther("0.05")); // got most ETH back minus gas
    expect(await Token.balanceOf(alice.address)).to.equal(0n);
  });

  it("graduates to PumpSwap once the sale supply is bought", async () => {
    const { launchpad, alice, swap, fee } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurve", curve);
    const Token = await ethers.getContractAt("Token", token);

    const gradEth = await Curve.graduationEth();
    const feeBefore = await ethers.provider.getBalance(fee.address);

    // send more than needed; excess should be refunded
    await Curve.connect(alice).buy(0, alice.address, { value: gradEth + ethers.parseEther("1") });

    expect(await Curve.graduated()).to.equal(true);

    const pair = await swap.getPair(token);
    expect(pair).to.not.equal(ethers.ZeroAddress);

    // migration tokens seeded into the pair
    expect(await Token.balanceOf(pair)).to.equal(TOTAL - SALE);

    // LP is locked at the dead address
    const Pair = await ethers.getContractAt("PumpSwapPair", pair);
    expect(await Pair.balanceOf("0x000000000000000000000000000000000000dEaD")).to.be.gt(0n);

    // platform fee paid
    expect(await ethers.provider.getBalance(fee.address)).to.be.gt(feeBefore);

    // curve is closed
    await expect(
      Curve.connect(alice).buy(0, alice.address, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("GRADUATED");
  });

  it("swaps on PumpSwap after graduation", async () => {
    const { launchpad, alice, bob, swap } = await deployAll();
    const { token, curve } = await createToken(launchpad, alice);
    const Curve = await ethers.getContractAt("BondingCurve", curve);
    const Token = await ethers.getContractAt("Token", token);

    const gradEth = await Curve.graduationEth();
    await Curve.connect(alice).buy(0, alice.address, { value: gradEth + ethers.parseEther("1") });

    const pair = await swap.getPair(token);
    const Pair = await ethers.getContractAt("PumpSwapPair", pair);

    // bob buys tokens from the pool with ETH
    await Pair.connect(bob).swapExactETHForTokens(0, bob.address, {
      value: ethers.parseEther("0.1"),
    });
    const bobBal = await Token.balanceOf(bob.address);
    expect(bobBal).to.be.gt(0n);

    // bob sells them back
    await Token.connect(bob).approve(pair, bobBal);
    await Pair.connect(bob).swapExactTokensForETH(bobBal, 0, bob.address);
    expect(await Token.balanceOf(bob.address)).to.equal(0n);
  });
});
