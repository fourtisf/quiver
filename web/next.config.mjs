/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export served by nginx at hoodpool.fun/app/
  output: "export",
  basePath: "/app",
  trailingSlash: true,
  images: { unoptimized: true },
  webpack: (config) => {
    // Optional peer deps of the Coinbase connector chain (x402 payments) that
    // are statically imported but never used by wallet connect / swap.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/evm": false,
      "@x402/core": false,
      "@x402/svm": false,
      porto: false,
    };
    return config;
  },
};

export default nextConfig;
