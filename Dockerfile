# --- build stage: install production deps only
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# --- runtime stage: small, non-root
FROM node:20-alpine
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ENV NODE_ENV=production APP_VERSION=${APP_VERSION} GIT_SHA=${GIT_SHA}
# patch OS packages, and drop npm/yarn: the runtime only needs `node`, and their bundled deps carry CVEs
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn-*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
USER 1000
EXPOSE 3000
CMD ["node", "src/server.js"]
