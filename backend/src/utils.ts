const TOKEN_DECIMALS = 18n;
const WAD = 10n ** TOKEN_DECIMALS;

export function weiToEth(wei: bigint): number {
  return Number(wei) / 1e18;
}

export function ethToUsd(eth: number, ethUsd: number): number {
  return eth * ethUsd;
}

export function tradePriceEth(ethWei: bigint, tokenWei: bigint): bigint {
  if (tokenWei === 0n) return 0n;
  return (ethWei * WAD) / tokenWei;
}

export function pairPriceEth(reserveEth: bigint, reserveToken: bigint): bigint {
  if (reserveToken === 0n) return 0n;
  return (reserveEth * WAD) / reserveToken;
}

export function marketCapEth(priceEthWei: bigint, totalSupply: bigint): bigint {
  return (priceEthWei * totalSupply) / WAD;
}

export function curveProgress(tokensSold: bigint, saleSupply: bigint): number {
  if (saleSupply === 0n) return 0;
  return Number((tokensSold * 10000n) / saleSupply) / 100;
}

export function formatAddress(address: string): string {
  return address.toLowerCase();
}

export function tradeId(txHash: string, logIndex: number): string {
  return `${txHash}:${logIndex}`;
}

export function candleBucket(timestamp: number, intervalSeconds: number): number {
  return Math.floor(timestamp / intervalSeconds) * intervalSeconds;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
