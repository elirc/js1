import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { application, request } from "./http.js";
let h;
before(async () => {
  h = await application();
});
after(async () => {
  if (h) await h.close();
});
const call = (path, method = "GET", body = undefined) =>
  request(h.origin, path, method, body);
const valid = {
  company: "AstraHiring",
  role: "Junior developer",
  stage: "Applied",
  contact: "Mentor",
  nextStepDate: "2028-03-10",
  notes: "",
};
test("follow-ups are sorted by date with undated records last and filters composed", async () => {
  await call("/api/applications", "POST", { ...valid, nextStepDate: "" });
  await call("/api/applications", "POST", valid);
  await call("/api/applications", "POST", {
    ...valid,
    nextStepDate: "2028-03-01",
  });
  const result = (
    await call("/api/applications?search=AstraHiring&stage=Applied")
  ).data;
  assert.deepEqual(
    result.map((x) => x.nextStepDate),
    ["2028-03-01", "2028-03-10", ""],
  );
  assert.equal(
    (await call("/api/applications?search=AstraHiring&stage=Offer")).data
      .length,
    0,
  );
});
test("invalid follow-up dates or field types do not overwrite an existing application", async () => {
  const made = await call("/api/applications", "POST", valid);
  for (const bad of [
    { nextStepDate: "2028-02-30" },
    { nextStepDate: [] },
    { company: {} },
    { notes: 42 },
  ])
    assert.equal(
      (
        await call("/api/applications/" + made.data.id, "PUT", {
          ...valid,
          ...bad,
        })
      ).status,
      400,
    );
  assert.deepEqual(
    (await call("/api/applications")).data.find((x) => x.id === made.data.id),
    made.data,
  );
});

test("equal follow-up dates keep a stable id order across requests", async () => {
  for (let i = 0; i < 3; i++)
    assert.equal((await call("/api/applications", "POST", { ...valid, company: "Astrastable", nextStepDate: "2099-05-05" })).status, 201);
  const first = (await call("/api/applications?search=Astrastable")).data.map((x) => x.id);
  const again = (await call("/api/applications?search=Astrastable")).data.map((x) => x.id);
  assert.equal(first.length, 3);
  assert.deepEqual(first, again);
  assert.deepEqual(first, [...first].sort());
});
