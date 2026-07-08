import { CANDLE_INTERVALS, INTERVAL_SECONDS } from "./config.js";
import { upsertCandle } from "./db.js";
import { candleBucket } from "./utils.js";

export function updateCandlesFromTrade(
  tokenAddress: string,
  timestamp: number,
  priceEth: bigint,
  volumeEth: bigint,
): void {
  for (const interval of CANDLE_INTERVALS) {
    const bucket = candleBucket(timestamp, INTERVAL_SECONDS[interval]);
    upsertCandle(tokenAddress, interval, bucket, priceEth, volumeEth);
  }
}
