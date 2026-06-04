# Build context = repo root:  docker build -f ops/Dockerfile -t mini-symmetry-ops .
# Node 25 to match local dev: anchor 0.32 is CJS and `import { BN }` only resolves
# under Node's newer cjs-module-lexer (Node 22's misses the re-export → SyntaxError).
FROM node:25-slim

WORKDIR /app
# Pin pnpm to the repo's version: pnpm 11+ turns ignored optional-native build
# scripts (bigint-buffer, esbuild, …) into a hard error; 10.x only warns and the
# pure-JS fallbacks are fine for the keeper. Node 25 dropped corepack → use npm.
RUN npm install -g pnpm@10.32.1

# install deps (tsx is a devDep — keeper/ops run TS directly)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod=false

# the ops service reuses sdk/ + keeper/
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Required env at runtime: RPC_URL, ADMIN_SECRET_KEY, FAUCET_USDC_MINT,
# (optional) FAUCET_SOL_SECRET_KEY, ALLOW_ORIGIN, KEEPER_POLL_MS, FAUCET_SOL, FAUCET_USDC
CMD ["pnpm", "exec", "tsx", "ops/index.ts"]
