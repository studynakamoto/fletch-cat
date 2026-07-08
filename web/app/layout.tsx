import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "fletch.cat — FletchPad launchpad on Robinhood Chain",
  description:
    "FletchPad: fair-launch tokens on a bonding curve, graduate to FletchSwap. The hood cat's launchpad on Robinhood Chain.",
  metadataBase: new URL("https://fletch.cat"),
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
