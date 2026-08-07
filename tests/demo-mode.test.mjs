import test from "node:test";
import assert from "node:assert/strict";
import { isDemoModeEnabled } from "../lib/demo-mode-core.ts";

test("demo mode включается только точным локальным флагом в development", () => {
  assert.equal(isDemoModeEnabled("true", "development"), true);
  assert.equal(isDemoModeEnabled("false", "development"), false);
  assert.equal(isDemoModeEnabled("TRUE", "development"), false);
  assert.equal(isDemoModeEnabled(undefined, "development"), false);
});

test("production и test никогда не включают demo mode", () => {
  assert.equal(isDemoModeEnabled("true", "production"), false);
  assert.equal(isDemoModeEnabled("true", "test"), false);
  assert.equal(isDemoModeEnabled("true", undefined), false);
});
