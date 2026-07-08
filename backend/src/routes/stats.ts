import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { getGlobalStats } from "../db.js";
import { publicClient } from "../indexer.js";
import { ethToUsd, weiToEth } from "../utils.js";

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/stats", async () => {
    const { totalTokens, totalVolumeEth } = getGlobalStats();

    let treasuryBalanceEth = 0;
    try {
      const balance = await publicClient.getBalance({
        address: config.contracts.treasury,
      });
      treasuryBalanceEth = weiToEth(balance);
    } catch {
      treasuryBalanceEth = 0;
    }

    const totalVolumeEthNum = weiToEth(totalVolumeEth);

    return {
      totalTokens,
      totalVolumeEth: totalVolumeEthNum,
      totalVolumeUsd: ethToUsd(totalVolumeEthNum, config.ethUsd),
      treasuryBalanceEth,
      treasuryBalanceUsd: ethToUsd(treasuryBalanceEth, config.ethUsd),
      ethUsd: config.ethUsd,
    };
  });
}
