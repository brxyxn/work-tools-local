import { expect, test } from "vitest";

import { createMemoryServices } from "./memory";

test("memory payload adapter mirrors create, update, delete, restore, and selection", async () => {
  const services = createMemoryServices();
  const created = await services.payloads.createBatch([
    { name: "first", json: `{"value":1}`, tags: ["a:1", "a:1"] },
    { json: `[2]` },
  ]);

  expect(created).toHaveLength(2);
  expect(created[0].tags).toEqual(["a:1"]);
  expect((await services.workspace.load()).state?.selectedPayloadId).toBe(created[0].id);

  const updated = await services.payloads.update({
    id: created[0].id,
    name: "renamed",
    json: `{"value":3}`,
    tags: [],
  });
  expect(updated).toMatchObject({ name: "renamed", json: `{"value":3}`, tags: [] });

  const removed = await services.payloads.delete([created[0].id]);
  expect(removed.map((payload) => payload.id)).toEqual([created[0].id]);
  expect((await services.workspace.load()).state?.selectedPayloadId).toBe(created[1].id);

  await services.payloads.restore(removed);
  expect((await services.payloads.list()).map((payload) => payload.id)).toContain(created[0].id);
});
