FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

ENV NODE_ENV=production
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
