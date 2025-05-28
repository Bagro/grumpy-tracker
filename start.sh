#!/bin/sh
set -e

# Run Prisma migrations
npx prisma migrate deploy

# Start the app
exec npm run start
