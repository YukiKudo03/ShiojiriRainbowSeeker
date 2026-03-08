ARG NODE_VERSION=20

# Stage 1: deps — npm ci with layer caching
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Stage 2: test — copy source and run tests
FROM node:${NODE_VERSION}-slim AS test
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV CI=true
CMD ["npm", "run", "test:all"]
