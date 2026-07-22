"use client";

import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { robinhoodChain } from "@/lib/chain";
import "@rainbow-me/rainbowkit/styles.css";

/* WalletConnect projectId: injected wallets (MetaMask etc.) work without one;
 * set NEXT_PUBLIC_WC_PROJECT_ID (free at cloud.reown.com) to enable the
 * WalletConnect QR path as well. */
const config = getDefaultConfig({
  appName: "Hoodpool",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "00000000000000000000000000000000",
  chains: [robinhoodChain],
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
