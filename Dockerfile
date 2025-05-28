# Grumpy Tracker Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npx prisma generate
COPY . .
RUN npx tailwindcss -i ./src/public/input.css -o ./src/public/tailwind.css --minify || true
EXPOSE 3000
CMD ["npm", "run", "start"]
