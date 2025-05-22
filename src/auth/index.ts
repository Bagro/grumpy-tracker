import { Lucia } from "lucia";
import { NodePostgresAdapter } from "@lucia-auth/adapter-postgresql";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const lucia = new Lucia(
  new NodePostgresAdapter(pool, {
    user: "user",
    session: "session",
  })
  // You can add config options as a second argument if needed
);
