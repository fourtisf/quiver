"use client";

import {
  RainbowKitProvider,
  connectorsForWallets,
  darkTheme,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, WagmiProvider, createConfig } from "wagmi";
import { robinhoodChain } from "@/lib/chain";
import "@rainbow-me/rainbowkit/styles.css";

/* With NEXT_PUBLIC_WC_PROJECT_ID set (free at cloud.reown.com) the full
 * RainbowKit wallet list incl. WalletConnect QR is offered. Without it, only
 * injected wallets (MetaMask etc.) are shown — no dead options in the modal. */
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

const config = projectId
  ? getDefaultConfig({
      appName: "Hoodpool",
      projectId,
      chains: [robinhoodChain],
      ssr: false,
    })
  : createConfig({
      chains: [robinhoodChain],
      connectors: connectorsForWallets(
        [{ groupName: "Wallets", wallets: [injectedWallet] }],
        { appName: "Hoodpool", projectId: "unused-injected-only" },
      ),
      transports: { [robinhoodChain.id]: http() },
      ssr: false,
    });

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#3FE0AE",
            accentColorForeground: "#050E10",
            borderRadius: "medium",
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
