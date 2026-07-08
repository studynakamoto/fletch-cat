import { ethers } from "hardhat";

// Adds a Uniswap v2 ETH/FLETCH liquidity position on Robinhood Chain (4663).
// Amounts are set via env vars:
//   ETH_AMOUNT   = ETH to add (e.g. "0.08")
//   FLETCH_AMOUNT= FLETCH to add (e.g. "800000")
//
// Run: ETH_AMOUNT=0.08 FLETCH_AMOUNT=800000 npx hardhat run scripts/uniLp.ts --network robinhood

const ROUTER = "0x89e5db8b5aa49aa85ac63f691524311aeb649eba";
const FACTORY = "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const FLETCH = "0x60977e96F4173A81674F8D4D636d55D43377e1A7";

const routerAbi = [
  "function addLiquidityETH(address token,uint amountTokenDesired,uint amountTokenMin,uint amountETHMin,address to,uint deadline) payable returns (uint amountToken,uint amountETH,uint liquidity)",
];
const factoryAbi = [
  "function getPair(address,address) view returns (address)",
];
const erc20Abi = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  const ethAmountStr = process.env.ETH_AMOUNT;
  const fletchAmountStr = process.env.FLETCH_AMOUNT;
  if (!ethAmountStr || !fletchAmountStr) {
    throw new Error("Set ETH_AMOUNT and FLETCH_AMOUNT env vars");
  }
  const ethAmount = ethers.parseEther(ethAmountStr);
  const fletchAmount = ethers.parseEther(fletchAmountStr);

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  const bal = await ethers.provider.getBalance(signer.address);
  console.log("ETH balance:", ethers.formatEther(bal));

  const token = new ethers.Contract(FLETCH, erc20Abi, signer);
  const fletchBal = await token.balanceOf(signer.address);
  console.log("FLETCH balance:", ethers.formatEther(fletchBal));

  if (bal < ethAmount + ethers.parseEther("0.01")) {
    throw new Error("Insufficient ETH for LP + gas buffer");
  }
  if (fletchBal < fletchAmount) {
    throw new Error("Insufficient FLETCH balance");
  }

  const factory = new ethers.Contract(FACTORY, factoryAbi, signer);
  const existing = await factory.getPair(FLETCH, WETH);
  console.log("Existing pair:", existing);

  const allowance = await token.allowance(signer.address, ROUTER);
  if (allowance < fletchAmount) {
    console.log("Approving FLETCH to router...");
    const atx = await token.approve(ROUTER, ethers.MaxUint256);
    await atx.wait();
    console.log("Approved.");
  }

  const router = new ethers.Contract(ROUTER, routerAbi, signer);
  const deadline = Math.floor(Date.now() / 1000) + 1200;
  console.log(`Adding liquidity: ${ethAmountStr} ETH + ${fletchAmountStr} FLETCH...`);
  const tx = await router.addLiquidityETH(
    FLETCH,
    fletchAmount,
    (fletchAmount * 95n) / 100n,
    (ethAmount * 95n) / 100n,
    signer.address,
    deadline,
    { value: ethAmount }
  );
  const receipt = await tx.wait();
  console.log("Liquidity added. tx:", receipt?.hash);

  const pair = await factory.getPair(FLETCH, WETH);
  console.log("Uniswap v2 pair:", pair);
  console.log("Explorer:", `https://robinhoodchain.blockscout.com/address/${pair}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
