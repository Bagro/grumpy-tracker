#!/bin/zsh

# Azure deployment script for Grumpy Tracker
# - Container App (with automatic update)
# - PostgreSQL Flexible Server (data preserved)
# - Let's Encrypt certificate for custom domain (auto-renewed)
# - Region: Sweden (swedencentral)

RESOURCE_GROUP="grumpy-rg"
LOCATION="swedencentral"
CONTAINERAPP_ENV="grumpy-env"
CONTAINERAPP_NAME="grumpy-tracker"
POSTGRES_NAME="grumpy-pg"
POSTGRES_ADMIN="grumpyadmin"
POSTGRES_PASSWORD="yourStrong(!)Password" # Change this and use secrets in production!
IMAGE="ghcr.io/Bagro/grumpy-tracker:latest"
DOMAIN_NAME="yourdomain.example.com" # <-- Set your custom domain here

# 1. Resource group
az group show --name $RESOURCE_GROUP || az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. PostgreSQL Flexible Server
if ! az postgres flexible-server show --resource-group $RESOURCE_GROUP --name $POSTGRES_NAME > /dev/null 2>&1; then
  az postgres flexible-server create \
    --resource-group $RESOURCE_GROUP \
    --name $POSTGRES_NAME \
    --admin-user $POSTGRES_ADMIN \
    --admin-password $POSTGRES_PASSWORD \
    --sku-name Standard_B1ms \
    --storage-size 32 \
    --version 15 \
    --location $LOCATION \
    --public-access 0.0.0.0-255.255.255.255
fi

# 3. Get Postgres connection string
PG_CONN="postgresql://${POSTGRES_ADMIN}@${POSTGRES_NAME}.postgres.database.azure.com:5432/grumpytracker?sslmode=require"

# 4. Container App Environment
az containerapp env show --name $CONTAINERAPP_ENV --resource-group $RESOURCE_GROUP || \
az containerapp env create --name $CONTAINERAPP_ENV --resource-group $RESOURCE_GROUP --location $LOCATION

# 5. Container App (create or update)
if az containerapp show --name $CONTAINERAPP_NAME --resource-group $RESOURCE_GROUP > /dev/null 2>&1; then
  az containerapp update \
    --name $CONTAINERAPP_NAME \
    --resource-group $RESOURCE_GROUP \
    --image $IMAGE \
    --set-env-vars DATABASE_URL=$PG_CONN
else
  az containerapp create \
    --name $CONTAINERAPP_NAME \
    --resource-group $RESOURCE_GROUP \
    --environment $CONTAINERAPP_ENV \
    --image $IMAGE \
    --target-port 3000 \
    --ingress 'external' \
    --env-vars DATABASE_URL=$PG_CONN
fi

# 6. Custom domain and Let's Encrypt certificate
# (Assumes you have set up a CNAME or A record for $DOMAIN_NAME to your Container App's default domain)
az containerapp hostname bind \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINERAPP_NAME \
  --hostname $DOMAIN_NAME \
  --environment $CONTAINERAPP_ENV \
  --certificate-managed

# The certificate will be automatically renewed by Azure.
