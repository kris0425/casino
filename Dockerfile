FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pil fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
COPY updates ./updates
COPY CHANGELOG.md ./CHANGELOG.md
COPY assets ./assets
COPY activity/public ./activity/public
RUN mkdir -p /app/data/renders
ENV NODE_ENV=production
VOLUME ["/app/data"]
CMD ["node", "src/index.js"]
