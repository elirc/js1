import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
// A calendar date is a label, not a local-midnight timestamp.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/field_service",
});

export async function query<Row>(
  text: string,
  params: unknown[] = [],
): Promise<Row[]> {
  const result = await pool.query(text, params);
  return result.rows as Row[];
}

export async function withTransaction<T>(
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
