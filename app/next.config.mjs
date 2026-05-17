/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: false,
  transpilePackages: ["@pythnetwork/pyth-solana-receiver", "@coral-xyz/anchor"],
  webpack: (cfg, { webpack }) => {
    cfg.resolve.fallback = { ...cfg.resolve.fallback, fs: false, path: false, crypto: false };
    // solana-utils pulls jito-ts (Jito bundles) which we don't use — stub it out.
    cfg.resolve.alias = { ...cfg.resolve.alias, "jito-ts": false };
    // pyth-solana-receiver + uint8array-tools ship malformed `exports` maps
    // (default condition not last); ignore exports fields and fall back to main/module.
    cfg.resolve.exportsFields = [];
    cfg.plugins.push(
      new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"], process: "process/browser" }),
    );
    return cfg;
  },
};

export default config;
