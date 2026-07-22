"use client";

import dynamic from "next/dynamic";

/* Wallet libraries need browser APIs; skip prerender for the whole shell so
 * the static export stays clean. */
const AppShell = dynamic(() => import("@/components/AppShell"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-spring/25 border-t-spring" />
    </div>
  ),
});

export default function Page() {
  return <AppShell />;
}
