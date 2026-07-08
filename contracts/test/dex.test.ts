import { expect } from "chai";
import { ethers } from "hardhat";

const MaxUint = ethers.MaxUint256;

// deadline helper — far in the future
async function deadline(): Promise<bigint> {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block!.timestamp) + 3600n;
}

async function deployDex() {
  const [deployer, alice, bob, feeSetter] = await ethers.getSigners();

  const WETH9 = await ethers.getContractFactory("WETH9");
  const weth = await WETH9.deploy();
  await weth.waitForDeployment();

  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(feeSetter.address);
  await factory.waitForDeployment();

  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(await factory.getAddress(), await weth.getAddress());
  await router.waitForDeployment();

  return { deployer, alice, bob, feeSetter, weth, factory, router };
}

async function deployToken(name: string, symbol: string, to: string, supply = ethers.parseEther("1000000")) {
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy(name, symbol, supply, to);
  await token.waitForDeployment();
  return token;
}

describe("PumpSwap V2 DEX", () => {
  describe("Factory", () => {
    it("creates a pair, registers it, and prevents duplicates", async () => {
      const { deployer, factory } = await deployDex();
      const a = await deployToken("Token A", "AAA", deployer.address);
      const b = await deployToken("Token B", "BBB", deployer.address);
      const aAddr = await a.getAddress();
      const bAddr = await b.getAddress();

      expect(await factory.allPairsLength()).to.equal(0n);
      await (await factory.createPair(aAddr, bAddr)).wait();
      expect(await factory.allPairsLength()).to.equal(1n);

      const pair = await factory.getPair(aAddr, bAddr);
      expect(pair).to.not.equal(ethers.ZeroAddress);
      // reverse lookup populated
      expect(await factory.getPair(bAddr, aAddr)).to.equal(pair);

      await expect(factory.createPair(aAddr, bAddr)).to.be.revertedWith("UniswapV2: PAIR_EXISTS");
      await expect(factory.createPair(aAddr, aAddr)).to.be.revertedWith("UniswapV2: IDENTICAL_ADDRESSES");

      const Pair = await ethers.getContractAt("UniswapV2Pair", pair);
      const [t0, t1] = [await Pair.token0(), await Pair.token1()];
      const expected0 = aAddr.toLowerCase() < bAddr.toLowerCase() ? aAddr : bAddr;
      expect(t0).to.equal(expected0);
      expect(t1).to.not.equal(t0);
    });

    it("only feeToSetter can toggle the protocol fee", async () => {
      const { factory, feeSetter, alice } = await deployDex();
      await expect(factory.connect(alice).setFeeTo(alice.address)).to.be.revertedWith("UniswapV2: FORBIDDEN");
      await (await factory.connect(feeSetter).setFeeTo(alice.address)).wait();
      expect(await factory.feeTo()).to.equal(alice.address);
    });
  });

  describe("Liquidity", () => {
    it("adds liquidity for a token/token pair and mints LP", async () => {
      const { deployer, router, factory } = await deployDex();
      const a = await deployToken("Token A", "AAA", deployer.address);
      const b = await deployToken("Token B", "BBB", deployer.address);
      const aAddr = await a.getAddress();
      const bAddr = await b.getAddress();
      const routerAddr = await router.getAddress();

      const amtA = ethers.parseEther("1000");
      const amtB = ethers.parseEther("4000");
      await (await a.approve(routerAddr, MaxUint)).wait();
      await (await b.approve(routerAddr, MaxUint)).wait();

      await (
        await router.addLiquidity(aAddr, bAddr, amtA, amtB, 0, 0, deployer.address, await deadline())
      ).wait();

      const pairAddr = await factory.getPair(aAddr, bAddr);
      const Pair = await ethers.getContractAt("UniswapV2Pair", pairAddr);

      const lp = await Pair.balanceOf(deployer.address);
      expect(lp).to.be.gt(0n);
      // sqrt(1000e18 * 4000e18) - 1000 = 2000e18 - 1000
      expect(lp).to.equal(ethers.parseEther("2000") - 1000n);
      // MINIMUM_LIQUIDITY locked at address(0)
      expect(await Pair.balanceOf(ethers.ZeroAddress)).to.equal(1000n);

      const [r0, r1] = await Pair.getReserves();
      expect(r0 + r1).to.equal(amtA + amtB);
    });

    it("adds liquidity with ETH (wraps to WETH) and removes it back", async () => {
      const { deployer, router, factory, weth } = await deployDex();
      const token = await deployToken("Token T", "TTT", deployer.address);
      const tokenAddr = await token.getAddress();
      const wethAddr = await weth.getAddress();
      const routerAddr = await router.getAddress();

      await (await token.approve(routerAddr, MaxUint)).wait();

      const amtToken = ethers.parseEther("10000");
      const amtETH = ethers.parseEther("10");
      await (
        await router.addLiquidityETH(tokenAddr, amtToken, 0, 0, deployer.address, await deadline(), {
          value: amtETH,
        })
      ).wait();

      const pairAddr = await factory.getPair(tokenAddr, wethAddr);
      const Pair = await ethers.getContractAt("UniswapV2Pair", pairAddr);
      const lp = await Pair.balanceOf(deployer.address);
      expect(lp).to.be.gt(0n);
      expect(await weth.balanceOf(pairAddr)).to.equal(amtETH);

      // remove all liquidity
      await (await Pair.approve(routerAddr, MaxUint)).wait();
      const tokenBefore = await token.balanceOf(deployer.address);
      await (
        await router.removeLiquidityETH(tokenAddr, lp, 0, 0, deployer.address, await deadline())
      ).wait();

      expect(await Pair.balanceOf(deployer.address)).to.equal(0n);
      // got the tokens back (minus the tiny locked minimum liquidity share)
      expect(await token.balanceOf(deployer.address)).to.be.gt(tokenBefore);
    });
  });

  describe("Swaps", () => {
    it("swaps token -> token via exact input", async () => {
      const { deployer, alice, router, factory } = await deployDex();
      const a = await deployToken("Token A", "AAA", deployer.address);
      const b = await deployToken("Token B", "BBB", deployer.address);
      const aAddr = await a.getAddress();
      const bAddr = await b.getAddress();
      const routerAddr = await router.getAddress();

      await (await a.approve(routerAddr, MaxUint)).wait();
      await (await b.approve(routerAddr, MaxUint)).wait();
      await (
        await router.addLiquidity(
          aAddr,
          bAddr,
          ethers.parseEther("10000"),
          ethers.parseEther("10000"),
          0,
          0,
          deployer.address,
          await deadline()
        )
      ).wait();

      // give alice some A and let her swap for B
      const amountIn = ethers.parseEther("100");
      await (await a.transfer(alice.address, amountIn)).wait();
      await (await a.connect(alice).approve(routerAddr, MaxUint)).wait();

      const path = [aAddr, bAddr];
      const expected = await router.getAmountsOut(amountIn, path);
      expect(expected[1]).to.be.gt(0n);

      const bBefore = await b.balanceOf(alice.address);
      await (
        await router
          .connect(alice)
          .swapExactTokensForTokens(amountIn, 0, path, alice.address, await deadline())
      ).wait();
      const bAfter = await b.balanceOf(alice.address);

      expect(bAfter - bBefore).to.equal(expected[1]);
      expect(await a.balanceOf(alice.address)).to.equal(0n);
    });

    it("swaps tokens for an exact output amount", async () => {
      const { deployer, alice, router } = await deployDex();
      const a = await deployToken("Token A", "AAA", deployer.address);
      const b = await deployToken("Token B", "BBB", deployer.address);
      const aAddr = await a.getAddress();
      const bAddr = await b.getAddress();
      const routerAddr = await router.getAddress();

      await (await a.approve(routerAddr, MaxUint)).wait();
      await (await b.approve(routerAddr, MaxUint)).wait();
      await (
        await router.addLiquidity(
          aAddr,
          bAddr,
          ethers.parseEther("10000"),
          ethers.parseEther("10000"),
          0,
          0,
          deployer.address,
          await deadline()
        )
      ).wait();

      const amountOut = ethers.parseEther("50");
      const path = [aAddr, bAddr];
      const amountsIn = await router.getAmountsIn(amountOut, path);

      await (await a.transfer(alice.address, amountsIn[0])).wait();
      await (await a.connect(alice).approve(routerAddr, MaxUint)).wait();

      const bBefore = await b.balanceOf(alice.address);
      await (
        await router
          .connect(alice)
          .swapTokensForExactTokens(amountOut, amountsIn[0], path, alice.address, await deadline())
      ).wait();
      expect((await b.balanceOf(alice.address)) - bBefore).to.equal(amountOut);
    });

    it("swaps ETH -> token -> token via a multi-hop path", async () => {
      const { deployer, alice, router, weth } = await deployDex();
      const mid = await deployToken("Mid", "MID", deployer.address);
      const out = await deployToken("Out", "OUT", deployer.address);
      const wethAddr = await weth.getAddress();
      const midAddr = await mid.getAddress();
      const outAddr = await out.getAddress();
      const routerAddr = await router.getAddress();

      await (await mid.approve(routerAddr, MaxUint)).wait();
      await (await out.approve(routerAddr, MaxUint)).wait();

      // WETH/MID pool
      await (
        await router.addLiquidityETH(
          midAddr,
          ethers.parseEther("10000"),
          0,
          0,
          deployer.address,
          await deadline(),
          { value: ethers.parseEther("10") }
        )
      ).wait();

      // MID/OUT pool
      await (
        await router.addLiquidity(
          midAddr,
          outAddr,
          ethers.parseEther("10000"),
          ethers.parseEther("20000"),
          0,
          0,
          deployer.address,
          await deadline()
        )
      ).wait();

      const path = [wethAddr, midAddr, outAddr];
      const amountInETH = ethers.parseEther("1");
      const expected = await router.getAmountsOut(amountInETH, path);
      expect(expected[2]).to.be.gt(0n);

      const outBefore = await out.balanceOf(alice.address);
      await (
        await router
          .connect(alice)
          .swapExactETHForTokens(0, path, alice.address, await deadline(), { value: amountInETH })
      ).wait();
      const outAfter = await out.balanceOf(alice.address);

      expect(outAfter - outBefore).to.equal(expected[2]);
    });

    it("swaps exact tokens for ETH (unwraps WETH)", async () => {
      const { deployer, alice, router, weth } = await deployDex();
      const token = await deployToken("Token T", "TTT", deployer.address);
      const tokenAddr = await token.getAddress();
      const wethAddr = await weth.getAddress();
      const routerAddr = await router.getAddress();

      await (await token.approve(routerAddr, MaxUint)).wait();
      await (
        await router.addLiquidityETH(
          tokenAddr,
          ethers.parseEther("10000"),
          0,
          0,
          deployer.address,
          await deadline(),
          { value: ethers.parseEther("10") }
        )
      ).wait();

      const amountIn = ethers.parseEther("100");
      await (await token.transfer(alice.address, amountIn)).wait();
      await (await token.connect(alice).approve(routerAddr, MaxUint)).wait();

      const path = [tokenAddr, wethAddr];
      const ethBefore = await ethers.provider.getBalance(alice.address);
      const tx = await router
        .connect(alice)
        .swapExactTokensForETH(amountIn, 0, path, alice.address, await deadline());
      const receipt = await tx.wait();
      const gas = receipt!.gasUsed * receipt!.gasPrice;
      const ethAfter = await ethers.provider.getBalance(alice.address);

      // received net ETH after gas
      expect(ethAfter + gas).to.be.gt(ethBefore);
    });

    it("reverts when slippage bound is not met", async () => {
      const { deployer, router } = await deployDex();
      const a = await deployToken("Token A", "AAA", deployer.address);
      const b = await deployToken("Token B", "BBB", deployer.address);
      const aAddr = await a.getAddress();
      const bAddr = await b.getAddress();
      const routerAddr = await router.getAddress();

      await (await a.approve(routerAddr, MaxUint)).wait();
      await (await b.approve(routerAddr, MaxUint)).wait();
      await (
        await router.addLiquidity(
          aAddr,
          bAddr,
          ethers.parseEther("10000"),
          ethers.parseEther("10000"),
          0,
          0,
          deployer.address,
          await deadline()
        )
      ).wait();

      const path = [aAddr, bAddr];
      await expect(
        router.swapExactTokensForTokens(
          ethers.parseEther("100"),
          ethers.parseEther("1000"), // impossibly high min out
          path,
          deployer.address,
          await deadline()
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("reverts on an expired deadline", async () => {
      const { deployer, router } = await deployDex();
      const a = await deployToken("Token A", "AAA", deployer.address);
      const b = await deployToken("Token B", "BBB", deployer.address);
      const path = [await a.getAddress(), await b.getAddress()];
      await expect(
        router.swapExactTokensForTokens(1n, 0, path, deployer.address, 1n)
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });
  });

  describe("Protocol fee", () => {
    it("mints LP to feeTo after swaps when the fee switch is on", async () => {
      const { deployer, alice, router, factory, feeSetter } = await deployDex();
      await (await factory.connect(feeSetter).setFeeTo(feeSetter.address)).wait();

      const a = await deployToken("Token A", "AAA", deployer.address);
      const b = await deployToken("Token B", "BBB", deployer.address);
      const aAddr = await a.getAddress();
      const bAddr = await b.getAddress();
      const routerAddr = await router.getAddress();

      await (await a.approve(routerAddr, MaxUint)).wait();
      await (await b.approve(routerAddr, MaxUint)).wait();
      await (
        await router.addLiquidity(
          aAddr,
          bAddr,
          ethers.parseEther("10000"),
          ethers.parseEther("10000"),
          0,
          0,
          deployer.address,
          await deadline()
        )
      ).wait();

      // generate fees with a swap
      await (await a.transfer(alice.address, ethers.parseEther("1000"))).wait();
      await (await a.connect(alice).approve(routerAddr, MaxUint)).wait();
      await (
        await router
          .connect(alice)
          .swapExactTokensForTokens(
            ethers.parseEther("1000"),
            0,
            [aAddr, bAddr],
            alice.address,
            await deadline()
          )
      ).wait();

      const pairAddr = await factory.getPair(aAddr, bAddr);
      const Pair = await ethers.getContractAt("UniswapV2Pair", pairAddr);

      // add a tiny bit more liquidity to trigger _mintFee
      await (
        await router.addLiquidity(
          aAddr,
          bAddr,
          ethers.parseEther("1"),
          ethers.parseEther("1"),
          0,
          0,
          deployer.address,
          await deadline()
        )
      ).wait();

      expect(await Pair.balanceOf(feeSetter.address)).to.be.gt(0n);
    });
  });
});
