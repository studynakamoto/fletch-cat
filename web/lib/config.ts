import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { robinhood, robinhoodTestnet, hardhatLocal, chainById } from "./chains";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "46630");

export const activeChain = chainById(CHAIN_ID);

export const LAUNCHPAD_FACTORY = (process.env.NEXT_PUBLIC_LAUNCHPAD_FACTORY ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const PUMPSWAP_FACTORY = (process.env.NEXT_PUBLIC_PUMPSWAP_FACTORY ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

const ZERO = "0x0000000000000000000000000000000000000000";

export const PLATFORM_TOKEN = (process.env.NEXT_PUBLIC_PLATFORM_TOKEN ?? ZERO) as `0x${string}`;
export const PLATFORM_PAIR = (process.env.NEXT_PUBLIC_PLATFORM_PAIR ?? ZERO) as `0x${string}`;
export const TREASURY = (process.env.NEXT_PUBLIC_TREASURY ?? ZERO) as `0x${string}`;

export const hasPlatformToken = PLATFORM_TOKEN !== ZERO && PLATFORM_PAIR !== ZERO;

// Uniswap v2-compatible DEX (canonical RH Chain Uniswap or FletchSwap fork).
// When configured, graduated tokens with a v2 pool trade through the router.
export const DEX_ROUTER = (process.env.NEXT_PUBLIC_DEX_ROUTER ?? ZERO) as `0x${string}`;
export const DEX_FACTORY = (process.env.NEXT_PUBLIC_DEX_FACTORY ?? ZERO) as `0x${string}`;
export const WETH = (process.env.NEXT_PUBLIC_WETH ?? ZERO) as `0x${string}`;
export const hasV2Dex = DEX_ROUTER !== ZERO && DEX_FACTORY !== ZERO && WETH !== ZERO;

export const wagmiConfig = getDefaultConfig({
  appName: "fletch.cat",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "fletchcat-dev",
  chains: [robinhoodTestnet, robinhood, hardhatLocal],
  transports: {
    [robinhood.id]: http(),
    [robinhoodTestnet.id]: http(),
    [hardhatLocal.id]: http(),
  },
  ssr: true,
});
