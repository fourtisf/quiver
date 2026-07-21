import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hoodpool — Liquidity for Robinfun tokens on Robinhood Chain",
  description:
    "Non-custodial liquidity venue for Robinfun tokens: one-click Uniswap pools, 1% swap fees to LPs, on-chain take-profit / stop-loss.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink font-body text-foam antialiased">{children}</body>
    </html>
  );
}
