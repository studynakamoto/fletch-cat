import "dotenv/config";
import { getAddress, type Address } from "viem";
import {
  bondingCurveAbi,
  erc20Abi,
  launchpadFactoryAbi,
  pumpSwapFactoryAbi,
  pumpSwapPairAbi,
} from "./abis.js";

function requireAddress(name: string, value: string | undefined): Address {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return getAddress(value);
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
  }
  return n;
}

function parseFloatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid float for ${name}: ${raw}`);
  }
  return n;
}

export const config = {
  port: parseIntEnv("PORT", 3001),
  rpcUrl: process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com",
  chainId: parseIntEnv("CHAIN_ID", 4663),
  startBlock: parseIntEnv("START_BLOCK", 0),
  blockChunkSize: parseIntEnv("BLOCK_CHUNK_SIZE", 2000),
  ethUsd: parseFloatEnv("ETH_USD", 1800),
  databasePath: process.env.DATABASE_PATH ?? "./data/indexer.db",
  contracts: {
    launchpadFactory: requireAddress(
      "LAUNCHPAD_FACTORY",
      process.env.LAUNCHPAD_FACTORY ?? "0x345f727b2C919789C991d96865505BD654d1F8F0",
    ),
    pumpSwapFactory: requireAddress(
      "PUMPSWAP_FACTORY",
      process.env.PUMPSWAP_FACTORY ?? "0x4B167BE628c8Bfb60FCEE215a9f3A68FC6f500B9",
    ),
    platformToken: requireAddress(
      "PLATFORM_TOKEN",
      process.env.PLATFORM_TOKEN ?? "0x60977e96F4173A81674F8D4D636d55D43377e1A7",
    ),
    platformPair: requireAddress(
      "PLATFORM_PAIR",
      process.env.PLATFORM_PAIR ?? "0x5635c0a6633E2c79ceB1f450DbE464FA8F0E76Ba",
    ),
    treasury: requireAddress(
      "TREASURY",
      process.env.TREASURY ?? "0xCFc622Af7E71C78d9e5672F4033C6225A6A36234",
    ),
  },
  abis: {
    launchpadFactory: launchpadFactoryAbi,
    bondingCurve: bondingCurveAbi,
    pumpSwapPair: pumpSwapPairAbi,
    pumpSwapFactory: pumpSwapFactoryAbi,
    erc20: erc20Abi,
  },
} as const;

export type CandleInterval = "1m" | "5m" | "1h";
export const CANDLE_INTERVALS: CandleInterval[] = ["1m", "5m", "1h"];

export const INTERVAL_SECONDS: Record<CandleInterval, number> = {
  "1m": 60,
  "5m": 300,
  "1h": 3600,
};
