import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DEAD = "0x000000000000000000000000000000000000dEaD";

// Manual buyback: treasury wallet swaps ETH on PumpSwap for $FLETCH
// and sends tokens to 0xdead (burn).
//
// Usage:
//   npm run buyback:local                 # spend all ETH in treasury wallet (minus gas buffer)
//   AMOUNT_ETH=0.05 npm run buyback:local # spend a fixed amount
async function main() {
  const record = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments.json"), "utf8")
  );
  const [signer] = await ethers.getSigners();
  const treasury = record.treasury ?? signer.address;

  if (signer.address.toLowerCase() !== treasury.toLowerCase()) {
    console.warn(`Warning: signer ${signer.address} is not the configured treasury ${treasury}`);
  }

  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`Treasury balance: ${ethers.formatEther(balance)} ETH`);

  const gasBuffer = ethers.parseEther("0.01");
  const maxSpend = balance > gasBuffer ? balance - gasBuffer : 0n;
  if (maxSpend === 0n) {
    console.log("Nothing to buy back — fund the treasury wallet first.");
    return;
  }

  const amount = process.env.AMOUNT_ETH ? ethers.parseEther(process.env.AMOUNT_ETH) : maxSpend;
  if (amount > maxSpend) {
    throw new Error(`AMOUNT_ETH (${process.env.AMOUNT_ETH}) exceeds spendable balance`);
  }

  const pair = await ethers.getContractAt("PumpSwapPair", record.platformPair);
  const platform = await ethers.getContractAt("Token", record.platformToken);

  const burnedBefore = await platform.balanceOf(DEAD);
  const tx = await pair.swapExactETHForTokens(0n, DEAD, { value: amount });
  const receipt = await tx.wait();
  const burnedAfter = await platform.balanceOf(DEAD);
  const bought = burnedAfter - burnedBefore;

  console.log(`Bought back with ${ethers.formatEther(amount)} ETH (tx ${receipt?.hash})`);
  console.log(`Tokens burned this run: ${ethers.formatEther(bought)}`);
  console.log(`Total burned (0xdead):  ${ethers.formatEther(burnedAfter)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
