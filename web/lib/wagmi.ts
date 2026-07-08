import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected, metaMask } from "wagmi/connectors";
import { hardhatLocal, robinhood, robinhoodTestnet } from "./chains";
import { WALLETCONNECT_ID, hasWalletConnect } from "./constants";

const chains = [robinhoodTestnet, robinhood, hardhatLocal] as const;
const transports = {
  [robinhood.id]: http(),
  [robinhoodTestnet.id]: http(),
  [hardhatLocal.id]: http(),
} as const;

// WalletConnect needs a real project id from cloud.walletconnect.com.
// Without one, browser-extension wallets still work; WC/mobile QR does not.
export const wagmiConfig = hasWalletConnect
  ? getDefaultConfig({
      appName: "fletch.cat",
      projectId: WALLETCONNECT_ID,
      chains,
      transports,
      ssr: true,
    })
  : createConfig({
      chains,
      connectors: [
        metaMask(),
        coinbaseWallet({ appName: "fletch.cat" }),
        injected(),
      ],
      transports,
      ssr: true,
    });
