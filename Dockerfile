# ---- deps: instala apenas dependências de produção ----
FROM node:22-bookworm-slim AS deps
WORKDIR /usr/app
ENV NODE_ENV=production
COPY ./src/package.json ./src/package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    LANG=C.UTF-8

RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/app

COPY --from=deps --chown=node:node /usr/app/node_modules ./node_modules
COPY --chown=node:node ./src/ ./

# cycletls é um binário Go que precisa de permissão de execução
RUN chmod +x ./node_modules/cycletls/dist/index* 2>/dev/null || true

USER node

CMD ["node", "index.js"]
