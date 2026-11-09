# Production image (PostgreSQL). Build: docker compose build
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN node scripts/set-db-provider.mjs postgresql && npx prisma generate && npx next build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production TZ=Africa/Addis_Ababa PORT=3000
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/* && useradd -m app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /app/storage && chown -R app /app/storage
USER app
EXPOSE 3000
# Apply migrations, sync the permission catalogue, then start.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && node server.js"]
