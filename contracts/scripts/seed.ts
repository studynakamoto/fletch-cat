import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Creates a few demo tokens on a running local node so the UI isn't empty.
async function main() {
  const record = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments.json"), "utf8")
  );
  const [dev] = await ethers.getSigners();
  const launchpad = await ethers.getContractAt("LaunchpadFactory", record.launchpadFactory);

  const demos = [
    ["Robinhood Doge", "RHDOGE", "The first dog on Robinhood Chain.", "🐕"],
    ["Pump Cat", "PCAT", "Meow to the moon.", "🐱"],
    ["Chain Frog", "CFROG", "Ribbit onchain.", "🐸"],
  ];

  for (const [name, symbol, desc, image] of demos) {
    const tx = await launchpad.createToken(name, symbol, desc, image, "", "", "", {
      value: ethers.parseEther("0.05"),
    });
    const receipt = await tx.wait();
    console.log(`Created ${symbol} (tx ${receipt?.hash})`);
  }
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
