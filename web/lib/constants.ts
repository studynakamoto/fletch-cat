import { chainById } from "./chains";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "46630");

export const activeChain = chainById(CHAIN_ID);

export const LAUNCHPAD_FACTORY = (process.env.NEXT_PUBLIC_LAUNCHPAD_FACTORY ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const PUMPSWAP_FACTORY = (process.env.NEXT_PUBLIC_PUMPSWAP_FACTORY ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

const ZERO = "0x0000000000000000000000000000000000000000";

// Canonical Uniswap v2 on Robinhood Chain mainnet (see HANDOFF.md).
const MAINNET_DEX = {
  router: "0x89e5db8b5aa49aa85ac63f691524311aeb649eba",
  factory: "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f",
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
} as const;

function dexAddress(envValue: string | undefined, mainnetDefault: string): `0x${string}` {
  const configured = envValue?.trim();
  if (configured && configured !== ZERO) return configured as `0x${string}`;
  if (CHAIN_ID === 4663) return mainnetDefault as `0x${string}`;
  return ZERO;
}

export const PLATFORM_TOKEN = (process.env.NEXT_PUBLIC_PLATFORM_TOKEN ?? ZERO) as `0x${string}`;
export const PLATFORM_PAIR = (process.env.NEXT_PUBLIC_PLATFORM_PAIR ?? ZERO) as `0x${string}`;
export const TREASURY = (process.env.NEXT_PUBLIC_TREASURY ?? ZERO) as `0x${string}`;

export const hasPlatformToken = PLATFORM_TOKEN !== ZERO && PLATFORM_PAIR !== ZERO;

export const DEX_ROUTER = dexAddress(process.env.NEXT_PUBLIC_DEX_ROUTER, MAINNET_DEX.router);
export const DEX_FACTORY = dexAddress(process.env.NEXT_PUBLIC_DEX_FACTORY, MAINNET_DEX.factory);
export const WETH = dexAddress(process.env.NEXT_PUBLIC_WETH, MAINNET_DEX.weth);
export const hasV2Dex = DEX_ROUTER !== ZERO && DEX_FACTORY !== ZERO && WETH !== ZERO;

export const WALLETCONNECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_ID?.trim() ?? "";
export const hasWalletConnect = WALLETCONNECT_ID.length > 0;
