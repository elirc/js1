import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/org_explorer"
});

export async function query<Row>(text: string, params: unknown[] = []): Promise<Row[]> {
  const result = await pool.query(text, params);
  return result.rows as Row[];
}
