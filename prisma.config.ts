import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
    adapter: () => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL environment variable is not set");
      }
      return new PrismaPg({ connectionString });
    },
  },
});
