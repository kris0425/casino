# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pil fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
RUN mkdir -p /app/data/renders

# Keep large, rarely changed media in cache layers before frequently changed code.
COPY assets ./assets
COPY activity/public ./activity/public
COPY scripts ./scripts
COPY updates ./updates
COPY CHANGELOG.md ./CHANGELOG.md
COPY src ./src
ENV NODE_ENV=production
VOLUME ["/app/data"]
CMD ["node", "src/index.js"]
