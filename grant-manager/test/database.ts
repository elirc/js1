import pg from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export async function database() {
  const supplied = process.env.ASTRA_TEST_DATABASE_URL;
  if (!supplied)
    throw new Error(
      "Set ASTRA_TEST_DATABASE_URL to a dedicated astra_test_* database.",
    );
  const url = new URL(supplied);
  if (!url.pathname.slice(1).startsWith("astra_test_"))
    throw new Error("Refusing a non-test database.");
  const schema = "astra_" + randomUUID().replaceAll("-", "");
  const admin = new pg.Client({ connectionString: supplied });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  try {
    await admin.query(`SET search_path TO "${schema}", public`);
    // Each schema is fresh. Remove destructive reset statements from the teaching setup script.
    const sql = (
      await readFile(
        new URL("../server/db/schema.sql", import.meta.url),
        "utf8",
      )
    )
      .replace(
        /^DROP (?:TABLE|MATERIALIZED VIEW|VIEW|INDEX|FUNCTION|TRIGGER)[^;]*;/gm,
        "",
      )
      .replace(/^CREATE EXTENSION[^;]*;/gm, "");
    await admin.query(sql);
    url.searchParams.set("options", "-c search_path=" + schema + ",public");
    process.env.DATABASE_URL = url.href;
    const { app } = await import("../server/src/index.js");
    const { pool } = await import("../server/src/db.js");
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const origin = "http://127.0.0.1:" + (server.address() as any).port;
    return {
      admin,
      pool,
      schema,
      origin,
      async close() {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        });
        await pool.end();
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
        await admin.end();
      },
    };
  } catch (error) {
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
    throw error;
  }
}
export async function request(
  origin: string,
  path: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(origin + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, data };
}
