import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: false,
  transpilePackages: [
    "@pythnetwork/pyth-solana-receiver",
    "@coral-xyz/anchor",
    "@splinetool/react-spline",
    "@splinetool/runtime",
  ],
  // Keep the heavy Raydium SDK out of the webpack bundle — required natively in the
  // node API route (avoids the exportsFields override below breaking its resolution).
  experimental: { serverComponentsExternalPackages: ["@raydium-io/raydium-sdk-v2"] },
  webpack: (cfg, { webpack }) => {
    cfg.resolve.fallback = { ...cfg.resolve.fallback, fs: false, path: false, crypto: false };
    // solana-utils pulls jito-ts (Jito bundles) which we don't use — stub it out.
    cfg.resolve.alias = {
      ...cfg.resolve.alias,
      "jito-ts": false,
      // react-spline ships only an `exports` map (no `main`); the exportsFields=[]
      // override below would break it, so point the bare specifier at its ESM entry.
      "@splinetool/react-spline$": path.resolve(
        __dirname,
        "node_modules/@splinetool/react-spline/dist/react-spline.js",
      ),
    };
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
