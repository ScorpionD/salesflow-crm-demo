FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json .npmrc ./
FROM base AS test
RUN npm ci --no-audit --no-fund
COPY . .
CMD ["npm","test"]
FROM base AS production
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node server ./server
USER node
EXPOSE 4600
CMD ["node","server/index.mjs"]
