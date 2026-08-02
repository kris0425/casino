# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pil fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
RUN mkdir -p /app/data/renders

# Runtime media is mounted read-only by docker-compose. It intentionally does
# not belong in the image or Docker build context.
COPY activity/public ./activity/public
COPY scripts ./scripts
COPY updates ./updates
COPY CHANGELOG.md ./CHANGELOG.md
COPY src ./src
ENV NODE_ENV=production
VOLUME ["/app/data"]
CMD ["node", "src/index.js"]
