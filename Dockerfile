FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_PUBLIC_SITE_URL
ENV VITE_BASE_PATH=/
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/server.ts ./server.ts
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src/utils/aiValidation.ts ./src/utils/aiValidation.ts
COPY --from=build --chown=node:node /app/src/utils/aiProtocol.ts ./src/utils/aiProtocol.ts
USER node
EXPOSE 3000
CMD ["node", "--import", "tsx", "server.ts"]
