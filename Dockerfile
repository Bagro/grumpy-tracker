# Grumpy Tracker Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache openssl
RUN npm install
COPY . .
RUN npx prisma generate
RUN npx tailwindcss -i ./src/public/input.css -o ./src/public/tailwind.css --minify || true
RUN chmod +x ./start.sh
EXPOSE 3000
CMD ["./start.sh"]
