"use client";

import dynamic from "next/dynamic";

const PortfolioScreen = dynamic(() => import("@/components/PortfolioScreen"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-spring/25 border-t-spring" />
    </div>
  ),
});

export default function Page() {
  return <PortfolioScreen />;
}
