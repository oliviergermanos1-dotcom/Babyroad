# BabyPhone WebSocket server
FROM node:20-alpine

WORKDIR /app

# Install production deps using the committed lockfile for reproducible builds.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Railway/Render inject PORT at runtime; this is just the documented default.
EXPOSE 5000

CMD ["node", "server.js"]
