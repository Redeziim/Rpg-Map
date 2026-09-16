FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3001 HOST=0.0.0.0 DB_PATH=/data/grimorio.sqlite
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/node_modules/three ./node_modules/three
COPY --from=build /app/src/components/diceGeometry.js ./src/components/diceGeometry.js
COPY --from=build /app/src/shared ./src/shared
COPY --from=build /app/package.json ./package.json
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3001
CMD ["node", "server/index.js"]
