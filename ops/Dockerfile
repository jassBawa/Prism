# Build context = repo root:  docker build -f ops/Dockerfile -t mini-symmetry-ops .
FROM node:22-slim

WORKDIR /app
RUN corepack enable

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
