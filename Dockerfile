# syntax=docker/dockerfile:1
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install
CMD ["bun", "run", "src/index.ts"]
