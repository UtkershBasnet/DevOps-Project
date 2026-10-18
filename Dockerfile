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
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
