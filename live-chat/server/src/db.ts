import "dotenv/config";
import pg from "pg";

const { Pool, Client } = pg;

export const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/live_chat";

// Pool for normal request/response queries.
export const pool = new Pool({ connectionString });

export async function query<Row>(text: string, params: unknown[] = []): Promise<Row[]> {
  const result = await pool.query(text, params);
  return result.rows as Row[];
}

// A standalone client is required for LISTEN: it must hold one connection open
// for the lifetime of the process, which a pool cannot guarantee.
export function createListenerClient(): pg.Client {
  return new Client({ connectionString });
}
