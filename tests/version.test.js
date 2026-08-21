const test = require("node:test");
const assert = require("node:assert/strict");

const packageJson = require("../package.json");
const manifest = require("../manifest.json");

test("패키지와 Chrome 확장 버전을 동일한 유효 버전으로 유지한다", () => {
  assert.equal(packageJson.version, manifest.version);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.version, "0.2.0");
});
