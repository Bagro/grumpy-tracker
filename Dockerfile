# syntax=docker/dockerfile:1
# --- Single-stage Bun build with Tailwind CLI via npx ---
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install
RUN bunx @tailwindcss/cli -i ./src/static/tailwind.input.css -o ./src/static/tailwind.css --minify
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
