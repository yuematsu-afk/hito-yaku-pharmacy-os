// test/withTimeout.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { withTimeout, TimeoutError } from "../src/lib/withTimeout.js";

test("withTimeout resolves before timeout", async () => {
  const v = await withTimeout(Promise.resolve(123), 50, "ok");
  assert.equal(v, 123);
});

test("withTimeout throws TimeoutError after timeout", async () => {
  const p = new Promise((resolve) => setTimeout(resolve, 100));
  await assert.rejects(
    () => withTimeout(p, 10, "slow"),
    (err) => err instanceof TimeoutError
  );
});
