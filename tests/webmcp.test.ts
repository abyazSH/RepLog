import test from "node:test";
import assert from "node:assert/strict";
import { trainingSummary } from "../lib/webmcp";
import { emptyData } from "../lib/model";
test("summary tool is read-only and rejects unsupported input", () => {
  const data = emptyData();
  const before = JSON.stringify(data);
  assert.deepEqual(trainingSummary(data, {}), {
    sessions: 0,
    completedSets: 0,
    volumeKg: 0,
    activeSession: null,
  });
  assert.equal(JSON.stringify(data), before);
  assert.throws(() => trainingSummary(data, { email: "other@example.com" }));
  assert.throws(() => trainingSummary(data, null));
});
