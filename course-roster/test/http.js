import { app } from "../server/server.js";
export async function application() {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    origin: "http://127.0.0.1:" + server.address().port,
    async close() {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    },
  };
}
export async function request(origin, path, method = "GET", body) {
  const response = await fetch(origin + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  };
}
